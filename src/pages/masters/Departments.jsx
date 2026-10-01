import React, { useState, useEffect, useCallback, useMemo } from 'react';
import masterApi from '../../api/masterApi';
import employeeApi from '../../api/employeeApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import {
  Plus,
  Edit2,
  Trash2,
  Building2,
  Search,
  UserCheck,
  CheckCircle,
  XCircle,
  Layers,
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { mastersNav } from '../../routes/moduleNavConfig';
import { extractApiData } from '../../utils/apiUtils';

export const Departments = () => {
  const { company: activeCompany, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    company: '',
    name: '',
    code: '',
    departmentHead: '',
    description: '',
    isActive: true,
  });

  // Load Data from Backend (GET /departments, GET /companies, GET /employees)
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, compRes, empRes] = await Promise.all([
        masterApi.getDepartments(),
        masterApi.getCompanies(),
        employeeApi.getEmployees({ limit: 200 }).catch(() => ({ data: [] })),
      ]);

      const deptList = extractApiData(deptRes, 'departments', 'data');
      const compList = extractApiData(compRes, 'companies', 'data');
      const empList = extractApiData(empRes, 'employees', 'data');

      setDepartments(deptList);
      setCompanies(compList);
      setEmployees(empList);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to load departments from backend', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Create Modal
  const openAddModal = () => {
    setEditingDept(null);
    const defaultCompanyId = activeCompany?._id || companies[0]?._id || '';
    setFormData({
      company: defaultCompanyId,
      name: '',
      code: '',
      departmentHead: '',
      description: '',
      isActive: true,
    });
    setModalOpen(true);
  };

  // Open Edit Modal (pre-fills with GET /departments/:id data or record data)
  const openEditModal = (d) => {
    setEditingDept(d);
    setFormData({
      company: d.company?._id || (typeof d.company === 'string' ? d.company : '') || activeCompany?._id || '',
      name: d.name || '',
      code: d.code || '',
      departmentHead: d.departmentHead?._id || (typeof d.departmentHead === 'string' ? d.departmentHead : ''),
      description: d.description || '',
      isActive: d.isActive !== false,
    });
    setModalOpen(true);

    if (d._id) {
      masterApi.getDepartmentById(d._id)
        .then((res) => {
          const item = res?.data || res?.department || res;
          if (item && (item._id === d._id || item.name)) {
            setFormData((prev) => ({
              ...prev,
              name: item.name || prev.name,
              code: item.code !== undefined ? item.code : prev.code,
              company: item.company?._id || (typeof item.company === 'string' ? item.company : '') || prev.company,
              departmentHead: item.departmentHead?._id || (typeof item.departmentHead === 'string' ? item.departmentHead : '') || prev.departmentHead,
              description: item.description !== undefined ? item.description : prev.description,
              isActive: item.isActive !== undefined ? item.isActive !== false : prev.isActive,
            }));
          }
        })
        .catch((err) => {
          console.warn('Could not fetch fresh department by id, using local row state:', err);
        });
    }
  };

  // Auto-generate code from department name (e.g., "Human Resources" -> "HR")
  const handleNameChange = (newName) => {
    setFormData((prev) => {
      let suggestedCode = prev.code;
      // Only suggest code if creating and code is currently empty or matches previous auto-code
      if (!editingDept && (!prev.code || prev.code === prev.name.slice(0, 4).toUpperCase())) {
        const words = newName.trim().split(/\s+/).filter(Boolean);
        if (words.length > 1) {
          suggestedCode = words.map((w) => w[0]).join('').toUpperCase().slice(0, 5);
        } else if (words.length === 1 && words[0].length >= 3) {
          suggestedCode = words[0].slice(0, 4).toUpperCase();
        }
      }
      return { ...prev, name: newName, code: suggestedCode };
    });
  };

  // Handle Form Submission (POST /departments or PUT /departments/:id)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      showToast('Department name is required', 'warning');
      return;
    }
    if (!formData.code?.trim()) {
      showToast('Department code is required', 'warning');
      return;
    }

    setSubmitting(true);
    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      company: formData.company || undefined,
      departmentHead: formData.departmentHead || undefined,
      description: formData.description?.trim() || '',
      isActive: Boolean(formData.isActive),
    };

    try {
      if (editingDept?._id) {
        await masterApi.updateDepartment(editingDept._id, payload);
        showToast(`Department "${payload.name}" updated successfully!`, 'success');
      } else {
        await masterApi.createDepartment(payload);
        showToast(`Department "${payload.name}" created successfully!`, 'success');
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to save department', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Toggle Status (Active / Inactive)
  const handleToggleStatus = async (dept) => {
    const nextStatus = dept.isActive === false;
    try {
      await masterApi.updateDepartment(dept._id, { isActive: nextStatus });
      showToast(`Department marked as ${nextStatus ? 'Active' : 'Inactive'}`, 'success');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update department status', 'error');
    }
  };

  // Handle Delete (DELETE /departments/:id)
  const handleDelete = async (dept) => {
    const isConfirmed = await confirm({
      title: 'Delete Department',
      message: `Are you sure you want to delete department "${dept.name}" (${dept.code})? Note: Deletion is blocked if employees or designations are assigned.`,
      confirmText: 'Delete Department',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!isConfirmed) return;

    try {
      await masterApi.deleteDepartment(dept._id);
      showToast(`Department "${dept.name}" deleted successfully`, 'success');
      await loadData();
    } catch (err) {
      if (err.response?.status === 409 || err.response?.status === 400 || err.status === 409) {
        const canDeactivate = await confirm({
          title: 'Department In Use',
          message: `${err.response?.data?.message || 'Cannot delete department because active designations or employees are assigned to it.'}\n\nWould you like to deactivate this department instead?`,
          confirmText: 'Deactivate Department',
          cancelText: 'Cancel',
          variant: 'warning',
        });
        if (canDeactivate) {
          try {
            await masterApi.updateDepartment(dept._id, { isActive: false });
            showToast(`Department "${dept.name}" deactivated successfully`, 'success');
            await loadData();
            return;
          } catch (deactErr) {
            showToast(deactErr.response?.data?.message || 'Failed to deactivate department', 'error');
            return;
          }
        }
        return;
      }
      showToast(
        err.response?.data?.message || err.message || 'Cannot delete department. Make sure no employees or designations are linked to it.',
        'error'
      );
    }
  };

  // Quick Stats
  const stats = useMemo(() => {
    const total = departments.length;
    const active = departments.filter((d) => d.isActive !== false).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [departments]);

  // Client Filtered List
  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = d.name?.toLowerCase().includes(q);
        const matchesCode = d.code?.toLowerCase().includes(q);
        const matchesDesc = d.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesDesc) return false;
      }

      // Company Filter
      if (companyFilter) {
        const compId = d.company?._id || (typeof d.company === 'string' ? d.company : '');
        if (compId !== companyFilter) return false;
      }

      // Status Filter
      if (statusFilter === 'ACTIVE' && d.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && d.isActive !== false) return false;

      return true;
    });
  }, [departments, search, companyFilter, statusFilter]);

  // Table Columns
  const columns = [
    {
      header: 'Department',
      key: 'name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>
            {r.name}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, maxWidth: 280 }}>
            {r.description || 'No description provided'}
          </div>
        </div>
      ),
    },
    {
      header: 'Code',
      key: 'code',
      render: (r) => (
        <span
          style={{
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: '0.82rem',
            backgroundColor: 'var(--bg-subtle, #f1f5f9)',
            padding: '3px 7px',
            borderRadius: 5,
            border: '1px solid var(--border)',
            color: 'var(--primary)',
          }}
        >
          {r.code || '-'}
        </span>
      ),
    },
    {
      header: 'Company',
      key: 'company',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem' }}>
          <Building2 size={13} color="var(--text-muted)" />
          <span>{r.company?.name || 'TIE Technologies'}</span>
        </div>
      ),
    },
    {
      header: 'Department Head',
      key: 'departmentHead',
      render: (r) => {
        const head = r.departmentHead;
        if (!head) {
          return <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>;
        }
        const headName = head.basicInfo?.fullName || head.fullName || head.name || 'Assigned Head';
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.84rem' }}>
            <UserCheck size={14} color="var(--primary)" />
            <span style={{ fontWeight: 500 }}>{headName}</span>
          </div>
        );
      },
    },
    {
      header: 'Status',
      key: 'isActive',
      render: (r) => (
        <Badge
          variant={r.isActive !== false ? 'success' : 'danger'}
          onClick={() => handleToggleStatus(r)}
          style={{ cursor: 'pointer' }}
          title="Click to toggle Active/Inactive"
        >
          {r.isActive !== false ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditModal(r)}
            title="Edit Department"
            style={{ color: 'var(--primary)' }}
          >
            <Edit2 size={15} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(r)}
            title="Delete Department"
            style={{ color: '#dc2626' }}
          >
            <Trash2 size={15} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Navigation */}
      <ModuleSubNav items={mastersNav} />

      {/* Header & Quick Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: 'var(--primary-light, #f0f7f8)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Departments Master
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Manage corporate organizational units, codes, and leadership assignments
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button variant="primary" icon={Plus} onClick={openAddModal}>
            Add Department
          </Button>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(46, 123, 133, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1 }}>{stats.total}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Total Departments</div>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981', lineHeight: 1 }}>{stats.active}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Active Units</div>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XCircle size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444', lineHeight: 1 }}>{stats.inactive}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Inactive Units</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
          <Input
            placeholder="Search by name, code, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 32, height: 34, fontSize: '0.84rem' }}
          />
          <Search
            size={14}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
          />
        </div>

        {companies.length > 1 && (
          <div style={{ width: 200 }}>
            <Select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              options={[
                { value: '', label: 'All Companies' },
                ...companies.map((c) => ({ value: c._id, label: c.name })),
              ]}
              style={{ height: 34, fontSize: '0.84rem' }}
            />
          </div>
        )}

        <div style={{ width: 140 }}>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Status' },
              { value: 'ACTIVE', label: 'Active Only' },
              { value: 'INACTIVE', label: 'Inactive Only' },
            ]}
            style={{ height: 34, fontSize: '0.84rem' }}
          />
        </div>

        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch('')} style={{ fontSize: '0.8rem' }}>
            Clear Search
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="card">
        <Table
          columns={columns}
          data={filteredDepartments}
          loading={loading}
          emptyMessage="No departments found. Click 'Add Department' to create a new organizational unit."
        />
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDept ? 'Edit Department' : 'Create New Department'}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {companies.length > 0 && (
            <Select
              label="Company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              options={companies.map((c) => ({ value: c._id, label: c.name }))}
              required
            />
          )}

          <div className="grid-2">
            <Input
              label="Department Name"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Human Resources"
              required
            />

            <Input
              label="Department Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. HR"
              required
            />
          </div>

          <div className="grid-2">
            <Select
              label="Department Head"
              value={formData.departmentHead}
              onChange={(e) => setFormData({ ...formData, departmentHead: e.target.value })}
              options={[
                { value: '', label: '-- None (Assign Later) --' },
                ...employees.map((emp) => {
                  const empName = emp.basicInfo?.fullName || emp.fullName || emp.name || 'Employee';
                  const empCode = emp.basicInfo?.employeeCode || emp.employeeCode;
                  return {
                    value: emp._id,
                    label: empCode ? `${empName} (${empCode})` : empName,
                  };
                }),
              ]}
            />

            <Select
              label="Status"
              value={formData.isActive ? 'true' : 'false'}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
              options={[
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
              Description
            </label>
            <textarea
              className="form-control"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe department operations, role within company, and responsibilities..."
              rows={3}
              style={{ width: '100%', fontSize: '0.84rem' }}
            />
          </div>

          <div className="modal-footer" style={{ margin: '16px -20px -20px' }}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingDept ? 'Update Department' : 'Create Department'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Departments;
