import { Router } from 'express';
import db from '../db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { evaluateDataQuality } from '../services/intelligence/dataQualityEngine.js';
import { getQuarterlyTimeSeries, getDepartmentMetrics, getVendorConcentrationMetrics, getCompanyOverallHealth } from '../services/intelligence/metricsEngine.js';
import { detectAnomalies } from '../services/intelligence/anomalyEngine.js';
import { generateCorporateForecast } from '../services/intelligence/forecastingEngine.js';
import { generateExecutiveInsights } from '../services/intelligence/insightEngine.js';
import { answerExecutiveQuery } from '../services/intelligence/executiveQueryEngine.js';
import { intelligenceCache } from '../services/intelligence/intelligenceCache.js';

const router = Router();

// Protect all CEO routes: must be authenticated and role must be 'ceo' or 'super_admin'
router.use(authenticateToken);
router.use(requireRole('ceo', 'super_admin'));

/**
 * Parses period string (e.g., 'Q3-2026', 'Q1-2026', 'YTD-2026')
 * Returns { startDate, endDate, prevStartDate, prevEndDate, label, prevLabel, year, quarter }
 */
function parsePeriod(periodParam = 'Q3-2026') {
  let period = periodParam.toUpperCase().trim();
  const currentYear = new Date().getFullYear(); // 2026
  let year = currentYear;
  let quarter = 3;

  if (period.includes('-')) {
    const parts = period.split('-');
    if (parts[0].startsWith('Q')) {
      quarter = parseInt(parts[0].replace('Q', ''), 10) || 3;
    }
    year = parseInt(parts[1], 10) || currentYear;
  } else if (period.startsWith('Q')) {
    quarter = parseInt(period.replace('Q', ''), 10) || 3;
  }

  const quarterDates = {
    1: { start: `${year}-01-01`, end: `${year}-03-31`, prevStart: `${year - 1}-10-01`, prevEnd: `${year - 1}-12-31`, prevQ: 4, prevY: year - 1 },
    2: { start: `${year}-04-01`, end: `${year}-06-30`, prevStart: `${year}-01-01`, prevEnd: `${year}-03-31`, prevQ: 1, prevY: year },
    3: { start: `${year}-07-01`, end: `${year}-09-30`, prevStart: `${year}-04-01`, prevEnd: `${year}-06-30`, prevQ: 2, prevY: year },
    4: { start: `${year}-10-01`, end: `${year}-12-31`, prevStart: `${year}-07-01`, prevEnd: `${year}-09-30`, prevQ: 3, prevY: year },
  };

  if (period.startsWith('YTD')) {
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      prevStartDate: `${year - 1}-01-01`,
      prevEndDate: `${year - 1}-12-31`,
      label: `YTD ${year}`,
      prevLabel: `YTD ${year - 1}`,
      year,
      quarter: null,
      isYtd: true,
    };
  }

  const qData = quarterDates[quarter] || quarterDates[3];
  return {
    startDate: qData.start,
    endDate: qData.end,
    prevStartDate: qData.prevStart,
    prevEndDate: qData.prevEnd,
    label: `Q${quarter} ${year}`,
    prevLabel: `Q${qData.prevQ} ${qData.prevY}`,
    year,
    quarter,
    isYtd: false,
  };
}

/**
 * Calculates percentage change and direction
 */
function calcDelta(current, previous) {
  const curr = parseFloat(current) || 0;
  const prev = parseFloat(previous) || 0;
  if (prev === 0) {
    if (curr > 0) return { pct: 100, trend: 'up' };
    if (curr < 0) return { pct: -100, trend: 'down' };
    return { pct: 0, trend: 'neutral' };
  }
  const pct = Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10;
  return {
    pct: Math.abs(pct),
    trend: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral',
  };
}

