import React, { useState, useEffect, useRef } from 'react';
import { Clock, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Professional 12-Hour Time Picker Component (AM / PM)
 * 
 * Supports:
 * - Direct typing for any hour (01 - 12)
 * - Direct typing for ANY minute (00 - 59)
 * - Keyboard Up / Down arrow stepping with cycling
 * - Visual up / down micro-stepper buttons
 * - Instant AM / PM toggle
 * - Emits standard 24-hr "HH:mm" to parent form
 */
export const TimePicker12 = ({
  label,
  value = '09:00',
  onChange,
  required = false,
  disabled = false,
  id,
}) => {
  // Parse incoming 24-hr value ("HH:mm") into 12-hr state
  const parse24 = (val) => {
    let raw = val || '09:00';
    if (typeof raw === 'string' && raw.includes('T')) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        raw = `${hh}:${mm}`;
      }
    }
    const [hStr, mStr] = String(raw).split(':');
    let h24 = parseInt(hStr, 10);
    if (isNaN(h24)) h24 = 9;
    let m = parseInt(mStr, 10);
    if (isNaN(m) || m < 0) m = 0;
    if (m > 59) m = 59;

    const period = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;

    return {
      hour: String(h12).padStart(2, '0'),
      minute: String(m).padStart(2, '0'),
      period,
    };
  };

  const parsed = parse24(value);
  const [hourStr, setHourStr] = useState(parsed.hour);
  const [minStr, setMinStr] = useState(parsed.minute);
  const [period, setPeriod] = useState(parsed.period);
  const [isFocused, setIsFocused] = useState(false);

  const hourInputRef = useRef(null);
  const minInputRef = useRef(null);

  // Sync internal state if external value changes
  useEffect(() => {
    const p = parse24(value);
    setHourStr(p.hour);
    setMinStr(p.minute);
    setPeriod(p.period);
  }, [value]);

  // Convert 12-hr to 24-hr HH:mm and emit
  const emitChange = (h12Str, mStrVal, per) => {
    let h12 = parseInt(h12Str, 10);
    if (isNaN(h12) || h12 < 1) h12 = 12;
    if (h12 > 12) h12 = 12;

    let m = parseInt(mStrVal, 10);
    if (isNaN(m) || m < 0) m = 0;
    if (m > 59) m = 59;

    let h24 = h12;
    if (per === 'AM') {
      if (h12 === 12) h24 = 0;
    } else {
      if (h12 !== 12) h24 = h12 + 12;
    }

    const hh = String(h24).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    if (onChange) {
      onChange(`${hh}:${mm}`);
    }
  };

  // Hour stepping
  const stepHour = (delta) => {
    let current = parseInt(hourStr, 10) || 12;
    let next = current + delta;
    if (next > 12) next = 1;
    if (next < 1) next = 12;
    const nextFormatted = String(next).padStart(2, '0');
    setHourStr(nextFormatted);
    emitChange(nextFormatted, minStr, period);
  };

  // Minute stepping (steps by 1, or Shift+click steps by 5)
  const stepMinute = (delta) => {
    let current = parseInt(minStr, 10) || 0;
    let next = current + delta;
    if (next > 59) next = 0;
    if (next < 0) next = 59;
    const nextFormatted = String(next).padStart(2, '0');
    setMinStr(nextFormatted);
    emitChange(hourStr, nextFormatted, period);
  };

  // Hour change handler
  const handleHourChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw === '') {
      setHourStr('');
      return;
    }
    let num = parseInt(raw, 10);
    if (num > 12) {
      num = 12;
    }
    const str = String(num);
    setHourStr(str);
    emitChange(str, minStr, period);
    // Auto-advance to minutes if user typed 2 digits or a number >= 2
    if (raw.length === 2 || num >= 2) {
      minInputRef.current?.focus();
      minInputRef.current?.select();
    }
  };

  const handleHourBlur = () => {
    let num = parseInt(hourStr, 10);
    if (isNaN(num) || num < 1) num = 12;
    if (num > 12) num = 12;
    const formatted = String(num).padStart(2, '0');
    setHourStr(formatted);
    emitChange(formatted, minStr, period);
  };

  // Minute change handler
  const handleMinuteChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw === '') {
      setMinStr('');
      return;
    }
    let num = parseInt(raw, 10);
    if (num > 59) num = 59;
    const str = String(num);
    setMinStr(str);
    emitChange(hourStr, str, period);
  };

  const handleMinuteBlur = () => {
    let num = parseInt(minStr, 10);
    if (isNaN(num) || num < 0) num = 0;
    if (num > 59) num = 59;
    const formatted = String(num).padStart(2, '0');
    setMinStr(formatted);
    emitChange(hourStr, formatted, period);
  };

  // Key navigation (Up / Down)
  const handleHourKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      stepHour(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      stepHour(-1);
    } else if (e.key === ':') {
      e.preventDefault();
      minInputRef.current?.focus();
    }
  };

  const handleMinuteKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      stepMinute(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      stepMinute(-1);
    } else if (e.key === 'Backspace' && minStr === '') {
      hourInputRef.current?.focus();
    }
  };

  const togglePeriod = (newPer) => {
    if (period === newPer) return;
    setPeriod(newPer);
    emitChange(hourStr, minStr, newPer);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Clock size={13} style={{ color: 'var(--primary)' }} />
          <span>{label}</span>
          {required && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
      )}

      {/* Main Container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: disabled ? '#f8fafc' : '#ffffff',
          border: `1.5px solid ${isFocused ? 'var(--primary)' : '#cbd5e1'}`,
          borderRadius: 8,
          padding: '4px 8px',
          boxShadow: isFocused ? '0 0 0 3px var(--primary-ring)' : '0 1px 2px rgba(0,0,0,0.03)',
          transition: 'all 0.15s ease',
          height: 38,
          boxSizing: 'border-box',
        }}
      >
        {/* Left: Time Inputs Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {/* Hour Input + Steppers */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <input
              ref={hourInputRef}
              id={id ? `${id}-hour` : undefined}
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={hourStr}
              disabled={disabled}
              placeholder="09"
              onChange={handleHourChange}
              onBlur={handleHourBlur}
              onKeyDown={handleHourKeyDown}
              onFocus={() => {
                setIsFocused(true);
                hourInputRef.current?.select();
              }}
              aria-label="Hour (1 to 12)"
              style={{
                width: 26,
                padding: '2px 0',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '0.92rem',
                fontWeight: 700,
                color: '#0f172a',
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
                cursor: disabled ? 'not-allowed' : 'text',
              }}
            />
            {/* Hour Micro-Steppers */}
            <div style={{ display: 'flex', flexDirection: 'column', margin: '0 2px' }}>
              <button
                type="button"
                tabIndex={-1}
                disabled={disabled}
                onClick={() => stepHour(1)}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#94a3b8',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Increase hour (Up arrow)"
              >
                <ChevronUp size={11} />
              </button>
              <button
                type="button"
                tabIndex={-1}
                disabled={disabled}
                onClick={() => stepHour(-1)}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#94a3b8',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Decrease hour (Down arrow)"
              >
                <ChevronDown size={11} />
              </button>
            </div>
          </div>

          <span
            style={{
              fontWeight: 800,
              color: '#64748b',
              fontSize: '1rem',
              userSelect: 'none',
              padding: '0 1px',
            }}
          >
            :
          </span>

          {/* Minute Input + Steppers */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <input
              ref={minInputRef}
              id={id ? `${id}-minute` : undefined}
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={minStr}
              disabled={disabled}
              placeholder="00"
              onChange={handleMinuteChange}
              onBlur={handleMinuteBlur}
              onKeyDown={handleMinuteKeyDown}
              onFocus={() => {
                setIsFocused(true);
                minInputRef.current?.select();
              }}
              aria-label="Minute (0 to 59)"
              style={{
                width: 26,
                padding: '2px 0',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '0.92rem',
                fontWeight: 700,
                color: '#0f172a',
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
                cursor: disabled ? 'not-allowed' : 'text',
              }}
            />
            {/* Minute Micro-Steppers */}
            <div style={{ display: 'flex', flexDirection: 'column', margin: '0 2px' }}>
              <button
                type="button"
                tabIndex={-1}
                disabled={disabled}
                onClick={() => stepMinute(1)}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#94a3b8',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Increase minute (Up arrow)"
              >
                <ChevronUp size={11} />
              </button>
              <button
                type="button"
                tabIndex={-1}
                disabled={disabled}
                onClick={() => stepMinute(-1)}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#94a3b8',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Decrease minute (Down arrow)"
              >
                <ChevronDown size={11} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: AM / PM Switcher Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#f1f5f9',
            borderRadius: 6,
            padding: '2px',
            border: '1px solid #e2e8f0',
          }}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => togglePeriod('AM')}
            style={{
              padding: '2px 7px',
              fontSize: '0.72rem',
              fontWeight: 800,
              borderRadius: 4,
              border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: period === 'AM' ? 'var(--primary)' : 'transparent',
              color: period === 'AM' ? '#ffffff' : '#64748b',
              boxShadow: period === 'AM' ? '0 1px 3px rgba(63,146,154,0.35)' : 'none',
              transition: 'all 0.15s ease',
              letterSpacing: '0.02em',
            }}
          >
            AM
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => togglePeriod('PM')}
            style={{
              padding: '2px 7px',
              fontSize: '0.72rem',
              fontWeight: 800,
              borderRadius: 4,
              border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: period === 'PM' ? 'var(--primary)' : 'transparent',
              color: period === 'PM' ? '#ffffff' : '#64748b',
              boxShadow: period === 'PM' ? '0 1px 3px rgba(63,146,154,0.35)' : 'none',
              transition: 'all 0.15s ease',
              letterSpacing: '0.02em',
            }}
          >
            PM
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimePicker12;
