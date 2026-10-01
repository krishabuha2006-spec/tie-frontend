import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';

export const Select = ({
  label,
  id,
  name,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  required = false,
  error,
  hint,
  helperText,
  disabled = false,
  className = '',
  style,
  placement = 'auto',
  openUpward: openUpwardProp,
  dropUp,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState({
    top: 0,
    bottom: undefined,
    left: 0,
    width: 200,
    maxHeight: 260,
    openUpward: false,
  });

  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectId = id || name;
  const isRequired = Boolean(required || (typeof label === 'string' && label.includes('*')));
  const cleanLabel = typeof label === 'string' ? label.replace(/\s*\*+\s*$/, '').trim() : label;
  const displayHint = hint || helperText;

  // Normalize options array to standard [{ value, label }]
  const normalizedOptions = useMemo(() => {
    if (!Array.isArray(options)) return [];
    return options.map((opt) => {
      if (typeof opt === 'object' && opt !== null) {
        return {
          value: opt.value !== undefined ? opt.value : (opt._id || opt.id || opt.name || ''),
          label: opt.label !== undefined ? opt.label : (opt.displayName || opt.name || opt.title || String(opt.value ?? '')),
        };
      }
      return {
        value: opt,
        label: String(opt),
      };
    });
  }, [options]);

  // Find currently selected option (properly handles empty string options e.g. { value: '', label: 'All Departments' })
  const selectedOption = useMemo(() => {
    if (value === undefined || value === null) return null;
    const match = normalizedOptions.find((opt) => String(opt.value) === String(value));
    if (match) return match;
    if (value === '') return null;
    return { value, label: String(value) };
  }, [normalizedOptions, value]);

  // Filter options when search is active
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const term = searchTerm.toLowerCase();
    return normalizedOptions.filter((opt) =>
      String(opt.label).toLowerCase().includes(term) || String(opt.value).toLowerCase().includes(term)
    );
  }, [normalizedOptions, searchTerm]);

  // Check if options already include a blank / all / reset option
  const hasEmptyOption = useMemo(() => {
    return normalizedOptions.some(
      (opt) => opt.value === '' || opt.value === null || opt.value === undefined
    );
  }, [normalizedOptions]);

  // Calculate viewport coordinates for the floating dropdown portal
  const updateCoords = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    const isUpward = Boolean(
      openUpwardProp ||
      dropUp ||
      placement === 'top' ||
      (placement !== 'bottom' && spaceBelow < 240 && spaceAbove > 180)
    );

    const maxH = isUpward
      ? Math.max(120, Math.min(260, spaceAbove - 16))
      : Math.max(120, Math.min(260, spaceBelow - 16));

    const popupWidth = Math.max(rect.width, 160);
    let leftPos = rect.left;
    if (leftPos + popupWidth > window.innerWidth - 8) {
      leftPos = Math.max(8, window.innerWidth - popupWidth - 8);
    }

    setCoords({
      openUpward: isUpward,
      top: isUpward ? undefined : rect.bottom + 4,
      bottom: isUpward ? window.innerHeight - rect.top + 4 : undefined,
      left: leftPos,
      width: popupWidth,
      maxHeight: maxH,
    });
  }, [openUpwardProp, dropUp, placement]);

  // Toggle Dropdown
  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updateCoords();
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  // Close on outside click, update position on scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    updateCoords();

    const handleClickOutside = (event) => {
      const inTrigger = containerRef.current && containerRef.current.contains(event.target);
      const inDropdown = dropdownRef.current && dropdownRef.current.contains(event.target);
      if (!inTrigger && !inDropdown) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    const handleScrollOrResize = (event) => {
      // Don't close or disrupt if scrolling inside the options list itself
      if (dropdownRef.current && dropdownRef.current.contains(event.target)) {
        return;
      }
      updateCoords();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updateCoords]);

  // Auto-focus search input if options > 7
  useEffect(() => {
    if (isOpen && normalizedOptions.length > 7 && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, normalizedOptions.length]);

  const handleSelect = (val) => {
    if (disabled) return;
    if (onChange) {
      onChange({
        target: {
          name,
          value: val,
        },
      });
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  // Determine label to display
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  return (
    <div
      ref={containerRef}
      className={`form-group ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        ...style,
      }}
    >
      {cleanLabel && (
        <label
          htmlFor={selectId}
          className="form-label"
        >
          {cleanLabel}
          {isRequired && (
            <span className="required">
              *
            </span>
          )}
        </label>
      )}

      {/* Hidden input to maintain form data binding without blocking HTML5 constraint validation */}
      <input
        type="hidden"
        id={selectId}
        name={name}
        value={value ?? ''}
      />

      {/* Custom Theme-Styled Select Trigger */}
      <div
        tabIndex={disabled ? -1 : 0}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={`custom-select-trigger ${isOpen ? 'open' : ''} ${error ? 'error' : ''} ${disabled ? 'disabled' : ''}`}
        style={{
          width: '100%',
          height: '38px',
          minHeight: '38px',
          padding: '8px 12px',
          backgroundColor: disabled ? 'var(--bg-app, #f8fafc)' : '#ffffff',
          border: error
            ? '1.5px solid var(--danger, #dc2626)'
            : isOpen
            ? '1.5px solid var(--primary, #3f929a)'
            : '1.5px solid var(--border-dark, #cbd5e1)',
          borderRadius: 'var(--radius-md, 8px)',
          boxShadow: isOpen ? '0 0 0 3px var(--primary-ring, rgba(63, 146, 154, 0.2))' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.65 : 1,
          transition: 'all 0.15s ease-in-out',
          userSelect: 'none',
          outline: 'none',
          boxSizing: 'border-box',
        }}
        {...props}
      >
        <span
          style={{
            fontSize: '0.875rem',
            color: selectedOption ? 'var(--text-main, #1e293b)' : 'var(--text-light, #94a3b8)',
            fontWeight: selectedOption ? 500 : 400,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            paddingRight: '8px',
          }}
        >
          {displayLabel}
        </span>

        <ChevronDown
          size={16}
          style={{
            color: isOpen ? 'var(--primary, #3f929a)' : 'var(--text-muted, #64748b)',
            transition: 'transform 0.2s ease, color 0.15s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        />
      </div>

      {/* Custom Dropdown Popup Menu rendered into body via Portal (Never gets clipped by parent cards, modals, or tables) */}
      {isOpen && !disabled && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: coords.openUpward ? undefined : coords.top,
            bottom: coords.openUpward ? coords.bottom : undefined,
            left: coords.left,
            width: coords.width,
            backgroundColor: '#ffffff',
            border: '1px solid var(--primary-border, #bce1e6)',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: coords.openUpward
              ? '0 -10px 25px -5px rgba(46, 123, 133, 0.22), 0 -8px 10px -6px rgba(0, 0, 0, 0.08)'
              : '0 10px 25px -5px rgba(46, 123, 133, 0.22), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
            zIndex: 999999,
            maxHeight: coords.maxHeight,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: coords.openUpward ? 'fadeInUpward 0.15s ease-out' : 'fadeInDropdown 0.15s ease-out',
          }}
        >
          {/* Quick Search inside dropdown if more than 7 items */}
          {normalizedOptions.length > 7 && (
            <div
              style={{
                padding: '8px 10px',
                borderBottom: '1px solid var(--border-light, #edf2f7)',
                backgroundColor: 'var(--bg-app, #f8fafc)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Search size={14} color="var(--text-muted, #64748b)" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '0.82rem',
                  color: 'var(--text-main, #1e293b)',
                }}
              />
            </div>
          )}

          {/* Options Scroll Container */}
          <div
            style={{
              overflowY: 'auto',
              maxHeight: `${Math.max(80, coords.maxHeight - (normalizedOptions.length > 7 ? 45 : 10))}px`,
              padding: '4px 0',
            }}
          >
            {/* Placeholder / Reset item (Only if not required, has placeholder, and no empty option already in list) */}
            {!isRequired && placeholder && !hasEmptyOption && (
              <div
                onClick={() => handleSelect('')}
                style={{
                  padding: '8px 14px',
                  fontSize: '0.84rem',
                  color: 'var(--text-muted, #64748b)',
                  fontStyle: 'italic',
                  cursor: 'pointer',
                  backgroundColor: !selectedOption ? 'var(--primary-light, #f0f7f8)' : 'transparent',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--primary-light, #f0f7f8)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = !selectedOption ? 'var(--primary-light, #f0f7f8)' : 'transparent';
                }}
              >
                {placeholder}
              </div>
            )}

            {/* Render Filtered Options */}
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = selectedOption && String(selectedOption.value) === String(opt.value);
                const safeValKey =
                  typeof opt.value === 'string' || typeof opt.value === 'number'
                    ? opt.value
                    : opt.value?._id || opt.value?.id || idx;
                return (
                  <div
                    key={`opt-${safeValKey}-${idx}`}
                    onClick={() => handleSelect(opt.value)}
                    style={{
                      padding: '9px 14px',
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isSelected ? 'var(--primary-subtle, #e2f0f2)' : 'transparent',
                      color: isSelected ? 'var(--primary-active, #1c525a)' : 'var(--text-main, #1e293b)',
                      fontWeight: isSelected ? 600 : 400,
                      transition: 'background-color 0.15s ease, color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'var(--primary-light, #edf7f8)';
                        e.currentTarget.style.color = 'var(--primary, #3f929a)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-main, #1e293b)';
                      }
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {opt.label}
                    </span>
                    {isSelected && (
                      <Check size={16} color="var(--primary, #3f929a)" style={{ flexShrink: 0, marginLeft: 8 }} />
                    )}
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  padding: '12px 14px',
                  fontSize: '0.82rem',
                  color: 'var(--text-muted, #64748b)',
                  textAlign: 'center',
                }}
              >
                No options found
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {error && <span className="form-error" style={{ display: 'block', marginTop: 4, fontSize: '0.78rem', color: '#ef4444' }}>{error}</span>}
      {displayHint && !error && <span className="form-hint" style={{ display: 'block', marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>{displayHint}</span>}
    </div>
  );
};

export default Select;
