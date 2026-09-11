import express from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * Resolves the authenticated user's role and data scope:
 * - 'super_admin' | 'ceo' -> Enterprise (full application data across all departments)
 * - 'dept_admin'          -> Department (all service data within their department)
 * - 'user'                -> Service (their assigned service/category data only)
 */
async function resolveUserPricingScope(user) {
  if (!user) return { role: 'guest', type: 'none' };
  
  if (user.role === 'super_admin' || user.role === 'ceo') {
    return {
      role: user.role,
      type: 'enterprise',
      label: 'Enterprise Portfolio (All Services)',
      badge: 'Super Admin • Full Platform',
      departmentId: null,
      departmentName: null,
      categoryId: null,
      categoryName: null,
      serviceVariants: [],
      categoryIds: [],
      categoryNames: []
    };
  }

  if (user.role === 'dept_admin') {
    const deptId = user.departmentId;
    let deptName = 'Department';
    let catRows = [];
    if (deptId) {
      const dRes = await pool.query('SELECT id, name FROM departments WHERE id = $1', [deptId]);
      if (dRes.rows.length > 0) deptName = dRes.rows[0].name;
      const cRes = await pool.query('SELECT id, name FROM categories WHERE department_id = $1 AND is_active = TRUE', [deptId]);
      catRows = cRes.rows;
    }
    const catNames = catRows.map(c => c.name);
    const expandedNames = [...catNames];
    if (catNames.some(n => n.toLowerCase() === 'ms365') && !expandedNames.some(n => n.toLowerCase() === 'm365')) {
      expandedNames.push('M365');
    }
    if (catNames.some(n => n.toLowerCase() === 'm365') && !expandedNames.some(n => n.toLowerCase() === 'ms365')) {
      expandedNames.push('MS365');
    }

    return {
      role: 'dept_admin',
      type: 'department',
      departmentId: deptId,
      departmentName: deptName,
      categories: catRows,
      categoryIds: catRows.map(c => c.id),
      categoryNames: expandedNames,
      label: `${deptName} Department`,
      badge: `Department Admin • ${deptName}`
    };
  }

  if (user.role === 'user') {
    const catId = user.categoryId;
    let catName = 'My Service';
    let deptName = 'Department';
    let deptId = user.departmentId;
    if (catId) {
      const cRes = await pool.query(`
        SELECT c.id, c.name, c.department_id, d.name as dept_name 
        FROM categories c 
        LEFT JOIN departments d ON c.department_id = d.id 
        WHERE c.id = $1
      `, [catId]);
      if (cRes.rows.length > 0) {
        catName = cRes.rows[0].name;
        deptId = cRes.rows[0].department_id || deptId;
        deptName = cRes.rows[0].dept_name || deptName;
      }
    }
    const serviceVariants = [catName];
    if (catName.toLowerCase() === 'ms365') serviceVariants.push('M365');
    if (catName.toLowerCase() === 'm365') serviceVariants.push('MS365');

    return {
      role: 'user',
      type: 'service',
      categoryId: catId,
      categoryName: catName,
      serviceVariants,
      departmentId: deptId,
      departmentName: deptName,
      label: `${catName} Service`,
      badge: `Service Specialist • ${catName}`
    };
  }

  return { role: user.role, type: 'unknown' };
}