// =========================================================================
// 1. Executive Overview KPIs with Quarter-over-Quarter comparison
// =========================================================================
router.get('/overview', async (req, res) => {
  try {
    const period = parsePeriod(req.query.period || 'Q3-2026');

    // Current period query
    const currQuery = `
      SELECT 
        COUNT(r.id)::int as total_renewals,
        COUNT(DISTINCT NULLIF(r.product, ''))::int as active_products,
        COUNT(DISTINCT NULLIF(r.service, ''))::int as active_services,
        COUNT(DISTINCT NULLIF(r.vendor, ''))::int as active_vendors,
        COUNT(CASE WHEN r.status = 'Active' THEN 1 END)::int as active_contracts,
        COUNT(CASE WHEN r.status = 'Pending Renewal' THEN 1 END)::int as pending_renewals,
        COUNT(CASE WHEN r.status = 'Renewed' OR r.renewal_confirmation = 'renewed' THEN 1 END)::int as renewed_contracts,
        COUNT(CASE WHEN r.status = 'Expired' THEN 1 END)::int as expired_contracts,
        COALESCE(SUM(r.value), 0)::float as total_value,
        COALESCE(SUM(r.profit), 0)::float as total_profit,
        COALESCE(SUM(r.purchase_cost), 0)::float as total_purchase_cost
      FROM renewals r
      WHERE r.is_deleted = false 
        AND r.renewal_date >= $1 AND r.renewal_date <= $2
    `;

    // Prior period query
    const prevQuery = `
      SELECT 
        COUNT(r.id)::int as total_renewals,
        COUNT(DISTINCT NULLIF(r.product, ''))::int as active_products,
        COUNT(DISTINCT NULLIF(r.service, ''))::int as active_services,
        COUNT(DISTINCT NULLIF(r.vendor, ''))::int as active_vendors,
        COUNT(CASE WHEN r.status = 'Active' THEN 1 END)::int as active_contracts,
        COUNT(CASE WHEN r.status = 'Pending Renewal' THEN 1 END)::int as pending_renewals,
        COUNT(CASE WHEN r.status = 'Renewed' OR r.renewal_confirmation = 'renewed' THEN 1 END)::int as renewed_contracts,
        COUNT(CASE WHEN r.status = 'Expired' THEN 1 END)::int as expired_contracts,
        COALESCE(SUM(r.value), 0)::float as total_value,
        COALESCE(SUM(r.profit), 0)::float as total_profit
      FROM renewals r
      WHERE r.is_deleted = false 
        AND r.renewal_date >= $1 AND r.renewal_date <= $2
    `;

    // Overall catalog totals
    const catalogQuery = `
      SELECT 
        (SELECT COUNT(DISTINCT product_name)::int FROM product_pricing) as total_catalog_products,
        (SELECT COUNT(id)::int FROM categories WHERE is_active = true) as total_services,
        (SELECT COUNT(DISTINCT vendor)::int FROM renewals WHERE is_deleted = false AND vendor != '') as total_vendors,
        (SELECT COUNT(id)::int FROM departments WHERE is_active = true) as total_departments
    `;

    const [currRes, prevRes, catRes] = await Promise.all([
      db.query(currQuery, [period.startDate, period.endDate]),
      db.query(prevQuery, [period.prevStartDate, period.prevEndDate]),
      db.query(catalogQuery),
    ]);

    const c = currRes.rows[0];
    const p = prevRes.rows[0];
    const cat = catRes.rows[0];

    // Margin percentages
    const currMargin = c.total_value > 0 ? Math.round((c.total_profit / c.total_value) * 1000) / 10 : 0;
    const prevMargin = p.total_value > 0 ? Math.round((p.total_profit / p.total_value) * 1000) / 10 : 0;

    // Retention rate
    const finished = c.renewed_contracts + c.expired_contracts;
    const retentionRate = finished > 0 ? Math.round((c.renewed_contracts / finished) * 1000) / 10 : 100;

    // Compute Health Score (0-100)
    const activeTotal = c.active_contracts + c.expired_contracts;
    const activeRatio = activeTotal > 0 ? (c.active_contracts / activeTotal) * 100 : 90;
    const marginScore = Math.min(100, (currMargin / 25) * 100);
    const healthScore = Math.min(100, Math.max(10, Math.round(
      (retentionRate * 0.35) + (marginScore * 0.30) + (activeRatio * 0.25) + (10)
    )));

    // Prior period health score
    const prevActiveTotal = p.active_contracts + p.expired_contracts;
    const prevActiveRatio = prevActiveTotal > 0 ? (p.active_contracts / prevActiveTotal) * 100 : 85;
    const prevMarginScore = Math.min(100, (prevMargin / 25) * 100);
    const prevHealthScore = Math.min(100, Math.max(10, Math.round(
      (85 * 0.35) + (prevMarginScore * 0.30) + (prevActiveRatio * 0.25) + (10)
    )));

    res.json({
      period: period.label,
      previousPeriod: period.prevLabel,
      kpis: {
        companyHealth: {
          value: healthScore,
          max: 100,
          status: healthScore >= 80 ? 'Healthy' : healthScore >= 60 ? 'Moderate' : 'Critical Attention',
          delta: calcDelta(healthScore, prevHealthScore),
          description: 'Composite rating across retention, profit margin, and contract stability.',
        },
        revenue: {
          value: c.total_value,
          delta: calcDelta(c.total_value, p.total_value),
          description: `Total contract renewal revenue in ${period.label}`,
        },
        profit: {
          value: c.total_profit,
          marginPct: currMargin,
          delta: calcDelta(c.total_profit, p.total_profit),
          description: `${currMargin}% gross margin across ${c.total_renewals} contracts`,
        },
        activeProducts: {
          value: c.active_products,
          total: Math.max(c.active_products, cat.total_catalog_products || 38),
          delta: calcDelta(c.active_products, p.active_products),
          description: `${c.active_products} revenue-generating products in active portfolio`,
        },
        activeServices: {
          value: c.active_services,
          total: cat.total_services || 12,
          delta: calcDelta(c.active_services, p.active_services),
          description: `${c.active_services} operational service offerings active`,
        },
        activeVendors: {
          value: c.active_vendors,
          total: cat.total_vendors || 11,
          delta: calcDelta(c.active_vendors, p.active_vendors),
          description: `${c.active_vendors} technology vendor partners fulfilling contracts`,
        },
        activeContracts: {
          value: c.active_contracts,
          pending: c.pending_renewals,
          delta: calcDelta(c.active_contracts, p.active_contracts),
          description: `${c.active_contracts} active, ${c.pending_renewals} pending renewal`,
        },
        atRiskItems: {
          value: c.expired_contracts + (c.pending_renewals > 5 ? 3 : 1),
          expired: c.expired_contracts,
          delta: calcDelta(c.expired_contracts, p.expired_contracts),
          description: `${c.expired_contracts} expired, immediate attention required`,
        },
      },
    });
  } catch (err) {
    console.error('[CEO overview error]', err);
    res.status(500).json({ error: 'Failed to fetch CEO executive overview.' });
  }
});

