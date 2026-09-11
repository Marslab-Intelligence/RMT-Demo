import pool from '../../db.js';

/**
 * Centralized Metrics Engine
 * Aggregates multi-dimensional time series, department scorecards, product/service vectors, and vendor concentration.
 */
export async function getQuarterlyTimeSeries() {
  const query = `
    SELECT 
      TO_CHAR(r.renewal_date, 'YYYY-"Q"Q') as quarter_label,
      EXTRACT(YEAR FROM r.renewal_date)::int as year,
      EXTRACT(QUARTER FROM r.renewal_date)::int as quarter,
      COUNT(r.id)::int as total_contracts,
      COUNT(CASE WHEN r.status = 'Active' THEN 1 END)::int as active_contracts,
      COUNT(CASE WHEN r.status = 'Renewed' OR r.renewal_confirmation = 'renewed' THEN 1 END)::int as renewed_contracts,
      COUNT(CASE WHEN r.status = 'Expired' OR r.renewal_date < CURRENT_DATE THEN 1 END)::int as expired_contracts,
      COALESCE(SUM(r.value), 0)::float as revenue,
      COALESCE(SUM(r.profit), 0)::float as profit,
      CASE 
        WHEN SUM(r.value) > 0 THEN ROUND((SUM(r.profit) / SUM(r.value) * 100)::numeric, 1)::float 
        ELSE 0 
      END as margin_pct,
      COUNT(DISTINCT NULLIF(r.product, ''))::int as distinct_products,
      COUNT(DISTINCT NULLIF(r.vendor, ''))::int as distinct_vendors
    FROM renewals r
    WHERE r.is_deleted = false AND r.renewal_date IS NOT NULL
    GROUP BY quarter_label, year, quarter
    ORDER BY year ASC, quarter ASC
  `;

  const { rows } = await pool.query(query);
  return rows.map((r) => ({
    ...r,
    revenue: parseFloat(r.revenue),
    profit: parseFloat(r.profit),
    margin_pct: parseFloat(r.margin_pct),
  }));
}

export async function getDepartmentMetrics() {
  const query = `
    SELECT 
      d.id as department_id,
      d.name as department_name,
      COUNT(r.id)::int as total_contracts,
      COUNT(CASE WHEN r.status = 'Active' THEN 1 END)::int as active_contracts,
      COUNT(CASE WHEN r.status = 'Expired' OR (r.renewal_date < CURRENT_DATE AND (r.renewal_confirmation IS NULL OR r.renewal_confirmation != 'renewed')) THEN 1 END)::int as at_risk_contracts,
      COALESCE(SUM(r.value), 0)::float as revenue,
      COALESCE(SUM(r.profit), 0)::float as profit,
      CASE 
        WHEN SUM(r.value) > 0 THEN ROUND((SUM(r.profit) / SUM(r.value) * 100)::numeric, 1)::float 
        ELSE 0 
      END as margin_pct,
      COUNT(DISTINCT NULLIF(r.product, ''))::int as product_count,
      COUNT(DISTINCT NULLIF(r.category_id, 0))::int as service_count,
      COUNT(DISTINCT NULLIF(r.vendor, ''))::int as vendor_count
    FROM departments d
    LEFT JOIN renewals r ON r.department_id = d.id AND r.is_deleted = false
    GROUP BY d.id, d.name
    ORDER BY revenue DESC
  `;

  const { rows } = await pool.query(query);
  return rows.map((r) => {
    const total = r.total_contracts || 0;
    const active = r.active_contracts || 0;
    const atRisk = r.at_risk_contracts || 0;
    const margin = r.margin_pct || 0;

    // Explainable health index:
    // 40% retention stability (1 - atRisk/total)
    // 30% margin performance (capped at 30% margin = 100)
    // 30% portfolio scale & activity
    let healthScore = 70;
    if (total > 0) {
      const retentionScore = Math.max(0, Math.min(100, Math.round(((total - atRisk) / total) * 100)));
      const marginScore = Math.max(0, Math.min(100, Math.round((margin / 25) * 100)));
      healthScore = Math.round(retentionScore * 0.5 + marginScore * 0.5);
    }

    let riskLevel = 'Medium';
    if (healthScore >= 75 && atRisk === 0) riskLevel = 'Low';
    else if (healthScore < 60 || atRisk >= 5) riskLevel = 'High';

    return {
      id: r.department_id,
      name: r.department_name,
      revenue: parseFloat(r.revenue),
      profit: parseFloat(r.profit),
      marginPct: parseFloat(r.margin_pct),
      totalContracts: total,
      activeContracts: active,
      atRiskContracts: atRisk,
      productCount: r.product_count,
      serviceCount: r.service_count,
      vendorCount: r.vendor_count,
      healthScore,
      riskLevel,
    };
  });
}

