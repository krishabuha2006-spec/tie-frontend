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
  Loader2,
  LocateFixed,
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

  // Actual Device GPS State
  const [deviceLocation, setDeviceLocation] = useState(null);
  const [fetchingGps, setFetchingGps] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    scope: 'BRANCH',
    referenceId: '',
    centerLatitude: '',
    centerLongitude: '',
    radiusMeters: 100,
    isActive: true,
  });

  const { showToast } = useToast();

  // Core function: Fetch real-time hardware / network device GPS location
  const fetchActualLocation = (updateForm = false, showNotification = true) => {
    if (!('geolocation' in navigator)) {
      const errText = 'GPS Geolocation is not supported by your browser.';
      setGpsError(errText);
      if (showNotification) showToast(errText, 'warning');
      return;
    }

    setFetchingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        const acc = Math.round(pos.coords.accuracy);

        const loc = { latitude: lat, longitude: lng, accuracy: acc, timestamp: new Date() };
        setDeviceLocation(loc);
        setFetchingGps(false);
        setGpsError(null);

        if (updateForm) {
          setFormData((prev) => ({
            ...prev,
            centerLatitude: lat,
            centerLongitude: lng,
          }));
        }

        if (showNotification) {
          showToast(`Live GPS detected: Lat ${lat}, Lng ${lng} (±${acc}m accuracy)`, 'success');
        }
      },
      (err) => {
        setFetchingGps(false);
        let msg = 'Could not fetch device GPS location.';
        if (err.code === 1) {
          msg = 'GPS Permission Denied. Please enable location permissions in your browser.';
        } else if (err.code === 2) {
          msg = 'GPS Position Unavailable. Please ensure device Location/GPS is turned ON.';
        } else if (err.code === 3) {
          msg = 'GPS request timed out. Please click "Retry Live GPS".';
        }
        setGpsError(msg);
        if (showNotification) {
          showToast(msg, 'warning');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [fRes, bRes, pRes, sRes] = await Promise.all([
        geoApi.getGeoFences().catch((err) => {
          if (err.response?.status === 403) console.warn('Geofences: 403 Forbidden - insufficient permissions');
          return { data: [] };
        }),
        masterApi.getBranches().catch((err) => {
          if (err.response?.status === 403) console.warn('Branches: 403 Forbidden - insufficient permissions');
          return { data: [] };
        }),
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
    // Auto-detect device GPS location on page load
    fetchActualLocation(false, false);
  }, []);

  const openAddModal = () => {
    const defaultBranch = branches[0];
    const initialLat = deviceLocation?.latitude ?? defaultBranch?.geoFence?.latitude ?? '';
    const initialLng = deviceLocation?.longitude ?? defaultBranch?.geoFence?.longitude ?? '';

    setFormData({
      name: defaultBranch ? `${defaultBranch.name} Fence` : '',
      scope: 'BRANCH',
      referenceId: defaultBranch?._id || '',
      centerLatitude: initialLat,
      centerLongitude: initialLng,
      radiusMeters: defaultBranch?.geoFence?.radiusInMeters || 100,
      isActive: true,
    });
    setModalOpen(true);

    // Fetch fresh live GPS coordinates immediately to update form
    fetchActualLocation(true, false);
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.referenceId) {
      showToast('Please specify a name and reference entity', 'warning');
      return;
    }

    const lat = parseFloat(formData.centerLatitude);
    const lng = parseFloat(formData.centerLongitude);
    if (isNaN(lat) || isNaN(lng)) {
      showToast('Please provide valid Latitude and Longitude GPS coordinates', 'warning');
      return;
    }

    setSubmitting(true);
    const payload = {
      name: formData.name.trim(),
      scope: formData.scope,
      reference: formData.referenceId,
      referenceId: formData.referenceId,
      referenceModel: formData.scope === 'BRANCH' ? 'Branch' : 'ProjectSite',
      centerLatitude: lat,
      centerLongitude: lng,
      radiusMeters: parseInt(formData.radiusMeters, 10) || 100,
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
    fetchActualLocation(true, true);
  };

  const useBranchCoordinates = () => {
    const selectedBranch = branches.find((b) => b._id === formData.referenceId);
    if (selectedBranch?.geoFence?.latitude && selectedBranch?.geoFence?.longitude) {
      setFormData((prev) => ({
        ...prev,
        centerLatitude: selectedBranch.geoFence.latitude,
        centerLongitude: selectedBranch.geoFence.longitude,
        radiusMeters: selectedBranch.geoFence.radiusInMeters || prev.radiusMeters,
      }));
      showToast(`Applied coordinates from ${selectedBranch.name}`, 'info');
    } else {
      showToast('Selected branch does not have pre-configured coordinates.', 'warning');
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

          {/* Live Device GPS Bar */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              backgroundColor: fetchingGps
                ? 'rgba(42, 171, 160, 0.08)'
                : deviceLocation
                  ? 'rgba(16, 185, 129, 0.08)'
                  : gpsError
                    ? 'rgba(239, 68, 68, 0.08)'
                    : 'var(--bg-subtle)',
              border: `1px solid ${fetchingGps
                  ? 'var(--primary)'
                  : deviceLocation
                    ? '#10b981'
                    : gpsError
                      ? '#ef4444'
                      : 'var(--border-color)'
                }`,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {fetchingGps ? (
                <Loader2 size={16} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
              ) : deviceLocation ? (
                <CheckCircle2 size={16} color="#10b981" />
              ) : gpsError ? (
                <AlertTriangle size={16} color="#ef4444" />
              ) : (
                <Navigation size={16} color="var(--text-muted)" />
              )}
              <div style={{ fontSize: '0.84rem' }}>
                {fetchingGps ? (
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                    Detecting real-time device GPS location...
                  </span>
                ) : deviceLocation ? (
                  <div>
                    <span style={{ fontWeight: 600, color: '#065f46' }}>Live GPS Active: </span>
                    <span style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>
                      {deviceLocation.latitude}, {deviceLocation.longitude}
                    </span>{' '}
                    <span style={{ fontSize: '0.76rem', color: '#047857' }}>
                      (Accuracy: ±{deviceLocation.accuracy}m)
                    </span>
                  </div>
                ) : gpsError ? (
                  <span style={{ color: '#b91c1c', fontSize: '0.82rem' }}>{gpsError}</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>Device GPS ready to detect coordinates</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={useCurrentDeviceLocation}
                disabled={fetchingGps}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: fetchingGps ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: fetchingGps ? 0.7 : 1,
                }}
              >
                {fetchingGps ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <LocateFixed size={13} />}
                {deviceLocation ? 'Refresh Live GPS' : 'Fetch Actual GPS'}
              </button>

              {formData.scope === 'BRANCH' && (
                <button
                  type="button"
                  onClick={useBranchCoordinates}
                  style={{
                    padding: '6px 10px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: 6,
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                  title="Use branch registered coordinates from master"
                >
                  Branch Master Coords
                </button>
              )}
            </div>
          </div>

          <div className="grid-3">
            <Input
              label="Center Latitude (GPS)"
              type="number"
              step="any"
              value={formData.centerLatitude}
              onChange={(e) => setFormData({ ...formData, centerLatitude: e.target.value })}
              placeholder="e.g. 21.242073"
              required
            />
            <Input
              label="Center Longitude (GPS)"
              type="number"
              step="any"
              value={formData.centerLongitude}
              onChange={(e) => setFormData({ ...formData, centerLongitude: e.target.value })}
              placeholder="e.g. 72.884184"
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
