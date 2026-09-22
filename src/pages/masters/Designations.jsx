import React, { useState, useEffect } from 'react';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { Plus, Edit2, Trash2, Award, Search } from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { mastersNav } from '../../routes/moduleNavConfig';

/** Normalize any backend response shape into a plain array */
const extractList = (res, ...keys) => {
  if (Array.isArray(res)) return res;
  for (const k of keys) {
    if (res && Array.isArray(res[k])) return res[k];
    if (res?.data && Array.isArray(res.data[k])) return res.data[k];
  }
  if (res && Array.isArray(res.data)) return res.data;
  return [];
};

const LEVEL_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
  value: String(i + 1),
  label: `Level ${i + 1}`,
}));

const EMPTY_FORM = {
  department: '',
  name: '',
  code: '',
  level: '1',
  description: '',
  isActive: true,
};

export const Designations = () => {
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDesig, setEditingDesig] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [desigToDelete, setDesigToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);

  const { showToast } = useToast();

  // Load departments once on mount
  useEffect(() => {
    masterApi.getDepartments()
      .then((res) => setDepartments(extractList(res, 'departments', 'data')))
      .catch(() => {});
  }, []);

  // Load designations when filters change
  useEffect(() => {
    let cancelled = false;
    const fetchDesignations = async () => {
      setLoading(true);
      try {
        // Only send params that have values
        const params = {};
        if (filterDept) params.department = filterDept;
        if (search.trim()) params.search = search.trim();

        const res = await masterApi.getDesignations(Object.keys(params).length ? params : undefined);
        if (!cancelled) setDesignations(extractList(res, 'designations', 'data'));
      } catch (err) {
        if (!cancelled) showToast(err.response?.data?.message || 'Failed to load designations', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchDesignations();
    return () => { cancelled = true; };
  }, [filterDept, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = () => {
    // Trigger re-fetch by resetting filters (re-runs the above effect)
    setFilterDept((v) => v);
    setSearch((v) => v);
    // Force re-fetch via direct call
    masterApi.getDesignations().then((res) => {
      setDesignations(extractList(res, 'designations', 'data'));
    }).catch(() => {});
  };

  const openAddModal = () => {
    setEditingDesig(null);
    setFormData({ ...EMPTY_FORM, department: departments[0]?._id || '' });
    setModalOpen(true);
  };

  const openEditModal = (d) => {
    setEditingDesig(d);
    setFormData({
      department: d.department?._id || d.department || '',
      name: d.name || '',          // ← Swagger schema field is `name`
      code: d.code || '',
      level: String(d.level || 1),
      description: d.description || '',
      isActive: d.isActive !== false,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Designation name is required', 'error');
      return;
    }
    if (!formData.department) {
      showToast('Department is required', 'error');
      return;
    }
    setSubmitting(true);

    const payload = {
      name: formData.name.trim(),
      department: formData.department,
      code: formData.code ? formData.code.trim().toUpperCase() : undefined,
      level: Number(formData.level) || 1,
      description: formData.description.trim() || undefined,
      isActive: formData.isActive,
    };

    try {
      if (editingDesig) {
        await masterApi.updateDesignation(editingDesig._id, payload);
        showToast('Designation updated successfully!', 'success');
      } else {
        await masterApi.createDesignation(payload);
        showToast('Designation created successfully!', 'success');
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save designation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!desigToDelete) return;
    setSubmitting(true);
    try {
      await masterApi.deleteDesignation(desigToDelete._id);
      showToast('Designation deleted successfully', 'success');
      setDeleteConfirmOpen(false);
      setDesigToDelete(null);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete designation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Designation',
      key: 'name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.name || r.title || '-'}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.description || ''}</div>
        </div>
      ),
    },
    {
      header: 'Code',
      key: 'code',
      render: (r) => r.code ? <Badge variant="primary">{r.code}</Badge> : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      header: 'Department',
      key: 'department',
      render: (r) => r.department?.name || r.department || '-',
    },
    {
      header: 'Level',
      key: 'level',
      render: (r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
          <Award size={14} color="var(--primary)" />
          L{r.level || 1}
        </span>
      ),
    },
    {
      header: 'Status',
      key: 'isActive',
      render: (r) => <Badge variant={r.isActive ? 'success' : 'danger'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(r)} title="Edit">
            <Edit2 size={14} />
          </button>
          <button
            className="btn btn-outline-danger btn-sm"
            onClick={() => {
              setDesigToDelete(r);
              setDeleteConfirmOpen(true);
            }}
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ModuleSubNav items={mastersNav} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Designations Master</h2>
        </div>
        <Button variant="primary" icon={Plus} onClick={openAddModal}>
          Add Designation
        </Button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 300 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="form-control"
            style={{ paddingLeft: 32 }}
            placeholder="Search by name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ flex: '1 1 180px', maxWidth: 260 }}>
          <select
            className="form-control"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <Table columns={columns} data={designations} loading={loading} emptyMessage="No designations configured." />
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDesig ? 'Edit Designation' : 'Add New Designation'}
      >
        <form onSubmit={handleSubmit}>
          <Select
            label="Department *"
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            options={departments.map((d) => ({ value: d._id, label: d.name }))}
            required
          />
          <Input
            label="Designation Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Senior Software Engineer"
            required
          />
          <Input
            label="Designation Code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="e.g. SR_SE"
          />
          <Select
            label="Seniority Level (1 – 10)"
            value={formData.level}
            onChange={(e) => setFormData({ ...formData, level: e.target.value })}
            options={LEVEL_OPTIONS}
          />
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Core responsibilities and seniority criteria"
              rows={3}
            />
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingDesig ? 'Save Changes' : 'Create Designation'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => { setDeleteConfirmOpen(false); setDesigToDelete(null); }}
        onConfirm={handleDelete}
        title="Delete Designation"
        message={`Are you sure you want to delete "${desigToDelete?.name || desigToDelete?.title}"? This action cannot be undone if no employees are assigned.`}
        confirmText="Delete"
        loading={submitting}
      />
    </div>
  );
};

export default Designations;
