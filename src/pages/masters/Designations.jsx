import React, { useState, useEffect, useCallback, useMemo } from 'react';
import masterApi from '../../api/masterApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import {
  Plus,
  Edit2,
  Trash2,
  Award,
  Search,
  Building2,
  Layers,
  CheckCircle,
  XCircle,
  TrendingUp,
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

export const Designations = () => {
  const { company: activeCompany } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDesig, setEditingDesig] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    code: '',
    company: '',
    level: 1,
    description: '',
    isActive: true,
  });

  // Load all master data from backend
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [desigRes, deptRes, compRes, levelRes] = await Promise.all([
        masterApi.getDesignations(),
        masterApi.getDepartments(),
        masterApi.getCompanies().catch(() => ({ data: [] })),
        masterApi.getDesignationLevels().catch(() => ({ data: [] })),
      ]);

      const desigList = extractApiData(desigRes, 'designations', 'data');
      const deptList = extractApiData(deptRes, 'departments', 'data');
      const compList = extractApiData(compRes, 'companies', 'data');
      const rawLevels = levelRes?.data || levelRes?.levels || (Array.isArray(levelRes) ? levelRes : []);

      // Format level options from API only (no frontend seed data)
      const formattedLevels = Array.isArray(rawLevels)
        ? rawLevels.map((lvl) => ({
            value: Number(lvl.level || lvl.value || 1),
            label: lvl.label || lvl.name || `Level ${lvl.level}`,
            grade: lvl.grade || `L${lvl.level}`,
          }))
        : [];

      setDesignations(desigList);
      setDepartments(deptList);
      setCompanies(compList);
      setLevels(formattedLevels);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to load designations from backend', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Add Modal
  const openAddModal = () => {
    setEditingDesig(null);
    setFormData({
      name: '',
      department: departments[0]?._id || '',
      code: '',
      company: activeCompany?._id || companies[0]?._id || '',
      level: 1,
      description: '',
      isActive: true,
    });
    setModalOpen(true);
  };

  // Open Edit Modal (fetches fresh data via GET /designations/:id)
  const openEditModal = async (d) => {
    setEditingDesig(d);
    setFormData({
      name: d.name || d.title || '',
      department: d.department?._id || (typeof d.department === 'string' ? d.department : '') || departments[0]?._id || '',
      code: d.code || '',
      company: d.company?._id || (typeof d.company === 'string' ? d.company : '') || activeCompany?._id || '',
      level: Number(d.level) || 1,
      description: d.description || '',
      isActive: d.isActive !== false,
    });
    setModalOpen(true);

    if (d._id) {
      try {
        const res = await masterApi.getDesignationById(d._id);
        const item = res?.data || res?.designation || res;
        if (item && (item._id === d._id || item.name)) {
          setFormData((prev) => ({
            ...prev,
            name: item.name || item.title || prev.name,
            department: item.department?._id || (typeof item.department === 'string' ? item.department : '') || prev.department,
            code: item.code !== undefined ? item.code : prev.code,
            company: item.company?._id || (typeof item.company === 'string' ? item.company : '') || prev.company,
            level: Number(item.level) || prev.level,
            description: item.description !== undefined ? item.description : prev.description,
            isActive: item.isActive !== undefined ? item.isActive !== false : prev.isActive,
          }));
        }
      } catch (err) {
        console.warn('Could not fetch fresh designation by id, using local row state:', err);
      }
    }
  };

  // Auto-generate suggested code from designation title (e.g. "Project Engineer" -> "PE")
  const handleNameChange = (newName) => {
    setFormData((prev) => {
      let suggestedCode = prev.code;
      if (!editingDesig && (!prev.code || prev.code === prev.name.slice(0, 4).toUpperCase())) {
        const words = newName.trim().split(/\s+/).filter(Boolean);
        if (words.length > 1) {
          suggestedCode = words.map((w) => w[0]).join('').toUpperCase().slice(0, 6);
        } else if (words.length === 1 && words[0].length >= 3) {
          suggestedCode = words[0].slice(0, 4).toUpperCase();
        }
      }
      return { ...prev, name: newName, code: suggestedCode };
    });
  };

  // Handle Form Submission (POST /designations or PUT /designations/:id)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      showToast('Designation title is required', 'warning');
      return;
    }
    if (!formData.department) {
      showToast('Please select a department', 'warning');
      return;
    }

    setSubmitting(true);
    const deptId = typeof formData.department === 'object' ? formData.department?._id : formData.department;
    const compId = typeof formData.company === 'object' ? formData.company?._id : formData.company;
    const payload = {
      name: formData.name.trim(),
      department: deptId,
      code: formData.code?.trim() ? formData.code.trim().toUpperCase() : undefined,
      company: compId || undefined,
      level: Number(formData.level) || 1,
      description: formData.description?.trim() || '',
      isActive: Boolean(formData.isActive),
    };

    try {
      if (editingDesig?._id) {
        await masterApi.updateDesignation(editingDesig._id, payload);
        showToast(`Designation "${payload.name}" updated successfully!`, 'success');
      } else {
        await masterApi.createDesignation(payload);
        showToast(`Designation "${payload.name}" created successfully!`, 'success');
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to save designation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Toggle Status (Active / Inactive)
  const handleToggleStatus = async (desig) => {
    const nextStatus = desig.isActive === false;
    try {
      await masterApi.updateDesignation(desig._id, { isActive: nextStatus });
      showToast(`Designation marked as ${nextStatus ? 'Active' : 'Inactive'}`, 'success');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update designation status', 'error');
    }
  };

  // Handle Delete (DELETE /designations/:id)
  const handleDelete = async (desig) => {
    const isConfirmed = await confirm({
      title: 'Delete Designation',
      message: `Are you sure you want to delete designation "${desig.name || desig.title}" (${desig.code || 'No code'})? Note: Deletion is blocked if active employees are assigned to this designation.`,
      confirmText: 'Delete Designation',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!isConfirmed) return;

    try {
      await masterApi.deleteDesignation(desig._id);
      showToast(`Designation "${desig.name || desig.title}" deleted successfully`, 'success');
      await loadData();
    } catch (err) {
      if (err.response?.status === 409 || err.response?.status === 400 || err.status === 409) {
        const canDeactivate = await confirm({
          title: 'Designation In Use',
          message: `${err.response?.data?.message || 'Cannot delete designation because active employees are assigned to it.'}\n\nWould you like to deactivate this designation instead?`,
          confirmText: 'Deactivate Designation',
          cancelText: 'Cancel',
          variant: 'warning',
        });
        if (canDeactivate) {
          try {
            await masterApi.updateDesignation(desig._id, { isActive: false });
            showToast(`Designation "${desig.name || desig.title}" deactivated successfully`, 'success');
            await loadData();
            return;
          } catch (deactErr) {
            showToast(deactErr.response?.data?.message || 'Failed to deactivate designation', 'error');
            return;
          }
        }
        return;
      }
      showToast(
        err.response?.data?.message || err.message || 'Cannot delete designation. Ensure no active employees are assigned to it.',
        'error'
      );
    }
  };

  // Quick Stats
  const stats = useMemo(() => {
    const total = designations.length;
    const active = designations.filter((d) => d.isActive !== false).length;
    const leadership = designations.filter((d) => Number(d.level) >= 7).length;
    return { total, active, leadership };
  }, [designations]);

  // Client Filtered List
  const filteredDesignations = useMemo(() => {
    return designations.filter((d) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = (d.name || d.title)?.toLowerCase().includes(q);
        const matchesCode = d.code?.toLowerCase().includes(q);
        const matchesDesc = d.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesDesc) return false;
      }

      // Department Filter
      if (departmentFilter) {
        const dId = d.department?._id || (typeof d.department === 'string' ? d.department : '');
        if (dId !== departmentFilter) return false;
      }

      // Level Filter
      if (levelFilter !== 'ALL') {
        const lvl = Number(d.level) || 1;
        if (levelFilter === 'ENTRY' && (lvl < 1 || lvl > 3)) return false;
        if (levelFilter === 'MID' && (lvl < 4 || lvl > 6)) return false;
        if (levelFilter === 'SENIOR' && lvl < 7) return false;
      }

      // Status Filter
      if (statusFilter === 'ACTIVE' && d.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && d.isActive !== false) return false;

      return true;
    });
  }, [designations, search, departmentFilter, levelFilter, statusFilter]);

  // Table Columns
  const columns = [
    {
      header: 'Designation Title',
      key: 'name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>
            {r.name || r.title || '-'}
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
          {r.code || '—'}
        </span>
      ),
    },
    {
      header: 'Department',
      key: 'department',
      render: (r) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.84rem' }}>
          <Layers size={13} color="var(--text-muted)" />
          <span style={{ fontWeight: 500 }}>{r.department?.name || (typeof r.department === 'string' ? r.department : '-')}</span>
        </div>
      ),
    },
    {
      header: 'Hierarchy Level',
      key: 'level',
      render: (r) => {
        const lvlNum = Number(r.level) || 1;
        const isLeadership = lvlNum >= 7;
        const isMid = lvlNum >= 4 && lvlNum <= 6;
        const badgeColor = isLeadership ? 'purple' : isMid ? 'info' : 'secondary';

        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Award size={14} color={isLeadership ? '#8b5cf6' : 'var(--primary)'} />
            <Badge variant={badgeColor}>
              Level {lvlNum}
            </Badge>
          </div>
        );
      },
    },
    {
      header: 'Company',
      key: 'company',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <Building2 size={12} />
          <span>{r.company?.name || 'TIE Technologies'}</span>
        </div>
      ),
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
            title="Edit Designation"
            style={{ color: 'var(--primary)' }}
          >
            <Edit2 size={15} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(r)}
            title="Delete Designation"
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
            <Award size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Designations Master
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Hierarchical job title, level, and organizational grade management
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button variant="primary" icon={Plus} onClick={openAddModal}>
            Add Designation
          </Button>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(46, 123, 133, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1 }}>{stats.total}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Total Designations</div>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981', lineHeight: 1 }}>{stats.active}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Active Positions</div>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#8b5cf6', lineHeight: 1 }}>{stats.leadership}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Leadership Roles (L7+)</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 280, maxWidth: '100%' }}>
          <Input
            icon={Search}
            placeholder="Search title, code, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 0 }}
            inputStyle={{ height: 38, fontSize: '0.84rem' }}
          />
        </div>

        <div style={{ width: 200 }}>
          <Select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            options={[
              { value: '', label: 'All Departments' },
              ...departments.map((d) => ({ value: d._id, label: d.name })),
            ]}
            style={{ marginBottom: 0 }}
          />
        </div>

        <div style={{ width: 180 }}>
          <Select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Levels (1-10)' },
              { value: 'ENTRY', label: 'Entry / Junior (L1-L3)' },
              { value: 'MID', label: 'Mid-Level (L4-L6)' },
              { value: 'SENIOR', label: 'Leadership (L7-L10)' },
            ]}
            style={{ marginBottom: 0 }}
          />
        </div>

        <div style={{ width: 140 }}>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Status' },
              { value: 'ACTIVE', label: 'Active Only' },
              { value: 'INACTIVE', label: 'Inactive Only' },
            ]}
            style={{ marginBottom: 0 }}
          />
        </div>

        {(search || departmentFilter || levelFilter !== 'ALL' || statusFilter !== 'ALL') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setDepartmentFilter('');
              setLevelFilter('ALL');
              setStatusFilter('ALL');
            }}
            style={{ fontSize: '0.8rem', height: 38 }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="card">
        <Table
          columns={columns}
          data={filteredDesignations}
          loading={loading}
          emptyMessage="No designations found. Click 'Add Designation' to define a new hierarchical title."
        />
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDesig ? 'Edit Designation' : 'Create New Designation'}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="grid-2">
            <Select
              label="Department *"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              options={departments.map((d) => ({ value: d._id, label: d.name }))}
              required
            />

            {companies.length > 0 && (
              <Select
                label="Company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                options={companies.map((c) => ({ value: c._id, label: c.name }))}
              />
            )}
          </div>

          <div className="grid-2">
            <Input
              label="Designation Title *"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Senior Project Manager"
              required
            />

            <Input
              label="Designation Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. SPM"
            />
          </div>

          <div className="grid-2">
            <Select
              label="Seniority Level (1 to 10)"
              value={String(formData.level)}
              onChange={(e) => setFormData({ ...formData, level: Number(e.target.value) })}
              options={levels.map((lvl) => ({
                value: String(lvl.value),
                label: lvl.label,
              }))}
              required
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

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ marginBottom: 6 }}>
              Description & Expectations
            </label>
            <textarea
              className="form-control"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Key responsibilities, domain focus, and role overview..."
              rows={3}
              style={{ width: '100%', fontSize: '0.86rem', resize: 'vertical' }}
            />
          </div>

          <div className="modal-footer" style={{ margin: '16px -20px -20px' }}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingDesig ? 'Update Designation' : 'Create Designation'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Designations;
