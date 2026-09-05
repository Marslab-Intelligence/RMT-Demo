import db from '../db.js';

/**
 * Allow-listed parameterized SQL query builder for AI agent
 * Enforces user role scoping for sales team members (owner/sales_email filter)
 */
export async function executeAgentQuery({ queryName, params = [], user }) {
  let sql = '';
  const queryParams = [];

  switch (queryName) {
    case 'get_expiring_renewals': {
      const days = parseInt(params[0], 10) || 30;
      sql = `
        SELECT id, unique_id, client_name, service, owner, sales_email, renewal_date, value, status, payment_state, renewal_confirmation
        FROM renewals
        WHERE is_deleted = FALSE
          AND status IN ('Active', 'Pending Renewal')
          AND renewal_date IS NOT NULL
          AND (renewal_date - CURRENT_DATE) <= $1
      `;
      queryParams.push(days);
      if (user?.role === 'sales') {
        sql += ` AND (LOWER(owner) = LOWER($2) OR LOWER(sales_email) = LOWER($3))`;
        queryParams.push(user.full_name || '', user.email || '');
      }
      sql += ` ORDER BY renewal_date ASC LIMIT 50`;
      break;
    }

    case 'get_renewal_by_id': {
      const rawId = String(params[0] || '').trim();
      const digitsMatch = rawId.match(/\d+/);
      const numericId = digitsMatch ? digitsMatch[0] : rawId;
      const formattedRmt = `RMT-${numericId}`;
      // Digits only, defensively — this goes straight into a regex pattern below.
      const safeNumeric = numericId.replace(/[^0-9]/g, '');

      sql = `
        SELECT *, (renewal_date - CURRENT_DATE)::int as days_left
        FROM renewals
        WHERE (
          id::text = $1
          OR LOWER(unique_id) = LOWER($1)
          OR LOWER(unique_id) = LOWER($2)
          OR unique_id ~* $3
        )
        AND is_deleted = FALSE
      `;
      // unique_id is zero-padded (RMT-0025), but a user types "rmt 25" or
      // "RMT-25". The old fallback was `unique_id ILIKE '%25%'` — a bare
      // substring match that also matched RMT-0125, RMT-0225, RMT-0250..59,
      // RMT-0325, RMT-0425, etc., and returned whichever one Postgres
      // happened to list first (no ORDER BY), so "rmt 25" could silently come
      // back as RMT-0425. This anchors the numeric part instead: only
      // optional LEADING zeros are allowed before the exact digits typed, so
      // "25" matches "RMT-0025" but not "RMT-0425" or "RMT-1025".
      queryParams.push(rawId, formattedRmt, `^rmt-0*${safeNumeric}$`);
      if (user?.role === 'sales') {
        sql += ` AND (LOWER(owner) = LOWER($4) OR LOWER(sales_email) = LOWER($5))`;
        queryParams.push(user.full_name || '', user.email || '');
      }
      break;
    }

    case 'get_portfolio_summary': {
      sql = `
        SELECT 
          COUNT(*)::int as total_active,
          COUNT(DISTINCT client_name)::int as total_clients,
          COALESCE(SUM(value), 0)::numeric as total_value,
          COALESCE(SUM(profit), 0)::numeric as total_profit,
          COUNT(CASE WHEN payment_state = 'overdue' THEN 1 END)::int as overdue_count,
          COUNT(CASE WHEN (renewal_date - CURRENT_DATE) <= 15 THEN 1 END)::int as urgent_count
        FROM renewals
        WHERE is_deleted = FALSE AND status IN ('Active', 'Pending Renewal')
      `;
      if (user?.role === 'sales') {
        sql += ` AND (LOWER(owner) = LOWER($1) OR LOWER(sales_email) = LOWER($2))`;
        queryParams.push(user.full_name || '', user.email || '');
      }
      break;
    }

    case 'get_client_stats': {
      sql = `
        SELECT 
          COUNT(DISTINCT client_name)::int as total_unique_clients,
          COUNT(*)::int as total_contracts,
          COALESCE(SUM(value), 0)::numeric as total_portfolio_value,
          COALESCE(AVG(value), 0)::numeric as avg_contract_value
        FROM renewals
        WHERE is_deleted = FALSE AND status IN ('Active', 'Pending Renewal')
      `;
      if (user?.role === 'sales') {
        sql += ` AND (LOWER(owner) = LOWER($1) OR LOWER(sales_email) = LOWER($2))`;
        queryParams.push(user.full_name || '', user.email || '');
      }
      break;
    }

    case 'get_top_clients_by_value': {
      const limit = Math.min(parseInt(params[0], 10) || 10, 50);
      sql = `
        SELECT id, unique_id, client_name, service, owner, renewal_date, value, profit, status
        FROM renewals
        WHERE is_deleted = FALSE AND status IN ('Active', 'Pending Renewal')
      `;
      if (user?.role === 'sales') {
        sql += ` AND (LOWER(owner) = LOWER($1) OR LOWER(sales_email) = LOWER($2))`;
        queryParams.push(user.full_name || '', user.email || '');
      }
      sql += ` ORDER BY value DESC NULLS LAST LIMIT ${limit}`;
      break;
    }

    case 'get_top_clients_by_profit': {
      const limit = Math.min(parseInt(params[0], 10) || 10, 50);
      sql = `
        SELECT id, unique_id, client_name, service, owner, value, profit, status
        FROM renewals
        WHERE is_deleted = FALSE AND status IN ('Active', 'Pending Renewal')
      `;
      if (user?.role === 'sales') {
        sql += ` AND (LOWER(owner) = LOWER($1) OR LOWER(sales_email) = LOWER($2))`;
        queryParams.push(user.full_name || '', user.email || '');
      }
      sql += ` ORDER BY profit DESC NULLS LAST LIMIT ${limit}`;
      break;
    }

    case 'get_overdue_renewals': {
      sql = `
        SELECT unique_id, client_name, service, owner, value, renewal_date, payment_state, payment_status
        FROM renewals
        WHERE is_deleted = FALSE 
          AND (payment_state = 'overdue' OR LOWER(status) = 'overdue' OR LOWER(payment_status) LIKE '%overdue%')
      `;
      if (user?.role === 'sales') {
        sql += ` AND (LOWER(owner) = LOWER($1) OR LOWER(sales_email) = LOWER($2))`;
        queryParams.push(user.full_name || '', user.email || '');
      }
      sql += ` ORDER BY value DESC NULLS LAST LIMIT 25`;
      break;
    }

    case 'get_pending_invoices': {
      sql = `
        SELECT unique_id, client_name, service, owner, value, renewal_date, invoice_status
        FROM renewals
        WHERE is_deleted = FALSE AND (invoice_status = 'Not' OR invoice_status IS NULL OR LOWER(invoice_status) = 'pending')
      `;
      if (user?.role === 'sales') {
        sql += ` AND (LOWER(owner) = LOWER($1) OR LOWER(sales_email) = LOWER($2))`;
        queryParams.push(user.full_name || '', user.email || '');
      }
      sql += ` ORDER BY value DESC NULLS LAST LIMIT 25`;
      break;
    }

    case 'search_client_renewals': {
      const rawTerm = String(params[0] || '').trim();
      const searchTerm = `%${rawTerm}%`;
      sql = `
        SELECT unique_id, client_name, service, owner, value, renewal_date, status, payment_state, invoice_status
        FROM renewals
        WHERE is_deleted = FALSE AND (
          LOWER(client_name) LIKE LOWER($1) 
          OR LOWER(service) LIKE LOWER($1) 
          OR LOWER(vendor) LIKE LOWER($1)
          OR LOWER(unique_id) LIKE LOWER($1)
          OR id::text LIKE $1
        )
      `;
      queryParams.push(searchTerm);
      if (user?.role === 'sales') {
        sql += ` AND (LOWER(owner) = LOWER($2) OR LOWER(sales_email) = LOWER($3))`;
        queryParams.push(user.full_name || '', user.email || '');
      }
      sql += ` ORDER BY renewal_date DESC LIMIT 25`;
      break;
    }

    case 'get_service_breakdown': {
      sql = `
        SELECT
          service,
          COUNT(*)::int as count,
          COALESCE(SUM(value), 0)::numeric as total_value,
          COALESCE(SUM(profit), 0)::numeric as total_profit
        FROM renewals
        WHERE is_deleted = FALSE AND status IN ('Active', 'Pending Renewal')
      `;
      if (user?.role === 'sales') {
        sql += ` AND (LOWER(owner) = LOWER($1) OR LOWER(sales_email) = LOWER($2))`;
        queryParams.push(user.full_name || '', user.email || '');
      }
      sql += ` GROUP BY service ORDER BY total_value DESC`;
      break;
    }

    case 'get_vendor_breakdown': {
      sql = `
        SELECT
          COALESCE(vendor, 'Unspecified') as vendor,
          COUNT(*)::int as count,
          COALESCE(SUM(value), 0)::numeric as total_value
        FROM renewals
        WHERE is_deleted = FALSE AND status IN ('Active', 'Pending Renewal')
      `;
      if (user?.role === 'sales') {
        sql += ` AND (LOWER(owner) = LOWER($1) OR LOWER(sales_email) = LOWER($2))`;
        queryParams.push(user.full_name || '', user.email || '');
      }
      sql += ` GROUP BY vendor ORDER BY total_value DESC`;
      break;
    }

    case 'get_owner_breakdown': {
      sql = `
        SELECT
          COALESCE(owner, 'Unassigned') as owner,
          COUNT(*)::int as count,
          COALESCE(SUM(value), 0)::numeric as total_value
        FROM renewals
        WHERE is_deleted = FALSE AND status IN ('Active', 'Pending Renewal')
      `;
      if (user?.role === 'sales') {
        sql += ` AND (LOWER(owner) = LOWER($1) OR LOWER(sales_email) = LOWER($2))`;
        queryParams.push(user.full_name || '', user.email || '');
      }
      sql += ` GROUP BY owner ORDER BY total_value DESC`;
      break;
    }

    // Admin-only reporting tools — mirror GET /api/dashboard/activity-logs
    // and GET /api/dashboard/email-logs (both requireRole('admin') in
    // server/routes/dashboard.js). No owner/sales_email scoping is applied
    // here, same as those routes: this data isn't per-record, it's a global
    // audit trail, and access to it is gated by TOOL_PERMISSIONS in
    // agentRunner.js (admin_only), not by row filtering. A sales-role user
    // should never reach this query in the first place.
    case 'get_activity_logs': {
      const limit = Math.min(parseInt(params[0], 10) || 20, 50);
      sql = `
        SELECT al.id, al.action, al.entity_type, al.entity_id, al.details, al.created_at, u.full_name, u.role
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT ${limit}
      `;
      break;
    }

    case 'get_email_logs': {
      const limit = Math.min(parseInt(params[0], 10) || 20, 50);
      sql = `
        SELECT el.id, el.recipient_email, el.recipient_type, el.email_type, el.subject, el.status, el.sent_at,
               COALESCE(el.client_name, r.client_name, 'System / Automation') as client_name
        FROM email_logs el
        LEFT JOIN renewals r ON el.renewal_id = r.id
        ORDER BY el.sent_at DESC
        LIMIT ${limit}
      `;
      break;
    }

    default:
      throw new Error(`Query '${queryName}' is not in the agent allow-list.`);
  }

  const { rows } = await db.query(sql, queryParams);
  return rows;
}
