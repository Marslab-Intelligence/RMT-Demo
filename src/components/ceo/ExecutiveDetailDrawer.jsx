import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCeo } from '../../context/CeoContext';
import { formatCurrency } from '../../utils/formatters';
import {
  X,
  ArrowLeft,
  Building2,
  Package,
  Server,
  Store,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Loader2,
  Search,
} from 'lucide-react';

export default function ExecutiveDetailDrawer() {
  const { token } = useAuth();
  const { drawerState, drawerHistory, closeDrawer, openDrawer, goBackDrawer, canGoBackDrawer } = useCeo();
  const { isOpen, type, id, title } = drawerState;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [deploymentSearchQuery, setDeploymentSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen || !type || !id) {
      setData(null);
      setServiceSearchQuery('');
      setDeploymentSearchQuery('');
      return;
    }

    let isMounted = true;
    setLoading(true);
    setActiveTab('overview');
    setServiceSearchQuery('');
    setDeploymentSearchQuery('');

    fetch(`/api/ceo/drilldown/${type}/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => {
        if (isMounted) {
          setData(resData);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load drilldown data:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, type, id, token]);

  if (!isOpen) return null;

  const getTypeIcon = () => {
    switch (type) {
      case 'department': return <Building2 className="w-5 h-5 text-brand-500" />;
      case 'product': return <Package className="w-5 h-5 text-indigo-500" />;
      case 'service': return <Server className="w-5 h-5 text-sky-500" />;
      case 'vendor': return <Store className="w-5 h-5 text-amber-500" />;
      case 'renewal': return <FileText className="w-5 h-5 text-purple-500" />;
      default: return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
    }
  };

  const previousEntry = drawerHistory.length > 0 ? drawerHistory[drawerHistory.length - 1] : null;

  const filteredServices = (data?.services || []).filter((svc) => {
    if (!serviceSearchQuery.trim()) return true;
    const q = serviceSearchQuery.toLowerCase();
    return (
      svc.name?.toLowerCase().includes(q) ||
      (svc.category && svc.category.toLowerCase().includes(q))
    );
  });

  const filteredRenewals = (data?.renewals || []).filter((ren) => {
    if (!deploymentSearchQuery.trim()) return true;
    const q = deploymentSearchQuery.toLowerCase();
    return (
      ren.client_name?.toLowerCase().includes(q) ||
      ren.product_name?.toLowerCase().includes(q) ||
      (ren.vendor_name && ren.vendor_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={closeDrawer}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0a0f1c] border-l border-surface-200 dark:border-surface-800 shadow-2xl flex flex-col h-full z-10 animate-slide-left">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-800/80 flex flex-col gap-3 bg-surface-50/50 dark:bg-surface-900/40">
          {/* Breadcrumb / Back Action Row */}
          <div className="flex items-center justify-between">
            {canGoBackDrawer ? (
              <button
                onClick={goBackDrawer}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 border border-brand-200 dark:border-brand-800/60 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to {previousEntry?.title || previousEntry?.type}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-surface-400 font-medium">
                <span>Executive Overview</span>
                <ChevronRight className="w-3 h-3 text-surface-400" />
                <span className="capitalize">{type}</span>
              </div>
            )}

            <button
              onClick={closeDrawer}
              aria-label="Close drawer"
              title="Close drawer"
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Main Drawer Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-surface-800/80 flex items-center justify-center shrink-0">
              {getTypeIcon()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-surface-200/70 dark:bg-surface-800 text-surface-600 dark:text-surface-300">
                  {type}
                </span>
                <span className="text-xs text-surface-400">Executive Drill-Down</span>
              </div>
              <h2 className="text-lg font-bold text-surface-950 dark:text-white truncate max-w-md mt-0.5">
                {title || data?.name || data?.product_name || `Detail #${id}`}
              </h2>
            </div>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
              <span className="text-xs text-surface-400 font-medium">Retrieving executive telemetry...</span>
            </div>
          ) : !data ? (
            <div className="p-8 text-center text-surface-400">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
              <p className="text-sm font-semibold">No detailed data found for this record.</p>
            </div>
          ) : (
            <>
              {/* Top Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {data.revenue !== undefined && (
                  <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-surface-200/60 dark:border-surface-800">
                    <span className="text-[11px] font-semibold text-surface-400 uppercase">Revenue</span>
                    <p className="text-base font-bold text-surface-900 dark:text-white mt-1 font-mono">
                      {formatCurrency(data.revenue)}
                    </p>
                  </div>
                )}
                {data.profit !== undefined && (
                  <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-surface-200/60 dark:border-surface-800">
                    <span className="text-[11px] font-semibold text-surface-400 uppercase">Gross Profit</span>
                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                      {formatCurrency(data.profit)}
                    </p>
                  </div>
                )}
                {data.marginPct !== undefined && (
                  <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-surface-200/60 dark:border-surface-800">
                    <span className="text-[11px] font-semibold text-surface-400 uppercase">Margin</span>
                    <p className="text-base font-bold text-surface-900 dark:text-white mt-1 font-mono">
                      {data.marginPct}%
                    </p>
                  </div>
                )}
                {data.healthScore !== undefined && (
                  <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-surface-200/60 dark:border-surface-800">
                    <span className="text-[11px] font-semibold text-surface-400 uppercase">Health Score</span>
                    <p className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
                      {data.healthScore} / 100
                    </p>
                  </div>
                )}
              </div>

              {/* Department Drill-Down Details */}
              {type === 'department' && (
                <div className="space-y-6">
                  {/* Department Services */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-surface-500">
                        Services under Department ({filteredServices.length}{serviceSearchQuery ? ` of ${data.services?.length || 0}` : ''})
                      </h3>

                      {/* Small Search Button & Input */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-100/90 dark:bg-surface-800/90 border border-surface-200/80 dark:border-surface-700/80 focus-within:border-brand-500 dark:focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500/20 transition-all shadow-2xs">
                        <Search className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                        <input
                          type="text"
                          value={serviceSearchQuery}
                          onChange={(e) => setServiceSearchQuery(e.target.value)}
                          placeholder="Search service..."
                          className="bg-transparent border-none outline-none text-xs text-surface-900 dark:text-white placeholder:text-surface-400 w-24 sm:w-36 transition-all focus:w-32 sm:focus:w-48"
                        />
                        {serviceSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setServiceSearchQuery('')}
                            className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 cursor-pointer p-0.5"
                            title="Clear search"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {filteredServices.length > 0 ? (
                      <div className="space-y-2">
                        {filteredServices.map((svc) => (
                          <div
                            key={svc.id}
                            onClick={() => openDrawer('service', svc.id, svc.name)}
                            className="p-3 rounded-xl border border-surface-200/80 dark:border-surface-800/80 hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer flex items-center justify-between transition-colors group"
                          >
                            <div className="flex items-center gap-3">
                              <Server className="w-4 h-4 text-sky-500" />
                              <div>
                                <p className="text-xs font-bold text-surface-900 dark:text-white group-hover:text-brand-500 transition-colors">
                                  {svc.name}
                                </p>
                                <span className="text-[11px] text-surface-400">
                                  {svc.renewalCount || 0} contracts • Margin: {svc.marginPct || 0}%
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-surface-700 dark:text-surface-300">
                                {formatCurrency(svc.revenue || 0)}
                              </span>
                              <ChevronRight className="w-4 h-4 text-surface-400 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center rounded-xl border border-dashed border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-900/30">
                        <Search className="w-6 h-6 mx-auto text-surface-400 mb-1.5 opacity-50" />
                        <p className="text-xs font-bold text-surface-800 dark:text-surface-200">No services match "{serviceSearchQuery}"</p>
                        <p className="text-[11px] text-surface-400 mt-0.5">Try searching with another service name</p>
                        <button
                          type="button"
                          onClick={() => setServiceSearchQuery('')}
                          className="mt-2 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                        >
                          Clear Search
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Supporting Vendors */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-surface-500 mb-3">
                      Supporting Vendors ({data.vendors?.length || 0})
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {data.vendors?.map((v) => (
                        <div
                          key={v.name}
                          onClick={() => openDrawer('vendor', v.name, v.name)}
                          className="p-3 rounded-xl border border-surface-200/80 dark:border-surface-800/80 hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Store className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-xs font-bold text-surface-900 dark:text-white truncate">{v.name}</span>
                          </div>
                          <span className="text-[11px] text-surface-400 mt-1 block">
                            {v.contractCount} contracts supported
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Product Drill-Down Details */}
              {type === 'product' && (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/30 border border-surface-200/80 dark:border-surface-800">
                    <span className="text-xs font-semibold text-surface-500 uppercase">Product Context</span>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <span className="text-[11px] text-surface-400">Department</span>
                        <p className="text-xs font-bold text-surface-900 dark:text-white mt-0.5">{data.departmentName}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-surface-400">Total Deployments</span>
                        <p className="text-xs font-bold text-surface-900 dark:text-white mt-0.5">{data.totalDeployments}</p>
                      </div>
                    </div>
                  </div>

                  {/* Renewals for this Product */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-surface-500 mb-3">
                      Client Contract Deployments ({data.renewals?.length || 0})
                    </h3>
                    <div className="space-y-2">
                      {data.renewals?.map((ren) => (
                        <div
                          key={ren.id}
                          onClick={() => openDrawer('renewal', ren.id, `${ren.client_name} - ${ren.product_name}`)}
                          className="p-3 rounded-xl border border-surface-200/80 dark:border-surface-800/80 hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer flex items-center justify-between group transition-colors"
                        >
                          <div>
                            <p className="text-xs font-bold text-surface-900 dark:text-white group-hover:text-brand-500 transition-colors">
                              {ren.client_name}
                            </p>
                            <span className="text-[11px] text-surface-400">
                              Vendor: {ren.vendor_name || 'Direct'} • Expiry: {ren.expiry_date}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-surface-900 dark:text-white">
                              {formatCurrency(ren.renewal_cost)}
                            </span>
                            <ChevronRight className="w-4 h-4 text-surface-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Vendor Drill-Down Details */}
              {type === 'vendor' && (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      Dependency & Concentration Assessment
                    </span>
                    <p className="text-xs text-surface-600 dark:text-surface-300 mt-1 leading-relaxed">
                      {data.name} supports {data.contractCount} corporate client contracts across {data.products?.length || 0} distinct software/hardware products.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-surface-500 mb-3">
                      Products Sourced from {data.name}
                    </h3>
                    <div className="space-y-2">
                      {data.products?.map((prod) => (
                        <div
                          key={prod.name}
                          onClick={() => openDrawer('product', prod.name, prod.name)}
                          className="p-3 rounded-xl border border-surface-200/80 dark:border-surface-800/80 hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer flex items-center justify-between group"
                        >
                          <span className="text-xs font-bold text-surface-900 dark:text-white group-hover:text-brand-500">
                            {prod.name}
                          </span>
                          <span className="text-xs font-mono text-surface-500">{prod.contractCount} contracts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Renewal Drill-Down Details */}
              {type === 'renewal' && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-surface-200/80 dark:border-surface-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-surface-400">Status</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40">
                        {data.status || 'Active'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-surface-400">Client / Account</span>
                      <span className="text-xs font-bold text-surface-900 dark:text-white">{data.client_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-surface-400">Product</span>
                      <span className="text-xs font-bold text-surface-900 dark:text-white">{data.product_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-surface-400">Service Category</span>
                      <span className="text-xs font-bold text-surface-900 dark:text-white">{data.serviceName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-surface-400">Department</span>
                      <span className="text-xs font-bold text-surface-900 dark:text-white">{data.departmentName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-surface-400">Expiry Date</span>
                      <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">{data.expiry_date}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Service Drill-Down Details */}
              {type === 'service' && (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-surface-500">
                        Active Deployments ({filteredRenewals.length}{deploymentSearchQuery ? ` of ${data.renewals?.length || 0}` : ''})
                      </h3>

                      {/* Small Search Button & Input */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-100/90 dark:bg-surface-800/90 border border-surface-200/80 dark:border-surface-700/80 focus-within:border-brand-500 dark:focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500/20 transition-all shadow-2xs">
                        <Search className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                        <input
                          type="text"
                          value={deploymentSearchQuery}
                          onChange={(e) => setDeploymentSearchQuery(e.target.value)}
                          placeholder="Search client..."
                          className="bg-transparent border-none outline-none text-xs text-surface-900 dark:text-white placeholder:text-surface-400 w-24 sm:w-36 transition-all focus:w-32 sm:focus:w-48"
                        />
                        {deploymentSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setDeploymentSearchQuery('')}
                            className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 cursor-pointer p-0.5"
                            title="Clear search"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {filteredRenewals.length > 0 ? (
                      <div className="space-y-2">
                        {filteredRenewals.map((ren) => (
                          <div
                            key={ren.id}
                            onClick={() => openDrawer('renewal', ren.id, `${ren.client_name} - ${ren.product_name}`)}
                            className="p-3 rounded-xl border border-surface-200/80 dark:border-surface-800/80 hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer flex items-center justify-between group"
                          >
                            <div>
                              <p className="text-xs font-bold text-surface-900 dark:text-white group-hover:text-brand-500">
                                {ren.client_name}
                              </p>
                              <span className="text-[11px] text-surface-400">{ren.product_name}</span>
                            </div>
                            <span className="font-mono text-xs font-bold text-surface-900 dark:text-white">
                              {formatCurrency(ren.renewal_cost)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center rounded-xl border border-dashed border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-900/30">
                        <Search className="w-6 h-6 mx-auto text-surface-400 mb-1.5 opacity-50" />
                        <p className="text-xs font-bold text-surface-800 dark:text-surface-200">No deployments match "{deploymentSearchQuery}"</p>
                        <button
                          type="button"
                          onClick={() => setDeploymentSearchQuery('')}
                          className="mt-2 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                        >
                          Clear Search
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Read-Only Notice Footer */}
        <div className="px-6 py-4 border-t border-surface-200 dark:border-surface-800/80 bg-surface-50/50 dark:bg-surface-900/50 flex items-center justify-between text-xs text-surface-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Executive Read-Only View</span>
          </div>
          <span>Confidential Leadership Data</span>
        </div>
      </div>
    </div>
  );
}
