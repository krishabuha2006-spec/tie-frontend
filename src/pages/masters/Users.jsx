import React, { useState, useEffect, useCallback } from 'react';
import userApi from '../../api/userApi';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { validateEmail, validatePhone } from '../../utils/validation';
import { Plus, UserCheck, UserX, Shield, Edit2, Search, Filter, Trash2 } from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { mastersNav } from '../../routes/moduleNavConfig';

export const Users = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    role: '',
    branchId: '',
    isActive: true,
  });

  const [editForm, setEditForm] = useState({
    name: '',
    role: '',
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

      if (uRes.status === 'fulfilled') {
        const usersList = uRes.value?.data?.users || uRes.value?.data || uRes.value?.users || [];
        setUsers(Array.isArray(usersList) ? usersList : []);
      }
      if (rRes.status === 'fulfilled') {
        const rolesList = rRes.value?.data || rRes.value?.roles || [];
        setRoles(Array.isArray(rolesList) ? rolesList : []);
      }
      if (bRes.status === 'fulfilled') {
        const branchesList = bRes.value?.data || bRes.value?.branches || [];
        setBranches(Array.isArray(branchesList) ? branchesList : []);
      }
      if (cRes.status === 'fulfilled') {
        const companiesList = cRes.value?.data || cRes.value?.companies || [];
        setCompanies(Array.isArray(companiesList) ? companiesList : []);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load system users', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedRoleFilter, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setCreateForm({
      name: '',
      email: '',
      password: '',
      role: roles[0]?._id || '',
      branchId: branches[0]?._id || '',
      isActive: true,
    });
    setCreateModalOpen(true);
  };

  const openEditModal = (u) => {
    setEditingUserId(u._id);
    setEditForm({
      name: u.name || '',
      role: typeof u.role === 'object' ? u.role?._id || '' : u.role || '',
      branchId: typeof u.branch === 'object' ? u.branch?._id || '' : u.branchId || '',
      isActive: u.isActive !== false,
    });
    setEditModalOpen(true);
  };

  // Step 3: Create User (POST /api/users)
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name?.trim() || !createForm.email?.trim() || !createForm.password) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }
    const emailErr = validateEmail(createForm.email, { fieldName: 'Login email' });
    if (emailErr) {
      showToast(emailErr, 'warning');
      return;
    }
    if (createForm.mobile?.trim()) {
      const phoneErr = validatePhone(createForm.mobile, { required: false, fieldName: 'Mobile number' });
      if (phoneErr) {
        showToast(phoneErr, 'warning');
        return;
      }
    }

    setSubmitting(true);
    try {
      const selectedRoleObj = roles.find((r) => r._id === createForm.role || r.name === createForm.role);
      const roleId = selectedRoleObj?._id || createForm.role;
      const roleName = selectedRoleObj?.name || selectedRoleObj?.slug || createForm.role;
      const defaultCompany = user?.company?._id || user?.company || companies[0]?._id;

      await userApi.createUser({
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        role: roleId,
        roleName: roleName,
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

  // Update User (PUT /api/users/:id)
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUserId) return;

    setSubmitting(true);
    try {
      await userApi.updateUser(editingUserId, {
        name: editForm.name.trim(),
        role: editForm.role || undefined,
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

  // Activate / Deactivate (PUT /users/:id/deactivate or /users/:id/status)
  const handleToggleStatus = async (userRecord) => {
    const nextStatus = !userRecord.isActive;
    try {
      if (!nextStatus) {
        await userApi.deactivateUser(userRecord._id);
      } else {
        await userApi.updateUserStatus(userRecord._id, true);
      }
      showToast(`User ${userRecord.name} ${nextStatus ? 'activated' : 'deactivated'} successfully`, 'success');
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update user status', 'error');
    }
  };

  // Delete User (DELETE /users/:id)
  const confirmDelete = (userRecord) => {
    setUserToDelete(userRecord);
    setDeleteModalOpen(true);
  };

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

  // Filtered Users by Search Query
  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = u.name?.toLowerCase().includes(q);
    const emailMatch = u.email?.toLowerCase().includes(q);
    const roleName = String(typeof u.role === 'string' ? u.role : (u.role?.displayName || u.role?.name || '')).toLowerCase();
    const roleMatch = roleName.includes(q);
    return nameMatch || emailMatch || roleMatch;
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
      header: 'Assigned Role',
      key: 'role',
      render: (r) => {
        const roleLabel = r.role?.displayName || r.role?.name || (typeof r.role === 'string' ? r.role : 'Standard');
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
            <Shield size={14} color="var(--primary)" />
            <span>{roleLabel}</span>
          </span>
        );
      },
    },
    {
      header: 'Linked Employee Master',
      key: 'employee',
      render: (r) => {
        const emp = r.employee;
        const empCode = emp?.basicInfo?.employeeCode || emp?.employeeCode || (r.employeeId ? `EMP-${String(r.employeeId).slice(-4)}` : null);
        const empName = emp?.basicInfo?.fullName || emp?.name || emp?.fullName || r.name;
        if (!empCode && !emp) {
          return (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              System Account (Admin)
            </span>
          );
        }
        return (
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'var(--primary-subtle, #e0e7ff)',
                  color: 'var(--primary, #4338ca)',
                  letterSpacing: '0.02em',
                }}
              >
                {empCode || 'LINKED'}
              </span>
              <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>{empName}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: 2 }}>
              ✓ Unified Employee Profile
            </div>
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
      render: (r) => (
        <Badge variant={r.isActive !== false ? 'success' : 'danger'}>
          {r.isActive !== false ? 'Active' : 'Deactivated'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            variant="light"
            size="sm"
            onClick={() => openEditModal(r)}
            icon={Edit2}
            title="Edit User Details"
          >
            Edit
          </Button>

          <Button
            variant={r.isActive !== false ? 'secondary' : 'light'}
            size="sm"
            onClick={() => handleToggleStatus(r)}
            icon={r.isActive !== false ? UserX : UserCheck}
            title={r.isActive !== false ? 'Deactivate User Account' : 'Activate User Account'}
          >
            {r.isActive !== false ? 'Deactivate' : 'Activate'}
          </Button>

          <Button
            variant="outline-danger"
            size="sm"
            onClick={() => confirmDelete(r)}
            icon={Trash2}
            title="Delete User"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ModuleSubNav items={mastersNav} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            System Users & Employee Logins
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            System users and employee masters are unified: each employee has assigned RBAC credentials that dynamically govern sidebar features.
          </p>
        </div>

        <Button variant="primary" icon={Plus} onClick={openCreateModal}>
          Create New User
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          gap: 12,
          padding: '12px 16px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 240 }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search users by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              width: '100%',
              fontSize: '0.88rem',
              color: 'var(--text-main)',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200 }}>
          <Filter size={14} color="var(--text-muted)" />
          <div style={{ flex: 1, minWidth: 160 }}>
            <Select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              options={[
                { value: '', label: 'All Roles' },
                ...roles.map((r) => ({ value: r._id, label: r.displayName || r.name })),
              ]}
              placeholder="All Roles"
            />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <Table
          columns={columns}
          data={filteredUsers}
          loading={loading}
          emptyMessage="No system users found matching the query."
        />
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New System User"
      >
        <form onSubmit={handleCreateSubmit}>
          <Input
            label="Full Name"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            placeholder="Enter full name"
            required
          />

          <Input
            label="Login Email"
            type="email"
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            placeholder="Enter email address"
            required
          />

          <Input
            label="Mobile Number (Optional)"
            type="tel"
            isPhone={true}
            value={createForm.mobile}
            onChange={(e) => setCreateForm({ ...createForm, mobile: e.target.value })}
            placeholder="10-digit mobile number"
          />

          <Input
            label="Initial Password"
            type="password"
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            placeholder="Enter password"
            required
          />

          <Select
            label="Assigned RBAC System Role"
            value={createForm.role}
            onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
            options={roles.map((r) => ({ value: r._id, label: r.displayName || r.name }))}
            placeholder="Select a role..."
            required
          />

          <Select
            label="Branch Scoping (Optional)"
            value={createForm.branchId}
            onChange={(e) => setCreateForm({ ...createForm, branchId: e.target.value })}
            options={branches.map((b) => ({ value: b._id, label: b.name }))}
            placeholder="Global / Corporate HQ (All Branches)"
          />

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="create-active-check"
              checked={createForm.isActive}
              onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="create-active-check" style={{ fontSize: '0.88rem', cursor: 'pointer' }}>
              Activate user account immediately
            </label>
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit System User Details"
      >
        <form onSubmit={handleEditSubmit}>
          <Input
            label="Full Name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            placeholder="Enter full name"
            required
          />

          <Select
            label="Assigned RBAC System Role"
            value={editForm.role}
            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
            options={roles.map((r) => ({ value: r._id, label: r.displayName || r.name }))}
            placeholder="Select a role..."
            required
          />

          <Select
            label="Branch Scoping"
            value={editForm.branchId}
            onChange={(e) => setEditForm({ ...editForm, branchId: e.target.value })}
            options={branches.map((b) => ({ value: b._id, label: b.name }))}
            placeholder="Global / Corporate HQ"
          />

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="edit-active-check"
              checked={editForm.isActive}
              onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="edit-active-check" style={{ fontSize: '0.88rem', cursor: 'pointer' }}>
              User Account Active
            </label>
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Save Updates
            </Button>
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
