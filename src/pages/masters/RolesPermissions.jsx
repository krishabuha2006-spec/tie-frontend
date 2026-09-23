import React, { useState, useEffect, useCallback, useMemo } from 'react';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  ShieldCheck,
  Plus,
  Save,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  Check,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { mastersNav } from '../../routes/moduleNavConfig';

// Standard 12 granular actions conforming to Backend PermissionActionsSchema
const ALL_ACTIONS = [
  'view', 'create', 'edit', 'delete', 'approve', 'reject',
  'export', 'print', 'download', 'uploadDocuments', 'assignTasks', 'viewReports'
];

const createActionsObject = (granted = true) => {
  const actions = {};
  ALL_ACTIONS.forEach((act) => {
    actions[act] = Boolean(granted);
  });
  return actions;
};

// Exactly 10 Core Modules - Balanced into 2 rows of 5 with backend submodules
const CORE_MODULES = [
  { key: 'employees', backendKey: 'hrmEmployees', submodules: ['hrmEmployees.directory', 'hrmEmployees.onboarding', 'hrmEmployees.documents', 'hrmEmployees.status'], label: 'Employees' },
  { key: 'attendance', backendKey: 'attendance', submodules: ['attendance.daily', 'attendance.field', 'attendance.biometric', 'attendance.shifts'], label: 'Attendance' },
  { key: 'recruitment', backendKey: 'recruitment', submodules: ['recruitment.jobOpenings', 'recruitment.candidates', 'recruitment.pipeline'], label: 'Recruitment' },
  { key: 'payroll', backendKey: 'payroll', submodules: ['payroll.salaryStructure', 'payroll.payRuns', 'payroll.payslips'], label: 'Payroll' },
  { key: 'leaves', backendKey: 'leaves', submodules: ['leaves.requests', 'leaves.balances', 'leaves.types'], label: 'Leaves' },
  { key: 'projects', backendKey: 'operations', submodules: ['operations.projects', 'operations.tasks', 'operations.milestones'], label: 'Projects & Tasks' },
  { key: 'assets', backendKey: 'assetsClaims', submodules: ['assetsClaims.assets', 'assetsClaims.claims', 'assetsClaims.loans'], label: 'Assets & Loans' },
  { key: 'performance', backendKey: 'performance', submodules: ['performance.appraisals', 'performance.goals', 'performance.reviews'], label: 'Performance' },
  { key: 'masters', backendKey: 'masters', submodules: ['masters.branches', 'masters.departments', 'masters.designations', 'masters.roles'], label: 'Settings' },
  { key: 'reports', backendKey: 'reports', submodules: ['reports.attendance', 'reports.payroll', 'reports.employees'], label: 'Reports' },
];

// Check if role has access to a module
function checkModuleAccess(role, permissionsMap, modKey, backendKey) {
  if (!role) return false;
  if (role.isSuperAdmin || role.name === 'super_admin') return true;

  const perms = permissionsMap || role.permissions;
  if (!perms || typeof perms !== 'object') return false;

  // Direct boolean
  if (perms[modKey] === true || perms[backendKey] === true) return true;

  // Action object with at least one active action
  const obj1 = perms[modKey];
  const obj2 = perms[backendKey];
  if (obj1 && typeof obj1 === 'object' && Object.values(obj1).some(Boolean)) return true;
  if (obj2 && typeof obj2 === 'object' && Object.values(obj2).some(Boolean)) return true;

  // Fuzzy match
  const k1 = modKey.toLowerCase();
  const k2 = backendKey.toLowerCase();
  for (const [k, val] of Object.entries(perms)) {
    const lower = k.toLowerCase();
    if (lower.includes(k1) || lower.includes(k2)) {
      if (val === true) return true;
      if (typeof val === 'object' && val !== null && Object.values(val).some(Boolean)) return true;
    }
  }

  return false;
}

