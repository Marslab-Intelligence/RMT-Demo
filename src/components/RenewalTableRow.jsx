import React, { memo } from 'react';
import { MailCheck, MailX, Edit, Trash2, CheckCircle } from 'lucide-react';
import { formatCurrency, formatDate, getDaysLeftColor } from '../utils/formatters';
import GlassSelect from './GlassSelect';
import StatusBadge from './common/StatusBadge';

// Pure lookup, no closures — moved here from RenewalsList.jsx alongside the
// row markup that was its only caller.
function getRenewalConfirmationBadge(status) {
  switch (status) {
    case 'reminder_sent':
    case 'awaiting_with_vendor':
      return { label: 'Reminder Sent', color: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800' };
    case 'quote_sent':
    case 'quotation_confirmation':
      return { label: 'Quote Sent', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800' };
    case 'awaiting_client_approval':
      return { label: 'Awaiting Client Approval', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' };
    case 'renewed':
      return { label: 'Renewed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' };
    case 'lost':
      return { label: 'Lost', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800' };
    case 'cancelled':
    case 'service_discontinued':
      return { label: 'Cancelled', color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' };
    default:
      return { label: 'Pending', color: 'bg-surface-100 text-surface-500 border-surface-200 dark:bg-surface-700 dark:text-surface-400 dark:border-surface-600' };
  }
}

/**
 * One row of the RenewalsList table, extracted verbatim from the inline
 * .map() it used to live in and wrapped in React.memo. PERF: with 250-1000
 * rows rendered unvirtualized (a real HTML <table> with a sticky <thead> —
 * virtualizing that cleanly requires abandoning table semantics, a much
 * larger and riskier change flagged separately, not done here), every
 * keystroke in the search box or any unrelated state change in the parent
 * used to reconcile all ~1000 inline <tr> row trees. Memoizing here means a
 * row only re-renders when ITS OWN props actually change — which requires
 * every callback prop below to be a stable reference from the parent
 * (wrapped in useCallback there), and `isSelected` to be the pre-computed
 * boolean rather than the raw selectedIds array (a new array reference on
 * every selection change would otherwise defeat this memo for every row).
 */
function RenewalTableRow({
  row,
  visibleCols,
  isCompact,
  isSelected,
  isAdmin,
  isSales,
  onToggleSelect,
  onNavigate,
  onToggleStopEmail,
  onRenewalConfirmationChange,
  onInvoiceStatusChange,
  onPaymentStatusChange,
  onEdit,
  onDelete,
  onApproveEdit,
}) {
  return (
    <tr className={`hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors ${isSelected ? 'bg-brand-50/50 dark:bg-brand-950/20' : ''}`}>
      <td className="w-8 px-1 py-1 text-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(row.id)}
          className="rounded border-surface-300 text-brand-600 focus:ring-brand-500 cursor-pointer w-3.5 h-3.5"
        />
      </td>

      {/* Unique ID */}
      {visibleCols.id && (
        <td className={`px-1.5 font-mono text-[11px] text-black dark:text-brand-400 font-bold truncate ${isCompact ? 'py-1' : 'py-1.5'}`} title={row.unique_id}>
          {row.unique_id.length > 8 ? row.unique_id.substring(0, 8) + '...' : row.unique_id}
        </td>
      )}

      {/* Client Info */}
      {visibleCols.client && (
        <td className={`px-1.5 overflow-hidden ${isCompact ? 'py-1' : 'py-1.5'}`}>
          <button
            onClick={() => onNavigate(row.id)}
            title={row.client_name}
            className="flex items-center gap-1.5 text-left w-full max-w-full group"
          >
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0 bg-gradient-to-br from-brand-500 to-brand-700">
              {row.client_name?.charAt(0)?.toUpperCase() || '?'}
            </span>
            <span className="font-bold text-black dark:text-brand-400 group-hover:text-slate-700 dark:group-hover:text-brand-300 transition-colors truncate text-[11px]">
              {row.client_name}
            </span>
          </button>
        </td>
      )}

      {/* Service */}
      {visibleCols.service && (
        <td className={`px-1.5 overflow-hidden ${isCompact ? 'py-1' : 'py-1.5'}`}>
          <p className="text-black dark:text-white font-medium truncate" title={row.service}>{row.service}</p>
        </td>
      )}

      {/* Quotation No */}
      {visibleCols.quotation && (
        <td className={`px-1.5 overflow-hidden ${isCompact ? 'py-1' : 'py-1.5'}`}>
          <p className="text-black dark:text-surface-300 font-medium truncate" title={row.quotation_number || '-'}>{row.quotation_number || '-'}</p>
        </td>
      )}

      {/* Renewal Date */}
      {visibleCols.date && (
        <td className={`px-1.5 ${isCompact ? 'py-1' : 'py-1.5'}`}>
          <p className="text-black dark:text-white whitespace-nowrap text-[11px]">{row.renewal_date ? formatDate(row.renewal_date) : '-'}</p>
          {row.renewal_date && (
            <p className={`text-[10px] mt-0.5 whitespace-nowrap ${getDaysLeftColor(row.days_left)}`}>
              {row.days_left < 0 ? 'Expired' : row.days_left === 0 ? 'Due Today' : `${row.days_left}d left`}
            </p>
          )}
        </td>
      )}

      {/* Value */}
      {visibleCols.value && (
        <td className={`px-1.5 font-medium text-black dark:text-white whitespace-nowrap text-[11px] ${isCompact ? 'py-1' : 'py-1.5'}`}>
          {formatCurrency(row.value)}
        </td>
      )}

      {/* Status */}
      {visibleCols.status && (
        <td className={`px-2 text-center whitespace-nowrap ${isCompact ? 'py-1' : 'py-1.5'}`}>
          <StatusBadge status={row.status} size="xs" />
        </td>
      )}

      {/* Timeline */}
      {visibleCols.timeline && (
        <td className={`px-2 text-center overflow-hidden ${isCompact ? 'py-1' : 'py-1.5'}`}>
          {row.status === '-' ? (
            <div className="text-center text-surface-400 dark:text-surface-600 font-medium">—</div>
          ) : row.stop_email ? (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStopEmail(row.id, row.stop_email); }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-[9px] font-semibold cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
              title="Automated emails stopped for this client. Click to resume."
            >
              <MailX className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
              <span>Stopped</span>
            </button>
          ) : (
            <div className="flex items-center justify-center gap-1 w-full flex-nowrap">
              <div className="flex justify-center gap-0.5 flex-nowrap">
                {['30', '20', '15', '10', '5', '3'].map(day => {
                  const sent = row[`day_${day}_sent`] === 'Yes';
                  return (
                    <div
                      key={day}
                      title={`${day} Day Reminder: ${sent ? 'Sent' : 'Pending'}`}
                      className={`w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold ${sent ? 'bg-green-500 text-white' : 'bg-surface-200 dark:bg-surface-700 text-surface-400'}`}
                    >
                      {sent && <MailCheck className="w-2 h-2" />}
                    </div>
                  );
                })}
              </div>
              {(isAdmin || isSales) && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleStopEmail(row.id, row.stop_email); }}
                  className="p-0.5 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded text-surface-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                  title="Click to stop automated emails for this client"
                >
                  <MailX className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </td>
      )}

      {/* Confirmation / Renewed */}
      {visibleCols.renewed && (
        <td className={`px-1.5 text-center overflow-hidden ${isCompact ? 'py-1' : 'py-1.5'}`}>
          {((isSales || isAdmin) && !(row.renewal_confirmation === 'renewed' && row.days_left !== null && row.days_left !== undefined && row.days_left > 30)) ? (
            <GlassSelect
              value={row.renewal_confirmation || 'pending'}
              onChange={(e, val) => onRenewalConfirmationChange(row.id, val !== undefined ? val : e.target.value)}
              size="xs"
              className="w-full text-center"
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'reminder_sent', label: 'Reminder Sent' },
                { value: 'quote_sent', label: 'Quote Sent' },
                { value: 'awaiting_client_approval', label: 'Awaiting Approval' },
                { value: 'renewed', label: 'Renewed' },
                { value: 'lost', label: 'Lost' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          ) : (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border inline-block truncate max-w-full ${getRenewalConfirmationBadge(row.renewal_confirmation).color}`}>
              {getRenewalConfirmationBadge(row.renewal_confirmation).label}
            </span>
          )}
        </td>
      )}

      {/* Invoice */}
      {visibleCols.invoice && (
        <td className={`px-1.5 text-center overflow-hidden ${isCompact ? 'py-1' : 'py-1.5'}`}>
          {(isSales || isAdmin) ? (
            <GlassSelect
              value={row.invoice_status || 'Not'}
              onChange={(e, val) => onInvoiceStatusChange(row.id, val !== undefined ? val : e.target.value)}
              size="xs"
              className="w-full min-w-[66px] max-w-[76px] mx-auto"
              options={[
                { value: 'Not', label: 'Not' },
                { value: 'Sent', label: 'Sent' },
              ]}
            />
          ) : (
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium border w-full max-w-[64px] mx-auto block text-center truncate ${
              row.invoice_status === 'Sent'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                : 'bg-surface-100 text-surface-500 border-surface-200 dark:bg-surface-700 dark:text-surface-300 dark:border-surface-600'
            }`}>
              {row.invoice_status === 'Sent' ? 'Sent' : 'Not'}
            </span>
          )}
        </td>
      )}

      {/* Payment */}
      {visibleCols.payment && (
        <td className={`px-1.5 text-center overflow-hidden ${isCompact ? 'py-1' : 'py-1.5'}`}>
          {(isSales || isAdmin) ? (
            <GlassSelect
              value={row.payment_status || 'No'}
              onChange={(e, val) => onPaymentStatusChange(row.id, val !== undefined ? val : e.target.value)}
              size="xs"
              className="w-full min-w-[66px] max-w-[76px] mx-auto"
              options={[
                { value: 'No', label: 'No' },
                { value: 'Yes', label: 'Yes' },
              ]}
            />
          ) : (
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium border w-full max-w-[64px] mx-auto block text-center truncate ${
              row.payment_status === 'Yes'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                : 'bg-surface-100 text-surface-500 border-surface-200 dark:bg-surface-700 dark:text-surface-300 dark:border-surface-600'
            }`}>
              {row.payment_status === 'Yes' ? 'Yes' : 'No'}
            </span>
          )}
        </td>
      )}

      {/* Actions */}
      {visibleCols.actions && (
        <td className={`px-1.5 py-1.5 text-center overflow-hidden ${isCompact ? 'py-1' : 'py-1.5'}`}>
          <div className="flex items-center justify-center gap-1">
            {(isSales || isAdmin) && (
              <button
                onClick={() => onEdit(row)}
                className="p-1 text-surface-500 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
                title="Edit Record"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => onDelete(row.id)}
                className="p-1 text-surface-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="Delete Record (Admin)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </td>
      )}

      {/* Approvals */}
      {isAdmin && visibleCols.approvals && (
        <td className={`px-1.5 py-1.5 text-center overflow-hidden ${isCompact ? 'py-1' : 'py-1.5'}`}>
          {row.edit_status === 'requested' && (
            <button
              onClick={() => onApproveEdit(row.id)}
              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors flex items-center justify-center gap-0.5 mx-auto text-[10px]"
              title="Approve Edit Request"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </button>
          )}
        </td>
      )}

      {/* Invoice / Bal */}
      {visibleCols.bal && (
        <td className={`px-1.5 py-1.5 text-right overflow-hidden ${isCompact ? 'py-1' : 'py-1.5'}`}>
          {row.invoice_status === 'Sent' && row.invoice_value !== null && row.invoice_value !== undefined ? (
            (() => {
              const valueVal = parseFloat(row.value) || 0;
              const paymentAmt = row.payment_status === 'Yes' ? (parseFloat(row.payment_amount) || 0) : 0;
              const balanceVal = valueVal - paymentAmt;
              const percentPaid = valueVal > 0 ? Math.round((paymentAmt / valueVal) * 100) : 0;
              return (
                <div className="flex flex-col items-end space-y-0.5 w-full ml-auto text-right leading-none">
                  <div className="text-[10px] text-surface-500 dark:text-surface-400 whitespace-nowrap">
                    Inv: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(row.invoice_value)}</span>
                  </div>
                  <div className="text-[10px] text-surface-500 dark:text-surface-400 whitespace-nowrap mt-0.5">
                    Bal: <span className="font-semibold text-surface-700 dark:text-surface-200">{formatCurrency(balanceVal)}</span>
                  </div>
                  {valueVal > 0 && (
                    <div className="text-[9px] text-surface-400 dark:text-surface-500 font-mono mt-0.5 whitespace-nowrap">
                      {percentPaid}% Paid
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <span className="text-surface-400 dark:text-surface-600 block text-center">—</span>
          )}
        </td>
      )}
    </tr>
  );
}

export default memo(RenewalTableRow);
