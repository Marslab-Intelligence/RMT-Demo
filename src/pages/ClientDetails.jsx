import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, CalendarClock, User, Mail, DollarSign, Tag, Clock,
  FileCheck, AlertCircle, Copy, Check, FileText, Edit3, MailX, MailCheck,
  LayoutGrid, Contact2, Wallet
} from 'lucide-react';
import { formatCurrency, formatDate, getStatusColor, getDaysLeftColor } from '../utils/formatters';
import toast from 'react-hot-toast';
import PageHeader from '../components/common/PageHeader';
import RenewalForm from '../components/RenewalForm';
import EmptyState from '../components/common/EmptyState';
import RadialGauge from '../components/RadialGauge';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'contact', label: 'Contact & Commercial', icon: Contact2 },
  { id: 'financials', label: 'Invoicing & Financials', icon: Wallet },
];

const CONFIRMATION_STYLES = {
  reminder_sent: { label: 'Reminder Sent', color: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800' },
  awaiting_with_vendor: { label: 'Reminder Sent', color: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800' },
  quote_sent: { label: 'Quote Sent', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800' },
  quotation_confirmation: { label: 'Quote Sent', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800' },
  awaiting_client_approval: { label: 'Awaiting Client Approval', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' },
  renewed: { label: 'Renewed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' },
  lost: { label: 'Lost', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' },
  service_discontinued: { label: 'Cancelled', color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' },
};

const PLAN_LABELS = {
  monthly_plan: 'Monthly plan',
  quarterly_plan: 'Quarterly plan',
  halfly_plan: 'Halfly plan',
};

const TONE_CLASSES = {
  brand: 'bg-brand-50 dark:bg-brand-900/20 text-brand-600',
  blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
  orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600',
  indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600',
  green: 'bg-green-50 dark:bg-green-900/20 text-green-600',
  purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600',
  emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600',
  amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600',
  rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600',
  sky: 'bg-sky-50 dark:bg-sky-900/20 text-sky-600',
};

const TONE_BORDER_CLASSES = {
  brand: 'border-t-brand-400 dark:border-t-brand-600',
  blue: 'border-t-blue-400 dark:border-t-blue-600',
  orange: 'border-t-orange-400 dark:border-t-orange-600',
  indigo: 'border-t-indigo-400 dark:border-t-indigo-600',
  green: 'border-t-green-400 dark:border-t-green-600',
  purple: 'border-t-purple-400 dark:border-t-purple-600',
  emerald: 'border-t-emerald-400 dark:border-t-emerald-600',
  amber: 'border-t-amber-400 dark:border-t-amber-600',
  rose: 'border-t-rose-400 dark:border-t-rose-600',
  sky: 'border-t-sky-400 dark:border-t-sky-600',
};

function InfoField({ icon: Icon, label, value, sub, tone = 'brand' }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-lg mt-0.5 ${TONE_CLASSES[tone] || TONE_CLASSES.brand}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-surface-500 font-bold uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-surface-900 dark:text-white break-words">{value}</p>
        {sub}
      </div>
    </div>
  );
}

function DetailStat({ icon: Icon, label, value, tone = 'brand', valueClass, children }) {
  return (
    <div
      className={`relative bg-white dark:bg-surface-900/50 p-4 rounded-xl border border-surface-200/60 dark:border-surface-700 border-t-[3px] ${TONE_BORDER_CLASSES[tone] || TONE_BORDER_CLASSES.brand} hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}
    >
      <div className="flex items-center gap-2 mb-2">
        {Icon && (
          <div className={`p-1.5 rounded-lg ${TONE_CLASSES[tone] || TONE_CLASSES.brand}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
        <p className="text-[10px] text-surface-500 font-bold uppercase tracking-wider truncate">{label}</p>
      </div>
      {children || (
        <p className={`text-base font-bold break-words ${valueClass || 'text-surface-900 dark:text-white'}`}>{value}</p>
      )}
    </div>
  );
}

export default function ClientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedSecondaryEmail, setCopiedSecondaryEmail] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const canEdit = user?.role === 'user' || user?.role === 'cst' || user?.role === 'super_admin' || user?.role === 'dept_admin';

  const fetchClient = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/renewals/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClient(data);
      } else {
        toast.error('Client details not found');
      }
    } catch (err) {
      console.error('Failed to fetch client details', err);
      toast.error('Error fetching client details');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    if (id && (id.startsWith('dateRange=') || id.includes('='))) {
      navigate(`/renewals?${id}`, { replace: true });
      return;
    }
    fetchClient();
  }, [id, fetchClient, navigate]);

  const handleCopyEmail = (email, type) => {
    if (!email) return;
    navigator.clipboard.writeText(email);
    if (type === 'primary') {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } else {
      setCopiedSecondaryEmail(true);
      setTimeout(() => setCopiedSecondaryEmail(false), 2000);
    }
    toast.success('Email copied to clipboard');
  };

  const handleToggleStopEmail = async () => {
    if (!client) return;
    try {
      const nextState = !client.stop_email;
      const res = await fetch(`/api/renewals/${client.id}/stop-email`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ stop_email: nextState })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update email setting.');

      toast.success(data.message || `Email reminders ${nextState ? 'stopped' : 'resumed'}.`);
      setClient(prev => ({ ...prev, stop_email: nextState }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/renewals');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <EmptyState
          icon={AlertCircle}
          title="Client Not Found"
          description="The requested renewal record could not be loaded or may have been deleted."
          actionText="Back to Renewals"
          onAction={handleBack}
        />
      </div>
    );
  }

  // Renewal countdown gauge — fills up as the renewal date approaches (or is
  // already past due), on a 90-day horizon, giving this record page an
  // at-a-glance urgency read that the previous plain-text "days left" line
  // didn't have.
  const daysLeft = client.days_left;
  const countdownPercent = daysLeft === null || daysLeft === undefined
    ? 0
    : daysLeft < 0
      ? 100
      : Math.round(100 - Math.min(100, (daysLeft / 90) * 100));
  const countdownColor = daysLeft < 0 ? '#e11d48' : daysLeft <= 15 ? '#f59e0b' : '#10b981';
  const countdownLabel = daysLeft === null || daysLeft === undefined
    ? 'No date'
    : daysLeft < 0
      ? `Expired ${Math.abs(daysLeft)}d ago`
      : daysLeft === 0
        ? 'Due today'
        : `${daysLeft}d left`;

  const confirmation = CONFIRMATION_STYLES[client.renewal_confirmation] || { label: 'Pending', color: 'bg-surface-100 text-surface-600 border-surface-200 dark:bg-surface-700 dark:text-surface-300 dark:border-surface-600' };

  const valueVal = parseFloat(client.value) || 0;
  const paymentAmt = client.payment_status === 'Yes' ? (parseFloat(client.payment_amount) || 0) : 0;
  const balanceAmt = valueVal - paymentAmt;
  const percentPaid = valueVal > 0 ? Math.round((paymentAmt / valueVal) * 100) : 0;

  return (
    <div className="animate-fade-in w-full h-[calc(100vh-6.5rem)] flex flex-col overflow-hidden space-y-4">
      {/* Standard Enterprise Page Header */}
      <PageHeader
        title={client.client_name || 'Renewal Account Details'}
        subtitle={`Contract reference ${client.unique_id || ''} • Managed by ${client.owner || 'Unassigned'}`}
        backTo="/renewals"
        backLabel="Back to Renewals"
        breadcrumbs={['Dashboard', 'Renewals', client.client_name]}
        badge={client.status}
        badgeColor={client.status === 'Active' ? 'emerald' : client.status === 'Expired' ? 'rose' : 'amber'}
        actions={
          canEdit && (
            <button
              onClick={() => setIsFormOpen(true)}
              className="btn-primary flex items-center gap-2 py-1.5 px-3.5 text-xs rounded-xl shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Record</span>
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start flex-1 min-h-0">
        {/* ── Left: sticky identity rail ── */}
        <div className="card p-5 flex flex-col items-center text-center lg:sticky lg:top-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-lg mb-4"
            style={{ background: 'linear-gradient(135deg, rgb(var(--brand-rgb)), rgb(var(--brand-rgb)) 60%, #f59e0b)' }}
          >
            {client.client_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <h1 className="text-lg font-extrabold text-surface-900 dark:text-white leading-tight">
            {client.client_name}
          </h1>
          <p className="text-xs font-mono text-brand-600 dark:text-brand-400 mt-1 font-semibold">
            {client.unique_id}
          </p>

          <div className="mt-4">
            <RadialGauge
              percent={countdownPercent}
              color={countdownColor}
              label="Time to renewal"
              sublabel={countdownLabel}
              size={112}
              stroke={8}
            />
          </div>

          <div className="w-full mt-4 flex flex-wrap justify-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(client.status)}`}>
              {client.status}
            </span>
            <button
              onClick={handleToggleStopEmail}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                client.stop_email
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-200'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
              }`}
              title={client.stop_email ? 'Click to resume automated reminder emails for this client' : 'Click to stop automated reminder emails for this client'}
            >
              {client.stop_email ? <MailX className="w-3 h-3" /> : <MailCheck className="w-3 h-3" />}
              <span>{client.stop_email ? 'Reminders Stopped' : 'Reminders Active'}</span>
            </button>
          </div>

          <div className="w-full mt-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] space-y-3 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-surface-500">Contract Value</span>
              <span className="text-sm font-black text-surface-900 dark:text-white">{formatCurrency(client.value)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-surface-500">Service</span>
              <span className="text-sm font-semibold text-surface-900 dark:text-white">{client.service}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-surface-500">Renewal Date</span>
              <span className="text-sm font-semibold text-surface-900 dark:text-white">{formatDate(client.renewal_date)}</span>
            </div>
            {client.quotation_number && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-surface-500">Quotation</span>
                <span className="text-sm font-semibold text-surface-900 dark:text-white">#{client.quotation_number}</span>
              </div>
            )}
            {client.invoice_number && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-surface-500">{client.invoice_type === 'Sales Order' ? 'Sales Order' : 'Invoice'}</span>
                <span className="text-sm font-semibold text-surface-900 dark:text-white">#{client.invoice_number}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: tabbed workspace ── */}
        <div className="space-y-4 min-w-0 h-full overflow-y-auto pr-1 custom-scrollbar">
          {client.expiry_reason && (
            <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 p-3 rounded-xl">
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-rose-600 dark:text-rose-450 font-bold uppercase tracking-wider mb-0.5">Expiry Reason</p>
                <p className="text-xs font-medium text-rose-700 dark:text-rose-350">{client.expiry_reason}</p>
              </div>
            </div>
          )}

          {client.edit_status && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-4 rounded-xl flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300 capitalize">
                  Edit Status: {client.edit_status}
                </h3>
                {client.edit_reason && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    Reason: {client.edit_reason}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex items-center gap-1 p-1 bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-xl w-fit overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    activeTab === tab.id ? 'bg-brand-500 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Overview tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="card p-6 space-y-4">
                <h2 className="text-base font-bold text-surface-900 dark:text-white border-b border-surface-150 dark:border-surface-700 pb-2">
                  Service &amp; Renewal Details
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <InfoField icon={Tag} label="Service Plan" value={client.service} tone="brand" />
                  <InfoField
                    icon={CalendarClock}
                    label="Renewal Date"
                    value={formatDate(client.renewal_date)}
                    tone="orange"
                    sub={client.days_left !== null && (
                      <p className={`text-xs mt-0.5 font-semibold ${getDaysLeftColor(client.days_left)}`}>
                        {countdownLabel}
                      </p>
                    )}
                  />
                  {client.plan_period && (
                    <InfoField
                      icon={Clock}
                      label="Plan Period"
                      value={
                        PLAN_LABELS[client.plan_period]
                          || (client.plan_period === 'yearly_plan'
                            ? `Yearly plan (${client.plan_duration || 1} ${client.plan_duration > 1 ? 'years' : 'year'})`
                            : client.plan_period)
                      }
                      tone="indigo"
                    />
                  )}
                  {client.quotation_number && (
                    <InfoField icon={FileText} label="Quotation Number" value={`#${client.quotation_number}`} tone="indigo" />
                  )}
                </div>
              </div>

              <div className="card p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-surface-150 dark:border-surface-700 pb-1.5">
                  <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-brand-500" /> Product &amp; Financial Details
                  </h2>
                  {canEdit && (
                    <button
                      onClick={() => setIsFormOpen(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-700 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
                    >
                      <Edit3 className="w-3 h-3" />
                      Edit Info
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-surface-500 font-bold uppercase tracking-wider mb-0.5">Product</p>
                      <p className="text-sm font-semibold text-surface-900 dark:text-white">{client.product || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-500 font-bold uppercase tracking-wider mb-0.5">Description</p>
                      <p className="text-sm font-semibold text-surface-900 dark:text-white whitespace-pre-wrap">{client.description || '-'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-surface-500 font-bold uppercase tracking-wider mb-0.5">Quantity</p>
                        <p className="text-sm font-semibold text-surface-900 dark:text-white">{client.quantity !== null && client.quantity !== undefined ? client.quantity : '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-surface-500 font-bold uppercase tracking-wider mb-0.5">Entity</p>
                        <p className="text-sm font-semibold text-surface-900 dark:text-white">{client.entity || '-'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-surface-500 font-bold uppercase tracking-wider mb-0.5">Vendor</p>
                      <p className="text-sm font-semibold text-surface-900 dark:text-white">{client.vendor || '-'}</p>
                    </div>
                  </div>

                  <div className="bg-surface-50 dark:bg-surface-900/40 p-4 rounded-xl border border-surface-200/50 dark:border-surface-700/50 space-y-3">
                    <h3 className="text-xs font-bold text-surface-700 dark:text-surface-300 uppercase tracking-wider">Cost breakdown</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-surface-500 font-bold uppercase tracking-wider">Purchase Cost</p>
                        <p className="text-sm font-bold text-surface-900 dark:text-white">
                          {client.purchase_cost !== null && client.purchase_cost !== undefined ? formatCurrency(client.purchase_cost) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-surface-500 font-bold uppercase tracking-wider">Total Purchase Cost</p>
                        <p className="text-sm font-bold text-surface-900 dark:text-white">
                          {client.total_purchase_cost !== null && client.total_purchase_cost !== undefined ? formatCurrency(client.total_purchase_cost) : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-surface-200/60 dark:border-surface-700/60">
                      <div>
                        <p className="text-[10px] text-surface-500 font-bold uppercase tracking-wider">Sales Cost</p>
                        <p className="text-sm font-bold text-surface-900 dark:text-white">
                          {client.sales_cost !== null && client.sales_cost !== undefined ? formatCurrency(client.sales_cost) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-surface-500 font-bold uppercase tracking-wider">Total Sales Cost</p>
                        <p className="text-sm font-bold text-surface-900 dark:text-white">
                          {client.total_sales_cost !== null && client.total_sales_cost !== undefined ? formatCurrency(client.total_sales_cost) : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-surface-200/60 dark:border-surface-700/60 flex justify-between items-center">
                      <span className="text-xs font-bold text-surface-600 dark:text-surface-400 uppercase tracking-wider">Estimated Profit</span>
                      <span className={`text-base font-extrabold ${client.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {client.profit !== null && client.profit !== undefined ? formatCurrency(client.profit) : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Contact & Commercial tab */}
          {activeTab === 'contact' && (
            <div className="space-y-4">
              <div className="card p-6 space-y-4">
                <h2 className="text-base font-bold text-surface-900 dark:text-white border-b border-surface-150 dark:border-surface-700 pb-2">
                  Contact Information
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <InfoField
                    icon={User}
                    label="Contact Person"
                    value={client.owner}
                    tone="blue"
                    sub={client.contact_number && (
                      <p className="text-xs text-surface-500 flex items-center mt-1">
                        <span className="font-semibold mr-1">Phone:</span> {client.contact_number}
                      </p>
                    )}
                  />
                  {client.reference_id && (
                    <InfoField icon={Tag} label="Reference ID (Invoice No)" value={client.reference_id} tone="green" />
                  )}
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-lg mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-surface-500 font-bold uppercase tracking-wider mb-0.5">Client Email</p>
                    <div className="flex items-center gap-2 group">
                      <p className="text-xs font-semibold text-surface-900 dark:text-white truncate">{client.client_email}</p>
                      <button
                        onClick={() => handleCopyEmail(client.client_email, 'primary')}
                        className="p-1 hover:bg-surface-100 dark:hover:bg-surface-700/50 rounded transition-colors text-surface-400 hover:text-brand-600"
                        title="Copy Email"
                      >
                        {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    {client.sales_email && (
                      <div className="flex items-center gap-2 mt-1.5 bg-surface-50 dark:bg-surface-900/40 p-2 rounded border border-surface-200/50 dark:border-surface-700/50">
                        <p className="text-xs text-surface-500 truncate flex-1">
                          <span className="font-semibold mr-1">Secondary:</span> {client.sales_email}
                        </p>
                        <button
                          onClick={() => handleCopyEmail(client.sales_email, 'secondary')}
                          className="p-0.5 hover:bg-surface-100 dark:hover:bg-surface-700/50 rounded transition-colors text-surface-400 hover:text-brand-600"
                          title="Copy Secondary Email"
                        >
                          {copiedSecondaryEmail ? <Check className="w-3 text-emerald-500" /> : <Copy className="w-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="card p-6 space-y-4 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent dark:from-indigo-950/20 border-l-4 border-l-indigo-500">
                <div className="flex items-center justify-between border-b border-surface-150 dark:border-surface-700 pb-1.5">
                  <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Quotation &amp; Commercial Information
                  </h2>
                  {canEdit && (
                    <button
                      onClick={() => setIsFormOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Quotation No. &amp; Costs
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <DetailStat
                    icon={FileText}
                    tone="indigo"
                    label="Quotation Number"
                    value={client.quotation_number ? `#${client.quotation_number}` : 'Not Added'}
                    valueClass="text-indigo-600 dark:text-indigo-400 font-extrabold"
                  />
                  <DetailStat icon={CalendarClock} tone="sky" label="Renewal Confirmation">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border inline-block ${confirmation.color}`}>
                      {confirmation.label}
                    </span>
                  </DetailStat>
                  <DetailStat icon={DollarSign} tone="emerald" label="Quotation / Sales Value" value={formatCurrency(client.total_sales_cost || client.value)} />
                  <DetailStat icon={Tag} tone="purple" label="Unit Sales Price & Qty" value={`${formatCurrency(client.sales_cost || 0)} × ${client.quantity || 1}`} />
                </div>
              </div>
            </div>
          )}

          {/* Invoicing & Financials tab */}
          {activeTab === 'financials' && (
            <div className="space-y-4">
              {(client.invoice_status === 'Sent' || client.invoice_number) ? (
                <div className="card p-6 space-y-4">
                  <h2 className="text-base font-bold text-surface-900 dark:text-white border-b border-surface-150 dark:border-surface-700 pb-2 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-500" /> {client.invoice_type || 'Invoice'} Information
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <DetailStat icon={FileCheck} tone="emerald" label={`${client.invoice_type || 'Invoice'} Number`} value={client.invoice_number || '-'} />
                    <DetailStat icon={DollarSign} tone="emerald" label={`${client.invoice_type || 'Invoice'} Value`} value={client.invoice_value !== null && client.invoice_value !== undefined ? formatCurrency(client.invoice_value) : '-'} />
                    <DetailStat icon={CalendarClock} tone="sky" label="Sent Date" value={client.invoice_sent_date ? formatDate(client.invoice_sent_date) : '-'} />
                  </div>

                  <div className="pt-2 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <DetailStat icon={DollarSign} tone="emerald" label="Amount Paid" value={formatCurrency(paymentAmt)} valueClass="text-emerald-700 dark:text-emerald-350" />
                      <DetailStat icon={AlertCircle} tone="amber" label="Outstanding Balance" value={formatCurrency(balanceAmt)} valueClass="text-amber-700 dark:text-amber-350" />
                    </div>

                    {valueVal > 0 && (
                      <div className="space-y-1.5 max-w-md">
                        <div className="flex justify-between text-xs font-semibold text-surface-700 dark:text-surface-300">
                          <span>{percentPaid}% Paid</span>
                          <span>{100 - percentPaid}% Remaining</span>
                        </div>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, percentPaid))}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <EmptyState icon={FileCheck} title="No invoice yet" description="An invoice hasn't been raised for this renewal." compact />
              )}

              {client.payment_status === 'Yes' && (
                <div className="card p-6 space-y-4">
                  <h2 className="text-base font-bold text-surface-900 dark:text-white border-b border-surface-150 dark:border-surface-700 pb-2 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-500" /> Payment Confirmation
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailStat icon={DollarSign} tone="emerald" label="Received Amount" value={client.payment_amount !== null && client.payment_amount !== undefined ? formatCurrency(client.payment_amount) : '-'} />
                    <DetailStat icon={CalendarClock} tone="sky" label="Received Date" value={client.payment_received_date ? formatDate(client.payment_received_date) : '-'} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isFormOpen && (
        <RenewalForm
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => {
            setIsFormOpen(false);
            fetchClient();
          }}
          editData={client}
        />
      )}
    </div>
  );
}
