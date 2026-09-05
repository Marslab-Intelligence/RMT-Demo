import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { createPortal } from 'react-dom';

/**
 * Liquid Glass Select Component
 * High-performance, accessible custom dropdown with frosted glassmorphism,
 * dynamic portal rendering, keyboard navigation, search filtering, and light/dark theme support.
 */
export default function GlassSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select option...',
  name,
  disabled = false,
  required = false,
  searchable = undefined, // auto-detect if > 7 options unless explicitly boolean
  className = '',
  menuClassName = '',
  icon: LeadingIcon = null,
  size = 'md', // 'xs', 'sm', 'md', 'lg'
  id,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0, placement: 'bottom' });

  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options to [{ value, label, badge, icon, disabled, isHeader }]
  const normalizedOptions = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'object' && opt !== null) {
        return {
          value: opt.value !== undefined ? opt.value : '',
          label: opt.label !== undefined ? opt.label : String(opt.value),
          badge: opt.badge,
          icon: opt.icon,
          disabled: opt.disabled,
          isHeader: opt.isHeader,
        };
      }
      return {
        value: String(opt),
        label: String(opt),
      };
    });
  }, [options]);

  // Determine current label
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => String(opt.value) === String(value));
  }, [normalizedOptions, value]);

  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  // Auto-searchable if more than 7 options
  const isSearchable = searchable !== undefined ? searchable : normalizedOptions.length > 7;

  // Filtered options based on search
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const term = searchTerm.toLowerCase().trim();
    return normalizedOptions.filter((opt) =>
      opt.label.toLowerCase().includes(term) || String(opt.value).toLowerCase().includes(term)
    );
  }, [normalizedOptions, searchTerm]);

  // Update menu position on open or scroll/resize
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedHeight = Math.min(320, filteredOptions.length * 38 + (isSearchable ? 54 : 16));

    const placement = spaceBelow < estimatedHeight && spaceAbove > spaceBelow ? 'top' : 'bottom';
    const top = placement === 'top' ? rect.top - estimatedHeight - 6 : rect.bottom + 6;

    const minWidth = Math.max(rect.width, 170);
    const left = Math.max(10, Math.min(window.innerWidth - minWidth - 10, rect.left));

    setMenuPos({
      top: Math.max(10, top),
      left,
      width: minWidth,
      placement,
    });
  }, [filteredOptions.length, isSearchable]);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
      setSearchTerm('');
      setHighlightIndex(0);
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 50);
    } else {
      setIsOpen(false);
    }
  };

  const handleSelect = (optionValue) => {
    if (onChange) {
      const syntheticEvent = {
        target: {
          name: name || '',
          value: optionValue,
        },
      };
      onChange(syntheticEvent, optionValue);
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        handleToggle();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => {
        const next = prev + 1;
        return next < filteredOptions.length ? next : 0;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => {
        const next = prev - 1;
        return next >= 0 ? next : filteredOptions.length - 1;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const currentOpt = filteredOptions[highlightIndex];
      if (currentOpt && !currentOpt.disabled && !currentOpt.isHeader) {
        handleSelect(currentOpt.value);
      }
    }
  };

  // Close when clicking outside or resizing
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen) updatePosition();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Size styles
  const sizeStyles = {
    xs: 'py-0.5 px-2 text-[11px] rounded-lg gap-1',
    sm: 'py-1.5 px-3 text-xs rounded-xl gap-1.5',
    md: 'py-2 px-3.5 text-xs rounded-xl gap-2',
    lg: 'py-2.5 px-4 text-sm rounded-xl gap-2',
  };

  return (
    <div className={`relative inline-block ${className.includes('w-full') ? 'w-full' : ''}`} id={id}>
      {/* Hidden input for HTML form validation */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value !== undefined && value !== null ? value : ''}
          required={required}
        />
      )}

      {/* Liquid Glass Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={`dropdown-btn-glass !flex !flex-row items-center justify-between flex-nowrap whitespace-nowrap ${sizeStyles[size] || sizeStyles.md} ${
          isOpen ? 'ring-2 ring-brand-500/60 border-white/90 dark:border-white/30 !bg-white/80 dark:!bg-white/[0.18]' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        style={{ width: className.includes('w-full') ? '100%' : undefined }}
      >
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden text-left flex-1">
          {LeadingIcon && (
            <LeadingIcon className="w-3.5 h-3.5 flex-shrink-0 text-slate-500 dark:text-slate-400" />
          )}
          <span className={`truncate font-semibold ${(!selectedOption || value === '') ? 'text-surface-400 dark:text-surface-500' : 'text-slate-800 dark:text-surface-100'}`}>
            {displayLabel}
          </span>
        </div>

        <ChevronDown
          className={`flex-shrink-0 ml-auto text-slate-500 dark:text-slate-400 transition-transform duration-200 ${
            size === 'xs' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'
          } ${isOpen ? 'rotate-180 text-brand-500 dark:text-brand-400' : 'rotate-0'}`}
        />
      </button>

      {/* Liquid Glass Menu Popover (Rendered via Portal to break out of all overflow boundaries) */}
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
              minWidth: `${menuPos.width}px`,
              maxWidth: '380px',
              zIndex: 999999,
            }}
            className={`dropdown-menu-glass p-1.5 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[320px] ${menuClassName}`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input for Large Option Lists */}
            {isSearchable && (
              <div className="relative p-1 mb-1 border-b border-black/5 dark:border-white/10">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search options..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setHighlightIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-black/[0.04] dark:bg-white/[0.08] border border-black/5 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1.5 focus:ring-brand-500 transition-all"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Options List */}
            <div ref={listRef} className="overflow-y-auto custom-scrollbar flex-1 space-y-0.5 p-0.5">
              {filteredOptions.length === 0 ? (
                <div className="py-4 px-3 text-center text-xs text-slate-400 font-medium">
                  No matching options found
                </div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  if (opt.isHeader) {
                    return (
                      <div
                        key={`header-${idx}`}
                        className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none"
                      >
                        {opt.label}
                      </div>
                    );
                  }

                  const isSelected = String(opt.value) === String(value);
                  const isHighlighted = idx === highlightIndex;

                  return (
                    <button
                      key={`${opt.value}-${idx}`}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => handleSelect(opt.value)}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer text-left ${
                        isSelected
                          ? 'bg-brand-500/15 text-brand-600 dark:text-brand-300 shadow-sm border border-brand-500/30'
                          : isHighlighted
                          ? 'bg-black/5 dark:bg-white/10 text-slate-900 dark:text-white border border-transparent'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 border border-transparent'
                      } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                        <span className="truncate">{opt.label}</span>
                      </div>

                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 flex-shrink-0" />
                      ) : opt.badge ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-slate-500 dark:text-slate-400 font-mono">
                          {opt.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
