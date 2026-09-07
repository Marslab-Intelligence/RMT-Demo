import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APPROVAL_TIERS,
  TOOL_PERMISSIONS,
  regexFallbackToolCall,
  runAgentTask,
} from '../server/agent/agentRunner.js';

// ── §2: regex fallback should resolve realistic paraphrasings to a sensible
// tool, not the bare literal-prompt search (rule 14) — that should be a last
// resort, not a common outcome. This is the degraded-mode path exercised
// whenever Gemini is unavailable (no_api_key, budget exhausted, or a call
// fails), which — per geminiClient.js's own comments — has been the ONLY
// path actually running in production until GEMINI_API_KEY was wired up.
const REALISTIC_PARAPHRASES = [
  // The exact repro from the bug report.
  { prompt: 'total records', expect: 'get_client_stats' },
  { prompt: 'how many renewals do we have', expect: 'get_client_stats' },
  { prompt: 'what is the total number of contracts', expect: 'get_client_stats' },
  { prompt: 'record count', expect: 'get_client_stats' },
  { prompt: 'total client count', expect: 'get_client_stats' },
  { prompt: 'how many clients do we have', expect: 'get_client_stats' },
  // Admin-only reporting vocabulary.
  { prompt: 'show me the activity log', expect: 'get_activity_logs' },
  { prompt: 'who made changes recently', expect: 'get_activity_logs' },
  { prompt: 'show sent emails this week', expect: 'get_email_logs' },
  { prompt: 'email history for this client', expect: 'get_email_logs' },
  // Delete intent must be named honestly, not silently swapped for a lookup —
  // caught live: "delete the record rmt1000" was returning RMT-1000's details
  // with zero acknowledgment the delete request was ignored.
  { prompt: 'delete the record rmt1000', expect: 'delete_renewal_record' },
  { prompt: 'i ask you to delete the record rmt 1000', expect: 'delete_renewal_record' },
  { prompt: 'remove RMT-425 please', expect: 'delete_renewal_record' },
  // Pre-existing vocabulary — sanity check these still route correctly.
  { prompt: 'who is our most profitable client', expect: 'get_top_clients_by_profit' },
  { prompt: 'which clients pay the most', expect: 'get_top_clients_by_value' },
  { prompt: 'any overdue payments', expect: 'get_overdue_renewals' },
  { prompt: 'invoices still pending', expect: 'get_pending_invoices' },
  { prompt: 'breakdown by vendor', expect: 'get_vendor_breakdown' },
  { prompt: 'renewals owned by Priya', expect: 'get_owner_breakdown' },
  { prompt: 'what is due for renewal soon', expect: 'get_expiring_renewals' },
  { prompt: 'details for RMT-273', expect: 'get_renewal_by_id' },
  { prompt: 'set follow up status to called for RMT-42', expect: 'parse_nl_edit' },
  { prompt: 'renewals in June 2026', expect: 'answer_data_question' },
  { prompt: 'what happened last month', expect: 'answer_data_question' },
  { prompt: 'give me a portfolio overview', expect: 'get_portfolio_summary' },
];

test('§2 - regex fallback resolves realistic paraphrasings to the intended tool', () => {
  for (const { prompt, expect } of REALISTIC_PARAPHRASES) {
    const result = regexFallbackToolCall(prompt);
    assert.equal(
      result.toolName,
      expect,
      `"${prompt}" resolved to "${result.toolName}", expected "${expect}"`
    );
  }
});

test('§2 - regex fallback never falls back to literal-prompt search for generic total/count phrasing', () => {
  const genericTotals = ['total records', 'how many renewals', 'record count', 'total contracts'];
  for (const prompt of genericTotals) {
    const result = regexFallbackToolCall(prompt);
    assert.notEqual(result.toolName, 'search_client_renewals');
    // The literal-fallback shape is { toolName: 'search_client_renewals', params: { query: prompt } } —
    // explicitly assert we never get that exact shape for these phrasings.
    assert.notEqual(result.params?.query, prompt);
  }
});

