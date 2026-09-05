import crypto from 'crypto';
import { executeAgentQuery } from './queryBuilder.js';
import { validateDraftSafety } from './safetyGate.js';
import { computeRiskScore } from './riskScorer.js';
import { parseNaturalLanguageMutation } from './naturalLanguageEditor.js';
import { classifyIntent, explainRiskScore, generateQuerySpec, rephraseDataQuestion } from './geminiClient.js';
import { runQuerySpec } from './queryEngine.js';

const MAX_STEPS = 12;

export const APPROVAL_TIERS = {
  get_expiring_renewals: 'auto',
  get_renewal_by_id: 'auto',
  get_portfolio_summary: 'auto',
  get_client_stats: 'auto',
  get_top_clients_by_value: 'auto',
  get_top_clients_by_profit: 'auto',
  get_overdue_renewals: 'auto',
  get_pending_invoices: 'auto',
  search_client_renewals: 'auto',
  get_service_breakdown: 'auto',
  get_vendor_breakdown: 'auto',
  get_owner_breakdown: 'auto',
  get_activity_logs: 'auto',
  get_email_logs: 'auto',
  answer_data_question: 'auto',
  parse_nl_edit: 'auto',
  draft_outreach_email: 'approve_first',
  stage_status_change: 'approve_first',
  delete_renewal_record: 'human_only',
  edit_pricing_structure: 'human_only'
};

/**
 * Action-authorization layer — separate and distinct from the data-visibility
 * row-scoping already enforced unconditionally in queryBuilder.js/queryEngine.js
 * (which stays untouched: it governs which ROWS a 'sales' user's own queries
 * can see). This governs which TOOLS a role is even authorized to invoke at
 * all, mirroring the app's real RBAC (see the requireRole('admin') /
 * adminOnly gates already in server/routes/dashboard.js and adminUsers.js) —
 * not inventing a new permission model.
 *
 * Tiers:
 *  - 'any_role'   any authenticated user (sales or admin) may invoke this tool.
 *  - 'admin_only' only an admin-role user may invoke this tool; a sales-role
 *                 user gets an explicit, honest denial (see runAgentTask).
 *  - 'human_only' blocked for autonomous execution regardless of role — kept
 *                 here for documentation parity with APPROVAL_TIERS, but the
 *                 human_only check in APPROVAL_TIERS is what actually blocks
 *                 it (checked first). This is NOT "admin can do it instead" —
 *                 per project design, delete_renewal_record and
 *                 edit_pricing_structure stay blocked for every role.
 *
 * Note: pricing changes, user management, and the automation on/off toggle
 * are admin-only actions in the app today (server/routes/pricing.js currently
 * has no role gate at all — a pre-existing app-level gap, not this agent's to
 * fix), but none of them are exposed as agent tools yet. If a tool for any of
 * those is added later, it MUST be tagged 'admin_only' (or 'human_only' if
 * irreversible/financial) here to match real RBAC.
 */
export const TOOL_PERMISSIONS = {
  get_expiring_renewals: 'any_role',
  get_renewal_by_id: 'any_role',
  get_portfolio_summary: 'any_role',
  get_client_stats: 'any_role',
  get_top_clients_by_value: 'any_role',
  get_top_clients_by_profit: 'any_role',
  get_overdue_renewals: 'any_role',
  get_pending_invoices: 'any_role',
  search_client_renewals: 'any_role',
  get_service_breakdown: 'any_role',
  get_vendor_breakdown: 'any_role',
  get_owner_breakdown: 'any_role',
  answer_data_question: 'any_role',
  // naturalLanguageEditor.js already enforces per-row sales ownership
  // internally (a sales user can only target their own records) — that's
  // data-level scoping, orthogonal to this tool-level check.
  parse_nl_edit: 'any_role',
  // Mirrors requireRole('admin') on GET /api/dashboard/activity-logs and
  // GET /api/dashboard/email-logs — these are global audit trails, not
  // per-record data, and the app already restricts them to admins only.
  get_activity_logs: 'admin_only',
  get_email_logs: 'admin_only',
  draft_outreach_email: 'any_role',
  stage_status_change: 'any_role',
  delete_renewal_record: 'human_only',
  edit_pricing_structure: 'human_only'
};