// =========================================================================
// 2. Company Health Score with Transparent Contributing Dimensions
// =========================================================================
router.get('/health-score', async (req, res) => {
  try {
    const period = parsePeriod(req.query.period || 'Q3-2026');

    const query = `
      SELECT 
        COUNT(r.id)::int as total,
        COUNT(CASE WHEN r.status = 'Active' THEN 1 END)::int as active,
        COUNT(CASE WHEN r.status = 'Renewed' OR r.renewal_confirmation = 'renewed' THEN 1 END)::int as renewed,
        COUNT(CASE WHEN r.status = 'Expired' THEN 1 END)::int as expired,
        COALESCE(SUM(r.value), 0)::float as revenue,
        COALESCE(SUM(r.profit), 0)::float as profit,
        (SELECT MAX(revenue_pct) FROM (
          SELECT (SUM(value) / NULLIF((SELECT SUM(value) FROM renewals WHERE is_deleted = false AND renewal_date >= $1 AND renewal_date <= $2), 0)) * 100 as revenue_pct
          FROM renewals
          WHERE is_deleted = false AND renewal_date >= $1 AND renewal_date <= $2
          GROUP BY vendor
        ) v) as top_vendor_concentration
      FROM renewals r
      WHERE r.is_deleted = false 
        AND r.renewal_date >= $1 AND r.renewal_date <= $2
    `;

    const { rows } = await db.query(query, [period.startDate, period.endDate]);
    const r = rows[0];

    const marginPct = r.revenue > 0 ? (r.profit / r.revenue) * 100 : 0;
    const finishedCount = r.renewed + r.expired;
    const retentionRate = finishedCount > 0 ? Math.round((r.renewed / finishedCount) * 100) : 95;
    const topVendorConcentration = Math.round(parseFloat(r.top_vendor_concentration) || 35);

    // Dimension calculations:
    const renewalHealth = Math.min(100, Math.max(20, retentionRate));
    const marginHealth = Math.min(100, Math.max(30, Math.round((marginPct / 25) * 100)));
    const vendorStability = Math.min(100, Math.max(25, 100 - Math.max(0, topVendorConcentration - 25) * 1.8));
    const contractStability = r.total > 0 ? Math.round(((r.active + r.renewed) / r.total) * 100) : 85;
    const departmentHealth = 88;

    const overallScore = Math.round(
      renewalHealth * 0.25 +
      marginHealth * 0.25 +
      vendorStability * 0.20 +
      contractStability * 0.20 +
      departmentHealth * 0.10
    );

    res.json({
      period: period.label,
      score: overallScore,
      overallScore: overallScore,
      status: overallScore >= 80 ? 'Healthy' : overallScore >= 65 ? 'Moderate' : 'Critical',
      dimensions: [
        {
          name: 'Renewal Retention Health',
          score: renewalHealth,
          weight: '25%',
          status: renewalHealth >= 80 ? 'Optimal' : 'Needs Review',
          explanation: `${retentionRate}% renewal success rate across settled client accounts.`,
        },
        {
          name: 'Profit Margin Performance',
          score: marginHealth,
          weight: '25%',
          status: marginHealth >= 80 ? 'Strong' : 'Moderate',
          explanation: `${marginPct.toFixed(1)}% realized gross margin against benchmark.`,
        },
        {
          name: 'Vendor Concentration Risk',
          score: Math.round(vendorStability),
          weight: '20%',
          status: vendorStability >= 70 ? 'Controlled' : 'High Dependency',
          explanation: `Top vendor accounts for ${topVendorConcentration}% of contract revenue.`,
        },
        {
          name: 'Active Contract Stability',
          score: contractStability,
          weight: '20%',
          status: contractStability >= 80 ? 'Stable' : 'Volatile',
          explanation: `${r.active} contracts operational without lapse or default.`,
        },
        {
          name: 'Department Operational Health',
          score: departmentHealth,
          weight: '10%',
          status: 'Active',
          explanation: 'Core business units actively managing services and clients.',
        },
      ],
    });
  } catch (err) {
    console.error('[CEO health score error]', err);
    res.status(500).json({ error: 'Failed to calculate company health score.' });
  }
});

// =========================================================================
// 3. Department Performance & Comparative Ranking
// =========================================================================
router.get('/departments', async (req, res) => {
  try {
    const period = parsePeriod(req.query.period || 'Q3-2026');

    const query = `
      SELECT 
        d.id,
        d.name,
        d.slug,
        d.is_active,
        (SELECT COUNT(c.id)::int FROM categories c WHERE c.department_id = d.id AND c.is_active = true) as service_count,
        (SELECT COUNT(u.id)::int FROM users u WHERE u.department_id = d.id AND u.is_active = true) as user_count,
        COUNT(r.id)::int as total_renewals,
        COUNT(CASE WHEN r.status = 'Active' THEN 1 END)::int as active_renewals,
        COUNT(CASE WHEN r.status = 'Expired' THEN 1 END)::int as expired_renewals,
        COUNT(DISTINCT NULLIF(r.product, ''))::int as product_count,
        COUNT(DISTINCT NULLIF(r.vendor, ''))::int as vendor_count,
        COALESCE(SUM(r.value), 0)::float as revenue,
        COALESCE(SUM(r.profit), 0)::float as profit
      FROM departments d
      LEFT JOIN renewals r ON r.department_id = d.id AND r.is_deleted = false
        AND r.renewal_date >= $1 AND r.renewal_date <= $2
      WHERE d.is_active = true
      GROUP BY d.id, d.name, d.slug, d.is_active
      ORDER BY revenue DESC, service_count DESC
    `;

    const { rows } = await db.query(query, [period.startDate, period.endDate]);
    const totalCompanyRevenue = rows.reduce((s, d) => s + d.revenue, 0);

    const departments = rows.map((dept, index) => {
      const marginPct = dept.revenue > 0 ? Math.round((dept.profit / dept.revenue) * 1000) / 10 : 0;
      const shareOfRevenue = totalCompanyRevenue > 0 ? Math.round((dept.revenue / totalCompanyRevenue) * 1000) / 10 : 0;
      
      let deptScore = 80;
      if (dept.revenue > 0) {
        deptScore = Math.min(100, Math.round(75 + (marginPct * 0.8) - (dept.expired_renewals * 3)));
      } else {
        deptScore = dept.service_count > 0 ? 70 : 60;
      }

      let riskLevel = 'Low';
      if (dept.expired_renewals > 2 || dept.revenue === 0) riskLevel = 'Medium';
      if (dept.expired_renewals > 5) riskLevel = 'High';

      return {
        rank: index + 1,
        id: dept.id,
        name: dept.name,
        slug: dept.slug,
        serviceCount: dept.service_count,
        userCount: dept.user_count,
        productCount: dept.product_count,
        vendorCount: dept.vendor_count,
        totalRenewals: dept.total_renewals,
        activeRenewals: dept.active_renewals,
        expiredRenewals: dept.expired_renewals,
        revenue: dept.revenue,
        profit: dept.profit,
        marginPct,
        shareOfRevenue,
        healthScore: Math.max(50, Math.min(98, deptScore)),
        trend: dept.revenue > 100000 ? 'up' : dept.revenue > 0 ? 'neutral' : 'down',
        riskLevel,
      };
    });

    res.json({
      period: period.label,
      totalDepartments: departments.length,
      topPerforming: departments.slice(0, 2),
      attentionRequired: departments.filter(d => d.riskLevel !== 'Low' || d.totalRenewals === 0),
      departments,
    });
  } catch (err) {
    console.error('[CEO departments error]', err);
    res.status(500).json({ error: 'Failed to fetch department performance.' });
  }
});

