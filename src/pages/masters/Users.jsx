import React, { useState, useEffect, useCallback } from 'react';
import userApi from '../../api/userApi';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { validateEmail, validatePhone } from '../../utils/validation';
import { Plus, UserCheck, UserX, Shield, Edit2, Search, Filter, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { mastersNav } from '../../routes/moduleNavConfig';
import { extractApiData } from '../../utils/apiUtils';

// Multi-Role Checkbox Selector Component
const RoleMultiSelect = ({ roles, selectedIds, onChange, label }) => {
  const [open, setOpen] = useState(false);
  const selectedRoles = roles.filter((r) => selectedIds.includes(r._id));
  const toggleRole = (roleId) => {
    if (selectedIds.includes(roleId)) {
      onChange(selectedIds.filter((id) => id !== roleId));
    } else {
      onChange([...selectedIds, roleId]);
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>{label}</label>}
      <div
        style={{
          border: '1.5px solid var(--border)',
          borderRadius: 8,
          background: 'var(--bg-card, #fff)',
          overflow: 'hidden',
        }}
      >
        {/* Trigger */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.88rem',
            color: 'var(--text-main)',
          }}
        >
          <span>
            {selectedRoles.length === 0
              ? 'Select roles...'
              : selectedRoles.map((r) => r.displayName || r.name).join(', ')}
          </span>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {/* Dropdown */}
        {open && (
          <div style={{ borderTop: '1px solid var(--border)', maxHeight: 220, overflowY: 'auto' }}>
            {roles.map((role) => (
              <label
                key={role._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 14px',
                  cursor: 'pointer',
                  background: selectedIds.includes(role._id) ? 'var(--primary-subtle, #f3e8e8)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(role._id)}
                  onChange={() => toggleRole(role._id)}
                  style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
                <span style={{ fontWeight: selectedIds.includes(role._id) ? 600 : 400, fontSize: '0.88rem' }}>
                  {role.displayName || role.name}
                </span>
                {role.isSuperAdmin && (
                  <Badge variant="warning" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>Super Admin</Badge>
                )}
              </label>
            ))}
            {roles.length === 0 && (
              <div style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No roles available</div>
            )}
          </div>
        )}
      </div>
      {selectedRoles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {selectedRoles.map((r) => (
            <span
              key={r._id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 10px',
                borderRadius: 20,
                background: 'var(--primary)',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              <Shield size={11} />
              {r.displayName || r.name}
              <button
                type="button"
                onClick={() => toggleRole(r._id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 0, lineHeight: 1, marginLeft: 2, fontSize: '1rem' }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export const Users = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);

  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    roles: [],     // Array of role IDs (multi-role)
    branchId: '',
    isActive: true,
  });

  const [editForm, setEditForm] = useState({
    name: '',
    roles: [],     // Array of role IDs (multi-role)
    branchId: '',
    isActive: true,
  });

  const { showToast } = useToast();
  const { user, isSuperAdmin } = useAuth();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedRoleFilter) params.role = selectedRoleFilter;

      const [uRes, rRes, bRes, cRes] = await Promise.allSettled([
        userApi.getUsers(params),
        masterApi.getRoles(),
        masterApi.getBranches(),
        masterApi.getCompanies(),
      ]);

      if (uRes.status === 'fulfilled') setUsers(extractApiData(uRes.value, 'users', 'data'));
      if (rRes.status === 'fulfilled') setRoles(extractApiData(rRes.value, 'roles', 'data'));
      if (bRes.status === 'fulfilled') setBranches(extractApiData(bRes.value, 'branches', 'data'));
      if (cRes.status === 'fulfilled') setCompanies(extractApiData(cRes.value, 'companies', 'data'));
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load system users', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedRoleFilter, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreateModal = () => {
    setCreateForm({ name: '', email: '', password: '', roles: [], branchId: '', isActive: true });
    setCreateModalOpen(true);
  };

  const openEditModal = (u) => {
    setEditingUserId(u._id);
    // Resolve roles: prefer the roles array, fallback to single role
    let resolvedRoleIds = [];
    if (Array.isArray(u.roles) && u.roles.length > 0) {
      resolvedRoleIds = u.roles.map((r) => (typeof r === 'object' ? r._id : r)).filter(Boolean);
    } else if (u.role) {
      const rid = typeof u.role === 'object' ? u.role._id : u.role;
      if (rid) resolvedRoleIds = [rid];
    }
    setEditForm({
      name: u.name || '',
      roles: resolvedRoleIds,
      branchId: typeof u.branch === 'object' ? u.branch?._id || '' : u.branchId || '',
      isActive: u.isActive !== false,
    });
    setEditModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name?.trim() || !createForm.email?.trim() || !createForm.password) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }
    if (createForm.roles.length === 0) {
      showToast('Please assign at least one role', 'warning');
      return;
    }
    const emailErr = validateEmail(createForm.email, { fieldName: 'Login email' });
    if (emailErr) { showToast(emailErr, 'warning'); return; }
    if (createForm.mobile?.trim()) {
      const phoneErr = validatePhone(createForm.mobile, { required: false, fieldName: 'Mobile number' });
      if (phoneErr) { showToast(phoneErr, 'warning'); return; }
    }

    setSubmitting(true);
    try {
      const primaryRoleId = createForm.roles[0];
      const primaryRoleObj = roles.find((r) => r._id === primaryRoleId);
      const defaultCompany = user?.company?._id || user?.company || companies[0]?._id;

      await userApi.createUser({
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        role: primaryRoleId,
        roles: createForm.roles,
        roleName: primaryRoleObj?.name || primaryRoleId,
        branch: createForm.branchId || undefined,
        branchId: createForm.branchId || undefined,
        company: defaultCompany || undefined,
        companyId: defaultCompany || undefined,
        mobile: createForm.mobile?.trim() || undefined,
        isActive: createForm.isActive,
      });
      showToast('System user created successfully!', 'success');
      setCreateModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to create user', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUserId) return;
    if (editForm.roles.length === 0) {
      showToast('Please assign at least one role', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await userApi.updateUser(editingUserId, {
        name: editForm.name.trim(),
        role: editForm.roles[0],       // primary role (backward compat)
        roles: editForm.roles,          // full roles array
        branch: editForm.branchId || undefined,
        branchId: editForm.branchId || undefined,
        isActive: editForm.isActive,
      });
      showToast('User details updated successfully!', 'success');
      setEditModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to update user', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (userRecord) => {
    const nextStatus = !userRecord.isActive;
    try {
      if (!nextStatus) await userApi.deactivateUser(userRecord._id);
      else await userApi.updateUserStatus(userRecord._id, true);
      showToast(`User ${userRecord.name} ${nextStatus ? 'activated' : 'deactivated'} successfully`, 'success');
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update user status', 'error');
    }
  };

  const confirmDelete = (userRecord) => { setUserToDelete(userRecord); setDeleteModalOpen(true); };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      await userApi.deleteUser(userToDelete._id);
      showToast('User account deleted successfully', 'success');
      setDeleteModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete user', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = u.name?.toLowerCase().includes(q);
    const emailMatch = u.email?.toLowerCase().includes(q);
    // Search across all roles
    const allRoleNames = (Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : (u.role ? [u.role] : []))
      .map((r) => String(typeof r === 'string' ? r : (r?.displayName || r?.name || '')).toLowerCase())
      .join(' ');
    return nameMatch || emailMatch || allRoleNames.includes(q);
  });

  const columns = [
    {
      header: 'User & Credentials',
      key: 'name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.name}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.email}</div>
        </div>
      ),
    },
    {
      header: 'Assigned Roles',
      key: 'roles',
      render: (r) => {
        const userRoles = Array.isArray(r.roles) && r.roles.length > 0 ? r.roles : (r.role ? [r.role] : []);
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {userRoles.map((role, idx) => {
              const label = typeof role === 'object' ? (role.displayName || role.name) : role;
              return (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    borderRadius: 12,
                    background: 'var(--primary-subtle, #fde8e8)',
                    color: 'var(--primary)',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                  }}
                >
                  <Shield size={11} />
                  {label || 'Standard'}
                </span>
              );
            })}
            {userRoles.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No role</span>}
          </div>
        );
      },
    },
    {
      header: 'Linked Employee Master',
      key: 'employee',
      render: (r) => {
        const emp = r.employee;
        const empCode = emp?.basicInfo?.employeeCode || emp?.employeeCode || null;
        const empName = emp?.basicInfo?.fullName || emp?.name || emp?.fullName || r.name;
        if (!empCode && !emp) {
          return <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>System Account (Admin)</span>;
        }
        return (
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--primary-subtle, #e0e7ff)', color: 'var(--primary, #4338ca)', letterSpacing: '0.02em' }}>
                {empCode || 'LINKED'}
              </span>
              <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>{empName}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: 2 }}>✓ Unified Employee Profile</div>
          </div>
        );
      },
    },
    {
      header: 'Branch Scoping',
      key: 'branch',
      render: (r) => r.branch?.name || r.branchName || 'Global / Corporate HQ',
    },
    {
      header: 'Session Status',
      key: 'isActive',
      render: (r) => <Badge variant={r.isActive !== false ? 'success' : 'danger'}>{r.isActive !== false ? 'Active' : 'Deactivated'}</Badge>,
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button variant="light" size="sm" onClick={() => openEditModal(r)} icon={Edit2} title="Edit User Details">Edit</Button>
          <Button variant={r.isActive !== false ? 'secondary' : 'light'} size="sm" onClick={() => handleToggleStatus(r)} icon={r.isActive !== false ? UserX : UserCheck} title={r.isActive !== false ? 'Deactivate' : 'Activate'}>
            {r.isActive !== false ? 'Deactivate' : 'Activate'}
          </Button>
          <Button variant="outline-danger" size="sm" onClick={() => confirmDelete(r)} icon={Trash2} title="Delete User">Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ModuleSubNav items={mastersNav} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>System Users & Employee Logins</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Assign one or multiple RBAC roles per user. Permissions are automatically merged from all assigned roles.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openCreateModal}>Create New User</Button>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ display: 'flex', gap: 12, padding: '12px 16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 240 }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search users by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.88rem', color: 'var(--text-main)' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200 }}>
          <Filter size={14} color="var(--text-muted)" />
          <div style={{ flex: 1, minWidth: 160 }}>
            <Select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              options={[{ value: '', label: 'All Roles' }, ...roles.map((r) => ({ value: r._id, label: r.displayName || r.name }))]}
              placeholder="All Roles"
            />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <Table columns={columns} data={filteredUsers} loading={loading} emptyMessage="No system users found matching the query." />
      </div>

      {/* Create User Modal */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New System User">
        <form onSubmit={handleCreateSubmit}>
          <Input label="Full Name" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Enter full name" required />
          <Input label="Login Email" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="Enter email address" required />
          <Input label="Mobile Number (Optional)" type="tel" isPhone={true} value={createForm.mobile} onChange={(e) => setCreateForm({ ...createForm, mobile: e.target.value })} placeholder="10-digit mobile number" />
          <Input label="Initial Password" type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} placeholder="Enter password" required />

          <RoleMultiSelect
            label="Assigned RBAC Roles (Multi-Select)"
            roles={roles}
            selectedIds={createForm.roles}
            onChange={(ids) => setCreateForm({ ...createForm, roles: ids })}
          />

          <Select
            label="Branch Scoping (Optional)"
            value={createForm.branchId}
            onChange={(e) => setCreateForm({ ...createForm, branchId: e.target.value })}
            options={branches.map((b) => ({ value: b._id, label: b.name }))}
            placeholder="Global / Corporate HQ (All Branches)"
          />

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="create-active-check" checked={createForm.isActive} onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })} style={{ cursor: 'pointer' }} />
            <label htmlFor="create-active-check" style={{ fontSize: '0.88rem', cursor: 'pointer' }}>Activate user account immediately</label>
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={submitting}>Create User</Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit System User Details">
        <form onSubmit={handleEditSubmit}>
          <Input label="Full Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Enter full name" required />

          <RoleMultiSelect
            label="Assigned RBAC Roles (Multi-Select)"
            roles={roles}
            selectedIds={editForm.roles}
            onChange={(ids) => setEditForm({ ...editForm, roles: ids })}
          />

          <Select
            label="Branch Scoping"
            value={editForm.branchId}
            onChange={(e) => setEditForm({ ...editForm, branchId: e.target.value })}
            options={branches.map((b) => ({ value: b._id, label: b.name }))}
            placeholder="Global / Corporate HQ"
          />

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="edit-active-check" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} style={{ cursor: 'pointer' }} />
            <label htmlFor="edit-active-check" style={{ fontSize: '0.88rem', cursor: 'pointer' }}>User Account Active</label>
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={submitting}>Save Updates</Button>
          </div>
        </form>
      </Modal>

      {/* Delete User Confirmation */}
      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteUser}
        title="Delete User Account"
        message={`Are you sure you want to permanently delete user account "${userToDelete?.name || ''}" (${userToDelete?.email || ''})? This will revoke all authentication access.`}
        confirmText="Delete User"
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  );
};

export default Users;
