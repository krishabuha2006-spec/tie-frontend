import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import tieLogo from '../../assets/logo.jpg';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowLeft,
  ArrowRight,
  KeyRound,
  Building2,
  MapPin,
  ShieldCheck,
  AlertCircle,
  UserCheck,
  ChevronDown,
  Check,
} from 'lucide-react';
import authApi from '../../api/authApi';
import masterApi from '../../api/masterApi';
import { validateEmail } from '../../utils/validation';
import { extractApiData } from '../../utils/apiUtils';

/**
 * Modern, professional custom dropdown for Company and Branch selection
 */
const WorkspaceDropdown = ({
  label,
  icon: Icon,
  options = [],
  selectedId,
  onSelect,
  placeholder = 'Select...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedItem =
    options.find((opt) => String(opt.id || opt._id) === String(selectedId)) ||
    (options.length > 0 ? options[0] : null);

  const filteredOptions = search.trim()
    ? options.filter(
        (opt) =>
          (opt.name || '').toLowerCase().includes(search.toLowerCase()) ||
          (opt.code || '').toLowerCase().includes(search.toLowerCase())
      )
    : options;

  return (
    <div style={{ marginBottom: 18 }} ref={dropdownRef}>
      <label
        style={{
          display: 'block',
          fontSize: '0.82rem',
          fontWeight: 600,
          color: '#334155',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            setSearch('');
          }}
          style={{
            width: '100%',
            height: 44,
            padding: '8px 12px 8px 38px',
            fontSize: '0.88rem',
            borderRadius: 10,
            border: isOpen ? '1.5px solid var(--primary, #2e7b85)' : '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            boxShadow: isOpen ? '0 0 0 3px rgba(46, 123, 133, 0.12)' : 'none',
            color: '#0f172a',
            outline: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            textAlign: 'left',
          }}
        >
          {Icon && (
            <Icon
              size={17}
              color={isOpen ? 'var(--primary, #2e7b85)' : '#64748b'}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, paddingRight: 6 }}>
            {selectedItem ? (
              <>
                <span
                  style={{
                    fontWeight: 600,
                    color: '#0f172a',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: '0.86rem',
                  }}
                >
                  {selectedItem.name}
                </span>
                {selectedItem.code && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      backgroundColor: 'rgba(46, 123, 133, 0.08)',
                      color: 'var(--primary, #2e7b85)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  >
                    {selectedItem.code}
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: '#94a3b8' }}>{placeholder}</span>
            )}
          </div>

          <ChevronDown
            size={16}
            color="#64748b"
            style={{
              flexShrink: 0,
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>

        {/* Floating Custom Menu */}
        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              zIndex: 60,
              backgroundColor: '#ffffff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.12), 0 6px 12px -3px rgba(0, 0, 0, 0.06)',
              maxHeight: 240,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            {/* Search filter if more than 5 options */}
            {options.length > 5 && (
              <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type to filter..."
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}

            <div style={{ maxHeight: 200, overflowY: 'auto', padding: '5px' }}>
              {filteredOptions.map((opt) => {
                const optId = String(opt.id || opt._id);
                const isSelected = String(selectedItem?.id || selectedItem?._id) === optId;
                return (
                  <div
                    key={optId}
                    onClick={() => {
                      onSelect(optId);
                      setIsOpen(false);
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 7,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      backgroundColor: isSelected ? 'rgba(46, 123, 133, 0.09)' : 'transparent',
                      color: isSelected ? 'var(--primary, #2e7b85)' : '#1e293b',
                      fontWeight: isSelected ? 600 : 400,
                      fontSize: '0.84rem',
                      marginBottom: 2,
                      transition: 'background-color 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {opt.name}
                      </span>
                      {opt.code && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 500,
                            backgroundColor: isSelected ? 'rgba(46, 123, 133, 0.15)' : '#f1f5f9',
                            color: isSelected ? 'var(--primary, #2e7b85)' : '#64748b',
                            padding: '1px 5px',
                            borderRadius: 4,
                            flexShrink: 0,
                          }}
                        >
                          {opt.code}
                        </span>
                      )}
                      {opt.company?.name && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            color: '#94a3b8',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ({opt.company.name})
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Check size={15} color="var(--primary, #2e7b85)" style={{ flexShrink: 0 }} />
                    )}
                  </div>
                );
              })}
              {filteredOptions.length === 0 && (
                <div style={{ padding: '14px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                  No matching options found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const Login = () => {
  const { token: urlToken } = useParams();
  const navigate = useNavigate();
  const { login, selectCompany, selectBranch, logout } = useAuth();
  const { showToast } = useToast();

  // Mode: 'login' (Step 1) | 'select-workspace' (Step 2) | 'forgot' | 'reset'
  const [mode, setMode] = useState(urlToken ? 'reset' : 'login');

  // Step 1: Credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Step 2: Company & Branch Selection
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [companyList, setCompanyList] = useState([]);
  const [branchList, setBranchList] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [confirmingWorkspace, setConfirmingWorkspace] = useState(false);

  // Forgot / Reset Password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetToken, setResetToken] = useState(urlToken || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (urlToken) {
      setResetToken(urlToken);
      setMode('reset');
    }
  }, [urlToken]);

  // Listen for concurrent device login or session expiration
  useEffect(() => {
    try {
      const storedNotice = sessionStorage.getItem('tie_session_expired_notice');
      const searchParams = new URLSearchParams(window.location.search);
      if (storedNotice || searchParams.get('expired')) {
        const noticeMsg = storedNotice || 'You were logged out because this account was logged in from another device.';
        setErrorMessage(noticeMsg);
        sessionStorage.removeItem('tie_session_expired_notice');
      }
    } catch {}

    const handleSessionExpired = (e) => {
      const msg = e.detail?.message || 'You were logged in from another device.';
      setErrorMessage(msg);
    };
    window.addEventListener('tie:session-expired', handleSessionExpired);
    return () => window.removeEventListener('tie:session-expired', handleSessionExpired);
  }, []);

  // Ensure all companies and branches are loaded whenever entering workspace selection
  useEffect(() => {
    if (mode === 'select-workspace') {
      const loadWorkspaceData = async () => {
        try {
          const [compRes, branchRes] = await Promise.allSettled([
            masterApi.getCompanies(),
            masterApi.getBranches(),
          ]);
          if (compRes.status === 'fulfilled') {
            const fetchedComps = extractApiData(compRes.value, 'companies', 'data') || (Array.isArray(compRes.value) ? compRes.value : []);
            if (Array.isArray(fetchedComps) && fetchedComps.length > 0) {
              setCompanyList((prev) => {
                const map = new Map();
                fetchedComps.forEach((c) => map.set(String(c._id || c.id), c));
                prev.forEach((c) => {
                  const id = String(c._id || c.id);
                  if (!map.has(id)) map.set(id, c);
                });
                return Array.from(map.values());
              });
            }
          }
          if (branchRes.status === 'fulfilled') {
            const fetchedBranches = extractApiData(branchRes.value, 'branches', 'data') || (Array.isArray(branchRes.value) ? branchRes.value : []);
            if (Array.isArray(fetchedBranches) && fetchedBranches.length > 0) {
              setBranchList((prev) => {
                const map = new Map();
                fetchedBranches.forEach((b) => map.set(String(b._id || b.id), b));
                prev.forEach((b) => {
                  const id = String(b._id || b.id);
                  if (!map.has(id)) map.set(id, b);
                });
                return Array.from(map.values());
              });
            }
          }
        } catch (e) {
          console.warn('Error loading workspace data:', e);
        }
      };
      loadWorkspaceData();
    }
  }, [mode]);

  // STEP 1: Submit Credentials -> POST /auth/login (200 OK) -> Load Companies & Branches
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both email address and password');
      showToast('Please enter your email and password', 'warning');
      return;
    }

    const emailErr = validateEmail(cleanEmail, { fieldName: 'Email' });
    if (emailErr) {
      setErrorMessage(emailErr);
      showToast(emailErr, 'warning');
      return;
    }

    setLoading(true);
    try {
      // 1. Authenticate user credentials -> POST /auth/login
      const res = await login(cleanEmail, password);
      const user = res?.data?.user || res?.user;
      setAuthenticatedUser(user);

      // 2. Fetch all system companies and branches for the organization
      let companies = res?.data?.accessibleCompanies || res?.accessibleCompanies || [];
      let branches = [];

      try {
        const [compRes, branchRes] = await Promise.allSettled([
          masterApi.getCompanies(),
          masterApi.getBranches(),
        ]);

        if (compRes.status === 'fulfilled') {
          const fetchedComps = extractApiData(compRes.value, 'companies', 'data') || (Array.isArray(compRes.value) ? compRes.value : []);
          if (Array.isArray(fetchedComps) && fetchedComps.length > 0) {
            const map = new Map();
            fetchedComps.forEach((c) => map.set(String(c._id || c.id), c));
            companies.forEach((c) => {
              const id = String(c._id || c.id);
              if (!map.has(id)) map.set(id, c);
            });
            companies = Array.from(map.values());
          }
        }

        if (branchRes.status === 'fulfilled') {
          const fetchedBranches = extractApiData(branchRes.value, 'branches', 'data') || (Array.isArray(branchRes.value) ? branchRes.value : []);
          if (Array.isArray(fetchedBranches) && fetchedBranches.length > 0) {
            branches = fetchedBranches;
          }
        }
      } catch (err) {
        console.warn('Workspace data fetch note:', err?.message);
      }

      if (companies.length === 0 && user?.company) {
        companies = [user.company];
      }
      if (branches.length === 0 && user?.branch) {
        branches = [user.branch];
      }

      setCompanyList(companies);
      setBranchList(branches);

      // Pre-select user's default company or first available
      const initialCompId =
        user?.company?._id || user?.company?.id || (typeof user?.company === 'string' ? user?.company : '') ||
        companies[0]?._id || companies[0]?.id || '';
      setSelectedCompanyId(String(initialCompId));

      // Pre-select user's default branch or first available
      const initialBranchId =
        user?.branch?._id || user?.branch?.id || (typeof user?.branch === 'string' ? user?.branch : '') ||
        branches[0]?._id || branches[0]?.id || '';
      setSelectedBranchId(String(initialBranchId));

      // Proceed to Step 2: Select Company & Branch
      setMode('select-workspace');
      showToast('Credentials verified! Please select your company & branch.', 'success');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Invalid email or password';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Confirm Selected Company & Branch -> Proceed to Dashboard
  const handleWorkspaceConfirm = async (e) => {
    e.preventDefault();
    if (!selectedCompanyId) {
      showToast('Please select a company workspace', 'warning');
      return;
    }

    setConfirmingWorkspace(true);
    try {
      // 1. Activate selected company in context & storage
      await selectCompany(selectedCompanyId);

      // 2. Activate selected branch in context & storage
      if (selectedBranchId) {
        selectBranch(selectedBranchId);
      }

      showToast(`Welcome, ${authenticatedUser?.name || 'User'}!`, 'success');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Workspace confirmation error:', err);
      // Fallback: Ensure user still navigates even if branch/company sync had minor warning
      navigate('/dashboard', { replace: true });
    } finally {
      setConfirmingWorkspace(false);
    }
  };

  // Switch back to Step 1
  const handleSwitchAccount = () => {
    if (logout) logout().catch(() => {});
    setAuthenticatedUser(null);
    setMode('login');
    setErrorMessage('');
  };

  // Show all system branches for super admin / director, but lock to assigned branch for branch users
  const isSuperAdminUser = Boolean(
    authenticatedUser?.isSuperAdmin ||
    authenticatedUser?.role?.isSuperAdmin ||
    (Array.isArray(authenticatedUser?.roles) && authenticatedUser.roles.some((r) => r?.isSuperAdmin)) ||
    /(super_admin|director)/i.test(String(authenticatedUser?.role?.name || authenticatedUser?.role || ''))
  );

  const branchesToDisplay = useMemo(() => {
    if (isSuperAdminUser) return branchList;
    if (authenticatedUser?.branch) {
      const uBId = authenticatedUser.branch._id || authenticatedUser.branch.id || (typeof authenticatedUser.branch === 'string' ? authenticatedUser.branch : '');
      const matched = branchList.filter((b) => String(b._id || b.id) === String(uBId));
      if (matched.length > 0) return matched;
      return typeof authenticatedUser.branch === 'object' ? [authenticatedUser.branch] : branchList;
    }
    return branchList;
  }, [branchList, authenticatedUser, isSuperAdminUser]);

  // Forgot Password Submit
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
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
      if (token) setResetToken(token);
      showToast(res?.message || 'Password reset token generated! Please check your email.', 'success');
      setMode('reset');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to send reset link';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setForgotLoading(false);
    }
  };

  // Reset Password Submit
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    const cleanToken = resetToken.trim();
    if (!cleanToken) {
      showToast('Please enter your reset security token', 'warning');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      showToast('New password must be at least 6 characters long', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'warning');
      return;
    }

    setResetLoading(true);
    try {
      const res = await authApi.resetPassword(cleanToken, newPassword);
      showToast(res?.message || 'Password reset successfully! Please sign in.', 'success');
      setEmail(forgotEmail || email);
      setPassword('');
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
      setMode('login');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to reset password';
      setErrorMessage(msg);
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
        fontFamily: 'var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: '#ffffff',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
          padding: '36px 30px',
          boxSizing: 'border-box',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
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
              fontSize: '1.35rem',
              fontWeight: 700,
              color: '#0f172a',
              margin: '0 0 4px',
              letterSpacing: '-0.01em',
            }}
          >
            TIE Corporation
          </h1>
          <p
            style={{
              fontSize: '0.84rem',
              color: '#64748b',
              margin: 0,
            }}
          >
            {mode === 'login' && 'Sign in to access your HRMS & ERP workspace'}
            {mode === 'select-workspace' && 'Select your active company & branch'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'reset' && 'Create your new password'}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 8,
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '0.82rem',
              marginBottom: 16,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ─── STEP 1: EMAIL & PASSWORD ─── */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit}>
            {/* Email Field */}
            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="login-email"
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
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
                  style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }}
                />
                <input
                  id="login-email"
                  className="login-input-with-icon"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Enter your email"
                  required
                  autoComplete="email"
                  style={{
                    width: '100%',
                    padding: '11px 14px 11px 42px',
                    fontSize: '0.88rem',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--primary, #2e7b85)')}
                  onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
                />
              </div>
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: 20 }}>
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
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#334155',
                  }}
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    setMode('forgot');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: '0.78rem',
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
                  style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }}
                />
                <input
                  id="login-password"
                  className="login-input-with-icon"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    padding: '11px 44px 11px 42px',
                    fontSize: '0.88rem',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease',
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
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '11px 16px',
                fontSize: '0.92rem',
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
                transition: 'background-color 0.15s ease',
              }}
            >
              <ShieldCheck size={18} />
              {loading ? 'Verifying...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* ─── STEP 2: COMPANY & BRANCH SELECTION ─── */}
        {mode === 'select-workspace' && (
          <form onSubmit={handleWorkspaceConfirm}>
            {/* User Info Chip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                backgroundColor: 'rgba(46, 123, 133, 0.08)',
                border: '1px solid rgba(46, 123, 133, 0.2)',
                marginBottom: 18,
              }}
            >
              <UserCheck size={16} color="var(--primary, #2e7b85)" />
              <div style={{ fontSize: '0.8rem', color: '#0f172a' }}>
                Signed in as <strong>{authenticatedUser?.name || email}</strong>
                {authenticatedUser?.role?.displayName && (
                  <span style={{ color: '#64748b', marginLeft: 4 }}>({authenticatedUser.role.displayName})</span>
                )}
              </div>
            </div>

            {/* Custom Select Company Dropdown */}
            <WorkspaceDropdown
              label="Select Company Workspace *"
              icon={Building2}
              options={companyList}
              selectedId={selectedCompanyId}
              onSelect={(id) => setSelectedCompanyId(id)}
              placeholder="Select Company Workspace"
            />

            {/* Custom Select Branch Dropdown */}
            <WorkspaceDropdown
              label="Select Branch Location *"
              icon={MapPin}
              options={branchesToDisplay}
              selectedId={selectedBranchId}
              onSelect={(id) => {
                setSelectedBranchId(id);
                // Auto-sync company if this branch has an assigned company
                const branchObj = branchList.find((b) => String(b._id || b.id) === String(id));
                const bCompId = branchObj?.company?._id || branchObj?.company?.id || branchObj?.company;
                if (bCompId && String(bCompId) !== String(selectedCompanyId)) {
                  setSelectedCompanyId(String(bCompId));
                }
              }}
              placeholder="Select Branch Location"
            />

            {/* Confirm Button */}
            <button
              type="submit"
              disabled={confirmingWorkspace}
              style={{
                width: '100%',
                padding: '11px 16px',
                fontSize: '0.92rem',
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: 'var(--primary, #2e7b85)',
                border: 'none',
                borderRadius: 8,
                cursor: confirmingWorkspace ? 'not-allowed' : 'pointer',
                opacity: confirmingWorkspace ? 0.75 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <span>{confirmingWorkspace ? 'Entering Workspace...' : 'Proceed to Dashboard'}</span>
              <ArrowRight size={16} />
            </button>

            {/* Switch Account Link */}
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={handleSwitchAccount}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '0.8rem',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: 4,
                }}
              >
                <ArrowLeft size={13} />
                <span>Sign in with a different account</span>
              </button>
            </div>
          </form>
        )}

        {/* ─── FORGOT PASSWORD MODE ─── */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label
                htmlFor="forgot-email"
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
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
                  style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }}
                />
                <input
                  id="forgot-email"
                  className="login-input-with-icon"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  autoComplete="email"
                  style={{
                    width: '100%',
                    padding: '11px 14px 11px 42px',
                    fontSize: '0.88rem',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={forgotLoading}
              style={{
                width: '100%',
                padding: '11px 16px',
                fontSize: '0.9rem',
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: 'var(--primary, #2e7b85)',
                border: 'none',
                borderRadius: 8,
                cursor: forgotLoading ? 'not-allowed' : 'pointer',
                marginBottom: 14,
              }}
            >
              {forgotLoading ? 'Sending Token...' : 'Send Reset Token'}
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setMode('reset')}
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--primary, #2e7b85)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Already have a reset token? Enter token &rarr;
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                style={{
                  fontSize: '0.82rem',
                  color: '#64748b',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                }}
              >
                <ArrowLeft size={14} /> Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* ─── RESET PASSWORD MODE ─── */}
        {mode === 'reset' && (
          <form onSubmit={handleResetSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label
                htmlFor="reset-token"
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: 6,
                }}
              >
                Security Reset Token
              </label>
              <div style={{ position: 'relative' }}>
                <KeyRound
                  size={16}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }}
                />
                <input
                  id="reset-token"
                  className="login-input-with-icon"
                  type="text"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Paste your reset token"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 14px 11px 42px',
                    fontSize: '0.85rem',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label
                htmlFor="reset-new-password"
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: 6,
                }}
              >
                New Password (minimum 6 characters)
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }}
                />
                <input
                  id="reset-new-password"
                  className="login-input-with-icon"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 44px 11px 42px',
                    fontSize: '0.88rem',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
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
                  }}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label
                htmlFor="reset-confirm-password"
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: 6,
                }}
              >
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }}
                />
                <input
                  id="reset-confirm-password"
                  className="login-input-with-icon"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 14px 11px 42px',
                    fontSize: '0.88rem',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={resetLoading}
              style={{
                width: '100%',
                padding: '11px 16px',
                fontSize: '0.9rem',
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: 'var(--primary, #2e7b85)',
                border: 'none',
                borderRadius: 8,
                cursor: resetLoading ? 'not-allowed' : 'pointer',
                marginBottom: 14,
              }}
            >
              {resetLoading ? 'Updating Password...' : 'Save Password & Sign In'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setMode('login')}
                style={{
                  fontSize: '0.82rem',
                  color: '#64748b',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <ArrowLeft size={14} /> Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