/**
 * Tools where an empty result is AMBIGUOUS — it could genuinely mean "no such
 * data" or it could mean the query/search missed something a broader lookup
 * could rescue (e.g. a name search that matched nothing because the question
 * wasn't actually a client-name search at all — the original bug report).
 * Escalation is reserved for exactly these.
 *
 * Deliberately NOT included: get_overdue_renewals, get_pending_invoices,
 * get_expiring_renewals, the *_breakdown tools, get_top_clients_by_*, and the
 * aggregate tools. For every one of those, generateResultSummary already has
 * a specific, correct, immediately-useful message for the empty case (e.g.
 * "🎉 No overdue renewals found in the system.") — that IS the answer, not a
 * miss to route around. Escalating those would silently downgrade a clear,
 * accurate "zero" answer into a vaguer "I couldn't find an answer" message,
 * which was caught in sandbox testing against real data (a demo dataset with
 * zero payment_state='overdue' rows turned "🎉 no overdue renewals" into a
 * false-sounding "couldn't find an answer" before this list existed).
 */
const ESCALATABLE_TOOLS = new Set(['search_client_renewals', 'answer_data_question']);

/**
 * True when a tool's output has nothing useful in it — the trigger for the
 * bounded escalation chain in runAgentTask, gated to ESCALATABLE_TOOLS only.
 */
function isResultEmpty(toolName, output) {
  if (!ESCALATABLE_TOOLS.has(toolName)) return false;
  if (toolName === 'answer_data_question') {
    return !output || !output.ok || !Array.isArray(output.rows) || output.rows.length === 0;
  }
  return !Array.isArray(output) || output.length === 0;
}

/** One-line human-readable trace of an attempt, for the honest give-up message. */
function describeAttempt(toolCall, promptUsed) {
  if (toolCall.toolName === 'answer_data_question') {
    return `an open-ended data lookup for "${promptUsed}"`;
  }
  const params = toolCall.params && Object.keys(toolCall.params).length ? ` (${JSON.stringify(toolCall.params)})` : '';
  return `${toolCall.toolName}${params}`;
}

/**
 * Main execution runner for Autonomous AI Renewal Agent.
 *
 * Runs a BOUNDED escalation chain, not an unbounded "keep trying until it
 * works" loop — at most 3 real tool attempts (primary tool → the general
 * answer_data_question fallback → one Gemini-rephrased retry of it), each
 * still subject to MAX_STEPS as a hard circuit breaker. An unbounded retry
 * loop against a rate-limited, budgeted external API (20 free-tier requests/
 * day — see geminiClient.js) would risk hung requests and runaway spend for
 * no real benefit; this achieves the same practical goal — never dead-end on
 * the first miss — deterministically instead.
 */