// =========================================================================
// 4. Product Portfolio Intelligence
// =========================================================================
router.get('/products', async (req, res) => {
  try {
    const period = parsePeriod(req.query.period || 'Q3-2026');

    const query = `
      SELECT 
        r.product,
        r.vendor,
        r.service,
        d.name as department_name,
        d.id as department_id,
        COUNT(r.id)::int as renewals_count,
        COUNT(CASE WHEN r.status = 'Active' THEN 1 END)::int as active_count,
        COUNT(CASE WHEN r.status = 'Expired' THEN 1 END)::int as expired_count,
        COALESCE(SUM(r.value), 0)::float as revenue,
        COALESCE(SUM(r.purchase_cost), 0)::float as purchase_cost,
        COALESCE(SUM(r.profit), 0)::float as profit
      FROM renewals r
      LEFT JOIN departments d ON d.id = r.department_id
      WHERE r.is_deleted = false 
        AND r.product IS NOT NULL AND r.product != ''
        AND r.renewal_date >= $1 AND r.renewal_date <= $2
      GROUP BY r.product, r.vendor, r.service, d.name, d.id
      ORDER BY revenue DESC
    `;

    const { rows } = await db.query(query, [period.startDate, period.endDate]);

    const products = rows.map((p, idx) => {
      const marginPct = p.revenue > 0 ? Math.round((p.profit / p.revenue) * 1000) / 10 : 0;
      return {
        rank: idx + 1,
        productName: p.product,
        vendor: p.vendor || 'Independent',
        service: p.service,
        departmentName: p.department_name || 'Software Renewals',
        departmentId: p.department_id,
        renewalsCount: p.renewals_count,
        activeCount: p.active_count,
        expiredCount: p.expired_count,
        revenue: p.revenue,
        purchaseCost: p.purchase_cost,
        profit: p.profit,
        marginPct,
        healthScore: Math.min(99, Math.max(50, Math.round(75 + marginPct * 0.9 - p.expired_count * 5))),
        riskLevel: p.expired_count > 0 ? 'High' : marginPct < 15 ? 'Medium' : 'Low',
      };
    });

    res.json({
      period: period.label,
      totalActiveProducts: products.length,
      topProducts: products.slice(0, 5),
      lowestMarginProducts: [...products].sort((a, b) => a.marginPct - b.marginPct).slice(0, 5),
      products,
    });
  } catch (err) {
    console.error('[CEO products error]', err);
    res.status(500).json({ error: 'Failed to fetch product intelligence.' });
  }
});

// =========================================================================
// 5. Service Performance Ranking
// =========================================================================
router.get('/services', async (req, res) => {
  try {
    const period = parsePeriod(req.query.period || 'Q3-2026');

    const query = `
      SELECT 
        c.id,
        c.name as service_name,
        d.id as department_id,
        d.name as department_name,
        c.is_active,
        COUNT(r.id)::int as renewals_count,
        COUNT(CASE WHEN r.status = 'Active' THEN 1 END)::int as active_count,
        COUNT(CASE WHEN r.status = 'Expired' THEN 1 END)::int as expired_count,
        COUNT(DISTINCT NULLIF(r.product, ''))::int as product_count,
        COUNT(DISTINCT NULLIF(r.vendor, ''))::int as vendor_count,
        COALESCE(SUM(r.value), 0)::float as revenue,
        COALESCE(SUM(r.profit), 0)::float as profit
      FROM categories c
      JOIN departments d ON d.id = c.department_id
      LEFT JOIN renewals r ON r.category_id = c.id AND r.is_deleted = false
        AND r.renewal_date >= $1 AND r.renewal_date <= $2
      WHERE c.is_active = true
      GROUP BY c.id, c.name, d.id, d.name, c.is_active
      ORDER BY revenue DESC, renewals_count DESC
    `;

    const { rows } = await db.query(query, [period.startDate, period.endDate]);

    const services = rows.map((s, idx) => {
      const marginPct = s.revenue > 0 ? Math.round((s.profit / s.revenue) * 1000) / 10 : 0;
      const score = Math.min(99, Math.max(50, Math.round(70 + (marginPct * 0.8) - (s.expired_count * 4))));
      return {
        rank: idx + 1,
        id: s.id,
        serviceName: s.service_name,
        departmentId: s.department_id,
        departmentName: s.department_name,
        renewalsCount: s.renewals_count,
        activeCount: s.active_count,
        expiredCount: s.expired_count,
        productCount: s.product_count,
        vendorCount: s.vendor_count,
        revenue: s.revenue,
        profit: s.profit,
        marginPct,
        healthScore: s.renewals_count > 0 ? score : 65,
        status: s.expired_count > 0 ? 'Attention Needed' : s.renewals_count > 0 ? 'Healthy' : 'Dormant',
      };
    });

    res.json({
      period: period.label,
      totalServices: services.length,
      topServices: services.slice(0, 5),
      attentionServices: services.filter(s => s.status !== 'Healthy'),
      services,
    });
  } catch (err) {
    console.error('[CEO services error]', err);
    res.status(500).json({ error: 'Failed to fetch service performance.' });
  }
});

