import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  X, 
  Check, 
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { createPortal } from 'react-dom';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Parses various date formats (YYYY-MM-DD, DD/MM/YYYY, ISO string, Date object)
 * into a valid JS Date object or null
 */
function parseDateInput(value) {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value)) return value;

  const str = String(value).trim();
  if (!str) return null;

  // Check DD/MM/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    const parts = str.split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
  }

  // Check YYYY-MM-DD format
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date;
  }

  // Standard JS parse
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format Date to DD/MM/YYYY
 */
function formatToIndian(date) {
  if (!date) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Format Date to YYYY-MM-DD (ISO date)
 */
function formatToISO(date) {
  if (!date) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${y}-${m}-${d}`;
}

/**
 * Liquid Glass Date & Time Picker Component
 */
export default function GlassDatePicker({
  value,
  onChange,
  name,
  placeholder = 'DD/MM/YYYY',
  outputFormat = 'auto', // 'YYYY-MM-DD', 'DD/MM/YYYY', or 'auto'
  enableTime = false,
  disabled = false,
  required = false,
  className = '',
  popoverClassName = '',
  size = 'md', // 'xs', 'sm', 'md', 'lg'
  icon: CustomIcon = null,
  showPresets = true,
  minDate = null,
  maxDate = null,
  id,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 320, placement: 'bottom' });
  const [viewMode, setViewMode] = useState('days'); // 'days', 'months', 'years'

  // Parsed initial date
  const parsedDate = useMemo(() => parseDateInput(value), [value]);

  // Current calendar view state
  const [viewYear, setViewYear] = useState(() => (parsedDate ? parsedDate.getFullYear() : new Date().getFullYear()));
  const [viewMonth, setViewMonth] = useState(() => (parsedDate ? parsedDate.getMonth() : new Date().getMonth()));
  
  // Time selection state
  const [selectedHours, setSelectedHours] = useState(() => (parsedDate ? parsedDate.getHours() : 12));
  const [selectedMinutes, setSelectedMinutes] = useState(() => (parsedDate ? parsedDate.getMinutes() : 0));

  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  // Sync internal view when value changes
  useEffect(() => {
    if (parsedDate) {
      setViewYear(parsedDate.getFullYear());
      setViewMonth(parsedDate.getMonth());
      setSelectedHours(parsedDate.getHours());
      setSelectedMinutes(parsedDate.getMinutes());
    }
  }, [parsedDate]);

  // Determine detected format
  const isIndianInputFormat = useMemo(() => {
    if (outputFormat === 'DD/MM/YYYY') return true;
    if (outputFormat === 'YYYY-MM-DD') return false;
    if (typeof value === 'string' && value.includes('/')) return true;
    return false;
  }, [outputFormat, value]);

  // Formatted display text
  const displayString = useMemo(() => {
    if (!parsedDate) return '';
    const datePart = formatToIndian(parsedDate);
    if (enableTime) {
      const hh = String(selectedHours).padStart(2, '0');
      const mm = String(selectedMinutes).padStart(2, '0');
      return `${datePart} ${hh}:${mm}`;
    }
    return datePart;
  }, [parsedDate, enableTime, selectedHours, selectedMinutes]);

  // Calculate Popover Position
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const popoverHeight = enableTime ? 430 : 380;
    const popoverWidth = 320;

    const placement = spaceBelow < popoverHeight && spaceAbove > spaceBelow ? 'top' : 'bottom';
    const top = placement === 'top' ? rect.top - popoverHeight - 8 : rect.bottom + 8;

    const left = Math.max(12, Math.min(window.innerWidth - popoverWidth - 12, rect.left));

    setPopoverPos({
      top: Math.max(10, top),
      left,
      width: popoverWidth,
      placement,
    });
  }, [enableTime]);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
      setViewMode('days');
      if (parsedDate) {
        setViewYear(parsedDate.getFullYear());
        setViewMonth(parsedDate.getMonth());
      } else {
        const today = new Date();
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
      }
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const emitDate = (dateObj, hours = selectedHours, minutes = selectedMinutes) => {
    if (!dateObj) {
      if (onChange) {
        const syntheticEvent = { target: { name: name || '', value: '' } };
        onChange(syntheticEvent, '');
      }
      return;
    }

    const finalDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), hours, minutes, 0);

    let outputVal = '';
    if (isIndianInputFormat) {
      outputVal = formatToIndian(finalDate);
    } else {
      outputVal = formatToISO(finalDate);
    }

    if (enableTime) {
      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
      outputVal = isIndianInputFormat ? `${outputVal} ${hh}:${mm}` : `${outputVal}T${hh}:${mm}:00`;
    }

    if (onChange) {
      const syntheticEvent = {
        target: {
          name: name || '',
          value: outputVal,
        },
      };
      onChange(syntheticEvent, outputVal);
    }
  };

  const handleDaySelect = (day) => {
    const newDate = new Date(viewYear, viewMonth, day);
    emitDate(newDate);
    if (!enableTime) {
      setIsOpen(false);
    }
  };

  const handleClear = (e) => {
    if (e) e.stopPropagation();
    emitDate(null);
    setIsOpen(false);
  };

  // Preset Shortcuts
  const applyPreset = (daysOffset, e) => {
    if (e) e.stopPropagation();
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    emitDate(d);
    if (!enableTime) {
      setIsOpen(false);
    }
  };

  // Calendar Day Generation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days = [];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        isPrev: true,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
      });
    }

    // Next month filler days to complete 35 or 42 grid
    const totalSlots = days.length <= 35 ? 35 : 42;
    const remaining = totalSlots - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        isNext: true,
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  // Today check
  const today = new Date();
  const isCurrentMonthToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth;

  // Selected check
  const isSelectedDay = (day, isCurrentMonth) => {
    if (!parsedDate || !isCurrentMonth) return false;
    return (
      parsedDate.getFullYear() === viewYear &&
      parsedDate.getMonth() === viewMonth &&
      parsedDate.getDate() === day
    );
  };

  // Month navigation
  const prevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Listen for outside click & resize
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        popoverRef.current && !popoverRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen) updatePosition();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  // Sizes
  const sizeStyles = {
    xs: 'py-1 px-2.5 text-[11px] rounded-lg',
    sm: 'py-1.5 px-3 text-xs rounded-xl',
    md: 'py-2 px-3.5 text-xs rounded-xl',
    lg: 'py-2.5 px-4 text-sm rounded-xl',
  };

  const IconToUse = CustomIcon || (enableTime ? Clock : CalendarIcon);

  return (
    <div className={`relative inline-block ${className.includes('w-full') ? 'w-full' : ''}`} id={id}>
      {/* Hidden input for HTML form integration if required */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value !== undefined && value !== null ? value : ''}
          required={required}
        />
      )}

      {/* Liquid Glass Date Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`dropdown-btn-glass ${sizeStyles[size] || sizeStyles.md} ${
          isOpen ? 'ring-2 ring-brand-500/60 border-white/90 dark:border-white/30 !bg-white/85 dark:!bg-white/[0.18]' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        style={{ width: className.includes('w-full') ? '100%' : undefined }}
      >
        <div className="flex items-center gap-2 min-w-0 overflow-hidden text-left flex-1">
          <IconToUse className="w-3.5 h-3.5 flex-shrink-0 text-brand-500 dark:text-brand-400" />
          <span className={`truncate font-semibold ${!parsedDate ? 'text-surface-400 dark:text-surface-500 font-normal' : 'text-slate-800 dark:text-surface-100'}`}>
            {displayString || placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-1.5">
          {parsedDate && !disabled && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Clear date"
            >
              <X className="w-3 h-3" />
            </span>
          )}
        </div>
      </button>

      {/* Liquid Glass Calendar Popover */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${popoverPos.top}px`,
              left: `${popoverPos.left}px`,
              width: `${popoverPos.width}px`,
              zIndex: 999999,
            }}
            className={`dropdown-menu-glass p-3.5 animate-in fade-in zoom-in-95 duration-150 select-none ${popoverClassName}`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick Presets Bar */}
            {showPresets && (
              <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-2.5 border-b border-black/5 dark:border-white/10 custom-scrollbar text-[10px] font-bold">
                <button
                  type="button"
                  onClick={(e) => applyPreset(0, e)}
                  className="px-2 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] hover:bg-brand-500/15 hover:text-brand-600 dark:hover:text-brand-400 text-slate-600 dark:text-slate-300 transition-colors whitespace-nowrap"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={(e) => applyPreset(1, e)}
                  className="px-2 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] hover:bg-brand-500/15 hover:text-brand-600 dark:hover:text-brand-400 text-slate-600 dark:text-slate-300 transition-colors whitespace-nowrap"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={(e) => applyPreset(30, e)}
                  className="px-2 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] hover:bg-brand-500/15 hover:text-brand-600 dark:hover:text-brand-400 text-slate-600 dark:text-slate-300 transition-colors whitespace-nowrap"
                >
                  +30 Days
                </button>
                <button
                  type="button"
                  onClick={(e) => applyPreset(90, e)}
                  className="px-2 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] hover:bg-brand-500/15 hover:text-brand-600 dark:hover:text-brand-400 text-slate-600 dark:text-slate-300 transition-colors whitespace-nowrap"
                >
                  +90 Days
                </button>
                <button
                  type="button"
                  onClick={(e) => applyPreset(365, e)}
                  className="px-2 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] hover:bg-brand-500/15 hover:text-brand-600 dark:hover:text-brand-400 text-slate-600 dark:text-slate-300 transition-colors whitespace-nowrap"
                >
                  +1 Year
                </button>
              </div>
            )}

            {/* Header: Month & Year Navigator */}
            <div className="flex items-center justify-between mb-3 px-1">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-all hover:scale-105"
                title="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 font-bold text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'months' ? 'days' : 'months')}
                  className="px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-900 dark:text-white transition-colors"
                >
                  {MONTH_NAMES[viewMonth]}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'years' ? 'days' : 'years')}
                  className="px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-brand-600 dark:text-brand-400 transition-colors font-mono"
                >
                  {viewYear}
                </button>
              </div>

              <button
                type="button"
                onClick={nextMonth}
                className="p-1 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-all hover:scale-105"
                title="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Month Picker Mode */}
            {viewMode === 'months' && (
              <div className="grid grid-cols-3 gap-1.5 py-2">
                {MONTH_NAMES.map((m, idx) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setViewMonth(idx);
                      setViewMode('days');
                    }}
                    className={`py-2 text-xs font-semibold rounded-xl transition-all ${
                      idx === viewMonth
                        ? 'bg-brand-500 text-white font-bold shadow-md shadow-brand-500/30'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                  >
                    {m.substring(0, 3)}
                  </button>
                ))}
              </div>
            )}

            {/* Quick Year Picker Mode */}
            {viewMode === 'years' && (
              <div className="grid grid-cols-4 gap-1.5 py-2 max-h-[190px] overflow-y-auto custom-scrollbar">
                {Array.from({ length: 24 }, (_, i) => viewYear - 10 + i).map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setViewYear(y);
                      setViewMode('days');
                    }}
                    className={`py-2 text-xs font-mono font-semibold rounded-xl transition-all ${
                      y === viewYear
                        ? 'bg-brand-500 text-white font-bold shadow-md shadow-brand-500/30'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}

            {/* Standard Calendar Days Grid */}
            {viewMode === 'days' && (
              <>
                {/* Week Day Names */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                  {WEEK_DAYS.map((w, idx) => (
                    <div
                      key={w}
                      className={`text-[10px] font-bold uppercase tracking-wider py-1 ${
                        idx === 0 || idx === 6
                          ? 'text-rose-500/80 dark:text-rose-400/80'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {w}
                    </div>
                  ))}
                </div>

                {/* Day Grid */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {calendarDays.map((item, idx) => {
                    const isSelected = isSelectedDay(item.day, item.isCurrentMonth);
                    const isToday =
                      isCurrentMonthToday &&
                      item.isCurrentMonth &&
                      today.getDate() === item.day;

                    return (
                      <button
                        key={`${item.day}-${idx}`}
                        type="button"
                        onClick={() => {
                          if (item.isPrev) {
                            prevMonth({ stopPropagation: () => {} });
                          } else if (item.isNext) {
                            nextMonth({ stopPropagation: () => {} });
                          } else {
                            handleDaySelect(item.day);
                          }
                        }}
                        className={`relative w-8 h-8 mx-auto flex items-center justify-center rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/40 font-bold scale-105 ring-2 ring-brand-400/40'
                            : item.isCurrentMonth
                            ? 'text-slate-800 dark:text-slate-100 hover:bg-black/5 dark:hover:bg-white/10 hover:scale-105'
                            : 'text-slate-400/50 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400'
                        }`}
                      >
                        <span>{item.day}</span>
                        {isToday && !isSelected && (
                          <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Optional Time Picker Grid */}
            {enableTime && (
              <div className="mt-3 pt-2.5 border-t border-black/5 dark:border-white/10 flex items-center justify-between px-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-bold">
                  <Clock className="w-3.5 h-3.5 text-brand-500" />
                  <span>Time:</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <select
                    value={selectedHours}
                    onChange={(e) => {
                      const h = parseInt(e.target.value, 10);
                      setSelectedHours(h);
                      if (parsedDate) emitDate(parsedDate, h, selectedMinutes);
                    }}
                    className="bg-black/5 dark:bg-white/10 rounded-lg px-2 py-1 text-slate-900 dark:text-white border border-black/5 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-brand-500 font-bold"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i} className="bg-white dark:bg-surface-800 text-slate-900 dark:text-white">
                        {String(i).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                  <span className="text-slate-400 font-bold">:</span>
                  <select
                    value={selectedMinutes}
                    onChange={(e) => {
                      const m = parseInt(e.target.value, 10);
                      setSelectedMinutes(m);
                      if (parsedDate) emitDate(parsedDate, selectedHours, m);
                    }}
                    className="bg-black/5 dark:bg-white/10 rounded-lg px-2 py-1 text-slate-900 dark:text-white border border-black/5 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-brand-500 font-bold"
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={i} value={i} className="bg-white dark:bg-surface-800 text-slate-900 dark:text-white">
                        {String(i).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Footer Toolbar */}
            <div className="mt-3 pt-2.5 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleClear}
                className="px-2 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-semibold transition-colors"
              >
                Clear
              </button>
              
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold shadow-sm shadow-brand-500/20 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