export async function runAgentTask({ prompt, context = {}, user }) {
  const history = [];
  const toolCallHashes = new Set();
  const attemptedDescriptions = [];
  let step = 0;
  let finalResult = null;
  let currentPrompt = prompt;
  let rephraseAttempted = false;

  let toolCall = await determineNextToolCall(prompt, context, user);

  while (toolCall && step < MAX_STEPS) {
    step++;

    // Loop detection — hashed on the tool call AND the prompt text actually
    // used for it, so the two legitimate answer_data_question attempts in the
    // escalation chain (original prompt, then the rephrased one) don't
    // collide just because they share a tool name.
    const callHash = crypto.createHash('md5').update(JSON.stringify({ toolCall, prompt: currentPrompt })).digest('hex');
    if (toolCallHashes.has(callHash)) {
      history.push({ step, error: 'Loop detected: identical tool call repeated. Aborting run.' });
      break;
    }
    toolCallHashes.add(callHash);

    // Approval Tier Check — a genuinely irreversible/financial action is
    // blocked for autonomous execution outright, regardless of role. This is
    // unchanged from before and checked first, ahead of the role-permission
    // check below.
    const tier = APPROVAL_TIERS[toolCall.toolName] || 'approve_first';
    if (tier === 'human_only') {
      const reason = 'This action requires manual human intervention and cannot be executed autonomously.';
      history.push({ step, action: toolCall.toolName, status: 'blocked', reason });
      finalResult = `⛔ ${reason}`;
      break;
    }

    // Role-based action authorization — a second, distinct layer from the
    // data-visibility row-scoping already enforced unconditionally inside
    // queryBuilder.js/queryEngine.js (untouched). This governs what the
    // agent is even authorized to ATTEMPT for this user's role, not what
    // rows come back.
    const permission = TOOL_PERMISSIONS[toolCall.toolName] || 'any_role';
    if (permission === 'admin_only' && user?.role !== 'admin') {
      const reason = "You don't have permission to do that — this action requires an administrator.";
      history.push({ step, action: toolCall.toolName, status: 'denied', reason });
      finalResult = `🚫 ${reason}`;
      break;
    }

    // Execute Tool
    let toolOutput;
    try {
      toolOutput = await executeTool(toolCall, user, currentPrompt);
      history.push({ step, tool: toolCall.toolName, params: toolCall.params, output: toolOutput });
    } catch (err) {
      history.push({ step, tool: toolCall.toolName, error: err.message });
      break;
    }

    attemptedDescriptions.push(describeAttempt(toolCall, currentPrompt));

    if (!isResultEmpty(toolCall.toolName, toolOutput)) {
      finalResult = await generateResultSummary(currentPrompt, toolCall.toolName, toolOutput, toolCall.params);
      break;
    }

    // ── Bounded escalation chain ─────────────────────────────────────────
    // Attempt 1 (above) came back empty. Try the most general tool next —
    // it can often answer what a narrower tool missed.
    if (toolCall.toolName !== 'answer_data_question') {
      history.push({ step, note: `"${toolCall.toolName}" returned nothing — escalating to a general data lookup.` });
      toolCall = { toolName: 'answer_data_question', params: {} };
      continue;
    }

    // Attempt 2 (answer_data_question on the original prompt) also came back
    // empty. One more Gemini call to rephrase/disambiguate the question, then
    // one final retry — never more than this.
    if (!rephraseAttempted) {
      rephraseAttempted = true;
      const rephrase = await rephraseDataQuestion({ originalQuestion: prompt, priorAttempts: attemptedDescriptions });
      if (rephrase.ok && rephrase.question) {
        currentPrompt = rephrase.question;
        history.push({ step, note: `Rephrased for retry: "${rephrase.question}"` });
        toolCall = { toolName: 'answer_data_question', params: {} };
        continue;
      }
      history.push({ step, note: `Rephrase attempt unavailable (${rephrase.reason || 'unknown'}).` });
    }

    // Chain exhausted (attempt 3, or rephrase itself unavailable) — an
    // honest, bounded give-up. Never fabricate a number here; the tool
    // outputs above are the only source of truth, and safetyGate's numeric-
    // grounding check is untouched and still applies to any outbound draft.
    finalResult = `I couldn't find an answer to that. Here's what I tried:\n` +
      attemptedDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n');
    break;
  }

  return {
    completed: true,
    totalSteps: step,
    finalResult: finalResult || 'Processed query successfully.',
    history
  };
}

const ROUTABLE_TOOLS = [
  'get_expiring_renewals',
  'get_portfolio_summary',
  'get_client_stats',
  'get_renewal_by_id',
  'get_top_clients_by_value',
  'get_top_clients_by_profit',
  'get_overdue_renewals',
  'get_pending_invoices',
  'search_client_renewals',
  'get_service_breakdown',
  'get_vendor_breakdown',
  'get_owner_breakdown',
  'get_activity_logs',
  'get_email_logs',
  'answer_data_question',
  'parse_nl_edit',
  // Included so the classifier can correctly recognize delete-intent by
  // name — APPROVAL_TIERS/TOOL_PERMISSIONS both mark this human_only, and
  // runAgentTask blocks it before executeTool is ever called, so this can
  // never actually delete anything regardless of which path names it.
  'delete_renewal_record',
];

const TOOL_HINT = 'Tool guide:\n' +
  '- get_client_stats for "total clients", "how many clients", "client count", "total unique clients", ' +
  '"total records", "how many renewals/contracts", or any generic record/renewal count or overview\n' +
  '- get_top_clients_by_profit for "highest profit", "top margin", or "most profitable client"\n' +
  '- get_top_clients_by_value for "top/biggest/highest value client(s)", "who pays the most", or "highest price renewal"\n' +
  '- get_overdue_renewals for "overdue payment", "unpaid clients", "late payment", or "due payment"\n' +
  '- get_pending_invoices for "invoice pending", "unbilled renewals", or "invoice not sent"\n' +
  '- search_client_renewals when searching for renewals of a specific client or service name\n' +
  '- get_vendor_breakdown for breakdown or totals by vendor (Microsoft, AWS, Acronis, etc.)\n' +
  '- get_owner_breakdown for breakdown or totals by owner/sales rep/BDM/CST\n' +
  '- get_service_breakdown for breakdown by service type\n' +
  '- get_expiring_renewals for renewals due soon\n' +
  '- get_portfolio_summary for overall high-level executive portfolio numbers\n' +
  '- get_renewal_by_id when a specific RMT-### is named\n' +
  '- get_activity_logs for "activity log", "audit log", "who did what", "user actions" — admin only\n' +
  '- get_email_logs for "email log", "sent emails", "email history", "reminder emails sent" — admin only\n' +
  '- parse_nl_edit only when the message asks to update or set a field on a record\n' +
  '- delete_renewal_record when the message explicitly asks to delete/remove a renewal record ' +
  '(this can never actually be executed autonomously, but should be named honestly rather than ' +
  'misread as a request to view the record)\n' +
  '- answer_data_question for date/time-range questions ("June 2026", "last month", "this quarter", "last 30 days") ' +
  'and for any other arbitrary data query about renewals that does not clearly match one of the tools above.';

