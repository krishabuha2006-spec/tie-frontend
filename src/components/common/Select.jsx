import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  const containerRef = useRef(null);
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

  // Find currently selected option
  const selectedOption = useMemo(() => {
    if (value === undefined || value === null || value === '') return null;
    return normalizedOptions.find((opt) => String(opt.value) === String(value)) || null;
  }, [normalizedOptions, value]);

  // Filter options if search is used
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const term = searchTerm.toLowerCase();
    return normalizedOptions.filter((opt) =>
      String(opt.label).toLowerCase().includes(term) || String(opt.value).toLowerCase().includes(term)
    );
  }, [normalizedOptions, searchTerm]);

  const [openUpward, setOpenUpward] = useState(false);

  const isOpeningUp = Boolean(
    openUpwardProp ||
    dropUp ||
    placement === 'top' ||
    (placement === 'auto' && openUpward)
  );

  // Auto-flip upward if too close to bottom of screen or explicitly requested
  useEffect(() => {
    if (openUpwardProp || dropUp || placement === 'top') {
      setOpenUpward(true);
      return;
    }
    if (placement === 'bottom') {
      setOpenUpward(false);
      return;
    }
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < 280 && spaceAbove > 180) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
  }, [isOpen, openUpwardProp, dropUp, placement]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens (if search is available)
  useEffect(() => {
    if (isOpen && normalizedOptions.length > 7 && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
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
      setIsOpen((prev) => !prev);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div
      ref={containerRef}
      className={`form-group ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        zIndex: isOpen ? 1000 : 1,
        ...style,
      }}
    >
      {cleanLabel && (
        <label
          htmlFor={selectId}
          className="form-label"
          style={{
            display: 'block',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--text-main, #1e293b)',
            marginBottom: '6px',
          }}
        >
          {cleanLabel}
          {isRequired && (
            <span className="required" style={{ color: '#ef4444', fontWeight: 600, marginLeft: 4 }}>
              *
            </span>
          )}
        </label>
      )}

      {/* Hidden input to maintain native form validation / accessibility */}
      <input
        type="hidden"
        id={selectId}
        name={name}
        value={value ?? ''}
        required={required}
      />

      {/* Custom Theme-Styled Select Trigger */}
      <div
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          minHeight: '38px',
          padding: '8px 12px',
          backgroundColor: disabled ? '#f8fafc' : '#ffffff',
          border: error
            ? '1px solid #ef4444'
            : isOpen
            ? '1px solid var(--primary, #2e7b85)'
            : '1px solid var(--border-dark, #cbd5e1)',
          borderRadius: 'var(--radius-md, 8px)',
          boxShadow: isOpen ? '0 0 0 3px var(--primary-ring, rgba(46, 123, 133, 0.18))' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.7 : 1,
          transition: 'all 0.15s ease-in-out',
          userSelect: 'none',
          outline: 'none',
          boxSizing: 'border-box',
        }}
        {...props}
      >
        <span
          style={{
            fontSize: '0.88rem',
            color: selectedOption ? 'var(--text-main, #1e293b)' : 'var(--text-light, #94a3b8)',
            fontWeight: selectedOption ? 500 : 400,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            paddingRight: '8px',
          }}
        >
          {selectedOption ? selectedOption.label : (value ? String(value) : placeholder)}
        </span>

        <ChevronDown
          size={16}
          style={{
            color: isOpen ? 'var(--primary, #2e7b85)' : 'var(--text-muted, #64748b)',
            transition: 'transform 0.2s ease, color 0.15s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        />
      </div>

      {/* Custom Dropdown Popup Menu */}
      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            ...(isOpeningUp
              ? { bottom: 'calc(100% + 6px)', top: 'auto' }
              : { top: 'calc(100% + 6px)', bottom: 'auto' }),
            left: 0,
            right: 0,
            backgroundColor: '#ffffff',
            border: '1px solid var(--primary-border, #bce1e6)',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: isOpeningUp
              ? '0 -10px 25px -5px rgba(46, 123, 133, 0.22), 0 -8px 10px -6px rgba(0, 0, 0, 0.08)'
              : '0 10px 25px -5px rgba(46, 123, 133, 0.22), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
            zIndex: 9999,
            maxHeight: '260px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: isOpeningUp ? 'fadeInUpward 0.15s ease-out' : 'fadeInDropdown 0.15s ease-out',
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
              maxHeight: '220px',
              padding: '4px 0',
            }}
          >
            {/* Placeholder / Reset item (Optional if field not required) */}
            {!required && (
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
                        e.currentTarget.style.backgroundColor = 'var(--primary-light, #f0f7f8)';
                        e.currentTarget.style.color = 'var(--primary, #2e7b85)';
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
                      <Check size={16} color="var(--primary, #2e7b85)" style={{ flexShrink: 0, marginLeft: 8 }} />
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
        </div>
      )}

      {error && <span className="form-error" style={{ display: 'block', marginTop: 4, fontSize: '0.78rem', color: '#ef4444' }}>{error}</span>}
      {displayHint && !error && <span className="form-hint" style={{ display: 'block', marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>{displayHint}</span>}
    </div>
  );
};

export default Select;
