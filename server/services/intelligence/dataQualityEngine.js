import pool from '../../db.js';

/**
 * Data Quality & Confidence Engine
 * Evaluates completeness, historical depth, freshness, and emits a rigorous confidence rating.
 */
export async function evaluateDataQuality() {
  const statsQuery = `
    SELECT 
      COUNT(*)::int as total_records,
      COUNT(CASE WHEN renewal_date IS NOT NULL THEN 1 END)::int as valid_dates,
      COUNT(CASE WHEN value IS NOT NULL AND value > 0 THEN 1 END)::int as valid_values,
      COUNT(CASE WHEN product IS NOT NULL AND product != '' THEN 1 END)::int as valid_products,
      COUNT(CASE WHEN department_id IS NOT NULL THEN 1 END)::int as valid_depts,
      COUNT(CASE WHEN vendor IS NOT NULL AND vendor != '' THEN 1 END)::int as valid_vendors,
      MIN(renewal_date) as earliest_date,
      MAX(renewal_date) as latest_date,
      MAX(updated_at) as last_updated,
      COUNT(DISTINCT TO_CHAR(renewal_date, 'YYYY-"Q"Q'))::int as observed_quarters
    FROM renewals
    WHERE is_deleted = false
  `;

  const { rows } = await pool.query(statsQuery);
  const s = rows[0] || {};

  const total = s.total_records || 0;
  if (total === 0) {
    return {
      confidence: 'Low',
      score: 0,
      completenessPct: 0,
      historicalDepthQuarters: 0,
      totalObservations: 0,
      dataFreshnessMinutes: null,
      reason: 'No verified renewal data exists in the application database.',
      dimensions: {
        dates: 0,
        values: 0,
        products: 0,
        departments: 0,
        vendors: 0,
      }
    };
  }

  const datePct = Math.round((s.valid_dates / total) * 100);
  const valPct = Math.round((s.valid_values / total) * 100);
  const prodPct = Math.round((s.valid_products / total) * 100);
  const deptPct = Math.round((s.valid_depts / total) * 100);
  const vendPct = Math.round((s.valid_vendors / total) * 100);

  const avgCompleteness = Math.round((datePct + valPct + prodPct + deptPct + vendPct) / 5);

  const quarters = s.observed_quarters || 0;
  const lastUpdated = s.last_updated ? new Date(s.last_updated) : new Date();
  const freshnessMinutes = Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / (60 * 1000)));

  // Confidence algorithm:
  // High confidence requires: >= 4 quarters of depth, >= 50 observations, and >= 85% completeness
  // Medium confidence: >= 2 quarters of depth, >= 20 observations, and >= 70% completeness
  // Low confidence: otherwise
  let confidence = 'Low';
  let reason = '';

  if (quarters >= 4 && total >= 50 && avgCompleteness >= 85) {
    confidence = 'High';
    reason = `Robust baseline of ${total} contracts across ${quarters} observed quarters with ${avgCompleteness}% field completeness.`;
  } else if (quarters >= 2 && total >= 20 && avgCompleteness >= 70) {
    confidence = 'Medium';
    reason = `Moderate historical depth (${quarters} quarters, ${total} observations). Projections carry moderate statistical variance.`;
  } else {
    confidence = 'Low';
    reason = `Limited historical depth (${quarters} quarters, ${total} observations). Insufficient longitudinal baseline for high certainty.`;
  }

  return {
    confidence,
    completenessPct: avgCompleteness,
    historicalDepthQuarters: quarters,
    totalObservations: total,
    earliestDate: s.earliest_date,
    latestDate: s.latest_date,
    dataFreshnessMinutes: freshnessMinutes,
    reason,
    dimensions: {
      dateCompleteness: datePct,
      valueCompleteness: valPct,
      productCompleteness: prodPct,
      departmentCompleteness: deptPct,
      vendorCompleteness: vendPct,
    }
  };
}
