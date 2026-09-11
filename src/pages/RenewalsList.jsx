import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, getStatusColor, getDaysLeftColor } from '../utils/formatters';
import { 
  Plus, Search, Filter, Download, ChevronLeft, ChevronRight, 
  MoreVertical, Edit, Edit3, RotateCw, MailCheck, MailX, ShieldAlert, CheckCircle, Trash2, X, Upload, Calendar,
  Columns, SlidersHorizontal, ArrowUp, ArrowDown, Send, CheckSquare, Square, FileSpreadsheet, Eye, EyeOff, Check, Maximize2, Minimize2, Tag
} from 'lucide-react';
import toast from 'react-hot-toast';
import RenewalForm from '../components/RenewalForm';
import RenewActionModal from '../components/RenewActionModal';
import ClientDetailsModal from '../components/ClientDetailsModal';
import InvoiceDetailsModal from '../components/InvoiceDetailsModal';
import IndianDateInput from '../components/IndianDateInput';
import GlassSelect from '../components/GlassSelect';
import RenewalTableRow from '../components/RenewalTableRow';
import GlassDatePicker from '../components/GlassDatePicker';
import EmptyState from '../components/common/EmptyState';
import PageHeader from '../components/common/PageHeader';

const normalizeHeader = (h) => {
  const clean = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean === 'clientname') return 'client_name';
  if (clean === 'service' || clean === 'servicename' || clean === 'serviceplan') return 'service';
  if (clean === 'renewaldate') return 'renewal_date';
  if (clean === 'value' || clean === 'contractvalue' || clean.includes('contractvalue')) return 'value';
  if (clean === 'clientemail') return 'client_email';
  if (clean === 'salesemail' || clean === 'clientsecondarymail' || clean === 'secondaryemail' || clean.includes('secondarymail')) return 'sales_email';
  if (clean === 'owner' || clean === 'contactperson' || clean === 'accountmanager' || clean.includes('contactperson')) return 'owner';
  if (clean === 'contactnumber' || clean === 'phone' || clean.includes('contactnumber') || clean.includes('phone')) return 'contact_number';
  if (clean === 'referenceid' || clean === 'referenceidinvoiceno' || clean.includes('referenceid')) return 'reference_id';
  if (clean === 'invoicenumber') return 'invoice_number';
  if (clean === 'quotationnumber' || clean === 'quotationno' || clean === 'quotation') return 'quotation_number';
  if (clean === 'planperiod') return 'plan_period';
  if (clean === 'plandurationyears' || clean === 'planduration') return 'plan_duration';
  if (clean === 'product') return 'product';
  if (clean === 'vendor') return 'vendor';
  if (clean === 'description') return 'description';
  if (clean === 'entity') return 'entity';
  if (clean === 'quantity') return 'quantity';
  if (clean.includes('purchasecost')) return 'purchase_cost';
  if (clean.includes('salescost')) return 'sales_cost';
  if (clean === 'renewed') return 'renewed';
  return clean;
};

const parseCSVDate = (dateStr) => {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  
  // Format: DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  // Format: YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Try standard JS Date parsing
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
};

const SERVICE_OPTIONS = [
  { value: 'all', label: 'All Services' },
  ...['AWS', 'AMC', 'BDR Suite', 'Domain', 'Firewall', 'GWS', 'LSH', 'M365', 'Plesk', 'Seqrite', 'Storage', 'SSL', 'Tally', 'Untangle', 'Zoho'].map(s => ({ value: s, label: s }))
];

const DATE_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'expired', label: 'Expired' },
  { value: 'today', label: 'Due Today' },
  { value: 'next7', label: 'Next 7 Days' },
  { value: 'next30', label: 'Next 30 Days' },
  { value: 'next60', label: 'Next 60 Days' },
  { value: 'next90', label: 'Next 90 Days' },
  { isHeader: true, label: 'Monthwise' },
  { value: 'this_month', label: 'This Month' },
  { value: 'next_month', label: 'Next Month' },
  { value: 'prev_month', label: 'Previous Month' },
  { isHeader: true, label: 'By Calendar Month' },
  { value: 'm_1', label: 'January' },
  { value: 'm_2', label: 'February' },
  { value: 'm_3', label: 'March' },
  { value: 'm_4', label: 'April' },
  { value: 'm_5', label: 'May' },
  { value: 'm_6', label: 'June' },
  { value: 'm_7', label: 'July' },
  { value: 'm_8', label: 'August' },
  { value: 'm_9', label: 'September' },
  { value: 'm_10', label: 'October' },
  { value: 'm_11', label: 'November' },
  { value: 'm_12', label: 'December' },
];

const VALUE_OPTIONS = [
  { value: 'all', label: 'All Values' },
  { value: 'under50k', label: 'Under ₹50K' },
  { value: '50k-1l', label: '₹50K – ₹1L' },
  { value: '1l-5l', label: '₹1L – ₹5L' },
  { value: 'above5l', label: 'Above ₹5L' },
];

const STATUS_COL_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'Pending Renewal', label: 'Pending Renewal' },
  { value: 'Expired', label: 'Expired' },
  { value: '-', label: 'Discontinued' },
];

const RENEWED_OPTIONS = [
  { value: 'all', label: 'All Options' },
  { value: 'pending', label: 'Pending' },
  { value: 'reminder_sent', label: 'Reminder Sent' },
  { value: 'quote_sent', label: 'Quote Sent' },
  { value: 'awaiting_client_approval', label: 'Awaiting Client Approval' },
  { value: 'renewed', label: 'Renewed' },
  { value: 'lost', label: 'Lost' },
  { value: 'cancelled', label: 'Cancelled' },
];

const INVOICE_OPTIONS = [
  { value: 'all', label: 'All Invoices' },
  { value: 'Sent', label: 'Sent' },
  { value: 'Not', label: 'Not Sent' },
];

const PAYMENT_OPTIONS = [
  { value: 'all', label: 'All Payments' },
  { value: 'Yes', label: 'Received' },
  { value: 'No', label: 'Pending' },
];