// GET all product pricing catalog items (role-scoped)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const scope = await resolveUserPricingScope(req.user);

    // Auto-sync missing vendor products directly from live client renewal records
    await pool.query(`
      INSERT INTO product_pricing (vendor, product_name, service_category, list_price, erp_price, purchase_cost, sales_cost, coupon_discount_percent, description)
      SELECT 
        r.vendor,
        r.product AS product_name,
        COALESCE(NULLIF(r.service, ''), 'Software & Services') AS service_category,
        ROUND(COALESCE(NULLIF(AVG(r.sales_cost), 0), NULLIF(AVG(r.value), 0), 1000) * 1.15, 2) AS list_price,
        0.00 AS erp_price,
        ROUND(COALESCE(NULLIF(AVG(r.purchase_cost), 0), 0), 2) AS purchase_cost,
        ROUND(COALESCE(NULLIF(AVG(r.sales_cost), 0), NULLIF(AVG(r.value / NULLIF(r.quantity, 0)), 0), 0), 2) AS sales_cost,
        10.00 AS coupon_discount_percent,
        CONCAT('Synced from client renewals (Service Plan: ', COALESCE(r.service, 'General'), ')') AS description
      FROM renewals r
      WHERE r.vendor IS NOT NULL AND r.vendor != '' AND r.product IS NOT NULL AND r.product != ''
        AND NOT EXISTS (
          SELECT 1 FROM product_pricing p 
          WHERE LOWER(p.vendor) = LOWER(r.vendor) AND LOWER(p.product_name) = LOWER(r.product)
        )
      GROUP BY r.vendor, r.product, r.service
    `);

    // Update zero or uninitialized purchase_cost and sales_cost from client renewal records for matching vendor and product
    await pool.query(`
      UPDATE product_pricing p
      SET 
        purchase_cost = CASE WHEN sub.avg_purchase_cost > 0 THEN sub.avg_purchase_cost ELSE p.purchase_cost END,
        sales_cost = CASE WHEN sub.avg_sales_cost > 0 THEN sub.avg_sales_cost ELSE p.sales_cost END
      FROM (
        SELECT 
          LOWER(r.vendor) AS vendor_clean, 
          LOWER(r.product) AS product_clean, 
          ROUND(COALESCE(NULLIF(AVG(r.purchase_cost), 0), 0), 2) AS avg_purchase_cost,
          ROUND(COALESCE(NULLIF(AVG(r.sales_cost), 0), 0), 2) AS avg_sales_cost
        FROM renewals r
        WHERE r.vendor IS NOT NULL AND r.vendor != '' 
          AND r.product IS NOT NULL AND r.product != '' 
          AND (r.purchase_cost > 0 OR r.sales_cost > 0)
        GROUP BY LOWER(r.vendor), LOWER(r.product)
      ) sub
      WHERE LOWER(p.vendor) = sub.vendor_clean 
        AND LOWER(p.product_name) = sub.product_clean;
    `);

    const { vendor, service, search } = req.query;
    const params = [];
    let renewalScopeJoin = '';

    // Scope the LEFT JOIN renewals so client contract counts and client names
    // only expose renewals belonging to the user's scope
    if (scope.type === 'service') {
      params.push(scope.categoryId);
      const catIdx = params.length;
      params.push(scope.serviceVariants.map(v => v.toLowerCase()));
      const varsIdx = params.length;
      renewalScopeJoin = ` AND (r.category_id = $${catIdx} OR LOWER(r.service) = ANY($${varsIdx}))`;
    } else if (scope.type === 'department') {
      params.push(scope.departmentId);
      const deptIdx = params.length;
      params.push(scope.categoryIds.length > 0 ? scope.categoryIds : [-1]);
      const catsIdx = params.length;
      renewalScopeJoin = ` AND (r.department_id = $${deptIdx} OR r.category_id = ANY($${catsIdx}))`;
    }
    
    let query = `
      SELECT 
        p.*,
        COALESCE(
          STRING_AGG(DISTINCT r.client_name, ', ') FILTER (WHERE r.client_name IS NOT NULL AND r.client_name != ''),
          ''
        ) as associated_clients_summary,
        COALESCE(
          STRING_AGG(DISTINCT CONCAT(r.client_name, ' ', COALESCE(r.client_email,''), ' ', COALESCE(r.owner,''), ' ', COALESCE(r.unique_id,''), ' ', COALESCE(r.quotation_number,''), ' ', COALESCE(r.invoice_number,''), ' ', COALESCE(r.reference_id,'')), ' | ') FILTER (WHERE r.client_name IS NOT NULL),
          ''
        ) as associated_clients,
        COUNT(DISTINCT r.id) FILTER (WHERE r.id IS NOT NULL AND (r.is_deleted IS FALSE OR r.is_deleted IS NULL)) as active_client_contracts
      FROM product_pricing p
      LEFT JOIN renewals r 
        ON LOWER(r.vendor) = LOWER(p.vendor) 
        AND (
          LOWER(r.product) = LOWER(p.product_name)
          OR LOWER(r.service) = LOWER(p.service_category)
          OR LOWER(r.product) LIKE LOWER('%' || p.product_name || '%')
          OR LOWER(p.product_name) LIKE LOWER('%' || r.product || '%')
          OR REPLACE(REPLACE(LOWER(r.product), ' ', ''), '-', '') LIKE LOWER('%' || REPLACE(REPLACE(p.product_name, ' ', ''), '-', '') || '%')
        )
        AND (r.is_deleted IS FALSE OR r.is_deleted IS NULL)
        ${renewalScopeJoin}
      WHERE 1=1
    `;

    // Role-based scoping on products:
    // - Service Specialist (user): ONLY their assigned service
    // - Department Admin: ALL services in their department
    // - Super Admin: Full application data (all services)
    if (scope.type === 'service') {
      params.push(scope.serviceVariants.map(v => v.toLowerCase()));
      const varsIdx = params.length;
      params.push(scope.categoryId);
      const catIdx = params.length;

      query += ` AND (
        LOWER(p.service_category) = ANY($${varsIdx})
        OR EXISTS (
          SELECT 1 FROM renewals r_scope 
          WHERE (r_scope.category_id = $${catIdx} OR LOWER(r_scope.service) = ANY($${varsIdx}))
            AND LOWER(r_scope.product) = LOWER(p.product_name)
        )
      )`;
    } else if (scope.type === 'department') {
      params.push(scope.categoryNames.map(n => n.toLowerCase()));
      const catNamesIdx = params.length;
      params.push(scope.departmentId);
      const deptIdx = params.length;
      params.push(scope.categoryIds.length > 0 ? scope.categoryIds : [-1]);
      const catIdsIdx = params.length;

      query += ` AND (
        LOWER(p.service_category) = ANY($${catNamesIdx})
        OR EXISTS (
          SELECT 1 FROM renewals r_scope 
          WHERE (r_scope.department_id = $${deptIdx} OR r_scope.category_id = ANY($${catIdsIdx}))
            AND LOWER(r_scope.product) = LOWER(p.product_name)
        )
      )`;
    }

    if (vendor && vendor !== 'all') {
      params.push(vendor);
      query += ` AND LOWER(p.vendor) = LOWER($${params.length})`;
    }

    if (service && service !== 'all') {
      params.push(service);
      query += ` AND LOWER(p.service_category) = LOWER($${params.length})`;
    }

    if (search && search.trim() !== '') {
      const cleanSearch = search.trim();
      const normSearch = cleanSearch.toLowerCase().replace(/[^a-z0-9]/g, '');
      const s = `%${cleanSearch}%`;
      const sNorm = `%${normSearch}%`;

      params.push(s);
      const sIdx = params.length;
      params.push(sNorm);
      const sNormIdx = params.length;

      query += ` AND (
        LOWER(p.product_name) LIKE LOWER($${sIdx}) OR 
        LOWER(p.vendor) LIKE LOWER($${sIdx}) OR 
        LOWER(p.service_category) LIKE LOWER($${sIdx}) OR
        LOWER(p.description) LIKE LOWER($${sIdx}) OR
        REPLACE(REPLACE(LOWER(p.product_name), ' ', ''), '-', '') LIKE $${sNormIdx} OR
        REPLACE(REPLACE(LOWER(p.service_category), ' ', ''), '-', '') LIKE $${sNormIdx} OR
        EXISTS (
          SELECT 1 FROM renewals r2
          WHERE LOWER(r2.vendor) = LOWER(p.vendor)
            AND (
              LOWER(r2.client_name) LIKE LOWER($${sIdx}) OR
              LOWER(r2.product) LIKE LOWER($${sIdx}) OR
              LOWER(r2.service) LIKE LOWER($${sIdx}) OR
              LOWER(r2.client_email) LIKE LOWER($${sIdx}) OR
              LOWER(r2.unique_id) LIKE LOWER($${sIdx}) OR
              REPLACE(REPLACE(LOWER(r2.client_name), ' ', ''), '-', '') LIKE $${sNormIdx} OR
              REPLACE(REPLACE(LOWER(r2.product), ' ', ''), '-', '') LIKE $${sNormIdx} OR
              REPLACE(REPLACE(LOWER(r2.service), ' ', ''), '-', '') LIKE $${sNormIdx}
            )
        )
      )`;
    }

    query += ' GROUP BY p.id ORDER BY p.vendor ASC, p.product_name ASC';
    const result = await pool.query(query, params);

    // Enrich records with calculated financial metrics
    const items = result.rows.map(row => {
      const listPrice = parseFloat(row.list_price || 0);
      const erpPrice = parseFloat(row.erp_price || 0);
      const couponDiscountPct = parseFloat(row.coupon_discount_percent || 0);

      const discountedPrice = listPrice > 0 
        ? listPrice * (1 - (couponDiscountPct / 100))
        : erpPrice;

      const rawPurchase = parseFloat(row.purchase_cost || 0);
      const rawSales = parseFloat(row.sales_cost || 0);
      const purchaseCost = rawPurchase > 0 ? rawPurchase : (rawSales > 0 ? rawSales : 0);

      let salesCost = erpPrice > 0 ? erpPrice : (discountedPrice > 0 ? discountedPrice : listPrice);
      if (rawSales > 0 && rawSales !== purchaseCost) {
        salesCost = rawSales;
      }

      const profitAmount = salesCost - purchaseCost;
      const marginPercent = salesCost > 0 ? (profitAmount / salesCost) * 100 : 0;
      const salesCostPercent = salesCost > 0 ? (purchaseCost / salesCost) * 100 : 0;
      const erpSavingsPercent = listPrice > 0 ? ((listPrice - (erpPrice > 0 ? erpPrice : salesCost)) / listPrice) * 100 : 0;

      return {
        ...row,
        list_price: listPrice,
        erp_price: erpPrice,
        purchase_cost: Math.round(purchaseCost * 100) / 100,
        sales_cost: Math.round(salesCost * 100) / 100,
        coupon_discount_percent: couponDiscountPct,
        discounted_price: Math.round((erpPrice > 0 ? erpPrice : discountedPrice) * 100) / 100,
        sales_cost_percent: Math.round(salesCostPercent * 10) / 10,
        margin_amount: Math.round(profitAmount * 100) / 100,
        profit: Math.round(profitAmount * 100) / 100,
        margin_percent: Math.round(marginPercent * 10) / 10,
        erp_savings_percent: Math.round(erpSavingsPercent * 10) / 10
      };
    });

    res.json(items);
  } catch (err) {
    console.error('Error fetching product pricing catalog:', err);
    res.status(500).json({ error: 'Failed to retrieve pricing catalog' });
  }
});

