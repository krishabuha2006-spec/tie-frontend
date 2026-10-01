import React, { useState, useEffect, useMemo } from 'react';
import masterApi from '../../api/masterApi';
import geoApi from '../../api/geoApi';
import { useToast } from '../../context/ToastContext';
import { validateEmail, validatePhone } from '../../utils/validation';
import { Plus, Edit2, Trash2, MapPin, Compass, Search, CheckCircle, ShieldCheck, X } from 'lucide-react';
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

export const Branches = () => {
  const [branches, setBranches] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
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
      const branchList = extractApiData(brRes, 'branches', 'data');
      const compList = extractApiData(compRes, 'companies', 'data');
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

  // Quick Stats
  const stats = useMemo(() => {
    const total = branches.length;
    const active = branches.filter((b) => b.isActive !== false).length;
    const geoFenced = branches.filter((b) => {
      const gf = b.geoFence;
      const lat = gf?.latitude || b.latitude;
      const lon = gf?.longitude || b.longitude;
      return Boolean(lat && lon);
    }).length;
    return { total, active, geoFenced };
  }, [branches]);

  // Client-Filtered Branches
  const filteredBranches = useMemo(() => {
    return branches.filter((b) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = b.name?.toLowerCase().includes(q);
        const matchesCode = b.code?.toLowerCase().includes(q);
        const matchesEmail = b.email?.toLowerCase().includes(q);
        const matchesCity = b.address?.city?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesEmail && !matchesCity) return false;
      }
      if (companyFilter) {
        const compId = b.company?._id || b.company;
        if (String(compId) !== String(companyFilter)) return false;
      }
      if (statusFilter === 'ACTIVE' && b.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && b.isActive !== false) return false;
      return true;
    });
  }, [branches, search, companyFilter, statusFilter]);

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
    const lat = formData.latitude ? Number(formData.latitude) : undefined;
    const lon = formData.longitude ? Number(formData.longitude) : undefined;
    const radius = Number(formData.radiusInMeters) || 500;

    const compId = typeof formData.company === 'object' ? formData.company?._id : (formData.company || undefined);
    const payload = {
      company: compId,
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      email: formData.email?.trim() || undefined,
      phone: formData.phone?.trim() || undefined,
      latitude: lat,
      longitude: lon,
      radiusInMeters: radius,
      geoFence: lat && lon ? {
        latitude: lat,
        longitude: lon,
        radiusInMeters: radius,
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
      let savedBranch = null;
      if (editingBranch) {
        const res = await masterApi.updateBranch(editingBranch._id, payload);
        savedBranch = res?.data || res;
        showToast('Branch updated successfully!', 'success');
      } else {
        const res = await masterApi.createBranch(payload);
        savedBranch = res?.data || res;
        showToast('Branch created successfully!', 'success');
      }

      // Automatically sync 500m GeoFence in backend /geo/geofences collection
      const branchId = savedBranch?._id || savedBranch?.id || editingBranch?._id;
      if (branchId && lat && lon) {
        try {
          let existingFence = null;
          try {
            const fencesRes = await geoApi.getGeoFences({ scope: 'BRANCH' });
            const list = Array.isArray(fencesRes) ? fencesRes : fencesRes?.data || fencesRes?.geofences || [];
            existingFence = list.find((f) => String(f.reference || f.referenceId) === String(branchId));
          } catch {}

          const fencePayload = {
            name: `${formData.name} Branch Geofence`,
            scope: 'BRANCH',
            reference: branchId,
            referenceId: branchId,
            referenceModel: 'Branch',
            centerLatitude: lat,
            centerLongitude: lon,
            radiusMeters: radius,
            isActive: true,
          };

          if (existingFence?._id || existingFence?.id) {
            await geoApi.updateGeoFence(existingFence._id || existingFence.id, fencePayload);
          } else {
            await geoApi.createGeoFence(fencePayload);
          }
        } catch (gfErr) {
          console.warn('Auto-sync of branch GeoFence non-fatal notice:', gfErr);
        }
      }

      setModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save branch', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (branch) => {
    const nextStatus = branch.isActive === false;
    try {
      await masterApi.updateBranch(branch._id, { isActive: nextStatus });
      showToast(`Branch marked as ${nextStatus ? 'Active' : 'Inactive'}`, 'success');
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update branch status', 'error');
    }
  };

  const handleDelete = async () => {
    if (!branchToDelete) return;
    setSubmitting(true);
    try {
      await masterApi.deleteBranch(branchToDelete._id);
      showToast('Branch deleted successfully', 'success');
      setDeleteConfirmOpen(false);
      loadData();
    } catch (err) {
      if (err.response?.status === 409 || err.status === 409) {
        try {
          await masterApi.updateBranch(branchToDelete._id, { isActive: false });
          showToast('Branch has associated records, so it was marked as Inactive instead.', 'info');
          setDeleteConfirmOpen(false);
          loadData();
          return;
        } catch (deactErr) {
          showToast(deactErr.response?.data?.message || 'Failed to deactivate branch', 'error');
          return;
        }
      }
      showToast(err.response?.data?.message || err.message || 'Failed to delete branch', 'error');
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
            title="Edit Branch"
            style={{ color: 'var(--primary)' }}
          >
            <Edit2 size={15} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setBranchToDelete(r);
              setDeleteConfirmOpen(true);
            }}
            title="Deactivate Branch"
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
            <MapPin size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Branch Locations Master
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Branch management with 500m GeoFence support
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button variant="primary" icon={Plus} onClick={openAddModal}>
            Add New Branch
          </Button>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(46, 123, 133, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1 }}>{stats.total}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Total Branches</div>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1 }}>{stats.active}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Active Branches</div>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Compass size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1 }}>{stats.geoFenced}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>500m GeoFenced</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 260, maxWidth: '100%' }}>
          <Input
            icon={Search}
            placeholder="Search by branch name, code, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputStyle={{ height: 36, fontSize: '0.84rem' }}
            style={{ marginBottom: 0 }}
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
              style={{ height: 36, fontSize: '0.84rem', marginBottom: 0 }}
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
            style={{ height: 36, fontSize: '0.84rem', marginBottom: 0 }}
          />
        </div>

        {(search || companyFilter || statusFilter !== 'ALL') && (
          <Button
            variant="ghost"
            size="sm"
            icon={X}
            onClick={() => {
              setSearch('');
              setCompanyFilter('');
              setStatusFilter('ALL');
            }}
            style={{ fontSize: '0.8rem', height: 36 }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      <div className="card">
        <Table columns={columns} data={filteredBranches} loading={loading} emptyMessage="No branches matching criteria." />
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
