import React, { useState, useEffect } from 'react';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { validateEmail, validatePhone } from '../../utils/validation';
import { Plus, Edit2, Trash2, Building2 } from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { mastersNav } from '../../routes/moduleNavConfig';
import { extractApiData } from '../../utils/apiUtils';

export const Companies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    website: '',
    taxNumber: '',
    registrationNumber: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
  });

  const { showToast } = useToast();

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const res = await masterApi.getCompanies();
      const list = extractApiData(res, 'companies', 'data');
      setCompanies(list);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load companies from backend', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const openAddModal = () => {
    setEditingCompany(null);
    setFormData({
      name: '',
      code: '',
      email: '',
      phone: '',
      website: '',
      taxNumber: '',
      registrationNumber: '',
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
    });
    setModalOpen(true);
  };

  const openEditModal = (comp) => {
    setEditingCompany(comp);
    setFormData({
      name: comp.name || '',
      code: comp.code || '',
      email: comp.email || '',
      phone: comp.phone || '',
      website: comp.website || '',
      taxNumber: comp.gstNumber || comp.taxNumber || '',
      registrationNumber: comp.panNumber || comp.registrationNumber || '',
      street: comp.address?.street || '',
      city: comp.address?.city || '',
      state: comp.address?.state || '',
      postalCode: comp.address?.postalCode || comp.address?.pincode || '',
      country: comp.address?.country || 'India',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailErr = validateEmail(formData.email, { fieldName: 'Official email' });
    if (emailErr) {
      showToast(emailErr, 'warning');
      return;
    }
    if (formData.phone?.trim()) {
      const phoneErr = validatePhone(formData.phone, { required: false, fieldName: 'Phone number' });
      if (phoneErr) {
        showToast(phoneErr, 'warning');
        return;
      }
    }
    setSubmitting(true);
    const payload = {
      name: formData.name,
      code: formData.code.toUpperCase(),
      email: formData.email,
      phone: formData.phone,
      website: formData.website,
      taxNumber: formData.taxNumber,
      registrationNumber: formData.registrationNumber,
      gstNumber: formData.taxNumber || undefined,
      panNumber: formData.registrationNumber || (formData.taxNumber && formData.taxNumber.length >= 12 ? formData.taxNumber.slice(2, 12) : undefined),
      address: {
        street: formData.street,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        postalCode: formData.postalCode,
        pincode: formData.postalCode,
      },
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

  const handleDelete = async () => {
    if (!companyToDelete) return;
    setSubmitting(true);
    try {
      await masterApi.deleteCompany(companyToDelete._id);
      showToast('Company deactivated successfully', 'success');
      setDeleteConfirmOpen(false);
      loadCompanies();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to deactivate company', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Company Name',
      key: 'name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.name}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.website || r.email}</div>
        </div>
      ),
    },
    {
      header: 'Code',
      key: 'code',
      render: (r) => <Badge variant="primary">{r.code}</Badge>,
    },
    {
      header: 'Phone / Tax ID',
      key: 'phone',
      render: (r) => (
        <div>
          <div>{r.phone || '-'}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>GST: {r.taxNumber || '-'}</div>
        </div>
      ),
    },
    {
      header: 'Location',
      key: 'city',
      render: (r) => (
        <div>
          {r.address?.city || '-'}, {r.address?.state || ''}
        </div>
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
              setCompanyToDelete(r);
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Companies Master</h2>
        </div>
        <Button variant="primary" icon={Plus} onClick={openAddModal}>
          Add New Company
        </Button>
      </div>

      <div className="card">
        <Table columns={columns} data={companies} loading={loading} emptyMessage="No companies configured." />
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCompany ? 'Edit Company' : 'Add New Company'}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <Input
              label="Company Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. TIE Technologies Pvt Ltd"
              required
            />
            <Input
              label="Company Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g. TIE-HQ"
              required
            />
            <Input
              label="Official Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="contact@tietechnologies.com"
              required
            />
            <Input
              label="Phone Number"
              type="tel"
              isPhone={true}
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="10-digit phone number"
            />
            <Input
              label="Website"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://tietechnologies.com"
            />
            <Input
              label="GST / Tax Number"
              value={formData.taxNumber}
              onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
              placeholder="24ABCDE1234F1Z5"
            />
            <Input
              label="Registration No (CIN)"
              value={formData.registrationNumber}
              onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
              placeholder="U72900GJ2026PTC123456"
            />
            <Input
              label="Street Address"
              value={formData.street}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              placeholder="1001, Tech Park, SG Highway"
            />
            <Input
              label="City"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Ahmedabad"
              required
            />
            <Input
              label="State"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              placeholder="Gujarat"
              required
            />
            <Input
              label="Postal Code"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              placeholder="380054"
            />
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
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
