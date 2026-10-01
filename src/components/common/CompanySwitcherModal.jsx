import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import Badge from './Badge';
import Input from './Input';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import masterApi from '../../api/masterApi';
import { extractApiData } from '../../utils/apiUtils';
import { Building2, CheckCircle2, Search, ArrowRight, RefreshCw } from 'lucide-react';

export const CompanySwitcherModal = ({ isOpen, onClose }) => {
  const { user, company, selectCompany, accessibleCompanies = [], isSuperAdmin, isDirector } = useAuth();
  const { showToast } = useToast();

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [switchingId, setSwitchingId] = useState(null);
  const [search, setSearch] = useState('');

  const loadCompanies = async () => {
    setLoading(true);
    try {
      let list = [];
      // If user has accessibleCompanies from login, start with them
      if (Array.isArray(accessibleCompanies) && accessibleCompanies.length > 0) {
        list = [...accessibleCompanies];
      }

      // Fetch full list of companies from backend /companies
      try {
        const res = await masterApi.getCompanies();
        const apiList = extractApiData(res, 'companies', 'data');
        if (Array.isArray(apiList) && apiList.length > 0) {
          // Merge avoiding duplicates
          const seen = new Set(list.map((c) => String(c._id || c.id)));
          for (const c of apiList) {
            const cid = String(c._id || c.id);
            if (!seen.has(cid)) {
              seen.add(cid);
              list.push(c);
            }
          }
        }
      } catch (err) {
        console.warn('Companies fetch note:', err?.message);
      }

      // If list is still empty, include current user's company
      if (list.length === 0 && company) {
        list = [company];
      }

      setCompanies(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCompanies();
    }
  }, [isOpen]);

  const currentCompanyId = company?._id || (typeof company === 'string' ? company : '');

  const handleSelect = async (targetCompany) => {
    const targetId = targetCompany._id || targetCompany.id;
    if (!targetId || targetId === currentCompanyId) {
      onClose();
      return;
    }

    setSwitchingId(targetId);
    try {
      const res = await selectCompany(targetId);
      showToast(
        res?.message || `Active company switched to ${targetCompany.name || 'selected company'}`,
        'success'
      );
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to switch company';
      showToast(msg, 'error');
    } finally {
      setSwitchingId(null);
    }
  };

  const filteredCompanies = companies.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.code?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Switch Active Company Session">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          Select a corporate workspace to switch your active session context via backend{' '}
          <code style={{ fontSize: '0.78rem', backgroundColor: 'var(--bg-subtle, #f1f5f9)', padding: '2px 5px', borderRadius: 4 }}>
            POST /auth/select-company
          </code>
          . All scoped data and JWT tokens will immediately update.
        </p>

        {/* Search Bar */}
        <div style={{ position: 'relative' }}>
          <Input
            placeholder="Search companies by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34, height: 36, fontSize: '0.85rem' }}
          />
          <Search
            size={15}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}
          />
        </div>

        {/* Company List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <RefreshCw size={20} className="spin" style={{ marginBottom: 6 }} />
              <div>Loading companies from backend...</div>
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No matching companies found.
            </div>
          ) : (
            filteredCompanies.map((c) => {
              const cId = c._id || c.id;
              const isActive = cId === currentCompanyId;
              const isSwitchingThis = switchingId === cId;

              return (
                <div
                  key={cId}
                  onClick={() => !isSwitchingThis && handleSelect(c)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: isActive
                      ? '2px solid var(--primary, #3f929a)'
                      : '1px solid var(--border)',
                    backgroundColor: isActive
                      ? 'rgba(63, 146, 154, 0.08)'
                      : 'var(--card-bg, #ffffff)',
                    cursor: isSwitchingThis ? 'wait' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.borderColor = 'var(--primary, #3f929a)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        backgroundColor: isActive ? 'var(--primary, #3f929a)' : 'var(--bg-subtle, #f1f5f9)',
                        color: isActive ? '#ffffff' : 'var(--text-main)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Building2 size={20} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                          {c.name || 'Untitled Company'}
                        </span>
                        {isActive && <Badge variant="success">Current Active</Badge>}
                        {c.code && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ({c.code})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {c.email || c.phone || (c.address?.city ? `${c.address.city}, ${c.address.state || ''}` : 'Corporate Workspace')}
                      </div>
                    </div>
                  </div>

                  <div>
                    {isSwitchingThis ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <RefreshCw size={14} className="spin" />
                        Switching...
                      </span>
                    ) : isActive ? (
                      <CheckCircle2 size={20} color="var(--primary, #3f929a)" />
                    ) : (
                      <Button variant="secondary" size="sm" icon={ArrowRight}>
                        Select
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ margin: '8px -20px -20px', display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CompanySwitcherModal;
