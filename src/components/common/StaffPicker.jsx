import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Search, ChevronDown, Check, User, X } from 'lucide-react';

export const StaffPicker = ({
  employees = [],
  value,
  onChange,
  label,
  placeholder = 'Select staff member...',
  disabled = false,
  required = false,
  style = {},
  dropUp = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 340, openUpward: false });

  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Helper to extract employee details safely
  const getEmpDetails = useCallback((emp) => {
    if (!emp) return { name: '', code: '', dept: '', desig: '', initials: 'EM' };
    const name = emp.basicInfo?.fullName || emp.name || 'Staff Member';
    const code = emp.basicInfo?.employeeCode || emp.employeeCode || '';
    const dept =
      emp.employmentInfo?.department?.name ||
      (typeof emp.department === 'string' ? emp.department : emp.department?.name) ||
      '';
    const desig =
      emp.employmentInfo?.designation?.name ||
      (typeof emp.designation === 'string' ? emp.designation : emp.designation?.name) ||
      '';
    const initials = name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'EM';
    return { name, code, dept, desig, initials };
  }, []);

  // Currently selected employee
  const selectedEmp = useMemo(() => {
    if (!value) return null;
    return employees.find((e) => String(e._id) === String(value)) || null;
  }, [employees, value]);

  const selectedDetails = useMemo(() => getEmpDetails(selectedEmp), [getEmpDetails, selectedEmp]);

  // Filtered employees list based on search
  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase().trim();
    return employees.filter((emp) => {
      const { name, code, dept, desig } = getEmpDetails(emp);
      return (
        name.toLowerCase().includes(q) ||
        code.toLowerCase().includes(q) ||
        dept.toLowerCase().includes(q) ||
        desig.toLowerCase().includes(q)
      );
    });
  }, [employees, search, getEmpDetails]);

  // Calculate dropdown coords
  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const isUpward = dropUp || (spaceBelow < 280 && spaceAbove > 200);

    const dropdownWidth = Math.max(rect.width, 360);
    let leftPos = rect.left;
    if (leftPos + dropdownWidth > window.innerWidth - 12) {
      leftPos = Math.max(12, window.innerWidth - dropdownWidth - 12);
    }

    setCoords({
      openUpward: isUpward,
      top: isUpward ? undefined : rect.bottom + 6,
      bottom: isUpward ? window.innerHeight - rect.top + 6 : undefined,
      left: leftPos,
      width: dropdownWidth,
      maxHeight: isUpward ? Math.min(320, spaceAbove - 20) : Math.min(340, spaceBelow - 20),
    });
  }, [dropUp]);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updateCoords();
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setSearch('');
    }
  };

  const handleSelect = (emp) => {
    if (disabled) return;
    if (onChange) {
      onChange(emp._id, emp);
    }
    setIsOpen(false);
    setSearch('');
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    updateCoords();

    const handleClickOutside = (e) => {
      const inTrigger = triggerRef.current && triggerRef.current.contains(e.target);
      const inDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!inTrigger && !inDropdown) {
        setIsOpen(false);
        setSearch('');
      }
    };

    const handleScrollOrResize = (e) => {
      if (dropdownRef.current && dropdownRef.current.contains(e.target)) return;
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

  // Auto focus search input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Color generator for avatar based on name
  const getAvatarGradient = (str) => {
    const gradients = [
      'linear-gradient(135deg, #3f929a 0%, #205c63 100%)',
      'linear-gradient(135deg, #f5a532 0%, #c4760e 100%)',
      'linear-gradient(135deg, #8bc54a 0%, #5d8e2a 100%)',
      'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
      'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
    ];
    let hash = 0;
    for (let i = 0; i < (str || '').length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && (
        <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <div
        ref={triggerRef}
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 12px',
          background: disabled ? '#f8fafc' : '#ffffff',
          border: isOpen ? '1.5px solid var(--primary, #3f929a)' : '1px solid #cbd5e1',
          borderRadius: 10,
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: isOpen ? '0 0 0 3px rgba(63, 146, 154, 0.15)' : '0 1px 2px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.18s ease',
          userSelect: 'none',
          minHeight: 44,
        }}
      >
        {selectedEmp ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: getAvatarGradient(selectedDetails.name),
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.78rem',
                fontWeight: 700,
                flexShrink: 0,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              {selectedDetails.initials}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedDetails.name}
                </span>
                {selectedDetails.code && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background: 'rgba(63, 146, 154, 0.1)',
                      color: 'var(--primary, #3f929a)',
                      padding: '1px 6px',
                      borderRadius: 4,
                      fontFamily: 'monospace',
                    }}
                  >
                    {selectedDetails.code}
                  </span>
                )}
              </div>
              {(selectedDetails.dept || selectedDetails.desig) && (
                <div style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {[selectedDetails.desig, selectedDetails.dept].filter(Boolean).join(' • ')}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: '0.85rem' }}>
            <User size={16} />
            <span>{placeholder}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
          <ChevronDown
            size={18}
            color={isOpen ? 'var(--primary, #3f929a)' : '#64748b'}
            style={{
              transition: 'transform 0.2s ease',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              flexShrink: 0,
            }}
          />
        </div>
      </div>

      {/* Floating Dropdown Portal */}
      {isOpen &&
        ReactDOM.createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: coords.top,
              bottom: coords.bottom,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight || 340,
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
              zIndex: 99999,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            {/* Search Input Header */}
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid #f1f5f9',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Search size={16} color="var(--primary, #3f929a)" style={{ flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search staff by name, code, dept..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '0.84rem',
                  color: '#0f172a',
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 2,
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Subheader Count */}
            <div
              style={{
                padding: '6px 14px',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#64748b',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Staff Directory ({filteredEmployees.length})
            </div>

            {/* Employees List Container */}
            <div
              style={{
                overflowY: 'auto',
                flex: 1,
                padding: '4px 0',
              }}
            >
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => {
                  const { name, code, dept, desig, initials } = getEmpDetails(emp);
                  const isSelected = selectedEmp && String(selectedEmp._id) === String(emp._id);

                  return (
                    <div
                      key={emp._id}
                      onClick={() => handleSelect(emp)}
                      style={{
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(63, 146, 154, 0.08)' : 'transparent',
                        borderLeft: isSelected ? '3px solid var(--primary, #3f929a)' : '3px solid transparent',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: getAvatarGradient(name),
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontSize: '0.85rem',
                                fontWeight: isSelected ? 700 : 600,
                                color: isSelected ? 'var(--primary, #3f929a)' : '#0f172a',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {name}
                            </span>
                            {code && (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  background: '#f1f5f9',
                                  color: '#475569',
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  fontFamily: 'monospace',
                                }}
                              >
                                {code}
                              </span>
                            )}
                          </div>
                          {(dept || desig) && (
                            <div
                              style={{
                                fontSize: '0.72rem',
                                color: '#64748b',
                                marginTop: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {[desig, dept].filter(Boolean).join(' • ')}
                            </div>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: 'var(--primary, #3f929a)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            flexShrink: 0,
                            marginLeft: 8,
                          }}
                        >
                          <Check size={14} strokeWidth={2.5} />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                  No staff members matching &ldquo;{search}&rdquo;
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default StaffPicker;
