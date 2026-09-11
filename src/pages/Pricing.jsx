import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { formatINR } from '../utils/formatters';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts';
import {
  Tag,
  DollarSign,
  Percent,
  Search,
  Plus,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  Sliders,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Layers,
  Building2,
  FileSpreadsheet,
  BarChart3,
  PieChart as PieChartIcon,
  LayoutGrid,
  Table as TableIcon,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Info,
  Check,
  X
} from 'lucide-react';
import GlassSelect from '../components/GlassSelect';

const PALETTE = [
  '#a559a5', // Indigo
  '#611c69', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#14b8a6'  // Teal
];

export default function Pricing() {
  const { user, token } = useAuth();
  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState('all');
  const [selectedServicePlan, setSelectedServicePlan] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('all'); // 'all' (Graphs + Table), 'graphs', 'table', 'cards'
  const [chartMode, setChartMode] = useState('comparison'); // 'comparison' (Bar), 'margin' (Ranked Margin %), 'share' (Donut)
  const [chartSort, setChartSort] = useState('revenue'); // 'revenue', 'profit', 'margin'
  const [activePieHover, setActivePieHover] = useState(null);

  // Role and scope detection
  const isRegularUser = user?.role === 'user' || analytics?.scope?.type === 'service';
  const isDeptAdmin = user?.role === 'dept_admin' || analytics?.scope?.type === 'department';
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'ceo' || (!isRegularUser && !isDeptAdmin);

  const scopeBadgeText = analytics?.scope?.badge || (
    isRegularUser
      ? `Service Specialist • ${user?.categoryName || 'My Service'}`
      : isDeptAdmin
      ? `Department Admin • ${user?.departmentName || 'Department'}`
      : 'Super Admin • Full Platform'
  );

  const pageTitle = isRegularUser
    ? `${user?.categoryName || analytics?.scope?.service_name || 'Service'} Pricing & Contract Margins`
    : isDeptAdmin
    ? `${user?.departmentName || analytics?.scope?.department_name || 'Department'} Pricing & ERP Margins`
    : 'Vendor Pricing & ERP Margins';

  const pageSubtitle = isRegularUser
    ? `Active partner procurement costs, standard ERP prices, sales price margins, and live renewal profitability for your assigned service: ${user?.categoryName || analytics?.scope?.service_name || 'Active Service'}.`
    : isDeptAdmin
    ? `Consolidated partner procurement costs, standard ERP prices, and department profitability diagnostics across all services in ${user?.departmentName || analytics?.scope?.department_name || 'your department'}.`
    : 'Consolidated partner procurement costs, standard ERP prices, sales price margins, and enterprise profitability diagnostics across all departments.';

  const sectionSummaryTitle = isRegularUser
    ? `${user?.categoryName || analytics?.scope?.service_name || 'Service'} Margin & Profitability Summary`
    : isDeptAdmin
    ? `${user?.departmentName || analytics?.scope?.department_name || 'Department'} Margin & Profitability Summary`
    : 'Executive Margin & Profitability Summary';

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    vendor: 'Microsoft',
    product_name: '',
    service_category: 'Software & Services',
    purchase_cost: '',
    sales_cost: '',
    erp_price: ''
  });
  const [isCustomVendor, setIsCustomVendor] = useState(false);
  const [isCustomServicePlan, setIsCustomServicePlan] = useState(false);

  // Available vendors for dropdown select in Add/Edit modal
  const availableVendors = useMemo(() => {
    const defaults = ['Microsoft', 'Google Workspace', 'AWS', 'Azure', 'Adobe', 'Sophos', 'Seqrite', 'Veeam', 'Acronis', 'Tally', 'Redington', 'Ingram Micro', 'Fortinet', 'Cisco'];
    const fromProds = products.map(p => p.vendor).filter(Boolean);
    const combined = Array.from(new Set([...defaults, ...fromProds, formData.vendor].filter(Boolean)));
    return combined.sort((a, b) => a.localeCompare(b));
  }, [products, formData.vendor]);

  // Available service plans for dropdown select in Add/Edit modal
  const availableServicePlans = useMemo(() => {
    if (isRegularUser) {
      const myService = analytics?.scope?.service_name || user?.categoryName || 'Software & Services';
      return [myService];
    }
    if (isDeptAdmin && analytics?.scope?.allowed_services?.length > 0) {
      return analytics.scope.allowed_services;
    }
    const defaults = ['Software & Services', 'M365', 'MS365', 'GWS', 'AWS Cloud', 'Azure Cloud', 'SSL Security', 'Domains & DNS', 'Cloud Backup', 'Endpoint Security', 'Hardware & IT Services', 'Tally & ERP'];
    const fromProds = products.map(p => p.service_category).filter(Boolean);
    const combined = Array.from(new Set([...defaults, ...fromProds, formData.service_category].filter(Boolean)));
    return combined.sort((a, b) => a.localeCompare(b));
  }, [products, formData.service_category, isRegularUser, isDeptAdmin, analytics?.scope, user]);

  // Fetch Pricing Data
  const fetchPricingData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [prodRes, anaRes] = await Promise.all([
        fetch('/api/pricing', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/pricing/analytics', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(data);
      }

      if (anaRes.ok) {
        const anaData = await anaRes.json();
        setAnalytics(anaData);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load pricing data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPricingData();
  }, [fetchPricingData]);

  // Vendor counts for tabs
  const vendorCounts = useMemo(() => {
    const counts = {};
    products.forEach(p => {
      const v = p.vendor || 'Other';
      counts[v] = (counts[v] || 0) + 1;
    });
    return counts;
  }, [products]);

  // Unique vendors for filtering
  const vendorsList = useMemo(() => {
    const set = new Set(products.map(p => p.vendor).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [products]);

  // Unique service plans / categories for filtering
  const servicePlansList = useMemo(() => {
    const set = new Set(products.map(p => p.service_category).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [products]);

  // Filtered Products
  const normalizeText = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesVendor = selectedVendor === 'all' || p.vendor.toLowerCase() === selectedVendor.toLowerCase();
      if (!matchesVendor) return false;

      const matchesPlan = selectedServicePlan === 'all' || (p.service_category || '').toLowerCase() === selectedServicePlan.toLowerCase();
      if (!matchesPlan) return false;

      if (!searchQuery.trim()) return true;

      const queryRaw = searchQuery.toLowerCase().trim();
      const queryNorm = normalizeText(searchQuery);
      const terms = queryRaw.split(/\s+/);

      const prodName = (p.product_name || '').toLowerCase();
      const vendorName = (p.vendor || '').toLowerCase();
      const category = (p.service_category || '').toLowerCase();
      const description = (p.description || '').toLowerCase();
      const associatedClients = (p.associated_clients || '').toLowerCase();

      const prodNameNorm = normalizeText(p.product_name);
      const vendorNameNorm = normalizeText(p.vendor);
      const categoryNorm = normalizeText(p.service_category);
      const associatedClientsNorm = normalizeText(p.associated_clients);

      const directMatch = prodName.includes(queryRaw) ||
                          vendorName.includes(queryRaw) ||
                          category.includes(queryRaw) ||
                          description.includes(queryRaw) ||
                          associatedClients.includes(queryRaw) ||
                          prodNameNorm.includes(queryNorm) ||
                          vendorNameNorm.includes(queryNorm) ||
                          categoryNorm.includes(queryNorm) ||
                          associatedClientsNorm.includes(queryNorm);

      if (directMatch) return true;

      const searchableText = `${prodName} ${vendorName} ${category} ${description} ${associatedClients}`;
      return terms.every(term => searchableText.includes(term) || normalizeText(searchableText).includes(normalizeText(term)));
    });
  }, [products, selectedVendor, selectedServicePlan, searchQuery]);

  // Chart Data: Aggregated Sales Cost, Purchase Cost, and Profit by Vendor
  const chartVendorData = useMemo(() => {
    if (!filteredProducts || filteredProducts.length === 0) return [];
    
    const map = {};
    filteredProducts.forEach(p => {
      const v = p.vendor || 'Other';
      if (!map[v]) {
        map[v] = { vendor: v, sales_cost: 0, purchase_cost: 0, profit: 0, contracts: 0 };
      }
      const cost = parseFloat(p.purchase_cost || 0);
      const sellingPrice = parseFloat(p.sales_cost > 0 ? p.sales_cost : (p.erp_price > 0 ? p.erp_price : (p.discounted_price || p.list_price || 0)));
      const prof = sellingPrice - cost;
      const clientContracts = Math.max(1, parseInt(p.active_client_contracts || 0));

      map[v].sales_cost += sellingPrice * clientContracts;
      map[v].purchase_cost += cost * clientContracts;
      map[v].profit += prof * clientContracts;
      map[v].contracts += clientContracts;
    });

    const totalPortfolio = Object.values(map).reduce((acc, curr) => acc + curr.sales_cost, 0);

    const list = Object.values(map).map(item => ({
      ...item,
      sales_cost: Math.round(item.sales_cost),
      purchase_cost: Math.round(item.purchase_cost),
      profit: Math.round(item.profit),
      margin_percent: item.sales_cost > 0 ? Math.round((item.profit / item.sales_cost) * 1000) / 10 : 0,
      share_percent: totalPortfolio > 0 ? Math.round((item.sales_cost / totalPortfolio) * 1000) / 10 : 0
    }));

    if (chartSort === 'profit') {
      return list.sort((a, b) => b.profit - a.profit);
    } else if (chartSort === 'margin') {
      return list.sort((a, b) => b.margin_percent - a.margin_percent);
    }
    return list.sort((a, b) => b.sales_cost - a.sales_cost);
  }, [filteredProducts, chartSort]);

  // Strategic Vendor Highlights
  const strategicHighlights = useMemo(() => {
    if (!chartVendorData || chartVendorData.length === 0) return null;
    const topMargin = [...chartVendorData].sort((a, b) => b.margin_percent - a.margin_percent)[0];
    const topRevenue = [...chartVendorData].sort((a, b) => b.sales_cost - a.sales_cost)[0];
    const topProfit = [...chartVendorData].sort((a, b) => b.profit - a.profit)[0];
    return { topMargin, topRevenue, topProfit };
  }, [chartVendorData]);

  // Handle Edit Click
  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setIsCustomVendor(false);
    setIsCustomServicePlan(false);
    setFormData({
      vendor: product.vendor,
      product_name: product.product_name,
      service_category: product.service_category || 'Software & Services',
      purchase_cost: product.purchase_cost !== undefined ? product.purchase_cost : '',
      sales_cost: product.sales_cost || '',
      erp_price: product.erp_price || ''
    });
    setIsEditModalOpen(true);
  };

  // Save Edit ERP Price / Pricing
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!formData.product_name || !formData.vendor) {
      toast.error('Vendor and Product Name are required');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingProduct ? `/api/pricing/${editingProduct.id}` : '/api/pricing';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast.success(editingProduct ? 'ERP Price updated successfully!' : 'New Product added to catalog!');
        setIsEditModalOpen(false);
        setIsAddModalOpen(false);
        setEditingProduct(null);
        fetchPricingData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save pricing data');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error while saving pricing data');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Product Entry
  const handleDeleteProduct = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" from pricing catalog?`)) return;
    try {
      const res = await fetch(`/api/pricing/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Product deleted from catalog');
        fetchPricingData();
      } else {
        toast.error('Failed to delete product');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error deleting product');
    }
  };

  // Modal Dynamic Calculator Preview
  const liveModalCalc = useMemo(() => {
    const cost = parseFloat(formData.purchase_cost || 0);
    const sale = parseFloat(formData.sales_cost || formData.erp_price || 0);
    const profit = sale - cost;
    const margin = sale > 0 ? Math.round((profit / sale) * 1000) / 10 : 0;
    return { cost, sale, profit, margin };
  }, [formData.purchase_cost, formData.sales_cost, formData.erp_price]);

  // Custom Tooltip for Vendor Financial Bar Chart
  const CustomBarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const salesCostVal = payload.find(p => p.dataKey === 'sales_cost')?.value || 0;
      const purchaseCostVal = payload.find(p => p.dataKey === 'purchase_cost')?.value || 0;
      const profitVal = payload.find(p => p.dataKey === 'profit')?.value || 0;
      const marginPct = salesCostVal > 0 ? Math.round((profitVal / salesCostVal) * 1000) / 10 : 0;

      return (
        <div className="p-3.5 glass rounded-xl border border-[var(--glass-border)] shadow-2xl text-xs space-y-2 min-w-[200px]">
          <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-1.5">
            <span className="font-extrabold text-sm text-[var(--text-primary)]">{label}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${marginPct >= 20 ? 'badge-success' : marginPct >= 10 ? 'badge-warning' : 'badge-danger'}`}>
              {marginPct}% Margin
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Portfolio Revenue:
              </span>
              <span className="font-extrabold text-[var(--text-primary)]">{formatINR(salesCostVal)}</span>
            </div>
            <div className="flex justify-between items-center text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Procurement Cost:
              </span>
              <span className="font-extrabold text-[var(--text-primary)]">{formatINR(purchaseCostVal)}</span>
            </div>
            <div className="flex justify-between items-center text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Net Gross Profit:
              </span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{formatINR(profitVal)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Margin Ranking Horizontal Bar Chart
  const CustomMarginTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="p-3.5 glass rounded-xl border border-[var(--glass-border)] shadow-2xl text-xs space-y-1.5 min-w-[190px]">
          <p className="font-bold text-sm text-[var(--text-primary)]">{data.vendor}</p>
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>Net Margin %:</span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{data.margin_percent}%</span>
          </div>
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>Profit Yield:</span>
            <span className="font-bold">{formatINR(data.profit)}</span>
          </div>
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>Total Sales Cost:</span>
            <span className="font-bold">{formatINR(data.sales_cost)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Donut Pie Chart
  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="p-3.5 glass rounded-xl border border-[var(--glass-border)] shadow-2xl text-xs space-y-1 min-w-[190px]">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-[var(--text-primary)]">{data.name}</span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full badge-info">
              {data.payload.share_percent}% Share
            </span>
          </div>
          <p className="text-[var(--text-secondary)] flex justify-between">
            <span>Portfolio Value:</span>
            <span className="font-bold text-[var(--text-primary)]">{formatINR(data.value)}</span>
          </p>
          <p className="text-[var(--text-secondary)] flex justify-between">
            <span>Profit Generated:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatINR(data.payload.profit)}</span>
          </p>
          <p className="text-[var(--text-muted)] text-[11px] pt-1 border-t border-[var(--glass-border)] flex justify-between">
            <span>Net Margin:</span>
            <span className="font-bold">{data.payload.margin_percent}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 w-full pb-16 animate-fadeIn">

      {/* SVG Gradients for Charts */}
      <svg width="0" height="0" className="hidden">
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#611c69" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.65} />
          </linearGradient>
          <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#d97706" stopOpacity={0.65} />
          </linearGradient>
          <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#059669" stopOpacity={0.65} />
          </linearGradient>
          <linearGradient id="marginBarGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a559a5" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.95} />
          </linearGradient>
        </defs>
      </svg>

      {/* ── HEADER WITH ACTIONS ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className={`p-2.5 rounded-2xl border shadow-xs ${
              isRegularUser
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : isDeptAdmin
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
            }`}>
              <Tag className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  isRegularUser
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : isDeptAdmin
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                }`}>
                  {isRegularUser ? (
                    <ShieldCheck className="w-3 h-3" />
                  ) : isDeptAdmin ? (
                    <Building2 className="w-3 h-3" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {scopeBadgeText}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-primary)] mt-1">
                {pageTitle}
              </h1>
            </div>
          </div>
          <p className="mt-1.5 text-xs sm:text-sm text-[var(--text-secondary)]">
            {pageSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPricingData}
            disabled={loading}
            className="btn-secondary !px-4 !py-2.5 !rounded-xl text-xs font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>

          <button
            onClick={() => {
              setEditingProduct(null);
              setIsCustomVendor(false);
              setIsCustomServicePlan(false);
              const defaultCategory = isRegularUser
                ? (analytics?.scope?.service_name || user?.categoryName || 'Software & Services')
                : (isDeptAdmin && analytics?.scope?.allowed_services?.[0]) || 'Software & Services';
              setFormData({
                vendor: 'Microsoft',
                product_name: '',
                service_category: defaultCategory,
                purchase_cost: '',
                sales_cost: '',
                erp_price: ''
              });
              setIsAddModalOpen(true);
            }}
            className="btn-primary !px-4 !py-2.5 !rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product Pricing</span>
          </button>
        </div>
      </div>

      {/* ── EXECUTIVE DATA ANALYTICAL DASHBOARD ── */}
      {analytics && (
        <div className="glass p-6 sm:p-7 space-y-6 relative overflow-hidden border border-[var(--glass-border)] shadow-lg rounded-2xl">
          
          {/* Top Banner: Profit/Loss Status + Key Metrics */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-[var(--glass-border)]">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  analytics.is_profitable ? 'badge-success' : 'badge-danger'
                }`}>
                  {analytics.is_profitable ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {analytics.status_label || 'Profitable'}
                </span>
                <span className="text-xs text-[var(--text-muted)] font-semibold">
                  • {analytics.active_contracts_count || 0} active contract{analytics.active_contracts_count === 1 ? '' : 's'} tracked
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                {sectionSummaryTitle}
              </h2>
            </div>

            {/* Prominent High-Impact KPI Badges */}
            <div className="flex items-center gap-4 p-2.5 sm:p-3 rounded-2xl glass-subtle border border-[var(--glass-border)] shadow-xs">
              <div className="px-3">
                <p className="text-[10px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider">Net Margin</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    +{analytics.net_margin_percent}%
                  </p>
                </div>
              </div>
              <div className="h-10 w-px bg-[var(--glass-border)]" />
              <div className="px-3">
                <p className="text-[10px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider">Net Profit Generated</p>
                <p className="text-xl sm:text-2xl font-black text-[var(--text-primary)] mt-0.5">
                  {formatINR(analytics.total_profit)}
                </p>
              </div>
            </div>
          </div>

          {/* AI / Non-Technical Business Takeaway Callout */}
          <div className="p-4 rounded-2xl flex items-start gap-3.5 border border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-xs">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-xs sm:text-sm leading-relaxed space-y-1">
              <span className="font-extrabold text-indigo-900 dark:text-indigo-300">
                {isRegularUser ? 'Service Takeaway:' : isDeptAdmin ? 'Department Takeaway:' : 'Executive Takeaway:'}
              </span>
              <p className="text-slate-700 dark:text-slate-300 font-medium">
                {analytics.executive_summary}
              </p>
            </div>
          </div>

          {/* 4 Core Financial Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* KPI 1: Total Portfolio Value */}
            <div className="stat-card p-5 space-y-2 rounded-2xl border border-[var(--glass-border)] hover:border-indigo-400/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Portfolio Revenue</span>
                <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
                  {formatINR(analytics.total_revenue)}
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--text-secondary)] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{analytics.active_contracts_count} Active Contracts</span>
                </div>
              </div>
            </div>

            {/* KPI 2: Total Purchase Cost */}
            <div className="stat-card p-5 space-y-2 rounded-2xl border border-[var(--glass-border)] hover:border-amber-400/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Procurement Cost</span>
                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Building2 className="w-4 h-4" />
                </span>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
                  {formatINR(analytics.total_purchase_cost)}
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--text-secondary)] font-semibold">
                  <span className="text-[var(--text-muted)]">Cost of Goods (COGS):</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {Math.round((analytics.total_purchase_cost / (analytics.total_revenue || 1)) * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* KPI 3: Catalog Avg ERP Margin */}
            <div className="stat-card p-5 space-y-2 rounded-2xl border border-[var(--glass-border)] hover:border-emerald-400/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Target Catalog Margin</span>
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Percent className="w-4 h-4" />
                </span>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {analytics.catalog_avg_margin_percent}%
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--text-secondary)] font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span>ERP Baseline Target (Healthy)</span>
                </div>
              </div>
            </div>

            {/* KPI 4: Expired Contract Risk */}
            <div className="stat-card p-5 space-y-2 rounded-2xl border border-[var(--glass-border)] hover:border-rose-400/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Expired Churn Exposure</span>
                <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                </span>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                  {formatINR(analytics.total_loss_value)}
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--text-secondary)] font-semibold">
                  <span className="font-bold text-rose-500">{analytics.expired_contracts_count} accounts</span>
                  <span>pending renewal</span>
                </div>
              </div>
            </div>

          </div>

          {/* Revenue Stream Breakdown Multi-Segment Progress Bar */}
          <div className="space-y-2.5 pt-2">
            <div className="flex flex-wrap justify-between items-center text-xs font-semibold gap-2">
              <span className="font-bold text-[var(--text-secondary)]">
                Portfolio Capital Allocation Spread:
              </span>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Net Profit ({analytics.net_margin_percent}%) • {formatINR(analytics.total_profit)}
                </span>
                <span className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Cost of Goods ({Math.round((analytics.total_purchase_cost / (analytics.total_revenue || 1)) * 100)}%) • {formatINR(analytics.total_purchase_cost)}
                </span>
                {analytics.total_loss_value > 0 && (
                  <span className="flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    Expired At-Risk ({Math.round((analytics.total_loss_value / (analytics.total_revenue || 1)) * 100)}%) • {formatINR(analytics.total_loss_value)}
                  </span>
                )}
              </div>
            </div>
            
            <div className="h-3.5 w-full rounded-full overflow-hidden flex bg-slate-200/70 dark:bg-slate-800 p-0.5 border border-[var(--glass-border)] shadow-inner">
              <div 
                style={{ 
                  width: `${Math.min(100, Math.max(8, (analytics.total_profit / (analytics.total_revenue + analytics.total_loss_value || 1)) * 100))}%`
                }} 
                className="bg-emerald-500 rounded-l-full transition-all duration-500 hover:brightness-110 cursor-pointer" 
                title={`Net Profit: ${formatINR(analytics.total_profit)} (${analytics.net_margin_percent}%)`}
              />
              <div 
                style={{ 
                  width: `${Math.min(100, Math.max(8, (analytics.total_purchase_cost / (analytics.total_revenue + analytics.total_loss_value || 1)) * 100))}%`
                }} 
                className="bg-amber-500 transition-all duration-500 hover:brightness-110 cursor-pointer" 
                title={`Procurement Cost: ${formatINR(analytics.total_purchase_cost)}`}
              />
              {analytics.total_loss_value > 0 && (
                <div 
                  style={{ 
                    width: `${Math.min(100, (analytics.total_loss_value / (analytics.total_revenue + analytics.total_loss_value || 1)) * 100)}%`
                  }} 
                  className="bg-rose-500 rounded-r-full transition-all duration-500 hover:brightness-110 cursor-pointer" 
                  title={`Expired Risk: ${formatINR(analytics.total_loss_value)}`}
                />
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── STRATEGIC VENDOR PERFORMANCE SUMMARY CARDS ── */}
      {strategicHighlights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl glass border border-emerald-500/20 flex items-center justify-between shadow-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Top Margin Producer
              </span>
              <p className="text-base font-black text-[var(--text-primary)]">
                {strategicHighlights.topMargin.vendor}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {formatINR(strategicHighlights.topMargin.profit)} profit generated
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                +{strategicHighlights.topMargin.margin_percent}% Margin
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl glass border border-blue-500/20 flex items-center justify-between shadow-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Volume Anchor Partner
              </span>
              <p className="text-base font-black text-[var(--text-primary)]">
                {strategicHighlights.topRevenue.vendor}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {formatINR(strategicHighlights.topRevenue.sales_cost)} sales value
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                {strategicHighlights.topRevenue.share_percent}% Portfolio
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl glass border border-indigo-500/20 flex items-center justify-between shadow-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Net Profit Driver
              </span>
              <p className="text-base font-black text-[var(--text-primary)]">
                {strategicHighlights.topProfit.vendor}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {strategicHighlights.topProfit.contracts} active accounts
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                {formatINR(strategicHighlights.topProfit.profit)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── VISUAL ANALYTICS & INTERACTIVE GRAPHS SECTION ── */}
      {(viewMode === 'all' || viewMode === 'graphs') && chartVendorData.length > 0 && (
        <div className="space-y-4">
          
          {/* Section Header with Graph Switching Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-black text-[var(--text-primary)]">
                Visual Analytics & Profitability Dynamics
              </h2>
            </div>

            {/* Interactive Graph Display Tabs & Sorter */}
            <div className="flex items-center gap-2">
              <div className="flex items-center glass-subtle p-1 rounded-xl border border-[var(--glass-border)]">
                <button
                  onClick={() => setChartMode('comparison')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    chartMode === 'comparison'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Revenue vs Cost vs Profit"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Financial Comparison
                </button>

                <button
                  onClick={() => setChartMode('margin')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    chartMode === 'margin'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Ranked Margin % Performance"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Margin % Ranking
                </button>
              </div>

              {/* Sort selector */}
              <div className="flex items-center glass-subtle p-1 rounded-xl border border-[var(--glass-border)] text-xs">
                <span className="px-2 text-[var(--text-muted)] font-semibold">Sort:</span>
                <button
                  onClick={() => setChartSort('revenue')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    chartSort === 'revenue' ? 'bg-[var(--glass-surface-1)] text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-muted)]'
                  }`}
                >
                  Revenue
                </button>
                <button
                  onClick={() => setChartSort('profit')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    chartSort === 'profit' ? 'bg-[var(--glass-surface-1)] text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-muted)]'
                  }`}
                >
                  Profit
                </button>
                <button
                  onClick={() => setChartSort('margin')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    chartSort === 'margin' ? 'bg-[var(--glass-surface-1)] text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-muted)]'
                  }`}
                >
                  Margin %
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart 1: Main Financial Comparison or Margin % Ranking Bar Chart */}
            <div className="lg:col-span-2 glass p-6 space-y-4 rounded-2xl border border-[var(--glass-border)] shadow-md">
              <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                    {chartMode === 'comparison' ? (
                      <>
                        <Building2 className="w-4 h-4 text-indigo-500" />
                        Vendor Financial Matrix (Revenue vs Procurement Cost vs Profit)
                      </>
                    ) : (
                      <>
                        <Award className="w-4 h-4 text-emerald-500" />
                        Vendor Profit Margin % Performance (Highest to Lowest)
                      </>
                    )}
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)] font-semibold mt-0.5">
                    {chartMode === 'comparison'
                      ? 'Side-by-side breakdown of top vendors by commercial volume and yield'
                      : 'Relative gross profit margins generated per product/service group'}
                  </p>
                </div>
              </div>

              {chartMode === 'comparison' ? (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartVendorData} margin={{ top: 15, right: 10, left: -10, bottom: 25 }}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#611c69" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.7} />
                        </linearGradient>
                        <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#d97706" stopOpacity={0.7} />
                        </linearGradient>
                        <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                      <XAxis 
                        dataKey="vendor" 
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={55}
                        stroke="var(--chart-grid)"
                        tick={{ fontSize: 11, fill: 'var(--text-secondary)', fontWeight: 600 }}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="var(--chart-grid)"
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        tickFormatter={(val) => val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${val}`}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                      <Legend 
                        wrapperStyle={{ paddingTop: 10, fontSize: '11px' }}
                        formatter={(value) => {
                          if (value === 'sales_cost') return <span className="font-extrabold text-blue-600 dark:text-blue-400">Sales Cost (Revenue)</span>;
                          if (value === 'purchase_cost') return <span className="font-extrabold text-amber-600 dark:text-amber-400">Purchase Cost</span>;
                          if (value === 'profit') return <span className="font-extrabold text-emerald-600 dark:text-emerald-400">Net Profit</span>;
                          return value;
                        }}
                      />
                      <Bar dataKey="sales_cost" name="sales_cost" fill="#611c69" radius={[6, 6, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="purchase_cost" name="purchase_cost" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="profit" name="profit" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={[...chartVendorData].sort((a, b) => b.margin_percent - a.margin_percent)}
                      margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
                      <XAxis 
                        type="number" 
                        domain={[0, 'dataMax + 5']} 
                        unit="%"
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        tickLine={false}
                        stroke="var(--chart-grid)"
                      />
                      <YAxis 
                        dataKey="vendor" 
                        type="category" 
                        tick={{ fontSize: 11, fill: 'var(--text-secondary)', fontWeight: 700 }}
                        width={110}
                        tickLine={false}
                        stroke="var(--chart-grid)"
                      />
                      <Tooltip content={<CustomMarginTooltip />} cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }} />
                      <Bar 
                        dataKey="margin_percent" 
                        name="Margin %" 
                        radius={[0, 8, 8, 0]} 
                        maxBarSize={22}
                      >
                        {[...chartVendorData].sort((a, b) => b.margin_percent - a.margin_percent).map((entry, index) => (
                          <Cell 
                            key={`margin-cell-${index}`} 
                            fill={entry.margin_percent >= 20 ? '#10b981' : entry.margin_percent >= 10 ? '#611c69' : '#f59e0b'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Chart 2: Vendor Portfolio Share Donut Chart with Center Metric */}
            <div className="glass p-6 space-y-4 flex flex-col justify-between rounded-2xl border border-[var(--glass-border)] shadow-md">
              <div className="border-b border-[var(--glass-border)] pb-3">
                <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-indigo-500" />
                  Portfolio Share Distribution
                </h3>
                <p className="text-[11px] text-[var(--text-muted)] font-semibold mt-0.5">
                  Proportion of total annual contract revenue by vendor
                </p>
              </div>

              {/* Donut Chart with Center Stat Overlay */}
              <div className="h-60 w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartVendorData}
                      dataKey="sales_cost"
                      nameKey="vendor"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={88}
                      paddingAngle={3}
                      onMouseEnter={(_, idx) => setActivePieHover(chartVendorData[idx])}
                      onMouseLeave={() => setActivePieHover(null)}
                    >
                      {chartVendorData.map((_, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={PALETTE[index % PALETTE.length]} 
                          className="transition-all duration-200 hover:opacity-80 cursor-pointer"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Central Donut Stat */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-[10px] font-extrabold uppercase text-[var(--text-muted)] tracking-wider">
                    {activePieHover ? activePieHover.vendor : 'Total Portfolio'}
                  </span>
                  <p className="text-base font-black text-[var(--text-primary)]">
                    {activePieHover ? `${activePieHover.share_percent}%` : formatINR(analytics?.total_revenue || 0)}
                  </p>
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                    {activePieHover ? `+${activePieHover.margin_percent}% margin` : `${chartVendorData.length} Vendors`}
                  </span>
                </div>
              </div>

              {/* Clean Legend Chips */}
              <div className="space-y-1.5 pt-3 border-t border-[var(--glass-border)]">
                {chartVendorData.slice(0, 5).map((item, idx) => (
                  <div key={item.vendor} className="flex items-center justify-between text-xs py-0.5">
                    <div className="flex items-center gap-2 truncate">
                      <span 
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: PALETTE[idx % PALETTE.length] }} 
                      />
                      <span className="font-bold text-[var(--text-secondary)] truncate">{item.vendor}</span>
                    </div>
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <span className="text-[var(--text-muted)]">{item.share_percent}%</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">+{item.margin_percent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── TOOLBAR: VENDOR TABS, SEARCH BAR & PRESENTATION VIEW SWITCHER ── */}
      <div className="space-y-3 pt-2">
        
        {/* Vendor Filter Pill Tabs with Counts */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
          <button
            onClick={() => setSelectedVendor('all')}
            className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedVendor === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'glass-subtle text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--glass-border)]'
            }`}
          >
            <span>All Vendors</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              selectedVendor === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200/80 dark:bg-slate-800 text-[var(--text-muted)]'
            }`}>
              {products.length}
            </span>
          </button>

          {vendorsList.filter(v => v !== 'all').map(v => (
            <button
              key={v}
              onClick={() => setSelectedVendor(v)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedVendor === v
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'glass-subtle text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--glass-border)]'
              }`}
            >
              <span>{v}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                selectedVendor === v ? 'bg-white/20 text-white' : 'bg-slate-200/80 dark:bg-slate-800 text-[var(--text-muted)]'
              }`}>
                {vendorCounts[v] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* View Format Toggle & Toolbar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          
          {/* View Format Switcher */}
          <div className="flex items-center glass-subtle p-1 rounded-xl border border-[var(--glass-border)] shadow-xs">
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'all' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Show Graphs + Table View"
            >
              <Sparkles className="w-3.5 h-3.5" />
              All Views
            </button>

            <button
              onClick={() => setViewMode('graphs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'graphs' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Focus on Visual Graphs"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Graphs Only
            </button>

            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'table' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Focus on Detailed Data Table"
            >
              <TableIcon className="w-3.5 h-3.5" />
              Catalog Table
            </button>

            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'cards' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Visual Cards Format"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Product Cards
            </button>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full lg:w-auto">
            {/* Service Plan Filter */}
            {isRegularUser ? (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shadow-xs whitespace-nowrap">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Service: {analytics?.scope?.service_name || user?.categoryName || 'My Service'}</span>
              </div>
            ) : (
              <div className="relative min-w-[180px]">
                <GlassSelect
                  value={selectedServicePlan}
                  onChange={(e, val) => setSelectedServicePlan(val || e.target.value)}
                  options={[
                    { value: 'all', label: isDeptAdmin ? `All ${user?.departmentName || 'Dept'} Services` : 'All Service Plans' },
                    ...servicePlansList.filter(sp => sp !== 'all').map(sp => ({ value: sp, label: sp })),
                  ]}
                  className="w-full"
                />
              </div>
            )}

            {/* Search Bar */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search product, vendor, client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-[var(--glass-surface-2)] border border-[var(--glass-border)] focus:outline-none focus:ring-2 focus:ring-indigo-500 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] shadow-xs transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Reset Filters Button */}
            {(selectedVendor !== 'all' || selectedServicePlan !== 'all' || searchQuery.trim()) && (
              <button
                onClick={() => {
                  setSelectedVendor('all');
                  setSelectedServicePlan('all');
                  setSearchQuery('');
                }}
                className="px-3 py-2 rounded-xl text-xs font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all whitespace-nowrap flex items-center gap-1"
                title="Reset all filters"
              >
                <X className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── VISUAL PRODUCT CARDS FORMAT ── */}
      {(viewMode === 'cards') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full p-16 text-center text-[var(--text-muted)] text-sm glass rounded-2xl">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-3 text-indigo-500" />
              Loading Visual Catalog Cards...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full p-16 text-center text-[var(--text-muted)] text-sm glass rounded-2xl">
              No products found matching your active filters.
            </div>
          ) : (
            filteredProducts.map((p) => {
              const purchaseCost = parseFloat(p.purchase_cost || 0);
              const salesCost = parseFloat(p.sales_cost || (p.erp_price > 0 ? p.erp_price : (p.discounted_price || p.list_price || 0)));
              const profitAmount = salesCost - purchaseCost;
              const marginPct = salesCost > 0 ? Math.round((profitAmount / salesCost) * 1000) / 10 : 0;
              const costPct = salesCost > 0 ? Math.round((purchaseCost / salesCost) * 1000) / 10 : 0;

              return (
                <div 
                  key={p.id} 
                  className="glass p-5 space-y-4 rounded-2xl border border-[var(--glass-border)] hover:border-indigo-400/40 hover:shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-black text-sm flex-shrink-0">
                        {p.vendor.substring(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <h3 className="font-extrabold text-sm text-[var(--text-primary)] leading-tight">{p.product_name}</h3>
                        <p className="text-[11px] text-[var(--text-muted)] font-semibold mt-0.5">
                          {p.vendor} • <span className="text-[var(--text-secondary)]">{p.service_category || 'General'}</span>
                        </p>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                      profitAmount > 0 ? 'badge-success' : 'badge-danger'
                    }`}>
                      {marginPct >= 0 ? '+' : ''}{marginPct}% margin
                    </span>
                  </div>

                  {/* Financial Breakdown Boxes */}
                  <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl glass-subtle border border-[var(--glass-border)]">
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] font-extrabold uppercase">Purchase Cost</p>
                      <p className="text-xs font-black text-[var(--text-primary)] mt-0.5">{formatINR(purchaseCost)}</p>
                      <p className="text-[9px] text-[var(--text-muted)] font-semibold">{costPct}% cost</p>
                    </div>
                    <div className="rounded-lg p-1 bg-amber-500/10 border border-amber-500/20">
                      <p className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">ERP Price</p>
                      <p className="text-xs font-black mt-0.5 text-amber-600 dark:text-amber-400">{formatINR(p.erp_price)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] font-extrabold uppercase">Sales Cost</p>
                      <p className="text-xs font-black text-[var(--text-primary)] mt-0.5">{formatINR(salesCost)}</p>
                    </div>
                  </div>

                  {/* Visual Cost vs Profit Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-extrabold">
                      <span className="text-[var(--text-muted)]">Cost vs Profit Share</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{formatINR(profitAmount)} Net Profit</span>
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800">
                      <div style={{ width: `${Math.min(100, Math.max(0, costPct))}%` }} className="bg-amber-500" title={`Cost ${costPct}%`} />
                      <div style={{ width: `${Math.min(100, Math.max(0, marginPct))}%` }} className="bg-emerald-500" title={`Profit ${marginPct}%`} />
                    </div>
                  </div>

                  {/* Actions & Contracts info */}
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--glass-border)] text-xs">
                    <span className="text-[11px] text-[var(--text-muted)] font-semibold">
                      {parseInt(p.active_client_contracts || 0)} client contract(s)
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="btn-secondary !px-2.5 !py-1 !rounded-lg text-amber-600 dark:text-amber-400 font-bold"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit ERP
                      </button>
                      {!isRegularUser && (
                        <button
                          onClick={() => handleDeleteProduct(p.id, p.product_name)}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-500/10 transition-all"
                          title="Delete product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── PRODUCT PRICING CATALOG TABLE ── */}
      {(viewMode === 'all' || viewMode === 'table') && (
        <div className="glass overflow-hidden rounded-2xl border border-[var(--glass-border)] shadow-md">
          {loading ? (
            <div className="p-16 text-center text-[var(--text-muted)] text-sm">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-3 text-indigo-500" />
              Loading Vendor Pricing Catalog...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-16 text-center text-[var(--text-muted)] text-sm">
              No products found matching your current search criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--glass-surface-2)] border-b border-[var(--glass-border)] text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="px-5 py-4">
                      Vendor & Product
                    </th>
                    <th className="px-4 py-4">
                      Service Plan
                    </th>
                    <th className="px-4 py-4 text-right">
                      Purchase Cost (COGS)
                    </th>
                    <th className="px-4 py-4 text-right bg-amber-500/10 text-amber-600 dark:text-amber-400 border-x border-amber-500/20">
                      Standard ERP Price
                    </th>
                    <th className="px-4 py-4 text-right">
                      Contract Sales Cost
                    </th>
                    <th className="px-4 py-4 text-right">
                      Net Margin & Profit
                    </th>
                    <th className="px-4 py-4 text-center">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--glass-border)] text-xs">
                  {filteredProducts.map((p) => {
                    const purchaseCost = parseFloat(p.purchase_cost || 0);
                    const salesCost = parseFloat(p.sales_cost || (p.erp_price > 0 ? p.erp_price : (p.discounted_price || p.list_price || 0)));
                    const profitAmount = salesCost - purchaseCost;
                    const marginPct = salesCost > 0 ? Math.round((profitAmount / salesCost) * 1000) / 10 : 0;
                    const costPct = salesCost > 0 ? Math.round((purchaseCost / salesCost) * 1000) / 10 : 0;

                    return (
                      <tr key={p.id} className="hover:bg-indigo-500/[0.03] transition-colors group">
                        
                        {/* Vendor & Product */}
                        <td className="px-5 py-4 font-medium">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-black text-xs flex-shrink-0">
                              {p.vendor.substring(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <p className="font-extrabold text-[var(--text-primary)] text-sm">{p.product_name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-[var(--text-muted)] font-semibold">{p.vendor}</span>
                                {parseInt(p.active_client_contracts || 0) > 0 && (
                                  <span className="px-2 py-0.5 text-[9px] font-black rounded-full badge-success">
                                    {p.active_client_contracts} contract{parseInt(p.active_client_contracts) > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Service Plan / Category */}
                        <td className="px-4 py-4">
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-200/60 dark:bg-slate-800 text-[var(--text-secondary)] border border-[var(--glass-border)]">
                            {p.service_category || 'General'}
                          </span>
                        </td>

                        {/* Purchase Cost (COGS) */}
                        <td className="px-4 py-4 text-right font-medium">
                          <span className="font-bold text-[var(--text-primary)]">{formatINR(purchaseCost)}</span>
                          <span className="block text-[10px] text-[var(--text-muted)] font-semibold">({costPct}% of sales)</span>
                        </td>

                        {/* ERP Price (Editable) */}
                        <td className="px-4 py-4 text-right font-black bg-amber-500/5 border-x border-amber-500/20">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-all cursor-pointer font-black"
                            title="Click to Edit ERP Price"
                          >
                            <span>{formatINR(p.erp_price)}</span>
                            <Edit2 className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                          </button>
                        </td>

                        {/* Sales Cost */}
                        <td className="px-4 py-4 text-right font-black text-[var(--text-primary)] text-sm">
                          {formatINR(salesCost)}
                        </td>

                        {/* Net Margin & Profit */}
                        <td className="px-4 py-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-black inline-flex items-center gap-1 ${
                              profitAmount > 0 
                                ? 'badge-success' 
                                : profitAmount === 0
                                ? 'badge-warning'
                                : 'badge-danger'
                            }`}>
                              {marginPct >= 0 ? '+' : ''}{marginPct}%
                            </span>
                            <span className="text-[10px] font-extrabold" style={{ color: profitAmount > 0 ? 'var(--success)' : profitAmount === 0 ? 'var(--text-muted)' : 'var(--danger)' }}>
                              {profitAmount >= 0 ? `+${formatINR(profitAmount)} profit` : `-${formatINR(Math.abs(profitAmount))} loss`}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(p)}
                              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-indigo-600 hover:bg-indigo-500/10 transition-all"
                              title="Edit Pricing & ERP"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {!isRegularUser && (
                              <button
                                onClick={() => handleDeleteProduct(p.id, p.product_name)}
                                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-500/10 transition-all"
                                title="Delete Product"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: ADD / EDIT PRODUCT PRICING WITH DYNAMIC LIVE CALCULATOR ── */}
      {(isEditModalOpen || isAddModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="modal-glass w-full max-w-lg p-6 space-y-5 rounded-2xl border border-[var(--glass-border)] shadow-2xl">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Calculator className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-black text-[var(--text-primary)]">
                    {editingProduct ? 'Edit ERP Price & Vendor Terms' : 'Add New Vendor Pricing'}
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)] font-semibold">
                    Set procurement costs and target ERP price to calculate net margins
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setIsEditModalOpen(false); setIsAddModalOpen(false); }}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">Vendor Name *</label>
                  {!isCustomVendor ? (
                    <GlassSelect
                      value={formData.vendor}
                      placeholder="Select Vendor"
                      options={[
                        ...availableVendors.map((v) => ({ value: v, label: v })),
                        { value: '__other__', label: '➕ Other (Type Custom Vendor...)' },
                      ]}
                      onChange={(e, val) => {
                        const v = val !== undefined ? val : e.target.value;
                        if (v === '__other__') {
                          setIsCustomVendor(true);
                          setFormData({ ...formData, vendor: '' });
                        } else {
                          setFormData({ ...formData, vendor: v });
                        }
                      }}
                      className="w-full"
                    />
                  ) : (
                    <div className="space-y-1">
                      <input
                        type="text"
                        required
                        autoFocus
                        value={formData.vendor}
                        onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                        className="input-field w-full"
                        placeholder="Type vendor name..."
                      />
                      <button
                        type="button"
                        onClick={() => setIsCustomVendor(false)}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                      >
                        ← Select from existing list
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">Service Plan / Category</label>
                  {isRegularUser ? (
                    <div className="space-y-1">
                      <input
                        type="text"
                        disabled
                        value={formData.service_category}
                        className="input-field w-full bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)] cursor-not-allowed font-medium"
                      />
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        Scoped to your assigned service: {formData.service_category}
                      </p>
                    </div>
                  ) : !isCustomServicePlan ? (
                    <GlassSelect
                      value={formData.service_category}
                      placeholder="Select Service Plan"
                      options={[
                        ...availableServicePlans.map((sp) => ({ value: sp, label: sp })),
                        { value: '__other__', label: '➕ Other (Type Custom Plan...)' },
                      ]}
                      onChange={(e, val) => {
                        const sp = val !== undefined ? val : e.target.value;
                        if (sp === '__other__') {
                          setIsCustomServicePlan(true);
                          setFormData({ ...formData, service_category: '' });
                        } else {
                          setFormData({ ...formData, service_category: sp });
                        }
                      }}
                      className="w-full"
                    />
                  ) : (
                    <div className="space-y-1">
                      <input
                        type="text"
                        autoFocus
                        value={formData.service_category}
                        onChange={(e) => setFormData({ ...formData, service_category: e.target.value })}
                        className="input-field w-full"
                        placeholder="Type service plan..."
                      />
                      <button
                        type="button"
                        onClick={() => setIsCustomServicePlan(false)}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                      >
                        ← Select from existing list
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-[var(--text-secondary)] mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  className="input-field w-full font-medium"
                  placeholder="e.g. Microsoft 365 Business Standard"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">Purchase Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchase_cost}
                    onChange={(e) => setFormData({ ...formData, purchase_cost: e.target.value })}
                    className="input-field w-full font-bold"
                    placeholder="e.g. 4200"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">Sales Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.sales_cost}
                    onChange={(e) => setFormData({ ...formData, sales_cost: e.target.value })}
                    className="input-field w-full font-bold"
                    placeholder="e.g. 5500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-amber-600 dark:text-amber-400 mb-1">ERP Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.erp_price}
                    onChange={(e) => setFormData({ ...formData, erp_price: e.target.value })}
                    className="input-field w-full font-black border-amber-500/50 focus:ring-amber-500"
                    placeholder="e.g. 6000"
                  />
                </div>
              </div>

              {/* Dynamic Live Margin Preview Box */}
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-[var(--glass-border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-[var(--text-muted)] tracking-wider">
                    Dynamic Margin Preview
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    liveModalCalc.margin >= 20 ? 'badge-success' : liveModalCalc.margin >= 10 ? 'badge-warning' : 'badge-danger'
                  }`}>
                    {liveModalCalc.margin >= 20 ? 'Healthy Margin' : liveModalCalc.margin >= 10 ? 'Moderate Margin' : 'Low / Negative Margin'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)]">Projected Gross Profit:</span>
                    <p className={`text-sm font-black ${liveModalCalc.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                      {liveModalCalc.profit >= 0 ? `+${formatINR(liveModalCalc.profit)}` : `-${formatINR(Math.abs(liveModalCalc.profit))}`}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)]">Projected Net Margin:</span>
                    <p className={`text-sm font-black ${liveModalCalc.margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                      {liveModalCalc.margin >= 0 ? '+' : ''}{liveModalCalc.margin}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--glass-border)]">
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setIsAddModalOpen(false); }}
                  className="btn-secondary !px-4 !py-2 !rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary !px-5 !py-2 !rounded-xl font-bold"
                >
                  {submitting ? 'Saving...' : 'Save Pricing'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