async function determineNextToolCall(prompt, context, user) {
  // Defense-in-depth: never even offer an admin-only tool name to the
  // classifier for a non-admin caller. The authoritative enforcement is the
  // TOOL_PERMISSIONS check in runAgentTask (which also covers the regex
  // fallback path below) — this just narrows what Gemini can pick from in
  // the first place, mirroring the app's real RBAC.
  const allowedTools = user?.role === 'admin'
    ? ROUTABLE_TOOLS
    : ROUTABLE_TOOLS.filter((t) => TOOL_PERMISSIONS[t] !== 'admin_only');

  const classification = await classifyIntent({
    prompt: `${TOOL_HINT}\n\nUser request: ${prompt}`,
    allowedTools,
    fallbackTool: 'answer_data_question',
  });

  if (classification.ok) {
    return { toolName: classification.toolName, params: classification.params };
  }

  return regexFallbackToolCall(prompt);
}

export function regexFallbackToolCall(prompt) {
  const lowerPrompt = prompt.toLowerCase();

  // 1. Client count & total client queries
  if (/total client|client count|how many client|number of client|distinct client|list of client|all client/i.test(lowerPrompt)) {
    return { toolName: 'get_client_stats', params: {} };
  }

  // 1b. Generic total/count queries not tied to the word "client" specifically
  // ("total records", "how many renewals", "record count", "number of
  // contracts"). Previously nothing recognized these, and they fell all the
  // way through to the literal-fallback client search (rule 14 below), which
  // searches for a client literally named e.g. "total records" and reports a
  // misleading "No matching client records found." for what is actually a
  // valid portfolio/client-stats question.
  if (
    /\b(total|how many|number of|count of)\b[\s\S]*\b(record|renewal|contract)s?\b/i.test(lowerPrompt) ||
    /\b(record|renewal|contract)\s+count\b/i.test(lowerPrompt)
  ) {
    return { toolName: 'get_client_stats', params: {} };
  }

  // 1c. Activity / audit log queries — admin-only; TOOL_PERMISSIONS in
  // runAgentTask is what actually denies a sales-role caller, not this rule.
  if (/\b(activity log|audit log|who (did|made|changed)|user actions?|system activity|login history)\b/i.test(lowerPrompt)) {
    return { toolName: 'get_activity_logs', params: {} };
  }

  // 1d. Email log / sent-email queries — admin-only, same note as above.
  if (/\b(email log|sent emails?|email history|reminder emails? (sent|log)|emails? (sent|delivered))\b/i.test(lowerPrompt)) {
    return { toolName: 'get_email_logs', params: {} };
  }

  // 2. Profit / margin queries (Checked before value!)
  if (/(profit|margin|gain|profitable)/i.test(lowerPrompt)) {
    return { toolName: 'get_top_clients_by_profit', params: { limit: 10 } };
  }

  // 3. High value / higher price / top client / expensive renewal queries.
  // The second clause is a targeted addition, not a broadening of the first
  // word list — adding a bare "most" there would also make "most overdue"
  // match here before ever reaching rule 4. "pay(s) the most" / "highest
  // paying" is exactly the phrasing the TOOL_HINT below already promises
  // ("who pays the most") but the fallback never actually implemented.
  if (
    (/(high|top|big|large|max|expensive|costly|price|value|higher|valuable|biggest|largest)/i.test(lowerPrompt) && /(client|renewal|contract|price|value)/i.test(lowerPrompt)) ||
    /(pay[s]?\s+the\s+most|highest paying|who pays the most)/i.test(lowerPrompt)
  ) {
    return { toolName: 'get_top_clients_by_value', params: { limit: 10 } };
  }

  // 4. Overdue / unpaid payment queries
  if (/(overdue|unpaid|pending payment|late payment|due payment|payment delay|disputed)/i.test(lowerPrompt)) {
    return { toolName: 'get_overdue_renewals', params: {} };
  }

  // 5. Invoice pending / invoice status
  if (/(invoice|unbilled|bill pending|not invoiced)/i.test(lowerPrompt)) {
    return { toolName: 'get_pending_invoices', params: {} };
  }

  // 6. Vendor queries
  if (/(vendor|supplier|brand|microsoft|aws|acronis|sophos|zoho)/i.test(lowerPrompt)) {
    if (/(microsoft|aws|acronis|sophos|zoho)/i.test(lowerPrompt)) {
      const match = lowerPrompt.match(/(microsoft|aws|acronis|sophos|zoho)/i);
      return { toolName: 'search_client_renewals', params: { query: match[0] } };
    }
    return { toolName: 'get_vendor_breakdown', params: {} };
  }

  // 7. Owner / BDM / Sales Rep queries. "owned by" doesn't match a bare
  // "owner" substring ("owned" and "owner" diverge at the last letter) — a
  // real gap discovered via test/agentRunner.test.js, not a hypothetical one.
  if (/(owner|owned by|owns\b|sales rep|bdm|assigned|account manager|sales person)/i.test(lowerPrompt)) {
    return { toolName: 'get_owner_breakdown', params: {} };
  }

  // 8. Service breakdown queries
  if (/(service|breakdown|by service|per service)/i.test(lowerPrompt)) {
    return { toolName: 'get_service_breakdown', params: {} };
  }

  // 9. Expiring / upcoming / due renewals
  if (/(expiring|\bdue\b|upcoming|urgent|risk|expiry)/i.test(lowerPrompt)) {
    return { toolName: 'get_expiring_renewals', params: { days: 30 } };
  }

  // 9c. Delete/remove-record intent — routed to delete_renewal_record, which
  // APPROVAL_TIERS blocks as human_only and TOOL_PERMISSIONS marks human_only
  // too, so this always ends in the honest "requires manual human
  // intervention" message, never an actual delete. Checked before rule 10
  // below on purpose: without this, "delete the record RMT-1000" matched the
  // plain RMT-ID lookup rule (it has an ID, and "delete" isn't one of that
  // rule's own update/set/change/edit/modify keywords), silently returned the
  // record details, and never acknowledged the delete request was ignored —
  // a real gap surfaced in sandbox testing, not a hypothetical one.
  if (/\b(delete|remove|erase|purge)\b[\s\S]*\b(record|renewal|contract|rmt[-\s]?\d+)\b|\bdelete\s+(?:this|that)\b/i.test(lowerPrompt)) {
    return { toolName: 'delete_renewal_record', params: {} };
  }

  // 10. Specific RMT ID lookup (e.g., RMT-101, rmt 101, rmt-101, RMT101).
  // Checked before the date/temporal step below — an explicit record ID is
  // a stronger, unambiguous signal than a date mention that might just be
  // incidental to the same message ("RMT-101 renewal for June 2026" should
  // still look up RMT-101, not run a date-range query).
  if (/(?:RMT|rmt)[-\s]?\d+/i.test(prompt)) {
    const idMatch = prompt.match(/(?:RMT|rmt)[-\s]?(\d+)/i);
    const numericPart = idMatch ? idMatch[1] : '';
    const formattedRmtId = `RMT-${numericPart}`;

    if (/(?:update|set|change|edit|modify)\b/i.test(lowerPrompt)) {
      return { toolName: 'parse_nl_edit', params: { utterance: prompt } };
    }
    return { toolName: 'get_renewal_by_id', params: { id: formattedRmtId } };
  }

  // 9b. Date/temporal questions — a real gap until now. Nothing above
  // recognizes "June 2026", "last month", "Q2", a bare year, etc., so these
  // fell all the way through to client-name search (step 12/14 below),
  // which correctly finds no client literally named "the record of june
  // 2026" and reports a misleading "no client records" message for a
  // question that was never about a client at all. answer_data_question can
  // actually construct a renewal_date range filter — route there instead.
  const MONTH_NAMES = /(january|february|march|april|may|june|july|august|september|october|november|december)/i;
  if (
    MONTH_NAMES.test(lowerPrompt) ||
    /\b(19|20)\d{2}\b/.test(lowerPrompt) ||
    /\b(last|this|next)\s+(month|week|quarter|year)\b/i.test(lowerPrompt) ||
    /\bq[1-4]\b/i.test(lowerPrompt) ||
    /\blast\s+\d+\s+days?\b/i.test(lowerPrompt)
  ) {
    return { toolName: 'answer_data_question', params: {} };
  }

  // 11. NL Edit instructions
  if (/(?:update|set|change)\s+[a-z_]+/i.test(lowerPrompt)) {
    return { toolName: 'parse_nl_edit', params: { utterance: prompt } };
  }

  // 12. Search client by name ("renewals for Acme", "client HDFC", "search Sidcorp")
  const clientSearchMatch = lowerPrompt.match(/(?:client|for|search|find|show)\s+([a-z0-9\s\.\-]{3,})/i);
  if (clientSearchMatch && !/portfolio|summary|overview|total|all|due|overdue|invoice|rmt|application|system|help/i.test(clientSearchMatch[1])) {
    return { toolName: 'search_client_renewals', params: { query: clientSearchMatch[1].trim() } };
  }

  // 13. High-level portfolio summary & RMT System info
  if (/portfolio|summary|overview|rmt|application|system|help|what can you do|features|agent/i.test(lowerPrompt)) {
    return { toolName: 'get_portfolio_summary', params: {} };
  }

  // 14. Fallback search for any other open prompt
  return { toolName: 'search_client_renewals', params: { query: prompt } };
}

