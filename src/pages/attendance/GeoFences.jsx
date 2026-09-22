import React, { useState, useEffect } from 'react';
import geoApi from '../../api/geoApi';
import masterApi from '../../api/masterApi';
import projectTaskApi from '../../api/projectTaskApi';
import { useToast } from '../../context/ToastContext';
import {
  Plus,
  MapPin,
  Trash2,
  Shield,
  CircleDot,
  History,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Navigation,
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { attendanceNav } from '../../routes/moduleNavConfig';

export const GeoFences = () => {
  const [fences, setFences] = useState([]);
  const [branches, setBranches] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [locationLogs, setLocationLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Module 5: GPS Accuracy & Fail-Closed Settings
  const [accuracySettings, setAccuracySettings] = useState({
    maxAcceptableAccuracyMeters: 100,
    failClosedOnMissingFence: false,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    scope: 'BRANCH',
    referenceId: '',
    centerLatitude: 23.0225,
    centerLongitude: 72.5714,
    radiusMeters: 100,
    isActive: true,
  });

  const { showToast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [fRes, bRes, pRes, sRes] = await Promise.all([
        geoApi.getGeoFences(),
        masterApi.getBranches(),
        projectTaskApi.getProjects().catch(() => ({ data: [] })),
        geoApi.getAccuracySettings().catch(() => null),
      ]);
      const fenceList = Array.isArray(fRes) ? fRes : (Array.isArray(fRes?.data) ? fRes.data : (fRes?.geofences || fRes?.fences || []));
      const branchList = Array.isArray(bRes) ? bRes : (Array.isArray(bRes?.data) ? bRes.data : (bRes?.branches || []));
      const projectList = Array.isArray(pRes) ? pRes : (Array.isArray(pRes?.data) ? pRes.data : (pRes?.projects || []));
      setFences(fenceList);
      setBranches(branchList);
      setProjects(projectList);

      if (sRes) {
        const sData = sRes?.data || sRes;
        setAccuracySettings({
          maxAcceptableAccuracyMeters: sData?.maxAcceptableAccuracyMeters || sData?.threshold || 100,
          failClosedOnMissingFence: Boolean(sData?.failClosedOnMissingFence),
        });
      }
    } catch (err) {
      showToast('Failed to load geo-fences', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAccuracySettings = async () => {
    setSavingSettings(true);
    try {
      await geoApi.updateAccuracySettings(accuracySettings);
      showToast('Geofence enforcement & accuracy policy updated successfully!', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update geofence policy', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const loadLocationLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await geoApi.getAllLocationLogs({ limit: 10 });
      const logList = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (res?.locationLogs || res?.logs || []));
      setLocationLogs(logList);
    } catch {
      setLocationLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadData();
    loadLocationLogs();
  }, []);

  const openAddModal = () => {
    setFormData({
      name: '',
      scope: 'BRANCH',
      referenceId: branches[0]?._id || '',
      centerLatitude: 23.0225,
      centerLongitude: 72.5714,
      radiusMeters: 100,
      isActive: true,
    });
    setModalOpen(true);
  };

  // Step 1: Create GeoFence (POST /api/geo/fences)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.referenceId) {
      showToast('Please specify a name and reference entity', 'warning');
      return;
    }

    setSubmitting(true);
    const payload = {
      name: formData.name.trim(),
      scope: formData.scope,
      reference: formData.referenceId,
      referenceId: formData.referenceId,
      referenceModel: formData.scope === 'BRANCH' ? 'Branch' : 'ProjectSite',
      centerLatitude: parseFloat(formData.centerLatitude),
      centerLongitude: parseFloat(formData.centerLongitude),
      radiusMeters: parseInt(formData.radiusMeters, 10),
      isActive: true,
    };

    try {
      await geoApi.createGeoFence(payload);
      showToast('Geo-Fence boundary created successfully!', 'success');
      setModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create geo-fence', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (fence) => {
    try {
      await geoApi.deactivateGeoFence(fence._id);
      showToast('Geo-Fence deactivated', 'success');
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to deactivate fence', 'error');
    }
  };

  const useCurrentDeviceLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFormData((prev) => ({
            ...prev,
            centerLatitude: parseFloat(pos.coords.latitude.toFixed(6)),
            centerLongitude: parseFloat(pos.coords.longitude.toFixed(6)),
          }));
          showToast('Updated coordinates from current device GPS!', 'success');
        },
        (err) => {
          showToast('Could not fetch GPS: ' + err.message, 'warning');
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const fenceColumns = [
    {
      header: 'Boundary / Scope',
      key: 'name',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CircleDot size={18} color="var(--primary)" />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Scope: <span style={{ fontWeight: 500 }}>{r.scope}</span> • {r.referenceId?.name || r.referenceId?._id || ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Center Coordinates',
      key: 'centerLatitude',
      render: (r) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
          {r.centerLatitude?.toFixed(4)}, {r.centerLongitude?.toFixed(4)}
        </span>
      ),
    },
    {
      header: 'Perimeter Radius',
      key: 'radiusMeters',
      render: (r) => <Badge variant="info">{r.radiusMeters} meters</Badge>,
    },
    {
      header: 'Spatial Status',
      key: 'isActive',
      render: (r) => (
        <Badge variant={r.isActive !== false ? 'success' : 'danger'}>
          {r.isActive !== false ? 'Active Fence' : 'Deactivated'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <Button
          variant="outline-danger"
          size="sm"
          onClick={() => handleDeactivate(r)}
          icon={Trash2}
          title="Deactivate boundary"
        >
          Deactivate
        </Button>
      ),
    },
  ];

  const logColumns = [
    {
      header: 'Employee',
      key: 'employee',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {r.employee?.firstName ? `${r.employee.firstName} ${r.employee.lastName || ''}` : r.employee?.name || 'Employee'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Accuracy: {r.gpsAccuracy ? `±${r.gpsAccuracy}m` : 'N/A'}
          </div>
        </div>
      ),
    },
    {
      header: 'Attendance Mode',
      key: 'attendanceType',
      render: (r) => <Badge variant="neutral">{r.attendanceType || 'OFFICE'}</Badge>,
    },
    {
      header: 'Reverse Geocoded Location',
      key: 'address',
      render: (r) => (
        <div style={{ fontSize: '0.82rem', maxWidth: 280 }}>
          <div>{r.address || `${r.latitude?.toFixed(4)}, ${r.longitude?.toFixed(4)}`}</div>
          {r.matchedSiteIds?.length > 0 && (
            <div style={{ fontSize: '0.74rem', color: 'var(--primary)', marginTop: 2 }}>
              Matched Sites: {r.matchedSiteIds.length} in 500m
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Spatial Authorization',
      key: 'permitted',
      render: (r) =>
        r.permitted ? (
          <Badge variant="success">Permitted</Badge>
        ) : (
          <Badge variant="danger">{r.reason || 'OUTSIDE_GEOFENCE'}</Badge>
        ),
    },
    {
      header: 'Resolved At',
      key: 'resolvedAt',
      render: (r) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {r.resolvedAt ? new Date(r.resolvedAt).toLocaleString() : 'Recent'}
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ModuleSubNav items={attendanceNav} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Geo-Fences &amp; Boundaries
          </h2>
        </div>

        <Button variant="primary" icon={Plus} onClick={openAddModal}>
          Create Geo-Fence
        </Button>
      </div>

      {/* Geofence Enforcement Policy Card */}
      <div className="card" style={{ padding: '14px 18px', backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={16} color="var(--primary)" />
            Office Geofence Enforcement Policy
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Status: <strong>{accuracySettings.failClosedOnMissingFence ? 'Strict Block (Fail-Closed)' : 'Allowed when fence unconfigured'}</strong> • Max GPS Accuracy: <strong>{accuracySettings.maxAcceptableAccuracyMeters}m</strong>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!accuracySettings.failClosedOnMissingFence}
              onChange={(e) => setAccuracySettings({ ...accuracySettings, failClosedOnMissingFence: !e.target.checked })}
            />
            <span>Allow Check-In if branch fence missing</span>
          </label>
          <Button
            size="sm"
            variant="secondary"
            loading={savingSettings}
            onClick={handleSaveAccuracySettings}
          >
            Save Policy
          </Button>
        </div>
      </div>

      {/* Geo-Fences Table */}
      <div className="card">
        <Table columns={fenceColumns} data={fences} loading={loading} emptyMessage="No active geo-fences configured." />
      </div>

      {/* STEP 1: Create Circular Geo-Fence Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create Circular Geo-Fence (Step 1)" size="lg">
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <Input
              label="Fence Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Head Office - Ahmedabad Main Campus Fence"
              required
            />

            <Select
              label="Boundary Scope"
              value={formData.scope}
              onChange={(e) => {
                const newScope = e.target.value;
                setFormData({
                  ...formData,
                  scope: newScope,
                  referenceId: newScope === 'BRANCH' ? branches[0]?._id || '' : projects[0]?._id || '',
                });
              }}
              options={[
                { value: 'BRANCH', label: 'Branch Office (Module 2)' },
                { value: 'PROJECT_SITE', label: 'Project Site (Module 9)' },
              ]}
              required
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            {formData.scope === 'BRANCH' ? (
              <Select
                label="Associated Branch Location (Module 2)"
                value={formData.referenceId}
                onChange={(e) => setFormData({ ...formData, referenceId: e.target.value })}
                options={branches.map((b) => ({ value: b._id, label: b.name }))}
                required
              />
            ) : (
              <Select
                label="Associated Project Site"
                value={formData.referenceId}
                onChange={(e) => setFormData({ ...formData, referenceId: e.target.value })}
                options={projects.map((p) => ({ value: p._id, label: p.title || p.name }))}
                required
              />
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button
              type="button"
              onClick={useCurrentDeviceLocation}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontWeight: 500,
              }}
            >
              <Navigation size={14} /> Detect Current Coordinates via GPS
            </button>
          </div>

          <div className="grid-3">
            <Input
              label="Center Latitude"
              type="number"
              step="any"
              value={formData.centerLatitude}
              onChange={(e) => setFormData({ ...formData, centerLatitude: e.target.value })}
              placeholder="23.0225"
              required
            />
            <Input
              label="Center Longitude"
              type="number"
              step="any"
              value={formData.centerLongitude}
              onChange={(e) => setFormData({ ...formData, centerLongitude: e.target.value })}
              placeholder="72.5714"
              required
            />
            <Input
              label="Radius (10m to 5,000m)"
              type="number"
              min="10"
              max="5000"
              value={formData.radiusMeters}
              onChange={(e) => setFormData({ ...formData, radiusMeters: e.target.value })}
              placeholder="100"
              required
            />
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Create Boundary Fence
            </Button>
          </div>
        </form>
      </Modal>

      {/* STEP 5: Location Audit Trail */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
              Spatial Authorization & Location Audit Trail (Step 5)
            </h3>
          </div>
          <Button size="sm" variant="light" icon={RefreshCw} onClick={loadLocationLogs} loading={loadingLogs}>
            Refresh Audit Logs
          </Button>
        </div>

        <Table
          columns={logColumns}
          data={locationLogs}
          loading={loadingLogs}
          emptyMessage="No spatial authorization logs recorded yet."
        />
      </div>
    </div>
  );
};

export default GeoFences;
