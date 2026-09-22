import React, { useState, useEffect } from 'react';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { validateEmail, validatePhone } from '../../utils/validation';
import { Plus, Edit2, Trash2, MapPin, Compass } from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { mastersNav } from '../../routes/moduleNavConfig';

export const Branches = () => {
  const [branches, setBranches] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    company: '',
    name: '',
    code: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    latitude: '',
    longitude: '',
    radiusInMeters: 500,
  });

  const { showToast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [brRes, compRes] = await Promise.all([
        masterApi.getBranches(),
        masterApi.getCompanies(),
      ]);
      const branchList = Array.isArray(brRes) ? brRes : (Array.isArray(brRes?.data) ? brRes.data : (brRes?.branches || brRes?.data?.branches || []));
      const compList = Array.isArray(compRes) ? compRes : (Array.isArray(compRes?.data) ? compRes.data : (compRes?.companies || compRes?.data?.companies || []));
      setBranches(branchList);
      setCompanies(compList);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load branches', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingBranch(null);
    setFormData({
      company: companies[0]?._id || '',
      name: '',
      code: '',
      email: '',
      phone: '',
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      latitude: '',
      longitude: '',
      radiusInMeters: 500,
    });
    setModalOpen(true);
  };

  const openEditModal = (b) => {
    setEditingBranch(b);
    const gf = b.geoFence || {};
    setFormData({
      company: b.company?._id || b.company || '',
      name: b.name || '',
      code: b.code || '',
      email: b.email || '',
      phone: b.phone || '',
      street: b.address?.street || '',
      city: b.address?.city || '',
      state: b.address?.state || '',
      postalCode: b.address?.postalCode || b.address?.pincode || '',
      country: b.address?.country || 'India',
      latitude: gf.latitude || b.latitude || '',
      longitude: gf.longitude || b.longitude || '',
      radiusInMeters: gf.radiusInMeters || 500,
    });
    setModalOpen(true);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
          radiusInMeters: 500,
        }));
        showToast('Current GPS coordinates captured for 500m GeoFence', 'success');
      },
      () => {
        showToast('Unable to retrieve GPS coordinates. Please grant location permissions.', 'warning');
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.email?.trim()) {
      const emailErr = validateEmail(formData.email, { required: false, fieldName: 'Official email' });
      if (emailErr) {
        showToast(emailErr, 'warning');
        return;
      }
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
      company: formData.company,
      name: formData.name,
      code: formData.code.toUpperCase(),
      email: formData.email,
      phone: formData.phone,
      geoFence: formData.latitude && formData.longitude ? {
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        radiusInMeters: Number(formData.radiusInMeters) || 500,
      } : undefined,
      address: {
        street: formData.street,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        postalCode: formData.postalCode,
      },
    };

    try {
      if (editingBranch) {
        await masterApi.updateBranch(editingBranch._id, payload);
        showToast('Branch updated successfully!', 'success');
      } else {
        await masterApi.createBranch(payload);
        showToast('Branch created successfully!', 'success');
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save branch', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!branchToDelete) return;
    setSubmitting(true);
    try {
      await masterApi.deleteBranch(branchToDelete._id);
      showToast('Branch deactivated successfully', 'success');
      setDeleteConfirmOpen(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to deactivate branch', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Branch Name',
      key: 'name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.name}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.email || '-'}</div>
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
      header: 'Location',
      key: 'city',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <MapPin size={14} color="var(--text-muted)" />
          <span>{r.address?.city || '-'}, {r.address?.state || ''}</span>
        </div>
      ),
    },
    {
      header: '500m GeoFence',
      key: 'geoFence',
      render: (r) => {
        const gf = r.geoFence;
        const lat = gf?.latitude || r.latitude;
        const lng = gf?.longitude || r.longitude;
        const rad = gf?.radiusInMeters || 500;
        return lat && lng ? (
          <div>
            <Badge variant="success" style={{ fontSize: '0.74rem' }}>{rad}m GeoFence Active</Badge>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
              {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
            </div>
          </div>
        ) : (
          <Badge variant="neutral" style={{ fontSize: '0.72rem' }}>500m Default</Badge>
        );
      },
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
              setBranchToDelete(r);
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Branch Locations</h2>
        </div>
        <Button variant="primary" icon={Plus} onClick={openAddModal}>
          Add New Branch
        </Button>
      </div>

      <div className="card">
        <Table columns={columns} data={branches} loading={loading} emptyMessage="No branches configured." />
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBranch ? 'Edit Branch' : 'Add New Branch'}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <Select
              label="Parent Company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              options={companies.map((c) => ({ value: c._id, label: c.name }))}
              required
            />
            <Input
              label="Branch Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Head Office - Ahmedabad"
              required
            />
            <Input
              label="Branch Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="BR-MAIN"
              required
            />
            <Input
              label="Official Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="ahmedabad@tietechnologies.com"
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
              label="Street Address"
              value={formData.street}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              placeholder="Titanium City Center, Prahladnagar"
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
              placeholder="380015"
            />
          </div>

          {/* 500m GeoFence Configuration Header */}
          <div style={{ margin: '16px 0 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Compass size={16} color="var(--primary)" />
                <span>500-Meter GeoFence Parameters (Attendance Gate)</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Coordinates used for Office & Site biometric check-in boundary validation
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleDetectLocation}
              style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Compass size={13} /> Detect My GPS
            </button>
          </div>

          <div className="grid-3">
            <Input
              label="Latitude"
              type="number"
              step="any"
              value={formData.latitude}
              onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
              placeholder="e.g. 23.0225"
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              value={formData.longitude}
              onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
              placeholder="e.g. 72.5714"
            />
            <Input
              label="Radius (Meters)"
              type="number"
              value={formData.radiusInMeters}
              onChange={(e) => setFormData({ ...formData, radiusInMeters: e.target.value })}
              placeholder="500"
            />
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingBranch ? 'Save Changes' : 'Create Branch'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Deactivate Branch"
        message={`Are you sure you want to deactivate branch "${branchToDelete?.name}"?`}
        confirmText="Deactivate"
        loading={submitting}
      />
    </div>
  );
};

export default Branches;