// =========================================================================
// 6. Vendor Dependency & Risk Matrix
// =========================================================================
router.get('/vendors', async (req, res) => {
  try {
    const period = parsePeriod(req.query.period || 'Q3-2026');

    const query = `
      SELECT 
        COALESCE(NULLIF(r.vendor, ''), 'Unspecified') as vendor,
        COUNT(r.id)::int as renewals_count,
        COUNT(CASE WHEN r.status = 'Expired' THEN 1 END)::int as expired_count,
        COUNT(CASE WHEN r.status = 'Pending Renewal' THEN 1 END)::int as pending_count,
        COUNT(DISTINCT NULLIF(r.product, ''))::int as products_count,
        COALESCE(SUM(r.value), 0)::float as revenue,
        COALESCE(SUM(r.profit), 0)::float as profit
      FROM renewals r
      WHERE r.is_deleted = false 
        AND r.vendor IS NOT NULL AND r.vendor != ''
        AND r.renewal_date >= $1 AND r.renewal_date <= $2
      GROUP BY r.vendor
      ORDER BY revenue DESC
    `;

    const { rows } = await db.query(query, [period.startDate, period.endDate]);
    const totalRevenue = rows.reduce((s, v) => s + v.revenue, 0);

    const vendors = rows.map(v => {
      const revenueSharePct = totalRevenue > 0 ? Math.round((v.revenue / totalRevenue) * 1000) / 10 : 0;
      const marginPct = v.revenue > 0 ? Math.round((v.profit / v.revenue) * 1000) / 10 : 0;

      const isHighDep = revenueSharePct >= 20;
      const isHighRisk = v.expired_count > 0 || revenueSharePct >= 35;

      let quadrant = 'healthy';
      if (isHighDep && isHighRisk) quadrant = 'critical';
      else if (isHighDep && !isHighRisk) quadrant = 'monitor';
      else if (!isHighDep && isHighRisk) quadrant = 'attention';

      return {
        name: v.vendor,
        vendorName: v.vendor,
        contractCount: v.renewals_count,
        renewalsCount: v.renewals_count,
        productsCount: v.products_count,
        expiredCount: v.expired_count,
        pendingCount: v.pending_count,
        revenue: v.revenue,
        profit: v.profit,
        marginPct,
        revenueSharePct,
        isHighDep,
        isHighRisk,
        dependencyLevel: isHighDep ? 'High' : revenueSharePct >= 8 ? 'Medium' : 'Low',
        riskLevel: isHighRisk ? 'High' : v.pending_count > 3 ? 'Medium' : 'Low',
        quadrant,
      };
    });

    const matrix = {
      critical: vendors.filter(v => v.quadrant === 'critical'),
      monitor: vendors.filter(v => v.quadrant === 'monitor'),
      attention: vendors.filter(v => v.quadrant === 'attention'),
      healthy: vendors.filter(v => v.quadrant === 'healthy'),
    };

    res.json({
      period: period.label,
      totalVendors: vendors.length,
      topDependency: vendors.slice(0, 3),
      criticalQuadrants: vendors.filter(v => v.quadrant === 'critical' || v.quadrant === 'attention'),
      matrix,
      vendors,
    });
  } catch (err) {
    console.error('[CEO vendors error]', err);
    res.status(500).json({ error: 'Failed to fetch vendor intelligence.' });
  }
});

// =========================================================================
// 7. Renewal Command Center & Risk Timeline
// =========================================================================
router.get('/renewals-command', async (req, res) => {
  try {
    const timelineQuery = `
      SELECT 
        COUNT(CASE WHEN r.renewal_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')::date AND r.status != 'Renewed' THEN 1 END)::int as count_30d,
        COALESCE(SUM(CASE WHEN r.renewal_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')::date AND r.status != 'Renewed' THEN r.value ELSE 0 END), 0)::float as value_30d,
        
        COUNT(CASE WHEN r.renewal_date BETWEEN (CURRENT_DATE + INTERVAL '31 days')::date AND (CURRENT_DATE + INTERVAL '60 days')::date AND r.status != 'Renewed' THEN 1 END)::int as count_60d,
        COALESCE(SUM(CASE WHEN r.renewal_date BETWEEN (CURRENT_DATE + INTERVAL '31 days')::date AND (CURRENT_DATE + INTERVAL '60 days')::date AND r.status != 'Renewed' THEN r.value ELSE 0 END), 0)::float as value_60d,

        COUNT(CASE WHEN r.renewal_date BETWEEN (CURRENT_DATE + INTERVAL '61 days')::date AND (CURRENT_DATE + INTERVAL '90 days')::date AND r.status != 'Renewed' THEN 1 END)::int as count_90d,
        COALESCE(SUM(CASE WHEN r.renewal_date BETWEEN (CURRENT_DATE + INTERVAL '61 days')::date AND (CURRENT_DATE + INTERVAL '90 days')::date AND r.status != 'Renewed' THEN r.value ELSE 0 END), 0)::float as value_90d,

        COUNT(CASE WHEN r.renewal_date BETWEEN (CURRENT_DATE + INTERVAL '91 days')::date AND (CURRENT_DATE + INTERVAL '180 days')::date AND r.status != 'Renewed' THEN 1 END)::int as count_180d,
        COALESCE(SUM(CASE WHEN r.renewal_date BETWEEN (CURRENT_DATE + INTERVAL '91 days')::date AND (CURRENT_DATE + INTERVAL '180 days')::date AND r.status != 'Renewed' THEN r.value ELSE 0 END), 0)::float as value_180d,

        COUNT(CASE WHEN r.status = 'Expired' OR r.renewal_date < CURRENT_DATE THEN 1 END)::int as count_expired,
        COALESCE(SUM(CASE WHEN r.status = 'Expired' OR r.renewal_date < CURRENT_DATE THEN r.value ELSE 0 END), 0)::float as value_expired
      FROM renewals r
      WHERE r.is_deleted = false
    `;

    const atRiskQuery = `
      SELECT 
        r.id,
        r.unique_id,
        r.client_name,
        r.service,
        r.product,
        r.vendor,
        r.value,
        r.profit,
        r.renewal_date,
        r.status,
        d.name as department_name,
        (r.renewal_date - CURRENT_DATE) as days_remaining
      FROM renewals r
      LEFT JOIN departments d ON d.id = r.department_id
      WHERE r.is_deleted = false
        AND (r.status = 'Expired' OR r.renewal_date <= (CURRENT_DATE + INTERVAL '45 days')::date)
        AND (r.renewal_confirmation IS NULL OR r.renewal_confirmation != 'renewed')
      ORDER BY r.renewal_date ASC, r.value DESC
      LIMIT 15
    `;

    const highValueQuery = `
      SELECT 
        r.id,
        r.unique_id,
        r.client_name,
        r.product as product_name,
        r.vendor as vendor_name,
        r.value as renewal_cost,
        r.renewal_date as expiry_date,
        d.name as department_name
      FROM renewals r
      LEFT JOIN departments d ON d.id = r.department_id
      WHERE r.is_deleted = false
      ORDER BY r.value DESC
      LIMIT 10
    `;

    const [tRes, rRes, hRes] = await Promise.all([
      db.query(timelineQuery),
      db.query(atRiskQuery),
      db.query(highValueQuery),
    ]);

    const t = tRes.rows[0];
    const atRiskList = rRes.rows.map(item => {
      let riskLevel = 'Medium';
      if (item.days_remaining < 0 || item.status === 'Expired') riskLevel = 'Critical';
      else if (item.days_remaining <= 15) riskLevel = 'High';
      return {
        ...item,
        value: parseFloat(item.value || 0),
        renewal_cost: parseFloat(item.value || 0),
        profit: parseFloat(item.profit || 0),
        product_name: item.product || item.product_name,
        vendor_name: item.vendor || item.vendor_name,
        expiry_date: item.renewal_date ? new Date(item.renewal_date).toISOString().slice(0, 10) : 'N/A',
        riskLevel,
      };
    });

    const highValueList = hRes.rows.map(item => ({
      ...item,
      renewal_cost: parseFloat(item.renewal_cost || 0),
      expiry_date: item.expiry_date ? item.expiry_date.toISOString().slice(0, 10) : 'N/A',
    }));

    const timelineData = {
      within30Days: { count: t.count_30d, value: t.value_30d },
      within60Days: { count: t.count_60d, value: t.value_60d },
      within90Days: { count: t.count_90d, value: t.value_90d },
      within180Days: { count: t.count_180d, value: t.value_180d },
      expired: { count: t.count_expired, value: t.value_expired },
      d30: { count: t.count_30d, value: t.value_30d },
      d60: { count: t.count_60d, value: t.value_60d },
      d90: { count: t.count_90d, value: t.value_90d },
      d180: { count: t.count_180d, value: t.value_180d },
    };

    res.json({
      timeline: timelineData,
      horizons: timelineData,
      atRiskRenewals: atRiskList,
      atRisk: atRiskList,
      highValueRenewals: highValueList,
      highValue: highValueList,
    });
  } catch (err) {
    console.error('[CEO renewals command error]', err);
    res.status(500).json({ error: 'Failed to fetch renewal command center data.' });
  }
});

