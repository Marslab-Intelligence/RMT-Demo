import { getQuarterlyTimeSeries, getDepartmentMetrics, getVendorConcentrationMetrics } from './metricsEngine.js';

/**
 * Anomaly & Statistical Variance Detection Engine
 * Uses Z-score and domain-specific thresholds to isolate unexpected shifts in revenue, margins, and concentration.
 */
export async function detectAnomalies() {
  const [quarters, depts, vendors] = await Promise.all([
    getQuarterlyTimeSeries(),
    getDepartmentMetrics(),
    getVendorConcentrationMetrics(),
  ]);

  const anomalies = [];

  if (quarters.length >= 3) {
    // Calculate historical mean and standard deviation for revenue and margin
    const revenues = quarters.map(q => q.revenue);
    const margins = quarters.map(q => q.margin_pct);

    const meanRev = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    const stdRev = Math.sqrt(revenues.map(x => Math.pow(x - meanRev, 2)).reduce((a, b) => a + b, 0) / revenues.length) || 1;

    const meanMargin = margins.reduce((a, b) => a + b, 0) / margins.length;
    const stdMargin = Math.sqrt(margins.map(x => Math.pow(x - meanMargin, 2)).reduce((a, b) => a + b, 0) / margins.length) || 1;

    // Check latest quarter
    const latest = quarters[quarters.length - 1];
    const prev = quarters[quarters.length - 2];

    const revZ = (latest.revenue - meanRev) / stdRev;
    const marginZ = (latest.margin_pct - meanMargin) / stdMargin;

    if (Math.abs(revZ) >= 2.0) {
      anomalies.push({
        id: 'rev-volatility',
        severity: revZ < 0 ? 'critical' : 'warning',
        type: 'Revenue Spike / Drop',
        metric: 'Quarterly Revenue Run-Rate',
        observedValue: latest.revenue,
        baselineValue: Math.round(meanRev),
        zScore: Math.round(revZ * 10) / 10,
        classification: Math.abs(revZ) >= 2.5 ? 'Critical Anomaly' : 'Statistical Anomaly',
        message: `${latest.quarter_label} revenue (₹${latest.revenue.toLocaleString()}) deviates by ${Math.abs(Math.round(revZ * 10) / 10)}σ from historical baseline.`,
      });
    }

    if (latest.margin_pct < prev.margin_pct - 5) {
      anomalies.push({
        id: 'margin-compression',
        severity: 'critical',
        type: 'Profit Margin Compression',
        metric: 'Gross Margin %',
        observedValue: `${latest.margin_pct}%`,
        baselineValue: `${prev.margin_pct}%`,
        classification: 'Critical Anomaly',
        message: `Gross profit margin compressed sharply from ${prev.margin_pct}% in ${prev.quarter_label} to ${latest.margin_pct}% in ${latest.quarter_label} (-${Math.round((prev.margin_pct - latest.margin_pct) * 10) / 10}% drop).`,
      });
    }
  }

  // Check Vendor Dependency Concentration
  const topVendor = vendors[0];
  if (topVendor && topVendor.concentrationPct >= 35) {
    anomalies.push({
      id: 'vendor-concentration-risk',
      severity: topVendor.concentrationPct >= 50 ? 'critical' : 'warning',
      type: 'Supplier Monopolization',
      metric: 'Vendor Concentration Share',
      observedValue: `${topVendor.concentrationPct}%`,
      baselineValue: '< 25%',
      classification: topVendor.concentrationPct >= 50 ? 'Critical Anomaly' : 'Meaningful Risk Shift',
      message: `Single supplier (${topVendor.vendor}) commands ${topVendor.concentrationPct}% of total corporate contract value (₹${topVendor.totalValue.toLocaleString()}).`,
    });
  }

  // Check Expired / Overdue Runways
  const totalExpiredAcrossDepts = depts.reduce((acc, d) => acc + (d.atRiskContracts || 0), 0);
  const totalContracts = depts.reduce((acc, d) => acc + (d.totalContracts || 0), 0);
  const overdueRatio = totalContracts > 0 ? (totalExpiredAcrossDepts / totalContracts) * 100 : 0;

  if (overdueRatio >= 15) {
    anomalies.push({
      id: 'portfolio-overdue-surge',
      severity: 'critical',
      type: 'Overdue Expiration Surge',
      metric: 'Overdue Contract Ratio',
      observedValue: `${Math.round(overdueRatio)}%`,
      baselineValue: '< 10%',
      classification: 'Critical Anomaly',
      message: `${totalExpiredAcrossDepts} contracts (${Math.round(overdueRatio)}% of active portfolio) are overdue or expired without logged renewal confirmation.`,
    });
  }

  return {
    totalAnomalies: anomalies.length,
    criticalCount: anomalies.filter(a => a.severity === 'critical').length,
    warningCount: anomalies.filter(a => a.severity === 'warning').length,
    anomalies,
  };
}