const ClientFilterDropdown = ({ value = [], onChange, clientList = [], isOpen, onToggle, filterPos, filterRef, onClose, setPage }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const valueArray = useMemo(() => Array.isArray(value) ? value : (value ? [value] : []), [value]);
  const isActive = valueArray.length > 0;

  const filteredClients = useMemo(() => {
    if (!clientList || clientList.length === 0) return [];
    if (!searchTerm.trim()) return clientList;
    const tokens = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return clientList.filter(c => {
      if (!c) return false;
      const lower = c.toLowerCase();
      return tokens.every(token => lower.includes(token));
    });
  }, [clientList, searchTerm]);

  const selectedSet = useMemo(() => new Set(valueArray), [valueArray]);

  return (
    <div className="inline-block">
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onToggle}
        className={`ml-1.5 p-1 rounded-lg transition-all duration-200 cursor-pointer border ${
          isActive
            ? 'text-brand-600 dark:text-brand-300 font-bold bg-brand-500/15 border-brand-500/40 shadow-sm'
            : 'text-surface-400 dark:text-surface-500 hover:text-surface-900 dark:hover:text-white bg-white/40 dark:bg-white/5 border-white/40 dark:border-white/10 hover:bg-white/70 dark:hover:bg-white/10 shadow-sm'
        }`}
        title={isActive ? `Filtered by ${valueArray.length} client(s)` : 'Filter Client Info'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
      </button>

      {isOpen && filterPos && createPortal(
        <div 
          ref={filterRef}
          style={{ position: 'fixed', top: `${filterPos.top}px`, left: `${filterPos.left}px`, zIndex: 99999 }}
          className="dropdown-menu-glass min-w-[260px] max-w-[320px] max-h-96 overflow-hidden flex flex-col p-3 animate-in fade-in slide-in-from-top-1 duration-150"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Header */}
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-surface-100 dark:border-surface-700">
            <span className="text-xs font-semibold text-surface-800 dark:text-surface-200">
              Filter Client Info
            </span>
            {valueArray.length > 0 && (
              <button
                type="button"
                onClick={() => { onChange([]); if (setPage) setPage(1); }}
                className="text-[11px] text-rose-500 hover:underline font-semibold cursor-pointer"
              >
                Clear All ({valueArray.length})
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative mb-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search client name..."
              autoFocus
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
            <Search className="w-3.5 h-3.5 text-surface-400 absolute left-2.5 top-2.5" />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-2 p-0.5 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 rounded-full"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Main List Container */}
          <div className="overflow-y-auto custom-scrollbar flex-1 max-h-60 space-y-2 pr-0.5">
            
            {/* Pinned Selected Items Section */}
            {valueArray.length > 0 && (
              <div className="bg-brand-50/80 dark:bg-brand-950/40 p-2 rounded-lg border border-brand-200/60 dark:border-brand-800/40">
                <div className="text-[10px] font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Selected ({valueArray.length})</span>
                  <button
                    type="button"
                    onClick={() => { onChange([]); if (setPage) setPage(1); }}
                    className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline capitalize font-normal cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
                <div className="space-y-0.5 max-h-24 overflow-y-auto custom-scrollbar">
                  {valueArray.map((clientName) => (
                    <label
                      key={`selected-${clientName}`}
                      onClick={() => {
                        const nextArr = valueArray.filter(c => c !== clientName);
                        onChange(nextArr);
                        if (setPage) setPage(1);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1 text-xs rounded bg-white dark:bg-surface-800 text-brand-700 dark:text-brand-300 font-semibold cursor-pointer shadow-sm hover:bg-brand-100/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={true}
                        readOnly
                        className="rounded border-brand-400 text-brand-600 focus:ring-brand-500 h-3.5 w-3.5 cursor-pointer accent-brand-600"
                      />
                      <span className="truncate">{clientName}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Results / All Clients */}
            <div>
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-wider">
                  {searchTerm ? `Search Results (${filteredClients.length})` : 'All Clients'}
                </span>
                {valueArray.length === 0 && (
                  <span className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold">
                    All Selected
                  </span>
                )}
              </div>

              {filteredClients.length === 0 ? (
                <div className="py-4 text-center text-xs text-surface-400 space-y-1">
                  <p>No clients match "{searchTerm}"</p>
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="text-brand-600 hover:underline text-[11px] font-medium"
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                filteredClients.map((clientName) => {
                  const isSelected = selectedSet.has(clientName);
                  return (
                    <label
                      key={clientName}
                      onClick={() => {
                        let nextArr = [...valueArray];
                        if (isSelected) {
                          nextArr = nextArr.filter(c => c !== clientName);
                        } else {
                          nextArr.push(clientName);
                        }
                        onChange(nextArr);
                        if (setPage) setPage(1);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-brand-50/60 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 font-semibold'
                          : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="rounded border-surface-300 dark:border-surface-600 text-brand-600 focus:ring-brand-500 h-3.5 w-3.5 cursor-pointer accent-brand-600"
                      />
                      <span className="truncate">{clientName}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const FilterDropdown = ({ col, value = [], onChange, options = [], isOpen, onToggle, filterPos, filterRef, onClose, setPage, title = '' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const valueArray = useMemo(() => Array.isArray(value) ? value : (value && value !== 'all' ? [value] : []), [value]);
  const isActive = valueArray.length > 0;
  const selectedSet = useMemo(() => new Set(valueArray), [valueArray]);

  const filteredOptions = useMemo(() => {
    const validOpts = options.filter(opt => opt.value !== 'all');
    if (!searchTerm.trim()) return validOpts;
    const term = searchTerm.toLowerCase();
    return validOpts.filter(opt => opt.isHeader || (opt.label && opt.label.toLowerCase().includes(term)));
  }, [options, searchTerm]);

  // Lookup map for labels
  const optionLabelMap = useMemo(() => {
    const map = {};
    options.forEach(opt => {
      if (opt.value && opt.value !== 'all') {
        map[opt.value] = opt.label || opt.value;
      }
    });
    return map;
  }, [options]);

  return (
    <div className="inline-block">
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onToggle}
        className={`ml-1.5 p-1 rounded-lg transition-all duration-200 cursor-pointer border ${
          isActive
            ? 'text-brand-600 dark:text-brand-300 font-bold bg-brand-500/15 border-brand-500/40 shadow-sm'
            : 'text-surface-400 dark:text-surface-500 hover:text-surface-900 dark:hover:text-white bg-white/40 dark:bg-white/5 border-white/40 dark:border-white/10 hover:bg-white/70 dark:hover:bg-white/10 shadow-sm'
        }`}
        title={isActive ? `Filter active (${valueArray.length})` : 'Filter'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
      </button>
      {isOpen && filterPos && createPortal(
        <div 
          ref={filterRef}
          style={{ position: 'fixed', top: `${filterPos.top}px`, left: `${filterPos.left}px`, zIndex: 99999 }}
          className="dropdown-menu-glass w-max min-w-[210px] max-w-[320px] max-h-96 overflow-hidden flex flex-col p-3 animate-in fade-in slide-in-from-top-1 duration-150 select-none"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-surface-100 dark:border-surface-700/60 mb-2">
            <span className="text-xs font-semibold text-surface-800 dark:text-surface-200">
              Filter {title || 'Options'}
            </span>
            {valueArray.length > 0 && (
              <button
                type="button"
                onClick={() => { onChange([]); if (setPage) setPage(1); }}
                className="text-[11px] text-rose-500 hover:underline font-semibold cursor-pointer"
              >
                Clear All ({valueArray.length})
              </button>
            )}
          </div>

          {options.length > 6 && (
            <div className="relative mb-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${title || 'options'}...`}
                autoFocus
                className="w-full pl-7 pr-6 py-1.5 text-xs rounded-md border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <Search className="w-3 h-3 text-surface-400 absolute left-2 top-2.5" />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-1.5 top-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <div className="overflow-y-auto custom-scrollbar flex-1 max-h-60 space-y-2 pr-0.5">
            {/* Pinned Selected Items Section */}
            {valueArray.length > 0 && (
              <div className="bg-brand-50/80 dark:bg-brand-950/40 p-2 rounded-lg border border-brand-200/60 dark:border-brand-800/40">
                <div className="text-[10px] font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Selected ({valueArray.length})</span>
                  <button
                    type="button"
                    onClick={() => { onChange([]); if (setPage) setPage(1); }}
                    className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline capitalize font-normal cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
                <div className="space-y-0.5 max-h-24 overflow-y-auto custom-scrollbar">
                  {valueArray.map((val) => (
                    <label
                      key={`selected-${val}`}
                      onClick={() => {
                        const nextArr = valueArray.filter(v => v !== val);
                        onChange(nextArr);
                        if (setPage) setPage(1);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1 text-xs rounded bg-white dark:bg-surface-800 text-brand-700 dark:text-brand-300 font-semibold cursor-pointer shadow-sm hover:bg-brand-100/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={true}
                        readOnly
                        className="rounded border-brand-400 text-brand-600 focus:ring-brand-500 h-3.5 w-3.5 cursor-pointer accent-brand-600"
                      />
                      <span className="truncate">{optionLabelMap[val] || val}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              {filteredOptions.map((opt, i) => {
                if (opt.isHeader) {
                  return (
                    <div key={`header-${i}`} className="px-2 pt-2 pb-1 text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-wider border-t border-surface-150 dark:border-surface-700/60 first:border-0 first:pt-0 whitespace-nowrap">
                      {opt.label}
                    </div>
                  );
                }
                const isSelected = selectedSet.has(opt.value);
                return (
                  <label
                    key={opt.value}
                    onClick={() => {
                      let nextArr = [...valueArray];
                      if (isSelected) {
                        nextArr = nextArr.filter(v => v !== opt.value);
                      } else {
                        nextArr.push(opt.value);
                      }
                      onChange(nextArr);
                      if (setPage) setPage(1);
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors cursor-pointer rounded ${
                      isSelected
                        ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 font-semibold'
                        : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="rounded border-surface-300 dark:border-surface-600 text-brand-600 focus:ring-brand-500 h-3.5 w-3.5 cursor-pointer accent-brand-600"
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default function RenewalsList() {
  const { token, user, getValidToken } = useAuth();
  const navigate = useNavigate();
  const [renewals, setRenewals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Derived filter state directly from URL searchParams (single source of truth)
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'all';

  const dateRangeParam = searchParams.get('dateRange') || '';
  const dateRangeFilter = useMemo(() => {
    return !dateRangeParam || dateRangeParam === 'all' ? [] : dateRangeParam.split(',').filter(Boolean);
  }, [dateRangeParam]);

  const valueParam = searchParams.get('valueRange') || '';
  const valueFilter = useMemo(() => {
    return !valueParam || valueParam === 'all' ? [] : valueParam.split(',').filter(Boolean);
  }, [valueParam]);

  const statusColParam = searchParams.get('statusCol') || '';
  const statusColFilter = useMemo(() => {
    return !statusColParam || statusColParam === 'all' ? [] : statusColParam.split(',').filter(Boolean);
  }, [statusColParam]);

  const renewedParam = searchParams.get('renewalConfirmation') || '';
  const renewedFilter = useMemo(() => {
    return !renewedParam || renewedParam === 'all' ? [] : renewedParam.split(',').filter(Boolean);
  }, [renewedParam]);

  const invoiceParam = searchParams.get('invoiceStatus') || '';
  const invoiceFilter = useMemo(() => {
    return !invoiceParam || invoiceParam === 'all' ? [] : invoiceParam.split(',').filter(Boolean);
  }, [invoiceParam]);

  const paymentParam = searchParams.get('paymentStatus') || '';
  const paymentFilter = useMemo(() => {
    return !paymentParam || paymentParam === 'all' ? [] : paymentParam.split(',').filter(Boolean);
  }, [paymentParam]);

  const clientParam = searchParams.get('clientName') || '';
  const clientFilter = useMemo(() => {
    return !clientParam || clientParam === 'all' ? [] : clientParam.split(',').filter(Boolean);
  }, [clientParam]);

  const serviceParam = searchParams.get('serviceName') || '';
  const serviceFilter = useMemo(() => {
    return !serviceParam || serviceParam === 'all' ? [] : serviceParam.split(',').filter(Boolean);
  }, [serviceParam]);

  const [openFilterCol, setOpenFilterCol] = useState(null); // which column dropdown is open
  const [filterPos, setFilterPos] = useState({ top: 0, left: 0 });
  const filterRef = useRef(null);

  // Unified updater for URL searchParams, preserving unrelated parameters
  const updateFilter = useCallback((key, value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (!value || value === 'all' || (Array.isArray(value) && value.length === 0)) {
        next.delete(key);
      } else if (Array.isArray(value)) {
        next.set(key, value.join(','));
      } else {
        next.set(key, String(value));
      }
      return next;
    }, { replace: true });
    setPage(1);
  }, [setSearchParams]);

  // Setters compatible with table column filter popups and buttons
  const setDateRangeFilter = useCallback((val) => {
    updateFilter('dateRange', typeof val === 'function' ? val(dateRangeFilter) : val);
  }, [updateFilter, dateRangeFilter]);

  const setValueFilter = useCallback((val) => {
    updateFilter('valueRange', typeof val === 'function' ? val(valueFilter) : val);
  }, [updateFilter, valueFilter]);

  const setStatusColFilter = useCallback((val) => {
    updateFilter('statusCol', typeof val === 'function' ? val(statusColFilter) : val);
  }, [updateFilter, statusColFilter]);

  const setRenewedFilter = useCallback((val) => {
    updateFilter('renewalConfirmation', typeof val === 'function' ? val(renewedFilter) : val);
  }, [updateFilter, renewedFilter]);

  const setInvoiceFilter = useCallback((val) => {
    updateFilter('invoiceStatus', typeof val === 'function' ? val(invoiceFilter) : val);
  }, [updateFilter, invoiceFilter]);

  const setPaymentFilter = useCallback((val) => {
    updateFilter('paymentStatus', typeof val === 'function' ? val(paymentFilter) : val);
  }, [updateFilter, paymentFilter]);

  const setClientFilter = useCallback((val) => {
    updateFilter('clientName', typeof val === 'function' ? val(clientFilter) : val);
  }, [updateFilter, clientFilter]);

  const setServiceFilter = useCallback((val) => {
    updateFilter('serviceName', typeof val === 'function' ? val(serviceFilter) : val);
  }, [updateFilter, serviceFilter]);

  const setStatusFilter = useCallback((val) => {
    updateFilter('status', typeof val === 'function' ? val(statusFilter) : val);
  }, [updateFilter, statusFilter]);

  // Local state for smooth search bar typing, debounced into URL searchParams
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        updateFilter('search', searchInput);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search, updateFilter]);

  const setSearch = useCallback((val) => {
    const cleanVal = typeof val === 'function' ? val(search) : val;
    setSearchInput(cleanVal || '');
    updateFilter('search', cleanVal || '');
  }, [search, updateFilter]);

  const clearAllFilters = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      const filterKeys = ['search', 'status', 'dateRange', 'valueRange', 'statusCol', 'renewalConfirmation', 'invoiceStatus', 'paymentStatus', 'clientName', 'serviceName'];
      filterKeys.forEach(k => next.delete(k));
      return next;
    }, { replace: true });
    setSearchInput('');
    setPage(1);
  }, [setSearchParams]);

  // Update URL and local state when status changes
  const handleStatusChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
  };
  
  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Opened via the app shell's "+ Create" action (e.g. /renewals?create=1)
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setSelectedRenewalToEdit(null);
      setIsFormOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [selectedRenewalToEdit, setSelectedRenewalToEdit] = useState(null);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [selectedRenewal, setSelectedRenewal] = useState(null);
  const [selectedClientDetails, setSelectedClientDetails] = useState(null);
  const [showRenewConfirmationModal, setShowRenewConfirmationModal] = useState(false);
  const [confirmRenewalId, setConfirmRenewalId] = useState(null);
  const [selectedInvoiceRenewal, setSelectedInvoiceRenewal] = useState(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState('');
  const [bulkConfirmationValue, setBulkConfirmationValue] = useState('');

  // Column Sorting State
  const [sortCol, setSortCol] = useState('renewal_date');
  const [sortDir, setSortDir] = useState('asc');

  // Table Compact Mode State (Excel-like density)
  const [isCompact, setIsCompact] = useState(() => {
    return localStorage.getItem('rmt_table_compact') === 'true';
  });

  const toggleCompact = () => {
    setIsCompact(prev => {
      const next = !prev;
      localStorage.setItem('rmt_table_compact', String(next));
      return next;
    });
  };

  // Column Widths State (Resizable Columns)
  const [colWidths, setColWidths] = useState(() => {
    const saved = localStorage.getItem('rmt_col_widths');
    return saved ? JSON.parse(saved) : {
      id: 95,
      client: 240,
      service: 110,
      quotation: 120,
      date: 125,
      value: 95,
      status: 95,
      timeline: 95,
      renewed: 145,
      invoice: 80,
      payment: 80,
      actions: 80,
      approvals: 90,
      bal: 110
    };
  });

  // Column Visibility State (Show/Hide Columns)
  const [visibleCols, setVisibleCols] = useState(() => {
    const saved = localStorage.getItem('rmt_visible_cols');
    return saved ? JSON.parse(saved) : {
      id: true,
      client: true,
      service: true,
      quotation: true,
      date: true,
      value: true,
      status: true,
      timeline: true,
      renewed: true,
      invoice: true,
      payment: true,
      actions: true,
      approvals: true,
      bal: true
    };
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef(null);

  const toggleColumnVisibility = (colKey) => {
    setVisibleCols(prev => {
      const next = { ...prev, [colKey]: !prev[colKey] };
      localStorage.setItem('rmt_visible_cols', JSON.stringify(next));
      return next;
    });
  };

  // Drag-to-resize Column Width Handler
  const handleResizeMouseDown = (colKey, e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || 90;

    const handleMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const newW = Math.max(35, startWidth + delta);
      setColWidths(prev => {
        const next = { ...prev, [colKey]: newW };
        localStorage.setItem('rmt_col_widths', JSON.stringify(next));
        return next;
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Sort handler
  const handleSort = (colKey) => {
    if (sortCol === colKey) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colKey);
      setSortDir('asc');
    }
  };

  // Priority tier helper:
  // Tier 0: Active / Pending renewals (nearest renewal dates / lowest days left on top)
  // Tier 1: Renewed / Completed / Called data
  // Tier 2: Expired renewals (past due, not cancelled)
  // Tier 3: ALL Cancelled renewals (placed at the absolute bottom / down of the table)
  const getRenewalSortTier = (r) => {
    if (!r) return 0;
    const status = (r.status || '').toLowerCase().trim();
    const confirmation = (r.renewal_confirmation || '').toLowerCase().trim();
    const followUp = (r.follow_up_status || '').toLowerCase().trim();
    const editStatus = (r.edit_status || '').toLowerCase().trim();
    const daysLeft = r.days_left;

    // Tier 3 (Very bottom of table): All Cancelled, Lost, or Discontinued renewals
    if (
      status === 'cancelled' ||
      confirmation === 'cancelled' ||
      confirmation === 'lost' ||
      confirmation === 'service_discontinued' ||
      editStatus === 'cancelled'
    ) {
      return 3;
    }

    // Tier 2: Expired renewals (past due)
    if (status === 'expired' || (daysLeft !== null && daysLeft !== undefined && daysLeft < 0)) {
      return 2;
    }

    // Tier 1: Renewed / Completed / Called data
    if (
      status === 'renewed' ||
      status === '-' ||
      confirmation === 'renewed' ||
      followUp === 'completed' ||
      followUp.includes('called') ||
      followUp.includes('completed')
    ) {
      return 1;
    }

    // Tier 0: Active / Pending renewals (top priority)
    return 0;
  };

  // Sort computation: shows active renewals with nearest renewal dates (lowest days left) on top,
  // followed by renewed/completed, then expired, and ALL cancelled renewals at the very bottom
  const sortedRenewals = React.useMemo(() => {
    if (!renewals || renewals.length === 0) return [];
    return [...renewals].sort((a, b) => {
      const tierA = getRenewalSortTier(a);
      const tierB = getRenewalSortTier(b);

      // Tier sorting: Tier 0 on top, Tier 3 (cancelled) at the very bottom
      if (tierA !== tierB) {
        return tierA - tierB;
      }

      // If sorting by renewal_date (or default), show nearest renewal dates (lowest days left) on top
      if (!sortCol || sortCol === 'renewal_date') {
        const timeA = a.renewal_date ? new Date(a.renewal_date).getTime() : Infinity;
        const timeB = b.renewal_date ? new Date(b.renewal_date).getTime() : Infinity;
        if (timeA !== timeB) {
          return sortDir === 'desc' ? timeB - timeA : timeA - timeB;
        }
        return (a.unique_id || '').localeCompare(b.unique_id || '');
      }

      // Column-specific sorting within each tier
      let valA = a[sortCol];
      let valB = b[sortCol];
      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      if (sortCol === 'value' || sortCol === 'invoice_value') {
        const numA = parseFloat(valA) || 0;
        const numB = parseFloat(valB) || 0;
        return sortDir === 'asc' ? numA - numB : numB - numA;
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }

      return sortDir === 'asc' 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });
  }, [renewals, sortCol, sortDir]);

  // Bulk Actions
  const handleExecuteBulkStatus = async () => {
    if (!selectedIds.length) return;
    try {
      const activeToken = (await getValidToken()) || token;
      const res = await fetch('/api/renewals/batch-update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}`
        },
        body: JSON.stringify({
          ids: selectedIds,
          status: bulkStatusValue || null,
          renewal_confirmation: bulkConfirmationValue || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || `Updated ${selectedIds.length} records.`);
        setSelectedIds([]);
        setShowBulkStatusModal(false);
        setBulkStatusValue('');
        setBulkConfirmationValue('');
        fetchRenewals();
      } else {
        toast.error(data.error || 'Failed to update records');
      }
    } catch (err) {
      toast.error('Error updating bulk status');
    }
  };

  const handleExecuteBulkReminder = async () => {
    if (!selectedIds.length) return;
    try {
      const activeToken = (await getValidToken()) || token;
      const res = await fetch('/api/renewals/batch-send-reminder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}`
        },
        body: JSON.stringify({ ids: selectedIds })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || `Sent reminder emails.`);
      } else {
        toast.error(data.error || 'Failed to send reminders.');
      }
    } catch (err) {
      toast.error('Error sending batch reminders.');
    }
  };

  const handleExportSelected = () => {
    const selectedRecords = renewals.filter(r => selectedIds.includes(r.id));
    if (selectedRecords.length === 0) {
      toast.error('No records selected for export.');
      return;
    }
    const headers = ['Unique ID', 'Client Name', 'Service', 'Quotation No', 'Renewal Date', 'Value', 'Status', 'Confirmation', 'Invoice Status', 'Payment Status', 'Owner'];
    const rows = selectedRecords.map(r => [
      r.unique_id,
      `"${(r.client_name || '').replace(/"/g, '""')}"`,
      `"${(r.service || '').replace(/"/g, '""')}"`,
      `"${(r.quotation_number || '').replace(/"/g, '""')}"`,
      r.renewal_date ? formatDate(r.renewal_date) : '',
      r.value || 0,
      r.status || '',
      r.renewal_confirmation || '',
      r.invoice_status || '',
      r.payment_status || '',
      `"${(r.owner || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `selected_renewals_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${selectedRecords.length} records to CSV.`);
  };

  const handleExecuteBulkDelete = async () => {
    if (!isAdmin || !selectedIds.length) return;
    try {
      const activeToken = (await getValidToken()) || token;
      const res = await fetch('/api/renewals/batch-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}`
        },
        body: JSON.stringify({ ids: selectedIds })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || `Deleted ${selectedIds.length} records.`);
        setSelectedIds([]);
        setShowBatchDeleteModal(false);
        fetchRenewals();
      } else {
        toast.error(data.error || 'Failed to delete records');
      }
    } catch (err) {
      toast.error('Error executing batch delete');
    }
  };

  const [newRenewalDate, setNewRenewalDate] = useState('');
  const [selectedPaymentRenewal, setSelectedPaymentRenewal] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentDateInput, setPaymentDateInput] = useState('');
  const datePickerRef = useRef(null);

  const tableContainerRef = useRef(null);
  const [isDragDown, setIsDragDown] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragScrollLeft, setDragScrollLeft] = useState(0);

  const handleDragMouseDown = (e) => {
    if (e.button !== 0) return; // Only left click
    if (e.target.closest('select') || e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) {
      return;
    }
    setIsDragDown(true);
    setDragStartX(e.pageX - tableContainerRef.current.offsetLeft);
    setDragScrollLeft(tableContainerRef.current.scrollLeft);
  };

  const handleDragMouseLeave = () => {
    setIsDragDown(false);
  };

  const handleDragMouseUp = () => {
    setIsDragDown(false);
  };

  const handleDragMouseMove = (e) => {
    if (!isDragDown) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const walk = (x - dragStartX) * 1.5;
    tableContainerRef.current.scrollLeft = dragScrollLeft - walk;
  };

  const handleNativeDateSelect = (e) => {
    const val = e.target.value;
    if (!val) return;
    const [year, month, day] = val.split('-');
    setNewRenewalDate(`${day}/${month}/${year}`);
  };

  const [masterClientList, setMasterClientList] = useState([]);

  useEffect(() => {
    if (renewals && renewals.length > 0) {
      setMasterClientList(prev => {
        let hasNew = false;
        const set = new Set(prev);
        renewals.forEach(r => {
          const name = r.client_name?.trim();
          if (name && !set.has(name)) {
            set.add(name);
            hasNew = true;
          }
        });
        if (!hasNew && prev.length > 0) return prev;
        return Array.from(set).sort((a, b) => a.localeCompare(b));
      });
    }
  }, [renewals]);

  const clientList = useMemo(() => {
    const set = new Set(masterClientList);
    renewals.forEach(r => {
      if (r.client_name && r.client_name.trim()) set.add(r.client_name.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [renewals, masterClientList]);

  const fetchRenewals = async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    setSelectedIds([]); // Clear selection when fetching new dataset
    try {
      const qSent = searchParams.get('quotesSent') || '';
      const pFollow = searchParams.get('pendingFollowup') || '';
      const servParam = Array.isArray(serviceFilter) && serviceFilter.length > 0 ? serviceFilter.join(',') : 'all';
      const statusColParam = Array.isArray(statusColFilter) && statusColFilter.length > 0 ? statusColFilter.join(',') : (statusFilter !== 'all' ? statusFilter : 'all');
      const dateParam = Array.isArray(dateRangeFilter) && dateRangeFilter.length > 0 ? dateRangeFilter.join(',') : 'all';
      const valParam = Array.isArray(valueFilter) && valueFilter.length > 0 ? valueFilter.join(',') : 'all';
      const renParam = Array.isArray(renewedFilter) && renewedFilter.length > 0 ? renewedFilter.join(',') : 'all';
      const invParam = Array.isArray(invoiceFilter) && invoiceFilter.length > 0 ? invoiceFilter.join(',') : 'all';
      const payParam = Array.isArray(paymentFilter) && paymentFilter.length > 0 ? paymentFilter.join(',') : 'all';
      const clientParam = Array.isArray(clientFilter) ? (clientFilter.length > 0 ? clientFilter.join(',') : '') : (clientFilter || '');

      const res = await fetch(`/api/renewals?page=1&limit=10000&search=${encodeURIComponent(search)}&status=${encodeURIComponent(statusColParam)}&dateRange=${encodeURIComponent(dateParam)}&valueRange=${encodeURIComponent(valParam)}&renewalConfirmation=${encodeURIComponent(renParam)}&clientName=${encodeURIComponent(clientParam)}&serviceName=${encodeURIComponent(servParam)}&invoiceStatus=${encodeURIComponent(invParam)}&paymentStatus=${encodeURIComponent(payParam)}&quotesSent=${qSent}&pendingFollowup=${pFollow}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setRenewals(data.data || []);
          setTotalPages(data.pagination?.totalPages || 1);
          setTotalRecords(data.pagination?.total || 0);
        } else {
          toast.error('Server returned invalid response format.');
        }
      } else {
        const contentType = res.headers.get('content-type');
        let errMsg = 'Failed to load renewals';
        if (contentType && contentType.includes('application/json')) {
          const errData = await res.json().catch(() => ({}));
          errMsg = errData.error || errMsg;
        }
        toast.error(errMsg);
      }
    } catch (err) {
      console.error('Error fetching renewals:', err);
      toast.error('Network or server connection error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Referentially stable refs for fetchRenewals and renewals
  const fetchRenewalsRef = useRef(fetchRenewals);
  fetchRenewalsRef.current = fetchRenewals;
  const renewalsRef = useRef(renewals);
  renewalsRef.current = renewals;

  // Real-time synchronization event listener — attaches once and always calls latest fetchRenewalsRef
  useEffect(() => {
    const handleRealTimeUpdate = () => {
      console.log('📡 UI Refetching renewals in background from SSE event...');
      if (fetchRenewalsRef.current) {
        fetchRenewalsRef.current(true);
      }
    };

    window.addEventListener('rmt_renewals_updated', handleRealTimeUpdate);
    return () => {
      window.removeEventListener('rmt_renewals_updated', handleRealTimeUpdate);
    };
  }, []);

  const confirmDeleteBatch = async () => {
    try {
      const res = await fetch('/api/renewals/delete-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids: selectedIds })
      });

      if (res.ok) {
        toast.success(`${selectedIds.length} renewals moved to trash`);
        setSelectedIds([]);
        setShowBatchDeleteModal(false);
        fetchRenewals();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete renewals');
      }
    } catch (err) {
      toast.error('Network error during batch delete');
    }
  };

  useEffect(() => {
    if (!token) return;
    const delayDebounceFn = setTimeout(() => {
      fetchRenewals();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [page, search, statusFilter, dateRangeFilter, valueFilter, statusColFilter, renewedFilter, invoiceFilter, paymentFilter, clientFilter, serviceFilter, token]);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setOpenFilterCol(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleFilter = (col, e) => {
    e.stopPropagation();
    if (openFilterCol === col) {
      setOpenFilterCol(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const leftPos = Math.max(10, Math.min(window.innerWidth - 230, rect.left - 40));
      setFilterPos({
        top: rect.bottom + 4,
        left: leftPos,
      });
      setOpenFilterCol(col);
    }
  };



  const handleExportCSV = () => {
    // Simple CSV export logic
    const headers = ['Unique ID', 'Client', 'Service', 'Renewal Date', 'Value', 'Status', 'Days Left'];
    const csvData = renewals.map(r => [
      r.unique_id, `"${r.client_name}"`, `"${r.service}"`, r.renewal_date, r.value, r.status, r.days_left
    ]);
    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `renewals_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'Invoice Number',
      'Client Name',
      'Service Name',
      'Renewal Date',
      'Contract Value (Rs)',
      'Client Email',
      'Client Secondary Mail',
      'Contact Person',
      'Contact Number',
      'Reference ID (Invoice No)',
      'Plan Period',
      'Plan Duration (Years)',
      'Entity',
      'Product',
      'Vendor',
      'Description',
      'Quantity',
      'Purchase Cost (Rs)',
      'Sales Cost (Rs)',
      'Renewed'
    ];
    const sampleData = [
      [
        'INV-2026-001', 'ABC Technologies Pvt Ltd', 'Amazon Web Services',
        '15/08/2026', '125000',
        'admin@abctech.com', 'support@abctech.com',
        'Rahul Sharma', '9876543210', 'REF-001',
        'yearly_plan', '1',
        'MIPL', 'AWS EC2', 'Amazon', 'Cloud compute instances',
        '5', '20000', '25000',
        'Awaiting with vendor'
      ],
      [
        'INV-2026-002', 'Global Media Solutions', 'Microsoft Azure',
        '05/09/2026', '85000',
        'contact@globalmedia.com', 'accounts@globalmedia.com',
        'Priya Menon', '9123456780', 'REF-002',
        'monthly_plan', '1',
        'SIDCORPTECH', 'Azure VM', 'Microsoft', 'Virtual machine subscription',
        '2', '35000', '42500',
        'Pending'
      ]
    ];
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.map(val => `"${val}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'RenewalPro_Bulk_Upload_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApproveEdit = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/renewals/${id}/approve-edit`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Edit request approved.');
        setSearch('');
        setSearchParams({});
        fetchRenewalsRef.current();
      } else {
        toast.error('Failed to approve edit.');
      }
    } catch (err) {
      toast.error('Network error');
    }
  }, [token, setSearchParams]);

  const handleDelete = useCallback((id) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  }, []);

  // Stable per-row callbacks for RenewalTableRow's memo — see its file-level
  // comment for why every prop passed to it needs to be a stable reference.
  const handleNavigateToRenewal = useCallback((id) => {
    navigate(`/renewals/${id}`);
  }, [navigate]);

  const handleEditRow = useCallback((row) => {
    setSelectedRenewalToEdit(row);
    setIsFormOpen(true);
  }, []);

  const handleToggleSelectRow = useCallback((id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const submitDelete = async (id) => {
    try {
      const res = await fetch(`/api/renewals/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Renewal moved to trash');
        fetchRenewals();
      } else {
        toast.error('Failed to delete renewal');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error('File size must be within 10MB');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvText = event.target?.result;
      if (typeof csvText !== 'string') {
        toast.error('Failed to read file content.');
        return;
      }

      try {
        // RFC 4180-compliant CSV parser: handles multi-line quoted fields
        const parseCSVText = (text) => {
          const rows = [];
          let row = [];
          let cell = '';
          let inQuotes = false;
          for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const next = text[i + 1];
            if (inQuotes) {
              if (ch === '"' && next === '"') { cell += '"'; i++; }
              else if (ch === '"') { inQuotes = false; }
              else { cell += ch; }
            } else {
              if (ch === '"') { inQuotes = true; }
              else if (ch === ',') { row.push(cell.trim()); cell = ''; }
              else if (ch === '\r' && next === '\n') {
                row.push(cell.trim()); rows.push(row); row = []; cell = ''; i++;
              } else if (ch === '\n') {
                row.push(cell.trim()); rows.push(row); row = []; cell = '';
              } else { cell += ch; }
            }
          }
          row.push(cell.trim());
          if (row.some(v => v)) rows.push(row);
          return rows;
        };

        const allRows = parseCSVText(csvText);
        if (allRows.length < 2) {
          toast.error('CSV file must contain a header row and at least one data row.');
          return;
        }

        const headers = allRows[0].map(h => normalizeHeader(h));

        const records = [];
        for (let i = 1; i < allRows.length; i++) {
          const rowData = allRows[i];
          if (!rowData.some(v => v)) continue;

          const record = {};
          headers.forEach((header, index) => {
            if (header) record[header] = rowData[index] || '';
          });

          // Normalize service name (e.g. MS365 -> M365)
          if (record.service) {
            record.service = record.service.trim();
            if (record.service.toUpperCase() === 'MS365') {
              record.service = 'M365';
            }
          }

          // Validate required columns
          if (!record.client_name || !record.service || !record.renewal_date || !record.owner || !record.client_email || !record.contact_number) {
            throw new Error(`Row ${i + 1}: Missing required fields (Client Name, Service, Renewal Date, Contact Person, Client Email, or Contact Number).`);
          }

          // Normalise date
          const parsedDate = parseCSVDate(record.renewal_date);
          if (!parsedDate) {
            throw new Error(`Row ${i + 1}: Invalid date value: ${record.renewal_date}. Supported formats: DD/MM/YYYY or YYYY-MM-DD.`);
          }
          record.renewal_date = parsedDate;
          record.value        = parseFloat(record.value) || 0;
          record.quantity     = parseInt(record.quantity) || 1;
          record.purchase_cost = parseFloat(record.purchase_cost) || 0;
          record.sales_cost   = parseFloat(record.sales_cost) || 0;
          record.total_purchase_cost = record.quantity * record.purchase_cost;
          record.total_sales_cost    = record.quantity * record.sales_cost;
          record.profit              = record.total_sales_cost - record.total_purchase_cost;
          record.plan_duration = parseInt(record.plan_duration) || 1;
          // Validate entity
          if (record.entity) {
            record.entity = record.entity.trim().toUpperCase();
          }
          const validEntities = ['MIPL', 'SIDCORPTECH', 'SPIOT'];
          if (record.entity && !validEntities.includes(record.entity)) {
            throw new Error(`Row ${i + 1}: Invalid entity "${record.entity}". Must be one of: MIPL, SIDCORPTECH, SPIOT.`);
          }
          // Validate plan period
          const validPlans = ['monthly_plan', 'quarterly_plan', 'halfly_plan', 'yearly_plan'];
          if (record.plan_period && !validPlans.includes(record.plan_period)) {
            record.plan_period = 'yearly_plan'; // default
          }

          // Normalize renewed status
          if (record.renewed) {
            const rClean = record.renewed.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            if (rClean.includes('remindersent') || rClean.includes('reminder') || rClean.includes('withvendor')) {
              record.renewal_confirmation = 'reminder_sent';
            } else if (rClean.includes('quotesent') || rClean.includes('quote') || rClean.includes('quotation')) {
              record.renewal_confirmation = 'quote_sent';
            } else if (rClean.includes('clientapproval') || rClean.includes('awaitingclient')) {
              record.renewal_confirmation = 'awaiting_client_approval';
            } else if (rClean === 'renewed') {
              record.renewal_confirmation = 'renewed';
            } else if (rClean.includes('lost')) {
              record.renewal_confirmation = 'lost';
            } else if (rClean.includes('discontinued') || rClean.includes('cancel')) {
              record.renewal_confirmation = 'cancelled';
            } else {
              record.renewal_confirmation = 'pending';
            }
          } else {
            record.renewal_confirmation = 'pending';
          }

          records.push(record);
        }

        if (records.length === 0) {
          toast.error('No valid records found in the CSV file.');
          return;
        }

        // Upload JSON payload
        const response = await fetch('/api/renewals/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ records })
        });

        if (response.ok) {
          const result = await response.json();
          toast.success(result.message || `Successfully imported ${records.length} records.`);
          fetchRenewals();
        } else {
          const errData = await response.json();
          toast.error(errData.error || 'Failed to import CSV.');
        }
      } catch (err) {
        toast.error(err.message || 'Error parsing CSV file.');
      } finally {
        e.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  const isSales = user?.role === 'user' || user?.role === 'cst';
  const isAdmin = (user?.role === 'super_admin' || user?.role === 'dept_admin');

  const getColWidth = (colName) => {
    switch (colName) {
      case 'id': return 'w-[6.5%]';
      case 'client': return 'w-[15%]';
      case 'service': return 'w-[7.5%]';
      case 'quotation': return 'w-[7%]';
      case 'date': return 'w-[8%]';
      case 'value': return 'w-[6%]';
      case 'status': return 'w-[8.5%]';
      case 'timeline': return 'w-[6.5%]';
      case 'renewed': return 'w-[7.5%]';
      case 'invoice': return 'w-[5%]';
      case 'payment': return 'w-[5%]';
      case 'actions': return 'w-[4.5%]';
      case 'approvals': return 'w-[5%]';
      case 'bal': return 'w-[6%]';
      default: return '';
    }
  };

  const handleToggleStopEmail = useCallback(async (id, currentStopEmail) => {
    try {
      const activeToken = (await getValidToken()) || token;
      const nextState = !currentStopEmail;
      const res = await fetch(`/api/renewals/${id}/stop-email`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}`
        },
        body: JSON.stringify({ stop_email: nextState })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update email setting.');

      toast.success(data.message || `Email reminders ${nextState ? 'stopped' : 'resumed'}.`);
      setRenewals(prev => prev.map(r => r.id === id ? { ...r, stop_email: nextState } : r));
    } catch (err) {
      toast.error(err.message);
    }
  }, [token, getValidToken]);

  const handleBatchStopEmail = async (stopEmailState, customIds = null) => {
    const targetIds = customIds || selectedIds;
    if (!targetIds || targetIds.length === 0) return;
    try {
      const activeToken = (await getValidToken()) || token;
      const res = await fetch(`/api/renewals/batch-stop-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}`
        },
        body: JSON.stringify({ ids: targetIds, stop_email: stopEmailState })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to batch update email settings.');

      toast.success(stopEmailState ? "Client email automation has been stopped." : "Client email automation has been resumed.");
      setRenewals(prev => prev.map(r => targetIds.includes(r.id) ? { ...r, stop_email: stopEmailState } : r));
      setSelectedIds([]);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // PERF: signature changed from (id, confirmation) to (row, confirmation) —
  // it used to look the record up via renewals.find(r => r.id === id), which
  // meant this callback had to close over the `renewals` array and could
  // never be referentially stable across a data refetch (defeating
  // RenewalTableRow's memo for the whole table on every fetch, including the
  // 300ms-debounced search-driven ones). The caller (the row) already has the
  // Supports either (row, confirmation) or legacy (id, confirmation) signature
  const handleRenewalConfirmation = useCallback(async (rowOrId, confirmation) => {
    const row = (typeof rowOrId === 'object' && rowOrId !== null)
      ? rowOrId
      : (renewalsRef.current?.find(r => r.id === rowOrId) || { id: rowOrId });
    const id = row?.id || rowOrId;
    if (!id || id === 'undefined') {
      toast.error('Invalid renewal selection');
      return;
    }

    if (confirmation === 'renewed') {
      let currentFormatted = '';
      try {
        let baseDate = new Date();
        if (row?.renewal_date) {
          baseDate = new Date(row.renewal_date);
        }

        const plan = row?.plan_period;
        const duration = parseInt(row?.plan_duration || 1, 10);
        let monthsToAdd = 12; // default to yearly
        if (plan === 'monthly_plan') {
          monthsToAdd = 1;
        } else if (plan === 'quarterly_plan') {
          monthsToAdd = 3;
        } else if (plan === 'halfly_plan') {
          monthsToAdd = 6;
        } else if (plan === 'yearly_plan') {
          monthsToAdd = 12 * duration;
        }

        const newDate = new Date(baseDate);
        newDate.setMonth(newDate.getMonth() + monthsToAdd);

        if (!isNaN(newDate.getTime())) {
          const day = String(newDate.getDate()).padStart(2, '0');
          const month = String(newDate.getMonth() + 1).padStart(2, '0');
          const year = newDate.getFullYear();
          currentFormatted = `${day}/${month}/${year}`;
        }
      } catch (e) {
        currentFormatted = '';
      }
      setNewRenewalDate(currentFormatted);
      setConfirmRenewalId(id);
      setShowRenewConfirmationModal(true);
      return;
    }

    const remarks = confirmation === 'renewed_with_update'
      ? window.prompt('Enter update details / remarks:')
      : null;
    if (confirmation === 'renewed_with_update' && !remarks) return;

    try {
      const res = await fetch(`/api/renewals/${id}/confirm-renewal`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ renewal_confirmation: confirmation, remarks })
      });
      if (res.ok) {
        toast.success('Renewal status is changed');
        fetchRenewalsRef.current();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update');
      }
    } catch (err) {
      toast.error('Network error');
    }
  }, [token]);

  // Supports either (row, status) or legacy (id, status) signature
  const handleInvoiceStatus = useCallback(async (rowOrId, status) => {
    const row = (typeof rowOrId === 'object' && rowOrId !== null)
      ? rowOrId
      : (renewalsRef.current?.find(r => r.id === rowOrId) || { id: rowOrId });
    const id = row?.id || rowOrId;
    if (!id || id === 'undefined') {
      toast.error('Invalid renewal selection');
      return;
    }

    if (status === 'Sent') {
      setSelectedInvoiceRenewal(row);
      setIsInvoiceModalOpen(true);
      return;
    }
    try {
      const res = await fetch(`/api/renewals/${id}/invoice`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invoice_status: status })
      });
      if (res.ok) {
        toast.success('Invoice status updated');
        fetchRenewalsRef.current();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update invoice status');
      }
    } catch (err) {
      toast.error('Network error');
    }
  }, [token]);

  // Supports either (row, status) or legacy (id, status) signature
  const handlePaymentStatus = useCallback(async (rowOrId, status) => {
    const row = (typeof rowOrId === 'object' && rowOrId !== null)
      ? rowOrId
      : (renewalsRef.current?.find(r => r.id === rowOrId) || { id: rowOrId });
    const id = row?.id || rowOrId;
    if (!id || id === 'undefined') {
      toast.error('Invalid renewal selection');
      return;
    }

    if (status === 'Yes') {
      setSelectedPaymentRenewal(row);
      setPaymentAmountInput(row.value ? String(row.value) : '');
      setPaymentDateInput(new Date().toISOString().substring(0, 10));
      setIsPaymentModalOpen(true);
      return;
    }
    try {
      const res = await fetch(`/api/renewals/${id}/payment`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payment_status: 'No' })
      });
      if (res.ok) {
        toast.success('Payment status updated to No');
        fetchRenewalsRef.current();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update payment status');
      }
    } catch (err) {
      toast.error('Network error');
    }
  }, [token]);

  const submitPaymentDetails = async () => {
    if (!selectedPaymentRenewal) return;
    if (!paymentAmountInput || !paymentDateInput) {
      toast.error('Payment Amount and Date are required');
      return;
    }
    try {
      const res = await fetch(`/api/renewals/${selectedPaymentRenewal.id}/payment`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          payment_status: 'Yes',
          payment_amount: paymentAmountInput,
          payment_received_date: paymentDateInput
        })
      });
      if (res.ok) {
        toast.success('Payment details recorded');
        setIsPaymentModalOpen(false);
        setSelectedPaymentRenewal(null);
        fetchRenewals();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update payment details');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const handleNewRenewalDateChange = (e) => {
    let val = e.target.value;
    val = val.replace(/[^0-9/]/g, '');
    const oldVal = newRenewalDate || '';
    if (val.length > oldVal.length) {
      if (val.length === 2) val = val + '/';
      else if (val.length === 5) val = val + '/';
    }
    if (val.length <= 10) {
      setNewRenewalDate(val);
    }
  };

  const submitRenewedConfirmation = async () => {
    if (!newRenewalDate) {
      toast.error('Please select a new renewal date.');
      return;
    }

    let dbRenewalDate = '';
    const parts = newRenewalDate.split('/');
    if (parts.length === 3) {
      const day = parts[0];
      const month = parts[1];
      const year = parts[2];
      const d = parseInt(day, 10);
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      if (isNaN(d) || isNaN(m) || isNaN(y) || m < 1 || m > 12 || d < 1 || d > 31 || y < 1000 || y > 9999) {
        toast.error('Please enter a valid date in DD/MM/YYYY format.');
        return;
      }
      dbRenewalDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else {
      toast.error('Please enter the date in DD/MM/YYYY format.');
      return;
    }
    
    if (!confirmRenewalId) {
      toast.error('No renewal selected.');
      return;
    }

    try {
      const res = await fetch(`/api/renewals/${confirmRenewalId}/confirm-renewal`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          renewal_confirmation: 'renewed', 
          new_renewal_date: dbRenewalDate 
        })
      });
      if (res.ok) {
        toast.success('Renewal status is changed');
        setShowRenewConfirmationModal(false);
        setConfirmRenewalId(null);
        setNewRenewalDate('');
        fetchRenewals();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  // getRenewalConfirmationBadge moved to components/RenewalTableRow.jsx —
  // it was pure (no closures) and only ever used by the row markup that
  // moved there with it.

  const totalCols = 1 + Object.entries(visibleCols).filter(([k, v]) => v && (k !== 'approvals' || isAdmin)).length;
  const isAllEmailStopped = renewals.length > 0 && renewals.every(r => r.stop_email);

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in pb-28 w-full">
      <PageHeader
        title="Renewal Management"
        badge={user?.departmentName ? user.departmentName : user?.role ? user.role.toUpperCase() : null}
        badgeColor="indigo"
      />

      {isAllEmailStopped && (
        <div className="bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-2.5 rounded-lg flex items-center justify-between shadow-sm animate-fade-in w-full">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
            <MailX className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>All client email automation has been stopped.</span>
          </div>
          {(isAdmin || isSales) && (
            <button
              onClick={() => handleBatchStopEmail(false, renewals.map(r => r.id))}
              className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors cursor-pointer flex items-center gap-1"
            >
              <MailCheck className="w-3.5 h-3.5" /> Resume All Emails
            </button>
          )}
        </div>
      )}
        
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 w-full overflow-visible pb-1 sm:pb-0">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>Active filter results: <strong className="text-slate-800 dark:text-white">{totalRecords}</strong></span>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto overflow-visible">
          <div className="relative flex-1 min-w-[180px] sm:w-72 sm:flex-initial">
            <input
              type="text"
              placeholder="Search client name or reference..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              className="input-field pl-8 w-full text-xs py-1.5 bg-white dark:bg-surface-800 text-zinc-900 dark:text-white"
            />
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-surface-400 pointer-events-none z-10" />
          </div>

          <div className="relative flex-shrink-0">
            <GlassSelect
              value={serviceFilter.length === 1 ? serviceFilter[0] : 'all'}
              onChange={(e, val) => {
                const v = val !== undefined ? val : e.target.value;
                setServiceFilter(v === 'all' ? [] : [v]);
                setPage(1);
              }}
              options={SERVICE_OPTIONS}
              icon={Tag}
              size="sm"
            />
          </div>

          <div className="relative flex-shrink-0">
            <GlassSelect
              value={statusFilter}
              onChange={(e, val) => handleStatusChange(val !== undefined ? val : e.target.value)}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'Active', label: 'Active' },
                { value: 'Pending Renewal', label: 'Pending Renewal' },
                { value: 'Expired', label: 'Expired' },
                { value: 'Renewed', label: 'Renewed' },
              ]}
              icon={Filter}
              size="sm"
            />
          </div>

          {/* Column Visibility Popover */}
          <div className="relative" ref={columnPickerRef}>
            <button 
              onClick={() => setShowColumnPicker(prev => !prev)}
              className={`dropdown-btn-glass flex-shrink-0 flex items-center gap-1.5 py-1.5 px-2.5 text-xs ${showColumnPicker ? 'bg-white/80 dark:bg-white/20' : ''}`}
              title="Show/Hide Columns"
            >
              <Columns className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" /> Columns
            </button>
            {showColumnPicker && (
              <div className="absolute right-0 mt-2 w-64 dropdown-menu-glass z-50 p-3.5 text-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-surface-100 dark:border-surface-700/80">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-surface-900 dark:text-white">Show/Hide Columns</span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-full border border-brand-200 dark:border-brand-800">
                      {Object.values(visibleCols).filter(Boolean).length} visible
                    </span>
                  </div>
                  <button 
                    onClick={() => setShowColumnPicker(false)} 
                    className="p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 rounded-md hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {[
                    { key: 'id', label: 'Unique ID' },
                    { key: 'client', label: 'Client Info' },
                    { key: 'service', label: 'Service' },
                    { key: 'quotation', label: 'Quotation No.' },
                    { key: 'date', label: 'Renewal Date' },
                    { key: 'value', label: 'Value' },
                    { key: 'status', label: 'Status' },
                    { key: 'timeline', label: 'Timeline' },
                    { key: 'renewed', label: 'Confirmation' },
                    { key: 'invoice', label: 'Invoice' },
                    { key: 'payment', label: 'Payment' },
                    { key: 'actions', label: 'Actions' },
                    { key: 'bal', label: 'Invoice / Bal' },
                  ].map(col => {
                    const isChecked = !!visibleCols[col.key];
                    return (
                      <label 
                        key={col.key} 
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-all ${
                          isChecked 
                            ? 'bg-surface-50 dark:bg-surface-700/40 text-surface-900 dark:text-white font-medium' 
                            : 'text-surface-400 dark:text-surface-500 hover:bg-surface-50/60 dark:hover:bg-surface-700/20'
                        }`}
                      >
                        <span className="truncate">{col.label}</span>
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={() => toggleColumnVisibility(col.key)} 
                          className="rounded border-surface-300 dark:border-surface-600 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer accent-brand-600"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Table Density Toggle */}
          <button 
            onClick={toggleCompact}
            className={`btn-secondary flex-shrink-0 flex items-center gap-1.5 py-1.5 px-2.5 text-xs ${isCompact ? 'bg-brand-50 text-brand-700 border-brand-300 dark:bg-brand-900/20 dark:text-brand-400' : ''}`}
            title="Toggle Compact View (Excel-like density)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {isCompact ? 'Compact View' : 'Normal View'}
          </button>

          <button onClick={handleExportCSV} className="btn-secondary flex-shrink-0 flex items-center gap-1.5 py-1.5 px-2.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Export All
          </button>

          {isAdmin && (
            <>
              <input
                type="file"
                id="csv-import-input"
                accept=".csv"
                className="hidden"
                onChange={handleImportCSV}
              />
              <button 
                onClick={() => document.getElementById('csv-import-input').click()}
                className="btn-secondary flex-shrink-0 flex items-center gap-1.5 py-1.5 px-2.5 text-xs whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" /> Import
              </button>
            </>
          )}

          {/* Bulk Actions Bar */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1.5 flex-shrink-0 bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 rounded-md px-2 py-1">
              <span className="text-[11px] font-semibold text-brand-700 dark:text-brand-300 mr-1">
                {selectedIds.length} Selected
              </span>

              {(isAdmin || isSales) && (
                <button 
                  onClick={() => setShowBulkStatusModal(true)}
                  className="bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center gap-1 py-1 px-2 text-[11px] rounded transition-colors shadow-sm cursor-pointer"
                  title="Bulk update status or confirmation"
                >
                  <Edit3 className="w-3 h-3" /> Update Status
                </button>
              )}

              {(isAdmin || isSales) && (
                <button 
                  onClick={handleExecuteBulkReminder}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1 py-1 px-2 text-[11px] rounded transition-colors shadow-sm cursor-pointer"
                  title="Send reminder emails to selected clients"
                >
                  <Send className="w-3 h-3" /> Send Reminder
                </button>
              )}

              <button 
                onClick={handleExportSelected}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1 py-1 px-2 text-[11px] rounded transition-colors shadow-sm cursor-pointer"
                title="Export selected records to CSV"
              >
                <FileSpreadsheet className="w-3 h-3" /> Export Selected
              </button>

              {(isAdmin || isSales) && (
                <>
                  <button 
                    onClick={() => handleBatchStopEmail(true)}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1 py-1 px-2 text-[11px] rounded transition-colors shadow-sm cursor-pointer"
                    title="Stop automated reminder emails for selected clients"
                  >
                    <MailX className="w-3 h-3" /> Stop Emails
                  </button>
                  <button 
                    onClick={() => handleBatchStopEmail(false)}
                    className="bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1 py-1 px-2 text-[11px] rounded transition-colors shadow-sm cursor-pointer"
                    title="Resume automated reminder emails for selected clients"
                  >
                    <MailCheck className="w-3 h-3" /> Resume Emails
                  </button>
                </>
              )}

              {isAdmin && (
                <button 
                  onClick={() => setShowBatchDeleteModal(true)}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center gap-1 py-1 px-2 text-[11px] rounded transition-colors shadow-sm cursor-pointer"
                  title="Delete selected records"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              )}
            </div>
          )}

          {(isSales || isAdmin) && (
            <button 
              onClick={() => { setSelectedRenewalToEdit(null); setIsFormOpen(true); }}
              className="btn-primary flex-shrink-0 flex items-center gap-1.5 py-1.5 px-2.5 text-xs whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Add Renewal
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Chips Bar */}
      {(search || statusFilter !== 'all' || clientFilter.length > 0 || serviceFilter.length > 0 || dateRangeFilter.length > 0 || valueFilter.length > 0 || statusColFilter.length > 0 || renewedFilter.length > 0 || invoiceFilter.length > 0 || paymentFilter.length > 0) && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-brand-50/80 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-800/50 rounded-xl mb-3 animate-in fade-in duration-150 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-bold text-brand-800 dark:text-brand-300 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" /> Active Filters:
            </span>
            {search && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-200 border border-surface-200 dark:border-surface-700 text-[11px] shadow-sm font-medium">
                Search: "{search}"
                <button type="button" onClick={() => setSearch('')} className="hover:text-rose-500 transition-colors"><X className="w-3 h-3" /></button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-200 border border-surface-200 dark:border-surface-700 text-[11px] shadow-sm font-medium">
                Status: {statusFilter}
                <button type="button" onClick={() => setStatusFilter('all')} className="hover:text-rose-500 transition-colors"><X className="w-3 h-3" /></button>
              </span>
            )}
            {clientFilter.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300 border border-brand-200 dark:border-brand-800 text-[11px] shadow-sm font-semibold">
                Clients ({clientFilter.length})
                <button type="button" onClick={() => setClientFilter([])} className="hover:text-rose-500 transition-colors"><X className="w-3 h-3" /></button>
              </span>
            )}
            {serviceFilter.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-200 border border-surface-200 dark:border-surface-700 text-[11px] shadow-sm font-medium">
                Services ({serviceFilter.length})
                <button type="button" onClick={() => setServiceFilter([])} className="hover:text-rose-500 transition-colors"><X className="w-3 h-3" /></button>
              </span>
            )}
            {dateRangeFilter.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-200 border border-surface-200 dark:border-surface-700 text-[11px] shadow-sm font-medium">
                Date Range ({dateRangeFilter.length})
                <button type="button" onClick={() => setDateRangeFilter([])} className="hover:text-rose-500 transition-colors"><X className="w-3 h-3" /></button>
              </span>
            )}
            {valueFilter.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-200 border border-surface-200 dark:border-surface-700 text-[11px] shadow-sm font-medium">
                Value ({valueFilter.length})
                <button type="button" onClick={() => setValueFilter([])} className="hover:text-rose-500 transition-colors"><X className="w-3 h-3" /></button>
              </span>
            )}
            {renewedFilter.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-200 border border-surface-200 dark:border-surface-700 text-[11px] shadow-sm font-medium">
                Confirmation ({renewedFilter.length})
                <button type="button" onClick={() => setRenewedFilter([])} className="hover:text-rose-500 transition-colors"><X className="w-3 h-3" /></button>
              </span>
            )}
            {invoiceFilter.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-200 border border-surface-200 dark:border-surface-700 text-[11px] shadow-sm font-medium">
                Invoice ({invoiceFilter.length})
                <button type="button" onClick={() => setInvoiceFilter([])} className="hover:text-rose-500 transition-colors"><X className="w-3 h-3" /></button>
              </span>
            )}
            {paymentFilter.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-200 border border-surface-200 dark:border-surface-700 text-[11px] shadow-sm font-medium">
                Payment ({paymentFilter.length})
                <button type="button" onClick={() => setPaymentFilter([])} className="hover:text-rose-500 transition-colors"><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 flex-shrink-0 cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="card overflow-hidden mt-3 sm:mt-5">
        <div 
          ref={tableContainerRef}
          onMouseDown={handleDragMouseDown}
          onMouseLeave={handleDragMouseLeave}
          onMouseUp={handleDragMouseUp}
          onMouseMove={handleDragMouseMove}
          className={`overflow-auto max-h-[calc(100vh-210px)] relative select-none custom-scrollbar ${isDragDown ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <table className="w-full text-left text-[11px] sm:text-xs table-fixed">
            <colgroup>
              <col style={{ width: '36px' }} />
              {visibleCols.id && <col style={{ width: `${colWidths.id || 95}px` }} />}
              {visibleCols.client && <col style={{ width: `${colWidths.client || 240}px` }} />}
              {visibleCols.service && <col style={{ width: `${colWidths.service || 110}px` }} />}
              {visibleCols.quotation && <col style={{ width: `${colWidths.quotation || 120}px` }} />}
              {visibleCols.date && <col style={{ width: `${colWidths.date || 125}px` }} />}
              {visibleCols.value && <col style={{ width: `${colWidths.value || 95}px` }} />}
              {visibleCols.status && <col style={{ width: `${colWidths.status || 95}px` }} />}
              {visibleCols.timeline && <col style={{ width: `${colWidths.timeline || 95}px` }} />}
              {visibleCols.renewed && <col style={{ width: `${colWidths.renewed || 145}px` }} />}
              {visibleCols.invoice && <col style={{ width: `${colWidths.invoice || 80}px` }} />}
              {visibleCols.payment && <col style={{ width: `${colWidths.payment || 80}px` }} />}
              {visibleCols.actions && <col style={{ width: `${colWidths.actions || 80}px` }} />}
              {isAdmin && visibleCols.approvals && <col style={{ width: `${colWidths.approvals || 90}px` }} />}
              {visibleCols.bal && <col style={{ width: `${colWidths.bal || 110}px` }} />}
            </colgroup>
            <thead className="sticky top-0 z-20 backdrop-blur-md bg-slate-100/95 dark:bg-slate-950/95 text-slate-700 dark:text-slate-300 font-semibold border-b border-black/10 dark:border-white/10 shadow-sm">
              <tr>
                <th className="w-8 px-1 py-1.5 text-center sticky top-0 z-20 bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-md">
                  <input 
                    type="checkbox"
                    checked={renewals.length > 0 && selectedIds.length === renewals.length}
                    ref={el => {
                      if (el) {
                        el.indeterminate = selectedIds.length > 0 && selectedIds.length < renewals.length;
                      }
                    }}
                    onChange={() => {
                      if (selectedIds.length === renewals.length) {
                        setSelectedIds([]);
                      } else {
                        setSelectedIds(renewals.map(r => r.id));
                      }
                    }}
                    className="rounded border-surface-300 text-brand-600 focus:ring-brand-500 cursor-pointer w-3.5 h-3.5"
                  />
                </th>

                {/* Unique ID */}
                {visibleCols.id && (
                  <th 
                    style={{ width: `${colWidths.id || 95}px`, minWidth: `${colWidths.id || 95}px` }} 
                    className={`relative px-2 ${isCompact ? 'py-1' : 'py-2'} font-semibold border-r border-surface-200/50 dark:border-surface-700/50 group select-none`}
                  >
                    <div className="flex items-center gap-1 h-5">
                      <button onClick={() => handleSort('unique_id')} className="flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400 font-semibold text-[11px] whitespace-nowrap">
                        <span>Unique ID</span>
                        {sortCol === 'unique_id' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-600" /> : <ArrowDown className="w-3 h-3 text-brand-600" />) : null}
                      </button>
                    </div>
                    <div onMouseDown={(e) => handleResizeMouseDown('id', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-500/80 z-30" />
                  </th>
                )}

                {/* Client Info */}
                {visibleCols.client && (
                  <th 
                    style={{ width: `${colWidths.client || 240}px`, minWidth: `${colWidths.client || 200}px` }} 
                    className={`relative px-2 ${isCompact ? 'py-1' : 'py-2'} font-semibold border-r border-surface-200/50 dark:border-surface-700/50 group select-none`}
                  >
                    <div className="flex items-center gap-1 h-5">
                      <button onClick={() => handleSort('client_name')} className="flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400 font-semibold text-[11px] whitespace-nowrap">
                        <span>Client Info</span>
                        {sortCol === 'client_name' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-600" /> : <ArrowDown className="w-3 h-3 text-brand-600" />) : null}
                      </button>
                      <ClientFilterDropdown 
                        value={clientFilter} 
                        onChange={setClientFilter} 
                        clientList={clientList}
                        isOpen={openFilterCol === 'client'} 
                        onToggle={(e) => toggleFilter('client', e)} 
                        filterPos={filterPos} 
                        filterRef={filterRef} 
                        onClose={() => setOpenFilterCol(null)} 
                        setPage={setPage} 
                      />
                    </div>
                    <div onMouseDown={(e) => handleResizeMouseDown('client', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-500/80 z-30" />
                  </th>
                )}

                {/* Service */}
                {visibleCols.service && (
                  <th 
                    style={{ width: `${colWidths.service || 120}px`, minWidth: `${colWidths.service || 120}px` }} 
                    className={`relative px-2 ${isCompact ? 'py-1' : 'py-2'} font-semibold border-r border-surface-200/50 dark:border-surface-700/50 group select-none`}
                  >
                    <div className="flex items-center gap-1 h-5">
                      <button onClick={() => handleSort('service')} className="flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400 font-semibold text-[11px] whitespace-nowrap">
                        <span>Service</span>
                        {sortCol === 'service' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-600" /> : <ArrowDown className="w-3 h-3 text-brand-600" />) : null}
                      </button>
                      <FilterDropdown 
                        col="service" 
                        value={serviceFilter} 
                        onChange={setServiceFilter} 
                        options={SERVICE_OPTIONS} 
                        isOpen={openFilterCol === 'service'} 
                        onToggle={(e) => toggleFilter('service', e)} 
                        filterPos={filterPos} 
                        filterRef={filterRef} 
                        onClose={() => setOpenFilterCol(null)} 
                        setPage={setPage} 
                        title="Services"
                      />
                    </div>
                    <div onMouseDown={(e) => handleResizeMouseDown('service', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-500/80 z-30" />
                  </th>
                )}

                {/* Quotation Number */}
                {visibleCols.quotation && (
                  <th 
                    style={{ width: `${colWidths.quotation || 130}px`, minWidth: `${colWidths.quotation || 130}px` }} 
                    className={`relative px-2 ${isCompact ? 'py-1' : 'py-2'} font-semibold border-r border-surface-200/50 dark:border-surface-700/50 group select-none`}
                  >
                    <div className="flex items-center gap-1 h-5">
                      <button onClick={() => handleSort('quotation_number')} className="flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400 font-semibold text-[11px] whitespace-nowrap">
                        <span>Quotation No.</span>
                        {sortCol === 'quotation_number' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-600" /> : <ArrowDown className="w-3 h-3 text-brand-600" />) : null}
                      </button>
                    </div>
                    <div onMouseDown={(e) => handleResizeMouseDown('quotation', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-500/80 z-30" />
                  </th>
                )}

                {/* Renewal Date */}
                {visibleCols.date && (
                  <th 
                    style={{ width: `${colWidths.date || 130}px`, minWidth: `${colWidths.date || 130}px` }} 
                    className={`relative px-2 ${isCompact ? 'py-1' : 'py-2'} font-semibold border-r border-surface-200/50 dark:border-surface-700/50 group select-none`}
                  >
                    <div className="flex items-center gap-1 h-5">
                      <button onClick={() => handleSort('renewal_date')} className="flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400 font-semibold text-[11px] whitespace-nowrap">
                        <span>Renewal Date</span>
                        {sortCol === 'renewal_date' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-600" /> : <ArrowDown className="w-3 h-3 text-brand-600" />) : null}
                      </button>
                      <FilterDropdown 
                        col="date" 
                        value={dateRangeFilter} 
                        onChange={setDateRangeFilter} 
                        options={DATE_OPTIONS} 
                        isOpen={openFilterCol === 'date'} 
                        onToggle={(e) => toggleFilter('date', e)} 
                        filterPos={filterPos} 
                        filterRef={filterRef} 
                        onClose={() => setOpenFilterCol(null)} 
                        setPage={setPage} 
                        title="Dates"
                      />
                    </div>
                    <div onMouseDown={(e) => handleResizeMouseDown('date', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-500/80 z-30" />
                  </th>
                )}

                {/* Value */}
                {visibleCols.value && (
                  <th 
                    style={{ width: `${colWidths.value || 100}px`, minWidth: `${colWidths.value || 100}px` }} 
                    className={`relative px-2 ${isCompact ? 'py-1' : 'py-2'} font-semibold border-r border-surface-200/50 dark:border-surface-700/50 group select-none`}
                  >
                    <div className="flex items-center gap-1 h-5">
                      <button onClick={() => handleSort('value')} className="flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400 font-semibold text-[11px] whitespace-nowrap">
                        <span>Value</span>
                        {sortCol === 'value' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-600" /> : <ArrowDown className="w-3 h-3 text-brand-600" />) : null}
                      </button>
                      <FilterDropdown 
                        col="value" 
                        value={valueFilter} 
                        onChange={setValueFilter} 
                        options={VALUE_OPTIONS} 
                        isOpen={openFilterCol === 'value'} 
                        onToggle={(e) => toggleFilter('value', e)} 
                        filterPos={filterPos} 
                        filterRef={filterRef} 
                        onClose={() => setOpenFilterCol(null)} 
                        setPage={setPage} 
                        title="Values"
                      />
                    </div>
                    <div onMouseDown={(e) => handleResizeMouseDown('value', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-500/80 z-30" />
                  </th>
                )}

                {/* Status */}
                {visibleCols.status && (
                  <th 
                    style={{ width: `${colWidths.status || 100}px`, minWidth: `${colWidths.status || 100}px` }} 
                    className={`relative px-2 ${isCompact ? 'py-1' : 'py-2'} font-semibold text-center border-r border-surface-200/50 dark:border-surface-700/50 group select-none`}
                  >
                    <div className="flex items-center justify-center gap-1 h-5">
                      <button onClick={() => handleSort('status')} className="flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400 font-semibold text-[11px] whitespace-nowrap">
                        <span>Status</span>
                        {sortCol === 'status' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-600" /> : <ArrowDown className="w-3 h-3 text-brand-600" />) : null}
                      </button>
                      <FilterDropdown 
                        col="status" 
                        value={statusColFilter} 
                        onChange={setStatusColFilter} 
                        options={STATUS_COL_OPTIONS} 
                        isOpen={openFilterCol === 'status'} 
                        onToggle={(e) => toggleFilter('status', e)} 
                        filterPos={filterPos} 
                        filterRef={filterRef} 
                        onClose={() => setOpenFilterCol(null)} 
                        setPage={setPage} 
                        title="Statuses"
                      />
                    </div>
                    <div onMouseDown={(e) => handleResizeMouseDown('status', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-500/80 z-30" />
                  </th>
                )}

                {/* Timeline */}
                {visibleCols.timeline && (
                  <th 
                    style={{ width: `${colWidths.timeline || 100}px`, minWidth: `${colWidths.timeline || 100}px` }} 
                    className={`relative px-2 ${isCompact ? 'py-1' : 'py-2'} font-semibold text-center border-r border-surface-200/50 dark:border-surface-700/50 select-none`}
                  >
                    <div className="flex items-center justify-center h-5 whitespace-nowrap">Timeline</div>
                    <div onMouseDown={(e) => handleResizeMouseDown('timeline', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-500/80 z-30" />
                  </th>
                )}

                {/* Confirmation / Renewed */}
                {visibleCols.renewed && (
                  <th 
                    style={{ width: `${colWidths.renewed || 155}px`, minWidth: `${colWidths.renewed || 155}px` }} 
                    className={`relative px-2 ${isCompact ? 'py-1' : 'py-2'} font-semibold text-center border-r border-surface-200/50 dark:border-surface-700/50 group select-none`}
                  >
                    <div className="flex items-center justify-center gap-1 h-5">
                      <button onClick={() => handleSort('renewal_confirmation')} className="flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400 font-semibold text-[11px] whitespace-nowrap">
                        <span>Confirmation</span>
                        {sortCol === 'renewal_confirmation' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-600" /> : <ArrowDown className="w-3 h-3 text-brand-600" />) : null}
                      </button>
                      <FilterDropdown 
                        col="renewed" 
                        value={renewedFilter} 
                        onChange={setRenewedFilter} 
                        options={RENEWED_OPTIONS} 
                        isOpen={openFilterCol === 'renewed'} 
                        onToggle={(e) => toggleFilter('renewed', e)} 
                        filterPos={filterPos} 
                        filterRef={filterRef} 
                        onClose={() => setOpenFilterCol(null)} 
                        setPage={setPage} 
                        title="Confirmations"
                      />
                    </div>
                    <div onMouseDown={(e) => handleResizeMouseDown('renewed', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-500/80 z-30" />
                  </th>
                )}

                {/* Invoice */}
                {visibleCols.invoice && (
                  <th 
                    style={{ width: `${colWidths.invoice || 95}px`, minWidth: `${colWidths.invoice || 95}px` }} 
                    className={`relative px-2 ${isCompact ? 'py-1' : 'py-2'} font-semibold text-center border-r border-surface-200/50 dark:border-surface-700/50 group select-none`}
                  >
                    <div className="flex items-center justify-center gap-1 h-5">
                      <button onClick={() => handleSort('invoice_status')} className="flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400 font-semibold text-[11px] whitespace-nowrap">
                        <span>Invoice</span>
                        {sortCol === 'invoice_status' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-600" /> : <ArrowDown className="w-3 h-3 text-brand-600" />) : null}
                      </button>
                      <FilterDropdown 
                        col="invoice" 
                        value={invoiceFilter} 
                        onChange={setInvoiceFilter} 
                        options={INVOICE_OPTIONS} 
                        isOpen={openFilterCol === 'invoice'} 
                        onToggle={(e) => toggleFilter('invoice', e)} 
                        filterPos={filterPos} 
                        filterRef={filterRef} 
                        onClose={() => setOpenFilterCol(null)} 
                        setPage={setPage} 
                        title="Invoices"
                      />
                    </div>
                    <div onMouseDown={(e) => handleResizeMouseDown('invoice', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-500/80 z-30" />
                  </th>
                )}

                {/* Payment */}
                {visibleCols.payment && (
                  <th 
                    style={{ width: `${colWidths.payment || 95}px`, minWidth: `${colWidths.payment || 95}px` }} 
                    className={`relative px-2 ${isCompact ? 'py-1' : 'py-2'} font-semibold text-center border-r border-surface-200/50 dark:border-surface-700/50 group select-none`}
                  >
                    <div className="flex items-center justify-center gap-1 h-5">
                      <button onClick={() => handleSort('payment_status')} className="flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400 font-semibold text-[11px] whitespace-nowrap">
                        <span>Payment</span>
                        {sortCol === 'payment_status' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-600" /> : <ArrowDown className="w-3 h-3 text-brand-600" />) : null}
                      </button>
                      <FilterDropdown 
                        col="payment" 
                        value={paymentFilter} 
                        onChange={setPaymentFilter} 
                        options={PAYMENT_OPTIONS} 
                        isOpen={openFilterCol === 'payment'} 
                        onToggle={(e) => toggleFilter('payment', e)} 
                        filterPos={filterPos} 
                        filterRef={filterRef} 
                        onClose={() => setOpenFilterCol(null)} 
                        setPage={setPage} 
                        title="Payments"
                      />
                    </div>
                    <div onMouseDown={(e) => handleResizeMouseDown('payment', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-500/80 z-30" />
                  </th>
                )}

                {/* Actions */}
                {visibleCols.actions && (
                  <th 
                    style={{ width: `${colWidths.actions || 85}px`, minWidth: `${colWidths.actions || 85}px` }} 
                    className={`relative px-2 ${isCompact ? 'py-1' : 'py-2'} font-semibold text-center border-r border-surface-200/50 dark:border-surface-700/50 select-none`}
                  >
                    <div className="flex items-center justify-center h-5 whitespace-nowrap">Actions</div>
                    <div onMouseDown={(e) => handleResizeMouseDown('actions', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-500/80 z-30" />
                  </th>
                )}

                {/* Approvals (Admin) */}
                {isAdmin && visibleCols.approvals && (
                  <th 
                    style={{ width: `${colWidths.approvals || 95}px`, minWidth: `${colWidths.approvals || 95}px` }} 
                    className={`relative px-2 ${isCompact ? 'py-1' : 'py-2'} font-semibold text-center border-r border-surface-200/50 dark:border-surface-700/50 select-none`}
                  >
                    <div className="flex items-center justify-center h-5 whitespace-nowrap">Approvals</div>
                    <div onMouseDown={(e) => handleResizeMouseDown('approvals', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-500/80 z-30" />
                  </th>
                )}

                {/* Invoice / Bal */}
                {visibleCols.bal && (
                  <th 
                    style={{ width: `${colWidths.bal || 115}px`, minWidth: `${colWidths.bal || 115}px` }} 
                    className={`relative px-2 ${isCompact ? 'py-1' : 'py-2'} font-semibold text-right select-none`}
                  >
                    <div className="flex items-center justify-end h-5 whitespace-nowrap">Invoice / Bal</div>
                    <div onMouseDown={(e) => handleResizeMouseDown('bal', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-500/80 z-30" />
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {loading ? (
                <tr>
                  <td colSpan={totalCols} className="px-6 py-12 text-center text-surface-500">
                    <div className="flex justify-center mb-2"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div></div>
                    Loading records...
                  </td>
                </tr>
              ) : sortedRenewals.length === 0 ? (
                <tr>
                  <td colSpan={totalCols} className="px-6 py-12 text-center text-surface-500">
                    <EmptyState
                      icon={Search}
                      title="No renewal records found"
                      description="No renewals match your current filter and search criteria. Try adjusting or clearing your filters."
                      actionText="Reset Filters"
                      onAction={clearAllFilters}
                    />
                  </td>
                </tr>
              ) : (
                sortedRenewals.map((row) => (
                  <RenewalTableRow
                    key={row.id}
                    row={row}
                    visibleCols={visibleCols}
                    isCompact={isCompact}
                    isSelected={selectedIds.includes(row.id)}
                    isAdmin={isAdmin}
                    isSales={isSales}
                    onToggleSelect={handleToggleSelectRow}
                    onNavigate={handleNavigateToRenewal}
                    onToggleStopEmail={handleToggleStopEmail}
                    onRenewalConfirmationChange={handleRenewalConfirmation}
                    onInvoiceStatusChange={handleInvoiceStatus}
                    onPaymentStatusChange={handlePaymentStatus}
                    onEdit={handleEditRow}
                    onDelete={handleDelete}
                    onApproveEdit={handleApproveEdit}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Table Footer */}
        <div className="px-6 py-4 border-t border-surface-200 dark:border-surface-700 flex items-center justify-between bg-white dark:bg-surface-800">
          <div className="text-sm text-surface-500 dark:text-surface-400">
            Showing all <span className="font-bold text-surface-900 dark:text-white">{renewals.length}</span> renewals
          </div>
          <div className="text-xs text-surface-400 dark:text-surface-500 font-medium">
            Full List • Scroll to view all records
          </div>
        </div>
      </div>

      {isFormOpen && (
        <RenewalForm 
          onClose={() => { setIsFormOpen(false); setSelectedRenewalToEdit(null); }} 
          onSuccess={() => { setIsFormOpen(false); setSelectedRenewalToEdit(null); fetchRenewals(); }} 
          editData={selectedRenewalToEdit}
        />
      )}

      {isRenewModalOpen && selectedRenewal && (
        <RenewActionModal 
          renewal={selectedRenewal}
          onClose={() => { setIsRenewModalOpen(false); setSelectedRenewal(null); }}
          onSuccess={() => { setIsRenewModalOpen(false); setSelectedRenewal(null); fetchRenewals(); }}
        />
      )}


      <InvoiceDetailsModal
        isOpen={isInvoiceModalOpen}
        renewal={selectedInvoiceRenewal}
        onClose={() => { setIsInvoiceModalOpen(false); setSelectedInvoiceRenewal(null); }}
        onSuccess={() => { setIsInvoiceModalOpen(false); setSelectedInvoiceRenewal(null); fetchRenewals(); }}
      />

      {isPaymentModalOpen && selectedPaymentRenewal && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-surface-200 dark:border-surface-700 flex flex-col">
            <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center bg-surface-50 dark:bg-surface-900/50">
              <h2 className="text-lg font-bold text-surface-900 dark:text-white">
                Enter Payment Details
              </h2>
              <button 
                onClick={() => { setIsPaymentModalOpen(false); setSelectedPaymentRenewal(null); fetchRenewals(); }}
                className="p-1 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 flex-1">
              <div>
                <label className="block text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-1">
                  Client Name
                </label>
                <div className="text-sm font-medium text-surface-900 dark:text-white">
                  {selectedPaymentRenewal.client_name}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-1">
                  Service
                </label>
                <div className="text-sm font-medium text-surface-950 dark:text-surface-100">
                  {selectedPaymentRenewal.service}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-1">
                  Payment Received Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="number"
                  placeholder="e.g. 15000"
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-transparent text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-1">
                  Payment Received Date <span className="text-red-500">*</span>
                </label>
                <IndianDateInput 
                  value={paymentDateInput}
                  onChange={(e) => setPaymentDateInput(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-transparent text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-sm"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-surface-50 dark:bg-surface-900/50 border-t border-surface-200 dark:border-surface-700 flex justify-end gap-3">
              <button 
                onClick={() => { setIsPaymentModalOpen(false); setSelectedPaymentRenewal(null); fetchRenewals(); }}
                className="px-4 py-2 text-sm font-semibold text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors border border-surface-300 dark:border-surface-700"
              >
                Cancel
              </button>
              <button 
                onClick={submitPaymentDetails}
                className="px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 rounded-lg transition-all shadow-md shadow-brand-500/10 flex items-center gap-1.5"
              >
                Save Details
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showRenewConfirmationModal && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-surface-200 dark:border-surface-700 flex flex-col">
            
            <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center bg-surface-50 dark:bg-surface-900/50">
              <div>
                <h2 className="text-lg font-bold text-surface-900 dark:text-white">
                  Confirm Renewal
                </h2>
                <p className="text-xs text-surface-500 mt-1">Select a new renewal date for the contract cycle.</p>
              </div>
              <button 
                onClick={() => { setShowRenewConfirmationModal(false); setConfirmRenewalId(null); }} 
                className="p-2 text-surface-400 hover:text-surface-600 rounded-full hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-2">
                  new renewal date
                </label>
                <GlassDatePicker 
                  placeholder="DD/MM/YYYY" 
                  required 
                  value={newRenewalDate} 
                  outputFormat="DD/MM/YYYY"
                  onChange={(e, val) => setNewRenewalDate(val !== undefined ? val : e.target.value)} 
                  className="w-full" 
                />
              </div>
              
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900 p-4 rounded-lg">
                <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  Selecting a new renewal date will automatically update the record, reset email flags, and start the next automated reminder cycle.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => { setShowRenewConfirmationModal(false); setConfirmRenewalId(null); }} 
                className="px-4 py-2 border border-surface-300 dark:border-surface-700 rounded-lg text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={submitRenewedConfirmation}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Confirm Renewal
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {showDeleteModal && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-surface-200 dark:border-surface-700 flex flex-col">
            
            <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center bg-surface-50 dark:bg-surface-900/50">
              <div>
                <h2 className="text-lg font-bold text-surface-900 dark:text-white">
                  Move to Trash
                </h2>
                <p className="text-xs text-surface-500 mt-1">Confirm deletion of this renewal.</p>
              </div>
              <button 
                onClick={() => { setShowDeleteModal(false); setDeleteId(null); }} 
                className="p-2 text-surface-400 hover:text-surface-600 rounded-full hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-surface-700 dark:text-surface-300 font-medium">
                    Are you sure you want to delete this renewal?
                  </p>
                  <p className="text-xs text-surface-500 mt-1 leading-relaxed">
                    The deleted record will be moved to the Trash bin. You can restore it later or delete it permanently from there.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => { setShowDeleteModal(false); setDeleteId(null); }} 
                className="px-4 py-2 border border-surface-300 dark:border-surface-700 rounded-lg text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={() => {
                  submitDelete(deleteId);
                  setShowDeleteModal(false);
                  setDeleteId(null);
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showBatchDeleteModal && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-surface-200 dark:border-surface-700 flex flex-col">
            
            <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center bg-surface-50 dark:bg-surface-900/50">
              <div>
                <h2 className="text-lg font-bold text-surface-900 dark:text-white">
                  Confirm Batch Delete
                </h2>
                <p className="text-xs text-surface-500 mt-1">Move selected renewals to trash.</p>
              </div>
              <button 
                onClick={() => setShowBatchDeleteModal(false)} 
                className="p-2 text-surface-400 hover:text-surface-600 rounded-full hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-surface-700 dark:text-surface-300 font-medium">
                    Are you sure you want to delete {selectedIds.length} selected renewals?
                  </p>
                  <p className="text-xs text-surface-500 mt-1 leading-relaxed">
                    The selected records will be moved to the Trash bin. You can restore them later or delete them permanently from there.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setShowBatchDeleteModal(false)} 
                className="px-4 py-2 border border-surface-300 dark:border-surface-700 rounded-lg text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleExecuteBulkDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Yes, Delete All Selected
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showBulkStatusModal && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-surface-200 dark:border-surface-700 flex flex-col">
            <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center bg-surface-50 dark:bg-surface-900/50">
              <div>
                <h2 className="text-lg font-bold text-surface-900 dark:text-white flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-brand-600" /> Bulk Status Update
                </h2>
                <p className="text-xs text-surface-500 mt-0.5">Updating {selectedIds.length} selected renewal(s)</p>
              </div>
              <button onClick={() => setShowBulkStatusModal(false)} className="p-2 text-surface-400 hover:text-surface-600 rounded-full hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1">Renewal Status</label>
                <GlassSelect 
                  value={bulkStatusValue} 
                  onChange={(e, val) => setBulkStatusValue(val !== undefined ? val : e.target.value)}
                  placeholder="-- No Change --"
                  options={[
                    { value: '', label: '-- No Change --' },
                    { value: 'Active', label: 'Active' },
                    { value: 'Pending Renewal', label: 'Pending Renewal' },
                    { value: 'Renewed', label: 'Renewed' },
                    { value: 'Expired', label: 'Expired' },
                  ]}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1">Renewal Confirmation</label>
                <GlassSelect 
                  value={bulkConfirmationValue} 
                  onChange={(e, val) => setBulkConfirmationValue(val !== undefined ? val : e.target.value)}
                  placeholder="-- No Change --"
                  options={[
                    { value: '', label: '-- No Change --' },
                    { value: 'pending', label: 'Pending' },
                    { value: 'reminder_sent', label: 'Reminder Sent' },
                    { value: 'quote_sent', label: 'Quote Sent' },
                    { value: 'awaiting_client_approval', label: 'Awaiting Client Approval' },
                    { value: 'renewed', label: 'Renewed' },
                    { value: 'lost', label: 'Lost' },
                    { value: 'cancelled', label: 'Cancelled' },
                  ]}
                  className="w-full"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setShowBulkStatusModal(false)} 
                className="px-4 py-2 border border-surface-300 dark:border-surface-700 rounded-lg text-xs font-semibold text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleExecuteBulkStatus}
                disabled={!bulkStatusValue && !bulkConfirmationValue}
                className="btn-primary px-4 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                Apply Bulk Update
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