async function executeTool(toolCall, user, prompt) {
  switch (toolCall.toolName) {
    case 'get_expiring_renewals':
      return await executeAgentQuery({ queryName: 'get_expiring_renewals', params: [toolCall.params.days || 30], user });
    case 'get_portfolio_summary':
      return await executeAgentQuery({ queryName: 'get_portfolio_summary', params: [], user });
    case 'get_client_stats':
      return await executeAgentQuery({ queryName: 'get_client_stats', params: [], user });
    case 'get_renewal_by_id':
      return await executeAgentQuery({ queryName: 'get_renewal_by_id', params: [toolCall.params.id], user });
    case 'get_top_clients_by_value':
      return await executeAgentQuery({ queryName: 'get_top_clients_by_value', params: [toolCall.params.limit || 10], user });
    case 'get_top_clients_by_profit':
      return await executeAgentQuery({ queryName: 'get_top_clients_by_profit', params: [toolCall.params.limit || 10], user });
    case 'get_overdue_renewals':
      return await executeAgentQuery({ queryName: 'get_overdue_renewals', params: [], user });
    case 'get_pending_invoices':
      return await executeAgentQuery({ queryName: 'get_pending_invoices', params: [], user });
    case 'search_client_renewals':
      return await executeAgentQuery({ queryName: 'search_client_renewals', params: [toolCall.params.query || ''], user });
    case 'get_service_breakdown':
      return await executeAgentQuery({ queryName: 'get_service_breakdown', params: [], user });
    case 'get_vendor_breakdown':
      return await executeAgentQuery({ queryName: 'get_vendor_breakdown', params: [], user });
    case 'get_owner_breakdown':
      return await executeAgentQuery({ queryName: 'get_owner_breakdown', params: [], user });
    case 'get_activity_logs':
      return await executeAgentQuery({ queryName: 'get_activity_logs', params: [toolCall.params.limit || 20], user });
    case 'get_email_logs':
      return await executeAgentQuery({ queryName: 'get_email_logs', params: [toolCall.params.limit || 20], user });
    case 'answer_data_question': {
      const specResult = await generateQuerySpec(prompt);
      if (!specResult.ok) {
        return { ok: false, reason: specResult.reason, explanation: specResult.explanation };
      }
      const queryResult = await runQuerySpec(specResult.spec, user);
      if (!queryResult.ok) {
        return { ok: false, reason: queryResult.reason, explanation: queryResult.error };
      }
      return { ok: true, rows: queryResult.rows };
    }
    case 'parse_nl_edit':
      return await parseNaturalLanguageMutation(toolCall.params.utterance, user);
    default:
      throw new Error(`Unknown tool name ${toolCall.toolName}`);
  }
}

