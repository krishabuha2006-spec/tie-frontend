import React, { useState, useEffect } from 'react';
import tieLogo from '../../assets/logo.jpg';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Eye, EyeOff, ArrowLeft, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import authApi from '../../api/authApi';
import { validateEmail } from '../../utils/validation';

export const Login = () => {
  const { token: urlToken } = useParams();

  // Mode: 'login' | 'forgot' | 'reset'
  const [mode, setMode] = useState(urlToken ? 'reset' : 'login');

  // Login credentials (clean and dynamic)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [receivedResetToken, setReceivedResetToken] = useState('');

  // Reset Password state
  const [resetToken, setResetToken] = useState(urlToken || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (urlToken) {
      setResetToken(urlToken);
      setMode('reset');
    }
  }, [urlToken]);

  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Step 1: Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      showToast('Please enter your email and password', 'warning');
      return;
    }
    const emailErr = validateEmail(cleanEmail, { fieldName: 'Email' });
    if (emailErr) {
      showToast(emailErr, 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await login(cleanEmail, password);
      showToast(res?.message || 'Login successful', 'success');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Invalid email or password';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Forgot Password
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = forgotEmail.trim();
    if (!cleanEmail) {
      showToast('Please enter your registered email address', 'warning');
      return;
    }
    const emailErr = validateEmail(cleanEmail, { fieldName: 'Email' });
    if (emailErr) {
      showToast(emailErr, 'warning');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await authApi.forgotPassword(cleanEmail);
      const token = res?.resetToken || res?.data?.resetToken || res?.token;
      if (token) {
        setReceivedResetToken(token);
        setResetToken(token);
        showToast('Password reset token generated! Please enter your new password.', 'success');
      } else {
        showToast(res?.message || 'Password reset token sent to your email! Please enter the token and your new password.', 'success');
      }
      // Immediately proceed to the Reset Token & New Password page
      setMode('reset');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to send reset link';
      showToast(msg, 'error');
    } finally {
      setForgotLoading(false);
    }
  };

  // Step 6: Reset Password
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    const cleanToken = resetToken.trim();
    if (!cleanToken) {
      showToast('Please enter your reset security token', 'warning');
      return;
    }
    if (!newPassword) {
      showToast('Please enter your new password', 'warning');
      return;
    }
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters long', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match. Please verify your new password.', 'warning');
      return;
    }

    setResetLoading(true);
    try {
      const res = await authApi.resetPassword(cleanToken, newPassword);
      showToast(res?.message || 'Password set successfully! Please sign in with your new password.', 'success');
      setEmail(forgotEmail || email);
      setPassword('');
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
      setReceivedResetToken('');
      setMode('login');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to reset password. Please check your token.';
      showToast(msg, 'error');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
        padding: '24px 16px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div className="login-card">
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src={tieLogo}
            alt="TIE Corporation"
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              objectFit: 'cover',
              display: 'block',
              margin: '0 auto 12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            }}
          />
          <h1
            style={{
              fontSize: '1.4rem',
              fontWeight: 700,
              color: '#0f172a',
              margin: '0 0 4px',
            }}
          >
            TIE Corporation
          </h1>
          <p
            style={{
              fontSize: '0.86rem',
              color: '#64748b',
              margin: 0,
            }}
          >
            {mode === 'login' && 'Sign in to access your HRMS & ERP workspace'}
            {mode === 'forgot' && 'Reset your forgotten password'}
            {mode === 'reset' && 'Set a new secure password'}
          </p>
        </div>

        {/* MODE 1: LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label
                htmlFor="login-email"
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: '#334155',
                  marginBottom: 6,
                }}
              >
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  autoComplete="email"
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    fontSize: '0.9rem',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--primary, #2e7b85)')}
                  onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
                />
              </div>
            </div>

            <div style={{ marginBottom: 22 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <label
                  htmlFor="login-password"
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    color: '#334155',
                  }}
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: '0.8rem',
                    color: 'var(--primary, #2e7b85)',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    padding: '10px 42px 10px 38px',
                    fontSize: '0.9rem',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--primary, #2e7b85)')}
                  onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '0.925rem',
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: 'var(--primary, #2e7b85)',
                border: 'none',
                borderRadius: 8,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.75 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!loading) e.target.style.backgroundColor = 'var(--primary-hover, #256770)';
              }}
              onMouseLeave={(e) => {
                if (!loading) e.target.style.backgroundColor = 'var(--primary, #2e7b85)';
              }}
            >
              <ShieldCheck size={18} />
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* MODE 2: FORGOT PASSWORD */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label
                htmlFor="forgot-email"
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: '#334155',
                  marginBottom: 6,
                }}
              >
                Registered Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  autoComplete="email"
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    fontSize: '0.9rem',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--primary, #2e7b85)')}
                  onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={forgotLoading}
              style={{
                width: '100%',
                padding: '11px 16px',
                fontSize: '0.925rem',
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: 'var(--primary, #2e7b85)',
                border: 'none',
                borderRadius: 8,
                cursor: forgotLoading ? 'not-allowed' : 'pointer',
                opacity: forgotLoading ? 0.75 : 1,
                marginBottom: 14,
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!forgotLoading) e.target.style.backgroundColor = 'var(--primary-hover, #256770)';
              }}
              onMouseLeave={(e) => {
                if (!forgotLoading) e.target.style.backgroundColor = 'var(--primary, #2e7b85)';
              }}
            >
              {forgotLoading ? 'Sending Request...' : 'Send Reset Link / Token'}
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => setMode('reset')}
                style={{
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  color: 'var(--primary, #2e7b85)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'center',
                  padding: '4px',
                }}
              >
                Already have a reset token? Enter token &amp; reset password &rarr;
              </button>

              <button
                type="button"
                onClick={() => setMode('login')}
                style={{
                  width: '100%',
                  padding: '9px 16px',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: '#64748b',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <ArrowLeft size={16} />
                <span>Back to login</span>
              </button>
            </div>
          </form>
        )}

        {/* MODE 3: RESET PASSWORD */}
        {mode === 'reset' && (
          <form onSubmit={handleResetSubmit}>
            {forgotEmail && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '10px 12px',
                  borderRadius: 8,
                  backgroundColor: 'var(--primary-light, #f0f7f8)',
                  border: '1px solid var(--primary-border, #bce1e6)',
                  fontSize: '0.82rem',
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Mail size={16} color="var(--primary, #2e7b85)" style={{ flexShrink: 0 }} />
                <span>Reset token sent for <strong>{forgotEmail}</strong></span>
              </div>
            )}

            {/* 1. RESET TOKEN */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label
                  htmlFor="reset-token"
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    color: '#334155',
                  }}
                >
                  Security Reset Token *
                </label>
                {resetToken && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--primary, #2e7b85)', fontWeight: 600 }}>
                    Token Ready
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <KeyRound
                  size={16}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  id="reset-token"
                  type="text"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Paste or enter your reset token"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    fontSize: '0.85rem',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--primary, #2e7b85)')}
                  onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
                />
              </div>
            </div>

            {/* 2. NEW PASSWORD */}
            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="reset-new-password"
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: '#334155',
                  marginBottom: 6,
                }}
              >
                New Password * (minimum 6 characters)
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  id="reset-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 42px 10px 38px',
                    fontSize: '0.9rem',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--primary, #2e7b85)')}
                  onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* 3. CONFIRM NEW PASSWORD */}
            <div style={{ marginBottom: 22 }}>
              <label
                htmlFor="reset-confirm-password"
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: '#334155',
                  marginBottom: 6,
                }}
              >
                Confirm New Password *
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  id="reset-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 42px 10px 38px',
                    fontSize: '0.9rem',
                    borderRadius: 8,
                    border: `1px solid ${confirmPassword && confirmPassword !== newPassword ? '#dc2626' : '#cbd5e1'}`,
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--primary, #2e7b85)')}
                  onBlur={(e) => (e.target.style.borderColor = confirmPassword && confirmPassword !== newPassword ? '#dc2626' : '#cbd5e1')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPassword && confirmPassword !== newPassword && (
                <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: 4 }}>
                  Passwords do not match
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={resetLoading}
              style={{
                width: '100%',
                padding: '11px 16px',
                fontSize: '0.925rem',
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: 'var(--primary, #2e7b85)',
                border: 'none',
                borderRadius: 8,
                cursor: resetLoading ? 'not-allowed' : 'pointer',
                opacity: resetLoading ? 0.75 : 1,
                marginBottom: 14,
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!resetLoading) e.target.style.backgroundColor = 'var(--primary-hover, #256770)';
              }}
              onMouseLeave={(e) => {
                if (!resetLoading) e.target.style.backgroundColor = 'var(--primary, #2e7b85)';
              }}
            >
              {resetLoading ? 'Updating Password...' : 'Set New Password & Sign In'}
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => setMode('forgot')}
                style={{
                  fontSize: '0.84rem',
                  fontWeight: 500,
                  color: 'var(--primary, #2e7b85)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'center',
                  padding: '4px',
                }}
              >
                Didn&apos;t receive token? Request another token
              </button>

              <button
                type="button"
                onClick={() => setMode('login')}
                style={{
                  width: '100%',
                  padding: '9px 16px',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: '#64748b',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <ArrowLeft size={16} />
                <span>Back to login</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