export const RolesPermissions = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Pending changes map: roleId -> permissions object
  const [pendingChanges, setPendingChanges] = useState({});
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);

  // Create / Edit Role Modal
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', displayName: '', description: '' });
  const [submittingRole, setSubmittingRole] = useState(false);

  // Delete Confirm Dialog
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [deletingRole, setDeletingRole] = useState(false);

  const { showToast } = useToast();
  const { fetchUserProfile, refreshRoles } = useAuth();

  // Load roles directly from backend
  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await masterApi.getRoles();
      const list = res?.data || res?.roles || (Array.isArray(res) ? res : []);
      setRoles(list);
      setPendingChanges({});
    } catch (err) {
      console.error(err);
      showToast('Failed to load roles from server', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // Get effective permissions
  const getRolePerms = useCallback(
    (role) => {
      if (pendingChanges[role._id]) {
        return pendingChanges[role._id];
      }
      return role.permissions || {};
    },
    [pendingChanges]
  );

  // Toggle module access for a role
  const handleToggleModule = (role, mod) => {
    if (role.isSuperAdmin || role.name === 'super_admin') return;

    const currentPerms = { ...getRolePerms(role) };
    const hasAccess = checkModuleAccess(role, currentPerms, mod.key, mod.backendKey);

    const updatedPerms = { ...currentPerms };
    const allActions = createActionsObject(true);
    const zeroActions = createActionsObject(false);

    if (hasAccess) {
      delete updatedPerms[mod.key];
      delete updatedPerms[mod.backendKey];
      Object.keys(updatedPerms).forEach((k) => {
        if (k.startsWith(mod.key) || k.startsWith(mod.backendKey)) {
          delete updatedPerms[k];
        }
      });
      // Store complete object with all false flags (never bare boolean false)
      updatedPerms[mod.key] = zeroActions;
      updatedPerms[mod.backendKey] = zeroActions;
      if (mod.submodules) {
        mod.submodules.forEach((sub) => {
          updatedPerms[sub] = zeroActions;
        });
      }
    } else {
      updatedPerms[mod.key] = allActions;
      updatedPerms[mod.backendKey] = allActions;
      if (mod.submodules) {
        mod.submodules.forEach((sub) => {
          updatedPerms[sub] = allActions;
        });
      }
    }

    setPendingChanges((prev) => ({
      ...prev,
      [role._id]: updatedPerms,
    }));
  };

  // Select all modules for a role
  const handleSelectAll = (role) => {
    if (role.isSuperAdmin || role.name === 'super_admin') return;
    const updatedPerms = { ...getRolePerms(role) };
    const allActions = createActionsObject(true);

    CORE_MODULES.forEach((mod) => {
      updatedPerms[mod.key] = allActions;
      updatedPerms[mod.backendKey] = allActions;
      if (mod.submodules) {
        mod.submodules.forEach((sub) => {
          updatedPerms[sub] = allActions;
        });
      }
    });

    setPendingChanges((prev) => ({
      ...prev,
      [role._id]: updatedPerms,
    }));
  };

  // Clear all modules for a role
  const handleClearAll = (role) => {
    if (role.isSuperAdmin || role.name === 'super_admin') return;
    const updatedPerms = {};
    const zeroActions = createActionsObject(false);

    CORE_MODULES.forEach((mod) => {
      updatedPerms[mod.key] = zeroActions;
      updatedPerms[mod.backendKey] = zeroActions;
      if (mod.submodules) {
        mod.submodules.forEach((sub) => {
          updatedPerms[sub] = zeroActions;
        });
      }
    });

    setPendingChanges((prev) => ({
      ...prev,
      [role._id]: updatedPerms,
    }));
  };

  // Save changes for one role
  const handleSaveRole = async (roleId) => {
    const role = roles.find((r) => r._id === roleId);
    if (!role) return;

    if (role.isSuperAdmin || role.name === 'super_admin') {
      showToast('Super Admin has full access to all features', 'info');
      return;
    }

    const permsToSave = pendingChanges[roleId] || role.permissions || {};
    setSavingRoleId(roleId);

    try {
      await masterApi.updateRolePermissions(roleId, permsToSave);

      setRoles((prev) =>
        prev.map((r) => (r._id === roleId ? { ...r, permissions: permsToSave } : r))
      );

      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[roleId];
        return next;
      });

      showToast(`Permissions saved for ${role.displayName || role.name}!`, 'success');

      if (refreshRoles) await refreshRoles();
      if (fetchUserProfile) await fetchUserProfile();
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.message || 'Failed to save permissions', 'error');
    } finally {
      setSavingRoleId(null);
    }
  };

  // Save all roles with pending changes
  const handleSaveAll = async () => {
    const roleIdsWithChanges = Object.keys(pendingChanges);
    if (roleIdsWithChanges.length === 0) {
      showToast('No changes to save', 'info');
      return;
    }

    setSavingAll(true);
    try {
      for (const rId of roleIdsWithChanges) {
        const role = roles.find((r) => r._id === rId);
        if (role) {
          const perms = pendingChanges[rId];
          await masterApi.updateRolePermissions(rId, perms);
        }
      }

      showToast('All role permissions updated successfully!', 'success');
      await loadRoles();
      if (refreshRoles) await refreshRoles();
      if (fetchUserProfile) await fetchUserProfile();
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.message || 'Failed to save some permissions', 'error');
    } finally {
      setSavingAll(false);
    }
  };

  // Save new or edited role metadata
  const handleSaveRoleMetadata = async (e) => {
    e.preventDefault();
    if (!roleForm.name.trim()) {
      showToast('Role code is required', 'error');
      return;
    }

    setSubmittingRole(true);
    const slug = roleForm.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const payload = {
      name: slug,
      displayName: roleForm.displayName.trim() || roleForm.name.trim(),
      description: roleForm.description.trim(),
    };

    try {
      if (editingRole) {
        await masterApi.updateRole(editingRole._id, payload);
        showToast('Role updated successfully', 'success');
      } else {
        await masterApi.createRole({ ...payload, permissions: {} });
        showToast('New role created! Tick the checkboxes to grant permissions.', 'success');
      }
      setRoleModalOpen(false);
      await loadRoles();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save role', 'error');
    } finally {
      setSubmittingRole(false);
    }
  };

  // Delete custom role
  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    setDeletingRole(true);
    try {
      await masterApi.deleteRole(roleToDelete._id);
      showToast(`Role "${roleToDelete.displayName || roleToDelete.name}" deleted`, 'success');
      setDeleteModalOpen(false);
      setRoleToDelete(null);
      await loadRoles();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to delete role', 'error');
    } finally {
      setDeletingRole(false);
    }
  };

  // Filtered roles based on search
  const filteredRoles = useMemo(() => {
    if (!search.trim()) return roles;
    const s = search.toLowerCase();
    return roles.filter(
      (r) =>
        r.name?.toLowerCase().includes(s) ||
        r.displayName?.toLowerCase().includes(s) ||
        r.description?.toLowerCase().includes(s)
    );
  }, [roles, search]);

  const pendingCount = Object.keys(pendingChanges).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Sub Navigation */}
      <ModuleSubNav items={mastersNav} />

      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={22} color="var(--primary)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Roles &amp; Permissions
            </h2>
            <Badge variant="primary">Access Control</Badge>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="secondary" icon={RefreshCw} onClick={loadRoles} loading={loading} title="Reload roles from server">
            Refresh
          </Button>

          {pendingCount > 0 && (
            <Button variant="primary" icon={Save} onClick={handleSaveAll} loading={savingAll}>
              Save All Changes ({pendingCount})
            </Button>
          )}

          <Button
            variant="secondary"
            icon={Plus}
            onClick={() => {
              setEditingRole(null);
              setRoleForm({ name: '', displayName: '', description: '' });
              setRoleModalOpen(true);
            }}
          >
            Create Role
          </Button>
        </div>
      </div>

      {/* Search Bar & Legend */}
      <div
        className="card"
        style={{
          padding: '8px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 300 }}>
            <Input
              placeholder="Search role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 30, fontSize: '0.82rem', height: 32 }}
            />
            <Search
              size={13}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {filteredRoles.length} Roles
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Status:</span>
          <span
            style={{
              fontSize: '0.74rem',
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 4,
              backgroundColor: 'rgba(42, 171, 160, 0.12)',
              color: 'var(--primary)',
            }}
          >
            ✓ Allowed
          </span>
          <span
            style={{
              fontSize: '0.74rem',
              fontWeight: 500,
              padding: '2px 7px',
              borderRadius: 4,
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-color)',
            }}
          >
            Restricted
          </span>
        </div>
      </div>

      {/* SINGLE CLEAN VIEW: ROLE ON LEFT, COMPACT CHECKBOXES DIRECTLY IN FRONT */}
      {loading ? (
        <div className="card" style={{ padding: '36px 20px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
            <span className="spinner-ring" />
            <span style={{ fontSize: '0.88rem', color: 'var(--text-main)', fontWeight: 500 }}>
              Loading data...
            </span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredRoles.map((role) => {
          const isSuper = role.isSuperAdmin || role.name === 'super_admin';
          const perms = getRolePerms(role);
          const isPending = !!pendingChanges[role._id];
          const isSavingThis = savingRoleId === role._id;

          // Count granted modules
          const grantedCount = isSuper
            ? CORE_MODULES.length
            : CORE_MODULES.filter((m) => checkModuleAccess(role, perms, m.key, m.backendKey)).length;

          return (
            <div
              key={role._id}
              className="card"
              style={{
                padding: '10px 14px',
                border: isPending
                  ? '1.5px solid #f59e0b'
                  : isSuper
                  ? '1px solid #fde68a'
                  : '1px solid var(--border-color)',
                backgroundColor: isSuper
                  ? '#fffdf9'
                  : isPending
                  ? 'rgba(254, 243, 199, 0.08)'
                  : '#ffffff',
                boxShadow: isPending
                  ? '0 1px 4px rgba(245, 158, 11, 0.12)'
                  : '0 1px 2px rgba(0,0,0,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
                transition: 'all 0.12s ease',
              }}
            >
              {/* LEFT COLUMN: Role Name & Badges */}
              <div style={{ width: 220, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 5,
                      backgroundColor: isSuper
                        ? '#fef3c7'
                        : role.isSystem
                        ? '#eff6ff'
                        : 'rgba(42, 171, 160, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isSuper ? '#d97706' : role.isSystem ? '#2563eb' : 'var(--primary)',
                      flexShrink: 0,
                    }}
                  >
                    <Shield size={13} />
                  </div>

                  <span
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: 'var(--text-main)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={role.displayName || role.name}
                  >
                    {role.displayName || role.name}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '1px 5px',
                      borderRadius: 4,
                      backgroundColor: isSuper ? '#fef3c7' : 'var(--bg-subtle)',
                      color: isSuper ? '#92400e' : 'var(--text-muted)',
                      fontWeight: 600,
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {isSuper ? 'Super Admin' : role.isSystem ? 'System' : 'Custom'}
                  </span>

                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '1px 5px',
                      borderRadius: 4,
                      backgroundColor: isSuper || grantedCount > 0 ? 'rgba(42, 171, 160, 0.1)' : 'var(--bg-subtle)',
                      color: isSuper || grantedCount > 0 ? 'var(--primary)' : 'var(--text-muted)',
                    }}
                  >
                    {isSuper ? 'Full' : `${grantedCount}/${CORE_MODULES.length}`}
                  </span>

                  {isPending && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '1px 4px',
                        borderRadius: 3,
                        backgroundColor: '#fef3c7',
                        color: '#b45309',
                      }}
                    >
                      Unsaved
                    </span>
                  )}
                </div>

                {!isSuper && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => handleSelectAll(role)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                    >
                      All
                    </button>
                    <span style={{ color: 'var(--border-color)', fontSize: '0.7rem' }}>·</span>
                    <button
                      type="button"
                      onClick={() => handleClearAll(role)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* CENTER: Compact Checkboxes Directly in Front (Balanced 5 columns x 2 rows) */}
              <div className="roles-checkbox-grid">
                {CORE_MODULES.map((mod) => {
                  const hasAccess = checkModuleAccess(role, perms, mod.key, mod.backendKey);

                  return (
                    <label
                      key={mod.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 7px',
                        borderRadius: 5,
                        border: hasAccess
                          ? '1px solid var(--primary)'
                          : '1px solid var(--border-color)',
                        backgroundColor: hasAccess
                          ? 'rgba(42, 171, 160, 0.08)'
                          : '#ffffff',
                        cursor: isSuper ? 'default' : 'pointer',
                        userSelect: 'none',
                        transition: 'all 0.12s ease',
                        margin: 0,
                        height: 26,
                        boxSizing: 'border-box',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={hasAccess}
                        disabled={isSuper}
                        onChange={() => handleToggleModule(role, mod)}
                        style={{
                          width: 13,
                          height: 13,
                          accentColor: 'var(--primary)',
                          cursor: isSuper ? 'default' : 'pointer',
                          margin: 0,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: hasAccess ? 600 : 400,
                          color: hasAccess ? 'var(--text-main)' : 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={mod.label}
                      >
                        {mod.label}
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* RIGHT COLUMN: Save Button & Manage Icons */}
              <div
                style={{
                  width: 100,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 6,
                }}
              >
                {!isSuper ? (
                  <Button
                    size="sm"
                    variant={isPending ? 'primary' : 'light'}
                    icon={isPending ? Save : Check}
                    loading={isSavingThis}
                    onClick={() => handleSaveRole(role._id)}
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.74rem',
                      height: 26,
                      minWidth: 58,
                    }}
                  >
                    {isPending ? 'Save' : 'Saved'}
                  </Button>
                ) : (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: '#d97706',
                      fontWeight: 600,
                      backgroundColor: '#fef3c7',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    Full
                  </span>
                )}

                {/* Edit / Delete for custom roles */}
                {!role.isSystem && !isSuper && (
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRole(role);
                        setRoleForm({
                          name: role.name,
                          displayName: role.displayName || role.name,
                          description: role.description || '',
                        });
                        setRoleModalOpen(true);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 2,
                      }}
                      title="Edit Role Name"
                    >
                      <Edit2 size={12} />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRoleToDelete(role);
                        setDeleteModalOpen(true);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--danger)',
                        cursor: 'pointer',
                        padding: 2,
                      }}
                      title="Delete Role"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredRoles.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)', fontSize: '0.84rem' }}>
            No roles match your search "{search}".
          </div>
        )}
      </div>
      )}

      {/* CREATE / EDIT ROLE MODAL */}
      <Modal
        isOpen={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        title={editingRole ? `Edit Role: ${editingRole.displayName || editingRole.name}` : 'Create New Role'}
      >
        <form onSubmit={handleSaveRoleMetadata}>
          <Input
            label="Role Code (Unique identifier)"
            value={roleForm.name}
            onChange={(e) => {
              const val = e.target.value;
              setRoleForm((p) => ({
                ...p,
                name: val,
                displayName: p.displayName || val,
              }));
            }}
            placeholder="e.g. sales_officer, site_supervisor"
            disabled={editingRole?.isSystem || editingRole?.isSuperAdmin}
            required
          />

          <Input
            label="Display Name (UI Label)"
            value={roleForm.displayName}
            onChange={(e) => setRoleForm({ ...roleForm, displayName: e.target.value })}
            placeholder="e.g. Sales Officer, Site Supervisor"
            required
          />

          <Input
            label="Description & Responsibilities"
            value={roleForm.description}
            onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
            placeholder="e.g. Handles field sales and leads access"
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" type="button" onClick={() => setRoleModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingRole}>
              {editingRole ? 'Save Changes' : 'Create Role'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteRole}
        title="Delete Role"
        message={`Delete role "${roleToDelete?.displayName || roleToDelete?.name}"? Users assigned to this role will lose their privileges.`}
        confirmText="Delete Role"
        confirmVariant="danger"
        loading={deletingRole}
      />
    </div>
  );
};

export default RolesPermissions;