async function generateResultSummary(prompt, toolName, output, toolParams = {}) {
  if (toolName === 'get_portfolio_summary' && output[0]) {
    const p = output[0];
    return `📊 Portfolio Analysis:\n• Total Active Contracts: ${p.total_active}\n• Total Unique Clients: ${p.total_clients}\n• Total Portfolio Value: ₹${parseFloat(p.total_value).toLocaleString('en-IN')}\n• Total Portfolio Profit: ₹${parseFloat(p.total_profit).toLocaleString('en-IN')}\n• Urgent Renewals (≤ 15 days): ${p.urgent_count}\n• Overdue Payments: ${p.overdue_count}`;
  }

  if (toolName === 'get_client_stats' && output[0]) {
    const s = output[0];
    return `📊 Client Portfolio Overview:\n• Total Unique Clients: ${s.total_unique_clients} clients\n• Total Active Contracts: ${s.total_contracts} contracts\n• Total Portfolio Value: ₹${parseFloat(s.total_portfolio_value).toLocaleString('en-IN')}\n• Average Contract Value: ₹${parseFloat(s.avg_contract_value).toLocaleString('en-IN')}`;
  }

  if (toolName === 'get_expiring_renewals') {
    if (!output.length) return 'No active renewals expiring within the specified timeframe.';
    const lines = output.slice(0, 15).map((r, i) =>
      `${i + 1}. ${r.client_name} (${r.unique_id}) — ₹${parseFloat(r.value).toLocaleString('en-IN')} | Service: ${r.service} | Date: ${r.renewal_date ? String(r.renewal_date).split('T')[0] : 'N/A'}`
    );
    return `⌛ Expiring Renewals (${output.length} total found):\n${lines.join('\n')}`;
  }

  if (toolName === 'get_renewal_by_id') {
    if (!output || !output.length) {
      return `ℹ️ No matching renewal record found for ${toolParams.id || 'the specified ID'}. Please check the ID or search by client name.`;
    }
    const r = output[0];
    const risk = computeRiskScore(r);
    let base = `📋 Record Details for ${r.unique_id || ('RMT-' + r.id)} (${r.client_name}):\n` +
               `• Service: ${r.service || 'N/A'}\n` +
               `• Contract Value: ₹${parseFloat(r.value || 0).toLocaleString('en-IN')}\n` +
               `• Status: ${r.status || 'Active'}\n` +
               `• Owner/BDM: ${r.owner || 'Unassigned'}\n` +
               `• Payment State: ${r.payment_state || 'Paid'}\n` +
               `• Days Until Renewal: ${r.days_left !== undefined && r.days_left !== null ? r.days_left : 'N/A'}\n` +
               `• Risk Tier: ${risk.tier} (Score: ${risk.score}/100)`;
    try {
      const explanation = await explainRiskScore(risk);
      if (explanation && explanation.ok && explanation.text) {
        base += `\n\nRisk Assessment: ${explanation.text}`;
      }
    } catch (e) {}
    return base;
  }

  if (toolName === 'parse_nl_edit') {
    if (output.error) return `⚠️ Edit Blocked: ${output.error}`;
    return `✏️ Mutation Proposed for ${output.target.uniqueId} (${output.target.clientName}):\nChange ${output.changes.map(c => `${c.field} ➔ ${c.to}`).join(', ')}.`;
  }

  if (toolName === 'get_top_clients_by_value') {
    if (!output.length) return 'No active renewals found to rank by value.';
    const lines = output.map((r, i) =>
      `${i + 1}. ${r.client_name} (${r.unique_id}) — ₹${parseFloat(r.value).toLocaleString('en-IN')} (Service: ${r.service || 'N/A'}${r.owner ? `, Owner: ${r.owner}` : ''})`
    );
    return `🏆 Top ${lines.length} Clients by Renewal Value:\n${lines.join('\n')}`;
  }

  if (toolName === 'get_top_clients_by_profit') {
    if (!output.length) return 'No active renewals found to rank by profit.';
    const lines = output.map((r, i) =>
      `${i + 1}. ${r.client_name} (${r.unique_id}) — Profit: ₹${parseFloat(r.profit || 0).toLocaleString('en-IN')} (Value: ₹${parseFloat(r.value).toLocaleString('en-IN')}, Service: ${r.service || 'N/A'})`
    );
    return `💰 Top ${lines.length} Clients by Renewal Profit:\n${lines.join('\n')}`;
  }

  if (toolName === 'get_overdue_renewals') {
    if (!output.length) return '🎉 Great news! No overdue renewals found in the system.';
    const lines = output.map((r, i) =>
      `${i + 1}. ${r.client_name} (${r.unique_id}) — ₹${parseFloat(r.value).toLocaleString('en-IN')} | Service: ${r.service} | Status: ${r.payment_state || 'Overdue'}`
    );
    return `⚠️ Overdue Renewals (${output.length} records found):\n${lines.join('\n')}`;
  }

  if (toolName === 'get_pending_invoices') {
    if (!output.length) return 'All active renewal contracts have invoices sent.';
    const lines = output.map((r, i) =>
      `${i + 1}. ${r.client_name} (${r.unique_id}) — ₹${parseFloat(r.value).toLocaleString('en-IN')} | Service: ${r.service} | Invoice: ${r.invoice_status || 'Not Sent'}`
    );
    return `📄 Renewals Pending Invoice (${output.length} records found):\n${lines.join('\n')}`;
  }

  if (toolName === 'search_client_renewals') {
    if (!output.length) return 'No matching client records found.';
    const lines = output.map((r, i) =>
      `• ${r.client_name} (${r.unique_id}) — ₹${parseFloat(r.value).toLocaleString('en-IN')} | Service: ${r.service} | Status: ${r.status}`
    );
    return `🔍 Search Results (${output.length} records found):\n${lines.join('\n')}`;
  }

  if (toolName === 'get_service_breakdown') {
    if (!output.length) return 'No active renewals found to break down by service.';
    const lines = output.map(s =>
      `• ${s.service}: ${s.count} contract${s.count === 1 ? '' : 's'}, total value ₹${parseFloat(s.total_value).toLocaleString('en-IN')}, profit ₹${parseFloat(s.total_profit).toLocaleString('en-IN')}`
    );
    return `💼 Renewal Portfolio by Service:\n${lines.join('\n')}`;
  }

  if (toolName === 'get_vendor_breakdown') {
    if (!output.length) return 'No vendor data available.';
    const lines = output.map(v =>
      `• ${v.vendor}: ${v.count} contract${v.count === 1 ? '' : 's'}, total value ₹${parseFloat(v.total_value).toLocaleString('en-IN')}`
    );
    return `🏢 Renewal Portfolio by Vendor:\n${lines.join('\n')}`;
  }

  if (toolName === 'get_owner_breakdown') {
    if (!output.length) return 'No owner data available.';
    const lines = output.map(o =>
      `• ${o.owner}: ${o.count} contract${o.count === 1 ? '' : 's'}, total value ₹${parseFloat(o.total_value).toLocaleString('en-IN')}`
    );
    return `👤 Renewal Portfolio by Owner / Sales Rep:\n${lines.join('\n')}`;
  }

  if (toolName === 'get_activity_logs') {
    if (!output.length) return 'No activity log entries found.';
    const lines = output.map((a, i) =>
      `${i + 1}. [${new Date(a.created_at).toLocaleString('en-IN')}] ${a.full_name || 'System'} (${a.role || '-'}) — ${a.action}${a.details ? ': ' + a.details : ''}`
    );
    return `📝 Recent Activity Log (${output.length} entries):\n${lines.join('\n')}`;
  }

  if (toolName === 'get_email_logs') {
    if (!output.length) return 'No email log entries found.';
    const lines = output.map((e, i) =>
      `${i + 1}. [${new Date(e.sent_at).toLocaleString('en-IN')}] ${e.client_name} — ${e.email_type} to ${e.recipient_email} (${e.status})`
    );
    return `📧 Recent Email Log (${output.length} entries):\n${lines.join('\n')}`;
  }

  if (toolName === 'answer_data_question') {
    if (!output.ok) {
      if (output.reason === 'unanswerable') {
        return `⚠️ I couldn't answer that: ${output.explanation || 'it doesn’t map to data I have access to.'}`;
      }
      if (['no_api_key', 'budget_exceeded', 'call_failed', 'daily_limit_reached', 'rate_limited'].includes(output.reason)) {
        const hint = output.reason === 'rate_limited' ? ' Please wait about a minute and try again.' : ' Please try again shortly.';
        return `⚠️ The AI service is temporarily unavailable (${output.reason.replace(/_/g, ' ')}).${hint}`;
      }
      return `⚠️ I couldn't answer that right now. Please try again.`;
    }
    if (!output.rows.length) return 'No matching records found.';
    const isSingleAggregate = output.rows.length === 1 && Object.keys(output.rows[0]).length <= 3;
    if (isSingleAggregate) {
      const parts = Object.entries(output.rows[0]).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${formatCell(v)}`);
      return parts.join(', ') + '.';
    }
    const lines = output.rows.slice(0, 15).map((row) =>
      Object.entries(row).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${formatCell(v)}`).join(', ')
    );
    const suffix = output.rows.length > 15 ? `\n…and ${output.rows.length - 15} more.` : '';
    return lines.join('\n') + suffix;
  }
  return JSON.stringify(output);
}

function formatCell(v) {
  if (v === null || v === undefined) return '—';
  // pg returns DATE columns as native JS Date objects — String(date) produces
  // "Wed Jun 10 2026 00:00:00 GMT+0530 (India Standard Time)", which is what
  // an answer_data_question response was showing verbatim to the user.
  if (v instanceof Date) return v.toLocaleDateString('en-IN');
  if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v) && Number(v) >= 1000) {
    return `₹${parseFloat(v).toLocaleString('en-IN')}`;
  }
  return String(v);
}
