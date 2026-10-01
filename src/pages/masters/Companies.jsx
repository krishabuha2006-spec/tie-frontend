import React, { useState, useEffect, useMemo } from 'react';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { validateEmail, validatePhone } from '../../utils/validation';
import { Plus, Edit2, Trash2, Building2, Search, CheckCircle, ShieldCheck, X } from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { mastersNav } from '../../routes/moduleNavConfig';
import { extractApiData } from '../../utils/apiUtils';

export const Companies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const emptyForm = { name: '', code: '', email: '', phone: '', gstNumber: '', panNumber: '' };

  const [formData, setFormData] = useState(emptyForm);
  const { showToast } = useToast();

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const res = await masterApi.getCompanies();
      const list = extractApiData(res, 'companies', 'data');
      setCompanies(list);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load companies', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCompanies(); }, []);

  const stats = useMemo(() => {
    const total = companies.length;
    const active = companies.filter((c) => c.isActive !== false).length;
    const gstRegistered = companies.filter((c) => Boolean(c.gstNumber || c.taxNumber || c.gst)).length;
    return { total, active, gstRegistered };
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !c.name?.toLowerCase().includes(q) &&
          !c.code?.toLowerCase().includes(q) &&
          !c.email?.toLowerCase().includes(q) &&
          !(c.gstNumber || c.taxNumber || '')?.toLowerCase().includes(q) &&
          !(c.panNumber || '')?.toLowerCase().includes(q)
        ) return false;
      }
      if (statusFilter === 'ACTIVE' && c.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && c.isActive !== false) return false;
      return true;
    });
  }, [companies, search, statusFilter]);

  const openAddModal = () => {
    setEditingCompany(null);
    setFormData(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (comp) => {
    setEditingCompany(comp);
    setFormData({
      name: comp.name || '',
      code: comp.code || '',
      email: comp.email || '',
      phone: comp.phone || '',
      gstNumber: comp.gstNumber || comp.taxNumber || comp.gst || comp.gstin || '',
      panNumber: comp.panNumber || comp.pan || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.email?.trim()) {
      const emailErr = validateEmail(formData.email, { fieldName: 'Official email' });
      if (emailErr) { showToast(emailErr, 'warning'); return; }
    } else if (!editingCompany) {
      showToast('Official email is required', 'warning');
      return;
    }

    if (formData.phone?.trim()) {
      const phoneErr = validatePhone(formData.phone, { required: false, fieldName: 'Phone number' });
      if (phoneErr) { showToast(phoneErr, 'warning'); return; }
    }

    setSubmitting(true);
    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      email: formData.email.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      gstNumber: formData.gstNumber.trim().toUpperCase() || undefined,
      panNumber: formData.panNumber.trim().toUpperCase() || undefined,
    };

    try {
      if (editingCompany) {
        await masterApi.updateCompany(editingCompany._id, payload);
        showToast('Company updated successfully!', 'success');
      } else {
        await masterApi.createCompany(payload);
        showToast('Company created successfully!', 'success');
      }
      setModalOpen(false);
      loadCompanies();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save company', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (comp) => {
    const nextStatus = comp.isActive === false;
    try {
      await masterApi.updateCompany(comp._id, { isActive: nextStatus });
      showToast(`Company marked as ${nextStatus ? 'Active' : 'Inactive'}`, 'success');
      loadCompanies();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update company status', 'error');
    }
  };

  const handleDelete = async () => {
    if (!companyToDelete) return;
    setSubmitting(true);
    try {
      await masterApi.deleteCompany(companyToDelete._id);
      showToast('Company deleted successfully', 'success');
      setDeleteConfirmOpen(false);
      loadCompanies();
    } catch (err) {
      if (err.response?.status === 409 || err.status === 409) {
        try {
          await masterApi.updateCompany(companyToDelete._id, { isActive: false });
          showToast('Company has active branches, so it was marked as Inactive instead.', 'info');
          setDeleteConfirmOpen(false);
          loadCompanies();
          return;
        } catch (deactErr) {
          showToast(deactErr.response?.data?.message || 'Failed to deactivate company', 'error');
          return;
        }
      }
      showToast(err.response?.data?.message || err.message || 'Failed to delete company', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field) => (e) => setFormData((p) => ({ ...p, [field]: e.target.value }));

  const columns = [
    {
      header: 'Company Name',
      key: 'name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.name}</div>
          {r.email && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.email}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Code',
      key: 'code',
      render: (r) => <Badge variant="primary">{r.code}</Badge>,
    },
    {
      header: 'Phone',
      key: 'phone',
      render: (r) => (
        <div style={{ fontWeight: 500 }}>{r.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>}</div>
      ),
    },
    {
      header: 'GST / PAN',
      key: 'gstNumber',
      render: (r) => {
        const gst = r.gstNumber || r.taxNumber || r.gst || '';
        const pan = r.panNumber || r.pan || '';
        if (!gst && !pan) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
        return (
          <div style={{ fontSize: '0.83rem', fontFamily: 'monospace' }}>
            {gst && <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>GST: {gst}</div>}
            {pan && <div style={{ color: 'var(--text-muted)' }}>PAN: {pan}</div>}
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
          <Button variant="ghost" size="sm" onClick={() => openEditModal(r)} title="Edit Company" style={{ color: 'var(--primary)' }}>
            <Edit2 size={15} />
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => { setCompanyToDelete(r); setDeleteConfirmOpen(true); }}
            title="Delete Company"
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
      <ModuleSubNav items={mastersNav} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'var(--primary-light, #f0f7f8)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Companies Master</h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Multi-company tenant management</div>
          </div>
        </div>
        <Button variant="primary" icon={Plus} onClick={openAddModal}>Add New Company</Button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          { label: 'Total Companies', value: stats.total, icon: Building2, color: 'var(--primary)', bg: 'rgba(46,123,133,0.1)' },
          { label: 'Active Entities', value: stats.active, icon: CheckCircle, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
          { label: 'GST Registered', value: stats.gstRegistered, icon: ShieldCheck, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={18} />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
          <Input
            icon={Search}
            placeholder="Search by name, code, GST, PAN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputStyle={{ height: 36, fontSize: '0.84rem' }}
            style={{ marginBottom: 0 }}
          />
        </div>
        <div style={{ width: 150 }}>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Status' },
              { value: 'ACTIVE', label: 'Active Only' },
              { value: 'INACTIVE', label: 'Inactive Only' },
            ]}
            style={{ height: 36, fontSize: '0.84rem', marginBottom: 0 }}
          />
        </div>
        {(search || statusFilter !== 'ALL') && (
          <Button variant="ghost" size="sm" icon={X} onClick={() => { setSearch(''); setStatusFilter('ALL'); }} style={{ fontSize: '0.8rem', height: 36 }}>
            Clear
          </Button>
        )}
      </div>

      <div className="card">
        <Table columns={columns} data={filteredCompanies} loading={loading} emptyMessage="No companies found." />
      </div>

      {/* Add / Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingCompany ? `Edit: ${editingCompany.name}` : 'Add New Company'} size="md">
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <Input label="Company Name" value={formData.name} onChange={set('name')} placeholder="TIE Technologies Pvt Ltd" required />
            <Input label="Company Code" value={formData.code} onChange={set('code')} placeholder="TIE-HQ" required />
            <Input
              label={`Official Email${editingCompany ? '' : ' *'}`}
              type="email"
              value={formData.email}
              onChange={set('email')}
              placeholder="info@company.com"
              required={!editingCompany}
            />
            <Input label="Phone Number" type="tel" isPhone value={formData.phone} onChange={set('phone')} placeholder="10-digit number" />
            <Input label="GST Number" value={formData.gstNumber} onChange={set('gstNumber')} placeholder="24ABCDE1234F1Z5" />
            <Input label="PAN Number" value={formData.panNumber} onChange={set('panNumber')} placeholder="ABCDE1234F" />
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingCompany ? 'Save Changes' : 'Create Company'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Deactivate Confirm */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Deactivate Company"
        message={`Are you sure you want to deactivate "${companyToDelete?.name}"?`}
        confirmText="Deactivate"
        loading={submitting}
      />
    </div>
  );
};

export default Companies;