// ── §4: role-based tool permission matrix ───────────────────────────────
test('§4 - TOOL_PERMISSIONS marks admin-only reporting tools distinctly from data tools', () => {
  assert.equal(TOOL_PERMISSIONS['get_activity_logs'], 'admin_only');
  assert.equal(TOOL_PERMISSIONS['get_email_logs'], 'admin_only');
  assert.equal(TOOL_PERMISSIONS['get_client_stats'], 'any_role');
  assert.equal(TOOL_PERMISSIONS['search_client_renewals'], 'any_role');
});

test('§4 - human_only tools stay blocked for autonomous execution regardless of role (hard constraint)', () => {
  assert.equal(APPROVAL_TIERS['delete_renewal_record'], 'human_only');
  assert.equal(APPROVAL_TIERS['edit_pricing_structure'], 'human_only');
  assert.equal(TOOL_PERMISSIONS['delete_renewal_record'], 'human_only');
  assert.equal(TOOL_PERMISSIONS['edit_pricing_structure'], 'human_only');
});

test('§2/§4 - a delete-intent chat message is named honestly and blocked, not silently swapped for a record lookup', async () => {
  const adminUser = { role: 'super_admin', full_name: 'Jane Admin', email: 'jane@example.com' };
  const res = await runAgentTask({ prompt: 'delete the record rmt1000', user: adminUser });

  assert.equal(res.completed, true);
  assert.match(res.finalResult, /requires manual human intervention/i);
  // The bug this guards against: the old routing silently returned the
  // record's details instead of acknowledging the delete request at all.
  assert.doesNotMatch(res.finalResult, /Record Details/i);
});

test('§4 - a sales-role request for an admin-only tool gets an explicit permission-denied message', async () => {
  const salesUser = { role: 'user', full_name: 'John Sales', email: 'john@example.com' };
  const res = await runAgentTask({ prompt: 'show me the activity log', user: salesUser });

  assert.equal(res.completed, true);
  assert.match(res.finalResult, /don't have permission/i);
  assert.match(res.finalResult, /administrator/i);
  // Never silently claim success on a denied action.
  assert.notEqual(res.finalResult, 'Processed query successfully.');
});

test('§4 - an admin-role request for the same admin-only tool is not denied', async () => {
  const adminUser = { role: 'super_admin', full_name: 'Jane Admin', email: 'jane@example.com' };
  const res = await runAgentTask({ prompt: 'show me the activity log', user: adminUser });

  assert.equal(res.completed, true);
  assert.doesNotMatch(res.finalResult, /don't have permission/i);
});

// ── §3: bounded escalation chain — never a dead-end, never unbounded ────
test('§3 - a query with zero results escalates and gives an honest, bounded answer (never a fabricated one)', async () => {
  const user = { role: 'super_admin', full_name: 'Jane Admin', email: 'jane@example.com' };
  // A client name that should not exist in any seeded/demo dataset.
  const res = await runAgentTask({
    prompt: 'show me renewals for Zzyzx Nonexistent Client Corp',
    user,
  });

  assert.equal(res.completed, true);
  assert.equal(typeof res.finalResult, 'string');
  // Bounded: primary attempt + at most 2 escalation attempts.
  assert.equal(res.totalSteps <= 4, true);
  // Never hangs, never throws — always resolves to either a real answer or
  // the honest give-up message, never silently "Processed query successfully."
  // with nothing behind it.
  if (/couldn't find an answer/i.test(res.finalResult)) {
    assert.match(res.finalResult, /here's what i tried/i);
  }
});

test('§3 - escalation chain is bounded by MAX_STEPS even when every attempt fails', async () => {
  const user = { role: 'user', full_name: 'John Sales', email: 'john@example.com' };
  const res = await runAgentTask({ prompt: 'asdkjaslkdj nonsense query xyz123', user });

  assert.equal(res.completed, true);
  assert.equal(res.totalSteps <= 12, true);
  assert.equal(typeof res.finalResult, 'string');
});