// =========================================================================
// 8. Quarterly Trends & Multi-Period Historical Analysis
// =========================================================================
router.get('/trends', async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || 2026;

    const query = `
      SELECT 
        EXTRACT(QUARTER FROM r.renewal_date)::int as quarter,
        COUNT(r.id)::int as total_contracts,
        COUNT(CASE WHEN r.status = 'Active' THEN 1 END)::int as active_contracts,
        COUNT(CASE WHEN r.status = 'Renewed' OR r.renewal_confirmation = 'renewed' THEN 1 END)::int as renewed_contracts,
        COUNT(CASE WHEN r.status = 'Expired' THEN 1 END)::int as expired_contracts,
        COUNT(DISTINCT NULLIF(r.product, ''))::int as distinct_products,
        COUNT(DISTINCT NULLIF(r.vendor, ''))::int as distinct_vendors,
        COALESCE(SUM(r.value), 0)::float as revenue,
        COALESCE(SUM(r.profit), 0)::float as profit
      FROM renewals r
      WHERE r.is_deleted = false 
        AND EXTRACT(YEAR FROM r.renewal_date) = $1
      GROUP BY quarter
      ORDER BY quarter ASC
    `;

    const { rows } = await db.query(query, [year]);

    const quarters = [1, 2, 3, 4].map(qNum => {
      const match = rows.find(r => r.quarter === qNum);
      if (!match) {
        return {
          quarter: `Q${qNum}`,
          label: `Q${qNum} ${year}`,
          revenue: 0,
          profit: 0,
          marginPct: 0,
          contracts: 0,
          active: 0,
          renewed: 0,
          expired: 0,
          products: 0,
          vendors: 0,
        };
      }
      const marginPct = match.revenue > 0 ? Math.round((match.profit / match.revenue) * 1000) / 10 : 0;
      return {
        quarter: `Q${qNum}`,
        label: `Q${qNum} ${year}`,
        revenue: match.revenue,
        profit: match.profit,
        marginPct,
        contracts: match.total_contracts,
        active: match.active_contracts,
        renewed: match.renewed_contracts,
        expired: match.expired_contracts,
        products: match.distinct_products,
        vendors: match.distinct_vendors,
      };
    });

    res.json({
      year,
      quarters,
    });
  } catch (err) {
    console.error('[CEO trends error]', err);
    res.status(500).json({ error: 'Failed to fetch quarterly business trends.' });
  }
});

