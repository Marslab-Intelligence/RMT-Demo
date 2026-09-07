import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Lock, Save, Edit3, Calendar } from 'lucide-react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import GlassSelect from './GlassSelect';
import GlassDatePicker from './GlassDatePicker';

const PREDEFINED_SERVICES = [
  "AWS",
  "AMC",
  "BDR Suite",
  "Domain",
  "Firewall",
  "GWS",
  "LSH",
  "M365",
  "Plesk",
  "Seqrite",
  "Storage",
  "SSL",
  "Tally",
  "Untangle",
  "Zoho"
];

const SUB_SERVICES = {};

export default function RenewalForm({ onClose, onSuccess, editData = null }) {
  const { token, user } = useAuth();
  const isAdmin = (user?.role === 'super_admin' || user?.role === 'dept_admin');
  const [loading, setLoading] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const datePickerRef = useRef(null);

  const handleNativeDateSelect = (e) => {
    const val = e.target.value;
    if (!val) return;
    const [year, month, day] = val.split('-');
    setFormData({ ...formData, renewal_date: `${day}/${month}/${year}` });
  };

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return '';
    }
  };

  const parseServiceValue = (serviceStr) => {
    if (!serviceStr) return { main: "", subs: [] };
    const match = serviceStr.match(/^([^(]+)\(([^)]+)\)$/);
    if (match) {
      const main = match[1].trim();
      const subs = match[2].split(',').map(s => s.trim());
      return { main, subs };
    }
    return { main: serviceStr.trim(), subs: [] };
  };

  const initialService = parseServiceValue(editData?.service || '');
  const [selectedMainService, setSelectedMainService] = useState(initialService.main);
  const [selectedSubServices, setSelectedSubServices] = useState(initialService.subs);


  const [formData, setFormData] = useState({
    client_name: editData?.client_name || '',
    service: editData?.service || '',
    renewal_date: editData?.renewal_date ? formatDateForInput(editData.renewal_date) : '',
    value: editData?.value || '',
    owner: editData?.owner || '',
    client_email: editData?.client_email || '',
    sales_email: editData?.sales_email || '',
    contact_number: editData?.contact_number || '',
    reference_id: editData?.reference_id || '',
    invoice_number: editData?.invoice_number || '',
    quotation_number: editData?.quotation_number || '',
    status: editData?.status || 'Active',
    plan_period: editData?.plan_period || 'yearly_plan',
    plan_duration: editData?.plan_duration || 1,
    expiry_reason: editData?.expiry_reason || '',
    product: editData?.product || '',
    description: editData?.description || '',
    quantity: editData?.quantity !== undefined ? editData.quantity : 1,
    purchase_cost: editData?.purchase_cost !== undefined ? editData.purchase_cost : '',
    total_purchase_cost: editData?.total_purchase_cost !== undefined ? editData.total_purchase_cost : '',
    sales_cost: editData?.sales_cost !== undefined ? editData.sales_cost : '',
    total_sales_cost: editData?.total_sales_cost !== undefined ? editData.total_sales_cost : '',
    profit: editData?.profit !== undefined ? editData.profit : '',
    vendor: editData?.vendor || '',
    entity: editData?.entity || '',
    reason: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    const qty = parseInt(formData.quantity) || 0;
    const pCost = parseFloat(formData.purchase_cost) || 0;
    const sCost = parseFloat(formData.sales_cost) || 0;
    
    const totalP = qty * pCost;
    const totalS = qty * sCost;
    const prof = totalS - totalP;
    
    setFormData(prev => ({
      ...prev,
      total_purchase_cost: totalP,
      total_sales_cost: totalS,
      profit: prof
    }));
  }, [formData.quantity, formData.purchase_cost, formData.sales_cost]);

  useEffect(() => {
    const combined = selectedSubServices.length > 0
      ? `${selectedMainService} (${selectedSubServices.join(', ')})`
      : selectedMainService;
    setFormData(prev => ({ ...prev, service: combined }));
  }, [selectedMainService, selectedSubServices]);

  // Auto-fetch vendor-product specific sales cost when vendor and product are provided
  useEffect(() => {
    if (!formData.vendor || !formData.product || !token) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pricing?search=${encodeURIComponent(formData.product)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const items = await res.json();
          const match = items.find(item => 
            item.vendor.toLowerCase().trim() === formData.vendor.toLowerCase().trim() &&
            item.product_name.toLowerCase().trim() === formData.product.toLowerCase().trim()
          );
          if (match) {
            setFormData(prev => ({
              ...prev,
              sales_cost: prev.sales_cost !== '' ? prev.sales_cost : (match.erp_price || match.sales_cost || ''),
              purchase_cost: prev.purchase_cost !== '' ? prev.purchase_cost : (match.sales_cost || '')
            }));
          }
        }
      } catch (err) {
        // ignore fetch errors
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [formData.vendor, formData.product, token]);

  const handleMainServiceChange = (e) => {
    const main = e.target.value;
    setSelectedMainService(main);
    setSelectedSubServices([]);
  };

  const handleSubServiceToggle = (sub) => {
    setSelectedSubServices(prev => {
      if (prev.includes(sub)) {
        return prev.filter(s => s !== sub);
      } else {
        return [...prev, sub];
      }
    });
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!acknowledged) {
      toast.error('Please acknowledge that the information is correct.');
      return;
    }
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

      const url = editData ? `/api/renewals/${editData.id}` : '/api/renewals';
      const method = editData ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submissionData)
      });
      
      if (res.ok) {
        toast.success(editData ? 'Record updated successfully.' : 'Renewal record created and locked.');
        onSuccess();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save record');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };



  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 dark:bg-[#080611]/80 backdrop-blur-md animate-fade-in">
      <div className="modal-glass w-full max-w-2xl overflow-hidden rounded-2xl flex flex-col max-h-[90vh]">
        
        <div className="modal-header-glass px-6 py-4 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {editData ? 'Edit Renewal Record' : 'Add New Renewal'}
            </h2>
            {(!editData && !isAdmin) && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-500" /> Record will be locked upon creation
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form id="renewal-form" onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="label">Invoice Number <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  name="invoice_number" 
                  required 
                  value={formData.invoice_number} 
                  onChange={handleChange} 
                  className="input-field" 
                  placeholder="Enter invoice number..."
                />
              </div>
              <div>
                <label className="label">Client Name <span className="text-red-500">*</span></label>
                <input type="text" name="client_name" required value={formData.client_name} onChange={handleChange} className="input-field" />
              </div>
              <div>
                <label className="label">Service Name <span className="text-red-500">*</span></label>
                <GlassSelect 
                  required
                  value={selectedMainService} 
                  placeholder="Select Service"
                  options={[
                    ...PREDEFINED_SERVICES.map(serviceName => ({ value: serviceName, label: serviceName })),
                    ...(selectedMainService && !PREDEFINED_SERVICES.includes(selectedMainService) ? [{ value: selectedMainService, label: selectedMainService }] : [])
                  ]}
                  onChange={handleMainServiceChange} 
                  className="w-full"
                />

                {SUB_SERVICES[selectedMainService] && (
                  <div className="mt-2.5 p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.04] space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Select Sub-Services:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {SUB_SERVICES[selectedMainService].map(sub => (
                        <label 
                          key={sub} 
                          className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                        >
                          <input 
                            type="checkbox" 
                            checked={selectedSubServices.includes(sub)}
                            onChange={() => handleSubServiceToggle(sub)}
                            className="rounded border-slate-300 dark:border-white/20 text-brand-600 focus:ring-brand-500/40 dark:bg-white/10"
                          />
                          <span>{sub}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="label">Quotation Number</label>
                <input 
                  type="text" 
                  name="quotation_number" 
                  value={formData.quotation_number} 
                  onChange={handleChange} 
                  className="input-field" 
                  placeholder="Enter quotation number..."
                />
              </div>
              
              <div>
                <label className="label">Renewal Date {formData.status !== '-' && <span className="text-red-500">*</span>}</label>
                <GlassDatePicker 
                  name="renewal_date" 
                  placeholder="DD/MM/YYYY" 
                  required={formData.status !== '-'} 
                  value={formData.renewal_date} 
                  outputFormat="DD/MM/YYYY"
                  onChange={(e, val) => setFormData({ ...formData, renewal_date: val !== undefined ? val : e.target.value })} 
                  className="w-full" 
                />
              </div>
              <div>
                <label className="label">Contract Value (₹) {formData.status !== '-' && <span className="text-red-500">*</span>}</label>
                <input type="number" name="value" required={formData.status !== '-'} min="0" value={formData.value} onChange={handleChange} className="input-field" />
              </div>

              <div>
                <label className="label">Client Email <span className="text-red-500">*</span></label>
                <input type="email" name="client_email" required value={formData.client_email} onChange={handleChange} className="input-field" />
              </div>
              <div>
                <label className="label">Client secondary mail</label>
                <input 
                  type="email" 
                  name="sales_email" 
                  value={formData.sales_email} 
                  onChange={handleChange} 
                  className="input-field" 
                  placeholder="Secondary email address"
                />
              </div>

              <div>
                <label className="label">Contact person <span className="text-red-500">*</span></label>
                <input type="text" name="owner" required value={formData.owner} onChange={handleChange} className="input-field" />
              </div>
              <div>
                <label className="label">Contact number <span className="text-red-500">*</span></label>
                <input type="text" name="contact_number" required value={formData.contact_number} onChange={handleChange} className="input-field" />
              </div>

              <div>
                <label className="label">Reference ID (invoice NO)</label>
                <input type="text" name="reference_id" value={formData.reference_id} onChange={handleChange} className="input-field" />
              </div>
              <div>
                <label className="label">Initial Status</label>
                <GlassSelect 
                  name="status" 
                  value={formData.status} 
                  onChange={handleChange} 
                  options={[
                    { value: 'Active', label: 'Active' },
                    { value: 'Pending Renewal', label: 'Pending Renewal' },
                    ...(formData.status === 'Expired' ? [{ value: 'Expired', label: 'Expired' }] : []),
                  ]}
                  className="w-full"
                />
              </div>
              <div>
                <label className="label">Plan Period</label>
                <GlassSelect 
                  name="plan_period" 
                  value={formData.plan_period} 
                  onChange={handleChange} 
                  options={[
                    { value: 'monthly_plan', label: 'Monthly plan' },
                    { value: 'quarterly_plan', label: 'Quarterly plan' },
                    { value: 'halfly_plan', label: 'Halfly plan' },
                    { value: 'yearly_plan', label: 'Yearly plan' },
                  ]}
                  className="w-full"
                />
              </div>
              {formData.plan_period === 'yearly_plan' && (
                <div>
                  <label className="label">Plan Duration (Years) <span className="text-red-500">*</span></label>
                  <input 
                    type="number" 
                    name="plan_duration" 
                    required 
                    min="1" 
                    value={formData.plan_duration} 
                    onChange={handleChange} 
                    className="input-field" 
                  />
                </div>
              )}

              <div className="md:col-span-2 border-t border-slate-200/80 dark:border-white/10 pt-5 mt-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Product & Financial Details
                </h3>
              </div>

              <div>
                <label className="label">Product</label>
                <input 
                  type="text" 
                  name="product" 
                  value={formData.product} 
                  onChange={handleChange} 
                  className="input-field" 
                  placeholder="Enter product..."
                />
              </div>

              <div>
                <label className="label">Vendor</label>
                <input 
                  type="text" 
                  name="vendor" 
                  value={formData.vendor} 
                  onChange={handleChange} 
                  className="input-field" 
                  placeholder="Enter vendor..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Description</label>
                <textarea 
                  name="description" 
                  rows="2"
                  value={formData.description} 
                  onChange={handleChange} 
                  className="input-field" 
                  placeholder="Enter description..."
                />
              </div>

              <div>
                <label className="label">Entity</label>
                <GlassSelect
                  name="entity"
                  value={formData.entity}
                  placeholder="Select entity..."
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'Select entity...' },
                    { value: 'MIPL', label: 'MIPL' },
                    { value: 'SIDCORPTECH', label: 'SIDCORPTECH' },
                    { value: 'SPIOT', label: 'SPIOT' },
                  ]}
                  className="w-full"
                />
              </div>

              <div>
                <label className="label">Quantity</label>
                <input 
                  type="number" 
                  name="quantity" 
                  min="1"
                  value={formData.quantity} 
                  onChange={handleChange} 
                  className="input-field" 
                />
              </div>

              <div>
                <label className="label">Purchase Cost (₹)</label>
                <input 
                  type="number" 
                  name="purchase_cost" 
                  min="0"
                  step="any"
                  value={formData.purchase_cost} 
                  onChange={handleChange} 
                  className="input-field" 
                />
              </div>

              <div>
                <label className="label">Total Purchase Cost (₹)</label>
                <input 
                  type="number" 
                  name="total_purchase_cost" 
                  readOnly
                  disabled
                  value={formData.total_purchase_cost} 
                  className="input-field bg-black/[0.03] dark:bg-black/30 dark:border-white/5 text-slate-500 dark:text-slate-400 cursor-not-allowed" 
                />
              </div>

              <div>
                <label className="label">Sales Cost (₹)</label>
                <input 
                  type="number" 
                  name="sales_cost" 
                  min="0"
                  step="any"
                  value={formData.sales_cost} 
                  onChange={handleChange} 
                  className="input-field" 
                />
              </div>

              <div>
                <label className="label">Total Sales Cost (₹)</label>
                <input 
                  type="number" 
                  name="total_sales_cost" 
                  readOnly
                  disabled
                  value={formData.total_sales_cost} 
                  className="input-field bg-black/[0.03] dark:bg-black/30 dark:border-white/5 text-slate-500 dark:text-slate-400 cursor-not-allowed" 
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Profit (₹)</label>
                <input 
                  type="number" 
                  name="profit" 
                  readOnly
                  disabled
                  value={formData.profit} 
                  className={`input-field bg-black/[0.03] dark:bg-black/30 dark:border-white/5 cursor-not-allowed font-semibold ${formData.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} 
                />
              </div>
            </div>

            {formData.status === 'Expired' && (
              <div>
                <label className="label">Expiry Reason <span className="text-rose-500">*</span></label>
                <textarea 
                  required
                  rows="2"
                  className="input-field"
                  placeholder="Describe why this renewal expired..."
                  name="expiry_reason"
                  value={formData.expiry_reason}
                  onChange={handleChange}
                ></textarea>
              </div>
            )}
            
            {editData && (
              <div>
                <label className="label">Reason for Update <span className="text-rose-500">*</span></label>
                <textarea 
                  required
                  rows="2"
                  className="input-field"
                  placeholder="Briefly describe why you are updating this record..."
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                ></textarea>
              </div>
            )}

            {!isAdmin && (
              <div className="bg-brand-500/10 dark:bg-purple-950/25 border border-brand-500/20 dark:border-purple-500/30 p-4 rounded-xl mt-6">
                <h4 className="text-sm font-semibold text-brand-800 dark:text-purple-300 mb-1">Note</h4>
                <p className="text-xs text-brand-600 dark:text-purple-200/80">
                  Once saved, this data cannot be edited directly to ensure data integrity. The system will automatically calculate dates and schedule reminder emails based on the Renewal Date provided.
                </p>
              </div>
            )}
             <div className="flex items-center gap-2.5 mt-4">
              <input 
                type="checkbox" 
                id="acknowledgement" 
                required 
                className="w-4 h-4 rounded text-purple-600 dark:text-purple-500 border-slate-300 dark:border-white/20 focus:ring-purple-500/40 dark:bg-white/10 cursor-pointer"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              <label htmlFor="acknowledgement" className="text-xs text-slate-600 dark:text-slate-300 font-medium select-none cursor-pointer flex items-center">
                I acknowledge that the information provided above is correct and verified. <span className="text-rose-500 ml-1">*</span>
              </label>
            </div>
          </form>
        </div>

        <div className="modal-footer-glass px-6 py-4 flex justify-end gap-3 flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" form="renewal-form" disabled={loading} className="btn-primary flex items-center gap-2">
            {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : (editData ? <Edit3 className="w-4 h-4" /> : <Save className="w-4 h-4" />)}
            {editData ? 'Save Changes' : 'Save & Lock Record'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