// GET Executive Non-Technical Profit/Loss Analytical Summary (role-scoped)
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const scope = await resolveUserPricingScope(req.user);
    let renewalScopeWhere = '';
    const renewalParams = [];

    if (scope.type === 'service') {
      renewalParams.push(scope.categoryId);
      renewalParams.push(scope.serviceVariants.map(v => v.toLowerCase()));
      renewalScopeWhere = ` AND (category_id = $1 OR LOWER(service) = ANY($2))`;
    } else if (scope.type === 'department') {
      renewalParams.push(scope.departmentId);
      renewalParams.push(scope.categoryIds.length > 0 ? scope.categoryIds : [-1]);
      renewalScopeWhere = ` AND (department_id = $1 OR category_id = ANY($2))`;
    }

    // 1. Fetch total aggregated revenue, cost, and profit from live client renewals within scope
    const renewalStatsRes = await pool.query(`
      SELECT 
        COUNT(*) as total_contracts,
        COALESCE(SUM(CASE WHEN status IN ('Active', 'Renewed', 'Pending Renewal') THEN value ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN status IN ('Active', 'Renewed', 'Pending Renewal') THEN total_purchase_cost ELSE 0 END), 0) as total_purchase_cost,
        COALESCE(SUM(CASE WHEN status IN ('Active', 'Renewed', 'Pending Renewal') THEN profit ELSE 0 END), 0) as total_profit,
        COALESCE(SUM(CASE WHEN status = 'Expired' THEN value ELSE 0 END), 0) as total_loss_value,
        COUNT(CASE WHEN status = 'Expired' THEN 1 END) as expired_count,
        COUNT(CASE WHEN status = 'Active' THEN 1 END) as active_count,
        COUNT(CASE WHEN status = 'Pending Renewal' THEN 1 END) as pending_count
      FROM renewals
      WHERE (is_deleted IS FALSE OR is_deleted IS NULL) ${renewalScopeWhere};
    `, renewalParams);

    const stats = renewalStatsRes.rows[0];
    const totalRev = parseFloat(stats.total_revenue || 0);
    const totalCost = parseFloat(stats.total_purchase_cost || 0);
    const totalProfit = parseFloat(stats.total_profit || (totalRev - totalCost));
    const totalLoss = parseFloat(stats.total_loss_value || 0);
    
    const netMarginPercent = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;
    const isProfitable = totalProfit >= 0;

    // 2. Vendor Breakdown Analytics within scope
    const vendorBreakdownRes = await pool.query(`
      SELECT 
        COALESCE(NULLIF(vendor, ''), 'Direct') as vendor_name,
        COUNT(*) as contract_count,
        SUM(CASE WHEN status IN ('Active', 'Renewed', 'Pending Renewal') THEN value ELSE 0 END) as total_value,
        SUM(CASE WHEN status IN ('Active', 'Renewed', 'Pending Renewal') THEN total_purchase_cost ELSE 0 END) as total_purchase_cost,
        SUM(CASE WHEN status IN ('Active', 'Renewed', 'Pending Renewal') THEN profit ELSE 0 END) as total_profit
      FROM renewals
      WHERE (is_deleted IS FALSE OR is_deleted IS NULL) ${renewalScopeWhere}
      GROUP BY vendor_name
      ORDER BY total_value DESC;
    `, renewalParams);

    const vendorBreakdown = vendorBreakdownRes.rows.map(v => {
      const vVal = parseFloat(v.total_value || 0);
      const vProf = parseFloat(v.total_profit || (vVal - parseFloat(v.total_purchase_cost || 0)));
      const sharePct = totalRev > 0 ? (vVal / totalRev) * 100 : 0;
      const vMarginPct = vVal > 0 ? (vProf / vVal) * 100 : 0;
      return {
        vendor: v.vendor_name,
        contracts: parseInt(v.contract_count || 0),
        total_value: vVal,
        total_profit: vProf,
        share_percent: Math.round(sharePct * 10) / 10,
        margin_percent: Math.round(vMarginPct * 10) / 10
      };
    });

    // 3. Catalog Average Margin within scope
    let catalogAvgQuery = `
      SELECT 
        AVG(erp_price) as avg_erp_price,
        AVG(purchase_cost) as avg_purchase_cost,
        AVG(sales_cost) as avg_sales_cost,
        AVG(coupon_discount_percent) as avg_discount
      FROM product_pricing
      WHERE 1=1
    `;
    const catalogParams = [];
    if (scope.type === 'service') {
      catalogParams.push(scope.serviceVariants.map(v => v.toLowerCase()));
      catalogAvgQuery += ` AND LOWER(service_category) = ANY($1)`;
    } else if (scope.type === 'department') {
      catalogParams.push(scope.categoryNames.map(n => n.toLowerCase()));
      catalogAvgQuery += ` AND LOWER(service_category) = ANY($1)`;
    }
    const catalogAvgRes = await pool.query(catalogAvgQuery, catalogParams);
    const catAvg = catalogAvgRes.rows[0];
    const avgErp = parseFloat(catAvg.avg_erp_price || 0);
    const avgPur = parseFloat(catAvg.avg_purchase_cost || 0);
    const avgSales = parseFloat(catAvg.avg_sales_cost || avgErp);
    const catalogMarginPercent = avgSales > 0 ? ((avgSales - avgPur) / avgSales) * 100 : 0;

    // Role-tailored Executive / Operational Takeaway statement
    let executiveSummaryText = '';
    const formattedMargin = Math.round(netMarginPercent * 10) / 10;
    const formattedRev = (totalRev / 100000).toFixed(2);
    const formattedProfit = (totalProfit / 100000).toFixed(2);
    const formattedLoss = (Math.abs(totalProfit) / 100000).toFixed(2);

    if (scope.type === 'service') {
      executiveSummaryText = isProfitable
        ? `Your assigned service "${scope.categoryName}" is currently operating in PROFIT with a net margin of ${formattedMargin}%. Active service portfolio value is ₹${formattedRev} Lakhs generating ₹${formattedProfit} Lakhs in net earnings across ${stats.active_count || 0} active contracts.`
        : `ATTENTION REQUIRED: Service "${scope.categoryName}" is currently showing higher procurement costs than revenue with a deficit of ₹${formattedLoss} Lakhs. Review pricing discounts and expiring contracts.`;
    } else if (scope.type === 'department') {
      executiveSummaryText = isProfitable
        ? `Department "${scope.departmentName}" is currently operating in PROFIT with a net margin of ${formattedMargin}%. Department portfolio value is ₹${formattedRev} Lakhs generating ₹${formattedProfit} Lakhs across ${scope.categoryNames.length} service groups.`
        : `ATTENTION REQUIRED: Department "${scope.departmentName}" is showing higher costs than revenue with a net deficit of ₹${formattedLoss} Lakhs. Review departmental discounts and vendor costs.`;
    } else {
      executiveSummaryText = isProfitable
        ? `RMT enterprise portfolio is currently operating in PROFIT with a net margin of ${formattedMargin}%. Total company portfolio value is ₹${formattedRev} Lakhs generating ₹${formattedProfit} Lakhs in net earnings across all departments.`
        : `ATTENTION REQUIRED: RMT enterprise portfolio shows higher costs than revenue with a net deficit of ₹${formattedLoss} Lakhs. Review enterprise pricing discounts and expiring contracts immediately.`;
    }

    res.json({
      scope: {
        role: scope.role,
        type: scope.type,
        label: scope.label,
        badge: scope.badge,
        service_name: scope.categoryName || null,
        department_name: scope.departmentName || null,
        category_id: scope.categoryId || null,
        department_id: scope.departmentId || null,
        allowed_services: scope.type === 'department' ? scope.categories.map(c => c.name) : (scope.type === 'service' ? [scope.categoryName] : null)
      },
      is_profitable: isProfitable,
      status_label: isProfitable ? 'PROFITABLE (Healthy Growth)' : 'LOSS RISK (Action Needed)',
      net_margin_percent: formattedMargin,
      total_revenue: totalRev,
      total_purchase_cost: totalCost,
      total_profit: totalProfit,
      total_loss_value: totalLoss,
      active_contracts_count: parseInt(stats.active_count || 0),
      pending_renewals_count: parseInt(stats.pending_count || 0),
      expired_contracts_count: parseInt(stats.expired_count || 0),
      executive_summary: executiveSummaryText,
      catalog_avg_margin_percent: Math.round(catalogMarginPercent * 10) / 10,
      catalog_avg_discount_percent: Math.round(parseFloat(catAvg.avg_discount || 0) * 10) / 10,
      vendor_breakdown: vendorBreakdown
    });
  } catch (err) {
    console.error('Error computing pricing analytics:', err);
    res.status(500).json({ error: 'Failed to compute executive analytics' });
  }
});