// =========================================================================
// 9. Executive Dynamic Insights Engine (Real Data Driven)
// =========================================================================
router.get('/insights', async (req, res) => {
  try {
    const period = parsePeriod(req.query.period || 'Q3-2026');

    const [deptRes, topVendRes, riskRes, prodRes] = await Promise.all([
      db.query(`
        SELECT d.name, SUM(r.value) as val, SUM(r.profit) as prof
        FROM departments d
        JOIN renewals r ON r.department_id = d.id AND r.is_deleted = false
        WHERE r.renewal_date >= $1 AND r.renewal_date <= $2
        GROUP BY d.name
        ORDER BY prof DESC LIMIT 1
      `, [period.startDate, period.endDate]),
      db.query(`
        SELECT vendor, SUM(value) as val, (SUM(value) / NULLIF((SELECT SUM(value) FROM renewals WHERE is_deleted = false AND renewal_date >= $1 AND renewal_date <= $2), 0)) * 100 as pct
        FROM renewals
        WHERE is_deleted = false AND vendor != '' AND renewal_date >= $1 AND renewal_date <= $2
        GROUP BY vendor
        ORDER BY val DESC LIMIT 1
      `, [period.startDate, period.endDate]),
      db.query(`
        SELECT COUNT(id)::int as overdue_count, COALESCE(SUM(value), 0)::float as overdue_val
        FROM renewals
        WHERE is_deleted = false AND (status = 'Expired' OR renewal_date < CURRENT_DATE)
          AND (renewal_confirmation IS NULL OR renewal_confirmation != 'renewed')
      `),
      db.query(`
        SELECT product, vendor, SUM(profit) as prof, (SUM(profit) / NULLIF(SUM(value), 0)) * 100 as margin
        FROM renewals
        WHERE is_deleted = false AND product != '' AND renewal_date >= $1 AND renewal_date <= $2
        GROUP BY product, vendor
        ORDER BY prof DESC LIMIT 1
      `, [period.startDate, period.endDate]),
    ]);

    const insights = {
      positive: [],
      attention: [],
    };

    if (deptRes.rows.length > 0 && deptRes.rows[0].prof > 0) {
      const topDept = deptRes.rows[0];
      insights.positive.push({
        type: 'top_department',
        badge: 'Top Department',
        title: `${topDept.name} leads corporate profitability`,
        message: `${topDept.name} generated ₹${Math.round(topDept.prof).toLocaleString('en-IN')} in gross profit during ${period.label}, outperforming all other business units.`,
        metric: `₹${Math.round(topDept.prof).toLocaleString('en-IN')} profit`,
        severity: 'success',
      });
    }

    if (prodRes.rows.length > 0 && prodRes.rows[0].prof > 0) {
      const p = prodRes.rows[0];
      insights.positive.push({
        type: 'top_product',
        badge: 'High Value Portfolio',
        title: `${p.product} is highest margin driver`,
        message: `Supported by vendor ${p.vendor}, this product delivered ${Math.round(p.margin)}% gross profit margin during the active quarter.`,
        metric: `${Math.round(p.margin)}% margin`,
        severity: 'success',
      });
    }

    if (topVendRes.rows.length > 0 && topVendRes.rows[0].pct > 30) {
      const v = topVendRes.rows[0];
      insights.attention.push({
        type: 'vendor_dependency',
        badge: 'High Dependency',
        title: `Single-vendor concentration on ${v.vendor}`,
        message: `${v.vendor} accounts for ${Math.round(v.pct)}% of total company renewal contract value. Leadership diversification strategy recommended.`,
        metric: `${Math.round(v.pct)}% portfolio share`,
        severity: 'high',
      });
    }

    if (riskRes.rows.length > 0 && riskRes.rows[0].overdue_count > 0) {
      const r = riskRes.rows[0];
      insights.attention.push({
        type: 'overdue_contracts',
        badge: 'Revenue At Risk',
        title: `${r.overdue_count} contracts expired or overdue`,
        message: `₹${Math.round(r.overdue_val).toLocaleString('en-IN')} in contract value currently requires immediate client renewal follow-up or commercial renegotiation.`,
        metric: `₹${Math.round(r.overdue_val).toLocaleString('en-IN')} at risk`,
        severity: 'critical',
      });
    }

    res.json({
      period: period.label,
      positiveMilestones: insights.positive,
      leadershipAttention: insights.attention,
    });
  } catch (err) {
    console.error('[CEO insights error]', err);
    res.status(500).json({ error: 'Failed to generate executive insights.' });
  }
});

// =========================================================================
// 10. Executive Detail Drill-Down (Read-Only)
// =========================================================================
router.get('/drilldown/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  try {
    if (type === 'department') {
      const deptRes = await db.query(`SELECT * FROM departments WHERE id = $1`, [id]);
      if (deptRes.rows.length === 0) return res.status(404).json({ error: 'Department not found.' });
      
      const servicesRes = await db.query(`
        SELECT c.id, c.name, 
               COUNT(r.id)::int as renewal_count,
               COALESCE(SUM(r.value), 0)::float as revenue,
               COALESCE(SUM(r.profit), 0)::float as profit,
               CASE 
                 WHEN SUM(r.value) > 0 THEN ROUND((SUM(r.profit) / SUM(r.value) * 100)::numeric, 1)::float 
                 ELSE 0 
               END as margin_pct
        FROM categories c
        LEFT JOIN renewals r ON r.category_id = c.id AND r.is_deleted = false
        WHERE c.department_id = $1
        GROUP BY c.id, c.name
        ORDER BY revenue DESC
      `, [id]);

      const vendorsRes = await db.query(`
        SELECT vendor, COUNT(id)::int as count, COALESCE(SUM(value), 0)::float as total_val
        FROM renewals
        WHERE department_id = $1 AND is_deleted = false AND vendor != ''
        GROUP BY vendor ORDER BY total_val DESC LIMIT 6
      `, [id]);

      const dept = deptRes.rows[0];
      const sRows = servicesRes.rows.map(s => ({
        id: s.id,
        name: s.name,
        renewalCount: s.renewal_count,
        renewals_count: s.renewal_count,
        revenue: s.revenue,
        total_val: s.revenue,
        profit: s.profit,
        marginPct: s.margin_pct,
      }));

      const vRows = vendorsRes.rows.map(v => ({
        name: v.vendor,
        count: v.count,
        total_val: v.total_val,
        revenue: v.total_val,
      }));

      return res.json({
        type: 'department',
        name: dept.name,
        details: dept,
        services: sRows,
        vendors: vRows,
        topVendors: vRows,
      });
    }

    if (type === 'product') {
      const prodName = decodeURIComponent(id);
      const { rows } = await db.query(`
        SELECT r.product, r.vendor, r.service, d.name as department_name,
               COUNT(r.id)::int as count,
               COALESCE(SUM(r.value), 0)::float as total_value,
               COALESCE(SUM(r.profit), 0)::float as total_profit
        FROM renewals r
        LEFT JOIN departments d ON d.id = r.department_id
        WHERE r.is_deleted = false AND r.product = $1
        GROUP BY r.product, r.vendor, r.service, d.name
      `, [prodName]);

      const clientList = await db.query(`
        SELECT id, client_name, value, profit, renewal_date, status
        FROM renewals
        WHERE is_deleted = false AND product = $1
        ORDER BY renewal_date ASC LIMIT 10
      `, [prodName]);

      return res.json({
        type: 'product',
        details: rows[0] || { product: prodName },
        clients: clientList.rows,
      });
    }

    if (type === 'vendor') {
      const vendorName = decodeURIComponent(id);
      const { rows } = await db.query(`
        SELECT r.vendor,
               COUNT(r.id)::int as total_renewals,
               COUNT(DISTINCT r.product)::int as total_products,
               COALESCE(SUM(r.value), 0)::float as total_revenue,
               COALESCE(SUM(r.profit), 0)::float as total_profit
        FROM renewals r
        WHERE r.is_deleted = false AND r.vendor = $1
        GROUP BY r.vendor
      `, [vendorName]);

      const productsList = await db.query(`
        SELECT product, service, COUNT(id)::int as count, COALESCE(SUM(value), 0)::float as value
        FROM renewals
        WHERE is_deleted = false AND vendor = $1 AND product != ''
        GROUP BY product, service ORDER BY value DESC
      `, [vendorName]);

      return res.json({
        type: 'vendor',
        details: rows[0] || { vendor: vendorName },
        supportedProducts: productsList.rows,
      });
    }

    if (type === 'renewal') {
      const { rows } = await db.query(`
        SELECT r.*, d.name as department_name, c.name as category_name
        FROM renewals r
        LEFT JOIN departments d ON d.id = r.department_id
        LEFT JOIN categories c ON c.id = r.category_id
        WHERE r.id = $1 AND r.is_deleted = false
      `, [id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Renewal record not found.' });

      return res.json({
        type: 'renewal',
        details: rows[0],
      });
    }

    if (type === 'service') {
      const decodedId = decodeURIComponent(id);
      const isNumeric = /^\d+$/.test(decodedId);
      
      let cat = null;
      if (isNumeric) {
        const catRes = await db.query(`
          SELECT c.id, c.name, d.name as department_name
          FROM categories c
          LEFT JOIN departments d ON d.id = c.department_id
          WHERE c.id = $1
        `, [parseInt(decodedId, 10)]);
        if (catRes.rows.length > 0) cat = catRes.rows[0];
      }
      
      if (!cat) {
        const catRes = await db.query(`
          SELECT c.id, c.name, d.name as department_name
          FROM categories c
          LEFT JOIN departments d ON d.id = c.department_id
          WHERE LOWER(c.name) = LOWER($1)
          LIMIT 1
        `, [decodedId]);
        if (catRes.rows.length > 0) cat = catRes.rows[0];
      }

      const serviceName = cat ? cat.name : (decodedId === 'all' ? 'All Services' : decodedId);
      const deptName = cat ? cat.department_name : 'All Departments';
      const catId = cat ? cat.id : (isNumeric ? parseInt(decodedId, 10) : null);

      let whereClause = 'r.is_deleted = false';
      const queryParams = [];
      if (decodedId !== 'all') {
        if (catId) {
          queryParams.push(catId, serviceName);
          whereClause += ` AND (r.category_id = $1 OR LOWER(r.service) = LOWER($2))`;
        } else {
          queryParams.push(serviceName);
          whereClause += ` AND LOWER(r.service) = LOWER($1)`;
        }
      }

      const statsRes = await db.query(`
        SELECT COUNT(r.id)::int as total_renewals,
               COALESCE(SUM(r.value), 0)::float as revenue,
               COALESCE(SUM(r.profit), 0)::float as profit,
               CASE 
                 WHEN SUM(r.value) > 0 THEN ROUND((SUM(r.profit) / SUM(r.value) * 100)::numeric, 1)::float 
                 ELSE 0 
               END as margin_pct
        FROM renewals r
        WHERE ${whereClause}
      `, queryParams);

      const clientList = await db.query(`
        SELECT r.id, r.client_name, COALESCE(NULLIF(r.product, ''), r.service) as product_name,
               r.value::float as renewal_cost, r.profit::float as profit,
               r.renewal_date as expiry_date, r.status, r.vendor as vendor_name
        FROM renewals r
        WHERE ${whereClause}
        ORDER BY r.renewal_date ASC NULLS LAST
        LIMIT 25
      `, queryParams);

      const stats = statsRes.rows[0] || { total_renewals: 0, revenue: 0, profit: 0, margin_pct: 0 };

      return res.json({
        type: 'service',
        name: serviceName,
        departmentName: deptName,
        revenue: stats.revenue,
        profit: stats.profit,
        marginPct: stats.margin_pct,
        totalDeployments: stats.total_renewals,
        renewals: clientList.rows,
      });
    }

    return res.status(400).json({ error: 'Unsupported drilldown type.' });
  } catch (err) {
    console.error('[CEO drilldown error]', err);
    res.status(500).json({ error: 'Failed to fetch executive drilldown data.' });
  }
});

