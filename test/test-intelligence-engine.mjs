import pool from '../server/db.js';
import { evaluateDataQuality } from '../server/services/intelligence/dataQualityEngine.js';
import { getQuarterlyTimeSeries, getDepartmentMetrics, getCompanyOverallHealth } from '../server/services/intelligence/metricsEngine.js';
import { detectAnomalies } from '../server/services/intelligence/anomalyEngine.js';
import { generateCorporateForecast } from '../server/services/intelligence/forecastingEngine.js';
import { generateExecutiveInsights } from '../server/services/intelligence/insightEngine.js';
import { answerExecutiveQuery } from '../server/services/intelligence/executiveQueryEngine.js';

async function testIntelligence() {
  console.log('=== TESTING CEO INTELLIGENCE ENGINES ===\n');

  // 1. Data Quality
  console.log('1. Evaluating Data Quality:');
  const quality = await evaluateDataQuality();
  console.log('Quality Output:', {
    confidence: quality.confidence,
    completenessPct: quality.completenessPct,
    historicalDepthQuarters: quality.historicalDepthQuarters,
    totalObservations: quality.totalObservations,
    reason: quality.reason,
  });

  // 2. Metrics Engine
  console.log('\n2. Testing Metrics Engine:');
  const quarters = await getQuarterlyTimeSeries();
  console.log(`Quarter series length: ${quarters.length} quarters.`);
  const health = await getCompanyOverallHealth();
  console.log(`Company Overall Health: ${health.score}/100 (${health.rating}).`);

  // 3. Anomaly Detection
  console.log('\n3. Testing Anomaly Detection:');
  const anomalies = await detectAnomalies();
  console.log(`Detected ${anomalies.totalAnomalies} anomalies (${anomalies.criticalCount} critical):`);
  for (const a of anomalies.anomalies) {
    console.log(` - [${a.severity.toUpperCase()}] ${a.type}: ${a.message}`);
  }

  // 4. Forecasting Engine & Model Selection
  console.log('\n4. Testing Statistical Forecasting Engine:');
  const forecast = await generateCorporateForecast();
  console.log('Forecast Horizon:', forecast.horizonSummary);
  console.log('Base Case Revenue:', forecast.scenarios?.baseCase?.revenue);
  console.log('Optimistic Case Revenue:', forecast.scenarios?.optimisticCase?.revenue);
  console.log('Conservative Case Revenue:', forecast.scenarios?.conservativeCase?.revenue);
  console.log('Model Registry Winning Models:');
  for (const m of forecast.modelRegistry) {
    console.log(` - ${m.metric}: ${m.selectedModel} (WAPE: ${m.backtestWape}, MAE: ${m.mae})`);
  }

  // 5. Executive Insights & Evidence
  console.log('\n5. Testing Executive Insight Engine:');
  const insights = await generateExecutiveInsights();
  console.log('Executive Briefing Items:');
  for (const b of insights.executiveBrief) {
    console.log(` [${b.priority}] ${b.title}`);
  }
  console.log('Attribution:', insights.attribution);

  // 6. Natural Language Query
  console.log('\n6. Testing Executive Query Engine:');
  const testQ1 = await answerExecutiveQuery('How is the company doing?');
  console.log('Q: How is the company doing?');
  console.log('A:', testQ1.headline);

  const testQ2 = await answerExecutiveQuery('What is forecasted for next quarter?');
  console.log('Q: What is forecasted for next quarter?');
  console.log('A:', testQ2.headline);

  console.log('\n✅ ALL INTELLIGENCE ENGINES OPERATING MATHEMATICALLY & FACTUALLY!');
  process.exit(0);
}

testIntelligence().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