// POST Create new product pricing entry
router.post('/', authenticateToken, async (req, res) => {
  try {
    const scope = await resolveUserPricingScope(req.user);

    let {
      vendor,
      product_name,
      service_category,
      list_price,
      erp_price,
      purchase_cost,
      sales_cost,
      coupon_discount_percent,
      description
    } = req.body;

    if (!vendor || !product_name) {
      return res.status(400).json({ error: 'Vendor and Product Name are required' });
    }

    // Role-based service category locking:
    // - Regular user: lock strictly to their assigned service
    // - Dept Admin: lock to services within their department
    if (scope.type === 'service') {
      service_category = scope.categoryName;
    } else if (scope.type === 'department') {
      const allowed = scope.categoryNames.map(n => n.toLowerCase());
      if (service_category && !allowed.includes(service_category.toLowerCase())) {
        return res.status(403).json({ 
          error: `Forbidden: As a department admin, you can only create products for services in ${scope.departmentName} (${scope.categoryNames.join(', ')})` 
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO product_pricing 
       (vendor, product_name, service_category, list_price, erp_price, purchase_cost, sales_cost, coupon_discount_percent, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        vendor,
        product_name,
        service_category || 'Software & Services',
        parseFloat(list_price || 0),
        parseFloat(erp_price || 0),
        parseFloat(purchase_cost || 0),
        parseFloat(sales_cost || 0),
        parseFloat(coupon_discount_percent || 0),
        description || ''
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating product pricing:', err);
    res.status(500).json({ error: 'Failed to create pricing entry' });
  }
});

// PUT Update existing product pricing (Editable ERP Price & Discounts)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const scope = await resolveUserPricingScope(req.user);

    const checkRes = await pool.query('SELECT * FROM product_pricing WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Product pricing entry not found' });
    }

    const existing = checkRes.rows[0];

    // Check scope permissions on existing item:
    if (scope.type === 'service') {
      const isMyService = scope.serviceVariants.some(v => v.toLowerCase() === (existing.service_category || '').toLowerCase());
      if (!isMyService) {
        return res.status(403).json({ error: 'Forbidden: You can only edit products belonging to your assigned service.' });
      }
    } else if (scope.type === 'department') {
      const allowed = scope.categoryNames.map(n => n.toLowerCase());
      const inDept = allowed.includes((existing.service_category || '').toLowerCase());
      if (!inDept) {
        return res.status(403).json({ error: `Forbidden: You can only edit products belonging to ${scope.departmentName}.` });
      }
    }

    let {
      vendor,
      product_name,
      service_category,
      list_price,
      erp_price,
      purchase_cost,
      sales_cost,
      coupon_discount_percent,
      description
    } = req.body;

    if (scope.type === 'service') {
      service_category = scope.categoryName;
    }

    const result = await pool.query(
      `UPDATE product_pricing SET
        vendor = $1,
        product_name = $2,
        service_category = $3,
        list_price = $4,
        erp_price = $5,
        purchase_cost = $6,
        sales_cost = $7,
        coupon_discount_percent = $8,
        description = $9,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [
        vendor !== undefined ? vendor : existing.vendor,
        product_name !== undefined ? product_name : existing.product_name,
        service_category !== undefined ? service_category : existing.service_category,
        list_price !== undefined ? parseFloat(list_price) : existing.list_price,
        erp_price !== undefined ? parseFloat(erp_price) : existing.erp_price,
        purchase_cost !== undefined ? parseFloat(purchase_cost) : existing.purchase_cost,
        sales_cost !== undefined ? parseFloat(sales_cost) : existing.sales_cost,
        coupon_discount_percent !== undefined ? parseFloat(coupon_discount_percent) : existing.coupon_discount_percent,
        description !== undefined ? description : existing.description,
        id
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating product pricing:', err);
    res.status(500).json({ error: 'Failed to update pricing entry' });
  }
});

// DELETE product pricing entry
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const scope = await resolveUserPricingScope(req.user);

    // Regular users cannot delete catalog items
    if (scope.type === 'service') {
      return res.status(403).json({ 
        error: 'Forbidden: Regular users cannot delete catalog items. Please contact your department administrator.' 
      });
    }

    const checkRes = await pool.query('SELECT * FROM product_pricing WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Product pricing entry not found' });
    }

    // Dept Admin can only delete items in their department
    if (scope.type === 'department') {
      const allowed = scope.categoryNames.map(n => n.toLowerCase());
      const inDept = allowed.includes((checkRes.rows[0].service_category || '').toLowerCase());
      if (!inDept) {
        return res.status(403).json({ 
          error: `Forbidden: You can only delete products belonging to your department (${scope.departmentName}).` 
        });
      }
    }

    const result = await pool.query('DELETE FROM product_pricing WHERE id = $1 RETURNING *', [id]);
    res.json({ message: 'Pricing entry deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('Error deleting product pricing:', err);
    res.status(500).json({ error: 'Failed to delete pricing entry' });
  }
});

export default router;