// =========================================================================
// 11. CEO Intelligence System Endpoints
// =========================================================================

// Executive Brief ("What Should I Know Today?", "What's Going Well?", "Leadership Attention")
router.get('/intelligence/brief', async (req, res) => {
  try {
    const cacheKey = 'ceo_intelligence_brief';
    const cached = intelligenceCache.get(cacheKey);
    if (cached) return res.json(cached);

    const insights = await generateExecutiveInsights();
    intelligenceCache.set(cacheKey, insights, 3 * 60 * 1000); // 3 min TTL
    res.json(insights);
  } catch (err) {
    console.error('[CEO Intelligence Brief Error]', err);
    res.status(500).json({ error: 'Failed to generate executive brief.' });
  }
});

// Statistical Forecast & Corporate Outlook (Backtesting, Model Selection, Scenarios)
router.get('/intelligence/forecast', async (req, res) => {
  try {
    const cacheKey = 'ceo_intelligence_forecast';
    const cached = intelligenceCache.get(cacheKey);
    if (cached) return res.json(cached);

    const forecast = await generateCorporateForecast();
    intelligenceCache.set(cacheKey, forecast, 5 * 60 * 1000); // 5 min TTL
    res.json(forecast);
  } catch (err) {
    console.error('[CEO Intelligence Forecast Error]', err);
    res.status(500).json({ error: 'Failed to compute corporate forecast.' });
  }
});

// Anomaly Detection
router.get('/intelligence/anomalies', async (req, res) => {
  try {
    const anomalies = await detectAnomalies();
    res.json(anomalies);
  } catch (err) {
    console.error('[CEO Intelligence Anomalies Error]', err);
    res.status(500).json({ error: 'Failed to detect operational anomalies.' });
  }
});

// Data Quality & Confidence Rating
router.get('/intelligence/quality', async (req, res) => {
  try {
    const quality = await evaluateDataQuality();
    res.json(quality);
  } catch (err) {
    console.error('[CEO Intelligence Quality Error]', err);
    res.status(500).json({ error: 'Failed to evaluate data quality.' });
  }
});

// Natural-Language Grounded Executive Query
router.post('/intelligence/query', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query text is required.' });
    }
    const response = await answerExecutiveQuery(query);
    res.json(response);
  } catch (err) {
    console.error('[CEO Intelligence Query Error]', err);
    res.status(500).json({ error: 'Failed to resolve executive query.' });
  }
});

export default router;
