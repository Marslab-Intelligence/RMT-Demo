import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, RefreshCw, AlertTriangle, Calendar } from 'lucide-react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '../utils/formatters';
import GlassSelect from './GlassSelect';
import GlassDatePicker from './GlassDatePicker';

export default function RenewActionModal({ renewal, onClose, onSuccess }) {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const datePickerRef = useRef(null);

  const handleNativeDateSelect = (e) => {
    const val = e.target.value;
    if (!val) return;
    const [year, month, day] = val.split('-');
    setFormData({ ...formData, renewal_date: `${day}/${month}/${year}` });
  };
  const [formData, setFormData] = useState({
    renewal_date: '',
    service: renewal.service,
    value: renewal.value,
    status: 'Active'
  });

  const [followUpData, setFollowUpData] = useState({
    follow_up_status: renewal.follow_up_status || '',
    follow_up_remarks: renewal.follow_up_remarks || ''
  });

  const isFinance = user?.role === 'finance';
  const isSales = user?.role === 'user';

  const handleDateChange = (e) => {
    let val = e.target.value;
    val = val.replace(/[^0-9/]/g, '');
    const oldVal = formData.renewal_date || '';
    if (val.length > oldVal.length) {
      if (val.length === 2) val = val + '/';
      else if (val.length === 5) val = val + '/';
    }
    if (val.length <= 10) {
      setFormData({ ...formData, renewal_date: val });
    }
  };

  const handleFinanceSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Parse renewal_date from DD/MM/YYYY to YYYY-MM-DD
      let submissionData = { ...formData };
      if (submissionData.renewal_date) {
        const parts = submissionData.renewal_date.split('/');
        if (parts.length === 3) {
          const day = parts[0];
          const month = parts[1];
          const year = parts[2];
          const d = parseInt(day, 10);
          const m = parseInt(month, 10);
          const y = parseInt(year, 10);
          if (isNaN(d) || isNaN(m) || isNaN(y) || m < 1 || m > 12 || d < 1 || d > 31 || y < 1000 || y > 9999) {
            toast.error('Please enter a valid date in DD/MM/YYYY format.');
            setLoading(false);
            return;
          }
          submissionData.renewal_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else {
          toast.error('Please enter the date in DD/MM/YYYY format.');
          setLoading(false);
          return;
        }
      }

      const res = await fetch(`/api/renewals/${renewal.id}/renew`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submissionData)
      });
      
      if (res.ok) {
        toast.success('Client successfully renewed. Automations reset.');
        onSuccess();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to renew client');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleSalesSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/renewals/${renewal.id}/follow-up`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(followUpData)
      });
      
      if (res.ok) {
        toast.success('Follow-up status updated');
        onSuccess();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update follow-up');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 dark:bg-[#080611]/80 backdrop-blur-md animate-fade-in">
      <div className="modal-glass w-full max-w-xl overflow-hidden rounded-2xl flex flex-col max-h-[90vh]">
        
        <div className="modal-header-glass px-6 py-4 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isFinance ? 'Process Client Renewal' : 'Update Follow-up Status'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{renewal.client_name} - {renewal.unique_id}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Current Info Summary */}
          <div className="bg-slate-50/70 dark:bg-white/[0.04] rounded-xl p-4 mb-6 border border-slate-200/80 dark:border-white/10">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-surface-500">Current Service</p>
                <p className="font-medium text-surface-900 dark:text-white">{renewal.service}</p>
              </div>
              <div>
                <p className="text-surface-500">Current Value</p>
                <p className="font-medium text-surface-900 dark:text-white">{formatCurrency(renewal.value)}</p>
              </div>
              <div>
                <p className="text-surface-500">Previous Renewal Date</p>
                <p className="font-medium text-surface-900 dark:text-white">{formatDate(renewal.renewal_date)}</p>
              </div>
              <div>
                <p className="text-surface-500">Status</p>
                <p className="font-medium text-surface-900 dark:text-white">{renewal.status}</p>
              </div>
            </div>
          </div>

          {isFinance ? (
            <form id="renew-form" onSubmit={handleFinanceSubmit} className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg flex items-start gap-3 mb-6">
                <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Processing this renewal will reset all email automation flags to "No" and start a new reminder cycle based on the new date. The previous record will be archived in history.
                </p>
              </div>

              <div>
                <label className="label">New Renewal Date <span className="text-red-500">*</span></label>
                <GlassDatePicker 
                  placeholder="DD/MM/YYYY" 
                  required 
                  value={formData.renewal_date} 
                  outputFormat="DD/MM/YYYY"
                  onChange={(e, val) => setFormData({ ...formData, renewal_date: val !== undefined ? val : e.target.value })} 
                  className="w-full" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Updated Service (Optional)</label>
                  <input 
                    type="text" 
                    value={formData.service} 
                    onChange={(e) => setFormData({...formData, service: e.target.value})} 
                    className="input-field" 
                  />
                </div>
                <div>
                  <label className="label">Updated Value (₹)</label>
                  <input 
                    type="number" 
                    value={formData.value} 
                    onChange={(e) => setFormData({...formData, value: e.target.value})} 
                    className="input-field" 
                  />
                </div>
              </div>
              
              <div>
                <label className="label">New Status</label>
                <GlassSelect 
                  value={formData.status} 
                  onChange={(e, val) => setFormData({...formData, status: val !== undefined ? val : e.target.value})} 
                  options={[
                    { value: 'Active', label: 'Active' },
                    { value: 'Renewed', label: 'Renewed' },
                  ]}
                  className="w-full"
                />
              </div>
            </form>
          ) : (
            <form id="sales-form" onSubmit={handleSalesSubmit} className="space-y-4">
              <div>
                <label className="label">Follow-up Status <span className="text-red-500">*</span></label>
                <GlassSelect 
                  required
                  value={followUpData.follow_up_status} 
                  placeholder="Select Status..."
                  onChange={(e, val) => setFollowUpData({...followUpData, follow_up_status: val !== undefined ? val : e.target.value})} 
                  options={[
                    { value: 'Meeting Scheduled', label: 'Meeting Scheduled' },
                    { value: 'Proposal Sent', label: 'Proposal Sent' },
                    { value: 'Negotiation', label: 'Negotiation' },
                    { value: 'Verbal Agreement', label: 'Verbal Agreement' },
                    { value: 'At Risk', label: 'At Risk' },
                    { value: 'Completed', label: 'Completed (Pending Finance)' },
                  ]}
                  className="w-full"
                />
              </div>
              <div>
                <label className="label">Follow-up Remarks</label>
                <textarea 
                  rows="3"
                  value={followUpData.follow_up_remarks} 
                  onChange={(e) => setFollowUpData({...followUpData, follow_up_remarks: e.target.value})} 
                  className="input-field resize-none"
                  placeholder="Add notes about client discussions..."
                ></textarea>
              </div>
            </form>
          )}
        </div>

        <div className="modal-footer-glass px-6 py-4 flex justify-end gap-3 flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button 
            type="submit" 
            form={isFinance ? "renew-form" : "sales-form"} 
            disabled={loading} 
            className="btn-primary flex items-center gap-2"
          >
            {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <RefreshCw className="w-4 h-4" />}
            {isFinance ? 'Complete Renewal Cycle' : 'Save Status'}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
