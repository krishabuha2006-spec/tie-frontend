import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const Input = ({
  label,
  id,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  error,
  hint,
  helperText,
  disabled = false,
  className = '',
  style,
  isPhone = false,
  ...props
}) => {
  const inputId = id || name;
  const isRequired = Boolean(required || (typeof label === 'string' && label.includes('*')));
  const cleanLabel = typeof label === 'string' ? label.replace(/\s*\*+\s*$/, '').trim() : label;
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const isPhoneType = Boolean(isPhone || type === 'tel');
  const isEmailType = type === 'email';
  const displayHint = hint || helperText;

  const defaultPlaceholder = isPhoneType
    ? '10-digit mobile number'
    : isEmailType
    ? 'e.g. name@example.com'
    : placeholder;

  const handleChange = (e) => {
    if (isPhoneType) {
      // Restrict to digits only and max length
      const maxLen = props.maxLength || 10;
      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, maxLen);
      e.target.value = digitsOnly;
    }
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <div className={`form-group ${className}`} style={style}>
      {cleanLabel && (
        <label htmlFor={inputId} className="form-label">
          {cleanLabel}
          {isRequired && (
            <span className="required" style={{ color: '#ef4444', fontWeight: 600, marginLeft: 4 }}>
              *
            </span>
          )}
        </label>
      )}
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          id={inputId}
          name={name}
          type={isPassword ? (showPassword ? 'text' : 'password') : (isPhoneType ? 'tel' : type)}
          inputMode={isPhoneType ? 'numeric' : (isEmailType ? 'email' : props.inputMode)}
          maxLength={isPhoneType ? (props.maxLength || 10) : props.maxLength}
          autoCapitalize={isEmailType ? 'none' : props.autoCapitalize}
          value={value ?? ''}
          onChange={handleChange}
          placeholder={defaultPlaceholder}
          disabled={disabled}
          required={required}
          className={`form-control ${error ? 'error' : ''}`}
          style={isPassword ? { paddingRight: '40px' } : undefined}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted, #64748b)',
              borderRadius: 4,
              outline: 'none',
            }}
            tabIndex={-1}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <span className="form-error">{error}</span>}
      {displayHint && !error && <span className="form-hint">{displayHint}</span>}
    </div>
  );
};

export default Input;
