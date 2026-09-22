import React, { useState, useEffect } from 'react';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { mastersNav } from '../../routes/moduleNavConfig';

export const Departments = () => {
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    company: '',
    name: '',
    code: '',
    description: '',
  });

  const { showToast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [deptRes, compRes] = await Promise.all([
        masterApi.getDepartments(),
        masterApi.getCompanies(),
      ]);
      const deptList = Array.isArray(deptRes) ? deptRes : (Array.isArray(deptRes?.data) ? deptRes.data : (deptRes?.departments || deptRes?.data?.departments || []));
      const compList = Array.isArray(compRes) ? compRes : (Array.isArray(compRes?.data) ? compRes.data : (compRes?.companies || compRes?.data?.companies || []));
      setDepartments(deptList);
      setCompanies(compList);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load departments', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingDept(null);
    setFormData({
      company: companies[0]?._id || '',
      name: '',
      code: '',
      description: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (d) => {
    setEditingDept(d);
    setFormData({
      company: d.company?._id || d.company || '',
      name: d.name || '',
      code: d.code || '',
      description: d.description || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      company: formData.company,
      name: formData.name,
      code: formData.code.toUpperCase(),
      description: formData.description,
    };

    try {
      if (editingDept) {
        await masterApi.updateDepartment(editingDept._id, payload);
        showToast('Department updated successfully!', 'success');
      } else {
        await masterApi.createDepartment(payload);
        showToast('Department created successfully!', 'success');
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save department', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deptToDelete) return;
    setSubmitting(true);
    try {
      await masterApi.deleteDepartment(deptToDelete._id);
      showToast('Department deactivated successfully', 'success');
      setDeleteConfirmOpen(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to deactivate department', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Department Name',
      key: 'name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.name}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.description || '-'}</div>
        </div>
      ),
    },
    {
      header: 'Code',
      key: 'code',
      render: (r) => <Badge variant="primary">{r.code}</Badge>,
    },
    {
      header: 'Company',
      key: 'company',
      render: (r) => r.company?.name || '-',
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
              setDeptToDelete(r);
              setDeleteConfirmOpen(true);
            }}
            title="Deactivate"
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Departments Master</h2>
        </div>
        <Button variant="primary" icon={Plus} onClick={openAddModal}>
          Add Department
        </Button>
      </div>

      <div className="card">
        <Table columns={columns} data={departments} loading={loading} emptyMessage="No departments configured." />
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDept ? 'Edit Department' : 'Add New Department'}
      >
        <form onSubmit={handleSubmit}>
          <Select
            label="Company"
            value={formData.company}
            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            options={companies.map((c) => ({ value: c._id, label: c.name }))}
            required
          />
          <Input
            label="Department Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Software Engineering"
            required
          />
          <Input
            label="Department Code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="DEPT-ENG"
            required
          />
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Core engineering and technical operations"
            />
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingDept ? 'Save Changes' : 'Create Department'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Deactivate Department"
        message={`Are you sure you want to deactivate department "${deptToDelete?.name}"?`}
        confirmText="Deactivate"
        loading={submitting}
      />
    </div>
  );
};

export default Departments;