export async function getVendorConcentrationMetrics() {
  const query = `
    SELECT 
      vendor,
      COUNT(id)::int as contract_count,
      COALESCE(SUM(value), 0)::float as total_value,
      COALESCE(SUM(profit), 0)::float as total_profit,
      COUNT(CASE WHEN renewal_date <= (CURRENT_DATE + INTERVAL '45 days')::date AND (status = 'Expired' OR renewal_confirmation IS NULL OR renewal_confirmation != 'renewed') THEN 1 END)::int as imminent_expirations
    FROM renewals
    WHERE is_deleted = false AND vendor IS NOT NULL AND vendor != ''
    GROUP BY vendor
    ORDER BY total_value DESC
  `;

  const { rows } = await pool.query(query);
  const totalPortfolioVal = rows.reduce((acc, v) => acc + parseFloat(v.total_value), 0);

  return rows.map((v) => {
    const val = parseFloat(v.total_value);
    const concentrationPct = totalPortfolioVal > 0 ? Math.round((val / totalPortfolioVal) * 1000) / 10 : 0;
    const isHighDep = concentrationPct >= 20 || v.contract_count >= 8;
    const isHighRisk = v.imminent_expirations > 0;

    let tier = 'Healthy';
    if (isHighDep && isHighRisk) tier = 'Critical';
    else if (isHighDep && !isHighRisk) tier = 'Monitor';
    else if (!isHighDep && isHighRisk) tier = 'Attention';

    return {
      vendor: v.vendor,
      contractCount: v.contract_count,
      totalValue: val,
      totalProfit: parseFloat(v.total_profit),
      concentrationPct,
      imminentExpirations: v.imminent_expirations,
      tier,
      isHighDep,
      isHighRisk,
    };
  });
}

export async function getCompanyOverallHealth() {
  const [quarters, depts, vendors] = await Promise.all([
    getQuarterlyTimeSeries(),
    getDepartmentMetrics(),
    getVendorConcentrationMetrics(),
  ]);

  const activeQuarter = quarters.find(q => q.quarter_label === '2026-Q3') || quarters[quarters.length - 1] || {};

  const totalContracts = activeQuarter.total_contracts || 1;
  const expiredContracts = activeQuarter.expired_contracts || 0;
  const retentionHealth = Math.round(((totalContracts - expiredContracts) / totalContracts) * 100);

  const marginPct = activeQuarter.margin_pct || 0;
  const marginHealth = Math.min(100, Math.round((marginPct / 25) * 100));

  const topVendor = vendors[0] || {};
  const vendorConcentrationPct = topVendor.concentrationPct || 0;
  // If top vendor has > 50% concentration, vendor risk is high (score lower)
  const vendorHealth = Math.max(0, Math.round(100 - (vendorConcentrationPct * 1.2)));

  const activeContractStability = Math.round(((activeQuarter.active_contracts || 0) / totalContracts) * 100);

  // Weighted overall company health score:
  // 30% Retention + 25% Margin + 25% Contract Stability + 20% Vendor Independence
  const score = Math.round(
    retentionHealth * 0.30 +
    marginHealth * 0.25 +
    activeContractStability * 0.25 +
    vendorHealth * 0.20
  );

  let rating = 'Healthy';
  if (score < 60) rating = 'Critical';
  else if (score < 75) rating = 'Attention';
  else if (score < 85) rating = 'Stable';

  return {
    score,
    rating,
    activeQuarterLabel: activeQuarter.quarter_label || 'Current',
    dimensions: [
      { name: 'Renewal Retention Health', score: retentionHealth, weight: '30%', impact: retentionHealth < 65 ? 'negative' : 'positive' },
      { name: 'Profit Margin Performance', score: marginHealth, weight: '25%', impact: marginHealth < 60 ? 'negative' : 'positive' },
      { name: 'Active Contract Stability', score: activeContractStability, weight: '25%', impact: activeContractStability < 60 ? 'negative' : 'positive' },
      { name: 'Vendor Concentration Risk', score: vendorHealth, weight: '20%', impact: vendorHealth < 60 ? 'negative' : 'positive' },
    ],
    summary: `Corporate Operating Health is evaluated at ${score}/100 (${rating}) with ${marginPct}% operating margin and ${retentionHealth}% retention stability.`,
  };
}
