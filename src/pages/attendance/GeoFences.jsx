import React, { useState, useEffect } from 'react';
import geoApi from '../../api/geoApi';
import masterApi from '../../api/masterApi';
import projectTaskApi from '../../api/projectTaskApi';
import employeeApi from '../../api/employeeApi';
import { useAuth } from '../../context/AuthContext';
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
  Navigation,
  Edit2,
  Search,
  Check,
  Building2,
  FolderGit2,
  Sliders,
  XCircle,
  Eye,
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
  const { user, isSuperAdmin, isBranchManager } = useAuth();
  const [activeTab, setActiveTab] = useState('FENCES'); // 'FENCES' | 'LOGS' | 'POLICY'

  // Data states
  const [fences, setFences] = useState([]);
  const [branches, setBranches] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState('ALL'); // 'ALL' | 'BRANCH' | 'PROJECT_SITE'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'

  // Location Logs state
  const [locationLogs, setLocationLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState('ALL'); // 'ALL' | 'PERMITTED' | 'REJECTED'

  // Accuracy Threshold Settings
  const [accuracySettings, setAccuracySettings] = useState({
    maxAcceptableAccuracyMeters: 100,
    failClosedOnMissingFence: true,
  });
  const [tempAccuracy, setTempAccuracy] = useState(100);
  const [savingSettings, setSavingSettings] = useState(false);

  // Create / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFence, setEditingFence] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    scope: 'BRANCH',
    referenceId: '',
    centerLatitude: 23.0225,
    centerLongitude: 72.5714,
    radiusMeters: 200,
    isActive: true,
  });

  const { showToast } = useToast();

  // Load GeoFences, Branches, Projects & Accuracy Settings
  const loadData = async () => {
    setLoading(true);
    try {
      const [fRes, bRes, pRes, sRes, eRes] = await Promise.all([
        geoApi.getGeoFences(),
        masterApi.getBranches().catch(() => ({ data: [] })),
        projectTaskApi.getProjects().catch(() => ({ data: [] })),
        geoApi.getAccuracySettings().catch(() => null),
        employeeApi.getEmployees({ limit: 100 }).catch(() => ({ data: [] })),
      ]);

      const fenceList = Array.isArray(fRes) ? fRes : (Array.isArray(fRes?.data) ? fRes.data : (fRes?.geofences || fRes?.fences || []));
      const branchList = Array.isArray(bRes) ? bRes : (Array.isArray(bRes?.data) ? bRes.data : (bRes?.branches || []));
      const projectList = Array.isArray(pRes) ? pRes : (Array.isArray(pRes?.data) ? pRes.data : (pRes?.projects || []));
      const employeeList = Array.isArray(eRes) ? eRes : (Array.isArray(eRes?.data) ? eRes.data : []);

      setFences(fenceList);
      setBranches(branchList);
      setProjects(projectList);
      setEmployees(employeeList);

      if (sRes) {
        const sData = sRes?.data || sRes;
        const maxAcc = sData?.maxAcceptableAccuracyMeters || sData?.threshold || 100;
        setAccuracySettings({
          maxAcceptableAccuracyMeters: maxAcc,
          failClosedOnMissingFence: sData?.failClosedOnMissingFence !== undefined ? Boolean(sData?.failClosedOnMissingFence) : true,
        });
        setTempAccuracy(maxAcc);
      }
    } catch {
      showToast('Failed to load geo-fence boundaries', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load Location Audit Logs (GET /geo/location-logs)
  const loadLocationLogs = async () => {
    setLoadingLogs(true);
    try {
      const params = { limit: 50 };
      if (logFilter === 'PERMITTED') params.permitted = true;
      if (logFilter === 'REJECTED') params.permitted = false;

      const res = await geoApi.getAllLocationLogs(params);
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

  useEffect(() => {
    if (activeTab === 'LOGS') {
      loadLocationLogs();
    }
  }, [activeTab, logFilter]);

  // Open Modal for Create
  const openCreateModal = () => {
    setEditingFence(null);
    setFormData({
      name: '',
      scope: 'BRANCH',
      referenceId: branches[0]?._id || '',
      centerLatitude: 23.0225,
      centerLongitude: 72.5714,
      radiusMeters: 200,
      isActive: true,
    });
    setModalOpen(true);
  };

  // Open Modal for Edit (PUT /geo/geofences/:id)
  const openEditModal = (fence) => {
    setEditingFence(fence);
    const refId = fence.reference || fence.referenceId?._id || fence.referenceId || '';
    setFormData({
      name: fence.name || '',
      scope: fence.scope || 'BRANCH',
      referenceId: typeof refId === 'string' ? refId : (refId?._id || ''),
      centerLatitude: fence.centerLatitude ?? 23.0225,
      centerLongitude: fence.centerLongitude ?? 72.5714,
      radiusMeters: fence.radiusMeters ?? 200,
      isActive: fence.isActive !== false,
    });
    setModalOpen(true);
  };

  // Device GPS Location Detection
  const useCurrentDeviceLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFormData((prev) => ({
            ...prev,
            centerLatitude: parseFloat(pos.coords.latitude.toFixed(6)),
            centerLongitude: parseFloat(pos.coords.longitude.toFixed(6)),
          }));
          showToast('Updated coordinates from device GPS!', 'success');
        },
        (err) => {
          showToast('Could not fetch GPS: ' + err.message, 'warning');
        },
        { enableHighAccuracy: true }
      );
    } else {
      showToast('Geolocation is not supported by your browser', 'warning');
    }
  };

  // Submit Create or Update GeoFence (POST /geo/geofences or PUT /geo/geofences/:id)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      showToast('Please specify a boundary name', 'warning');
      return;
    }
    if (!editingFence && !formData.referenceId) {
      showToast('Please select an associated branch or project site', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      if (editingFence) {
        // Update existing fence (PUT /geo/geofences/:id)
        await geoApi.updateGeoFence(editingFence._id || editingFence.id, {
          name: formData.name.trim(),
          centerLatitude: parseFloat(formData.centerLatitude),
          centerLongitude: parseFloat(formData.centerLongitude),
          radiusMeters: parseInt(formData.radiusMeters, 10),
          isActive: formData.isActive,
        });
        showToast('Geo-Fence updated successfully!', 'success');
      } else {
        // Create new fence (POST /geo/geofences)
        const payload = {
          name: formData.name.trim(),
          scope: formData.scope,
          reference: formData.referenceId,
          referenceId: formData.referenceId,
          referenceModel: formData.scope === 'BRANCH' ? 'Branch' : 'ProjectSite',
          centerLatitude: parseFloat(formData.centerLatitude),
          centerLongitude: parseFloat(formData.centerLongitude),
          radiusMeters: parseInt(formData.radiusMeters, 10) || (formData.scope === 'BRANCH' ? 200 : 500),
          isActive: true,
        };
        await geoApi.createGeoFence(payload);
        showToast('Geo-Fence configured successfully!', 'success');
      }

      setModalOpen(false);
      // Auto-refresh data without manual reload
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save geo-fence', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Deactivate GeoFence (PUT /geo/geofences/:id/deactivate)
  const handleDeactivate = async (fence) => {
    const id = fence._id || fence.id;
    try {
      await geoApi.deactivateGeoFence(id);
      showToast(`Geo-Fence "${fence.name}" deactivated`, 'success');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to deactivate fence', 'error');
    }
  };

  // Save Policy Settings (PUT /geo/settings/accuracy-threshold)
  const handleSaveAccuracySettings = async () => {
    setSavingSettings(true);
    try {
      await geoApi.updateAccuracySettings({
        maxAcceptableAccuracyMeters: tempAccuracy,
        failClosedOnMissingFence: accuracySettings.failClosedOnMissingFence,
      });
      setAccuracySettings((prev) => ({ ...prev, maxAcceptableAccuracyMeters: tempAccuracy }));
      showToast(`GPS accuracy policy updated to ±${tempAccuracy}m!`, 'success');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update GPS policy', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Stats
  const branchFencesCount = fences.filter((f) => f.scope === 'BRANCH').length;
  const projectFencesCount = fences.filter((f) => f.scope === 'PROJECT_SITE').length;
  const activeFencesCount = fences.filter((f) => f.isActive !== false).length;

  // Filtered fences
  const filteredFences = fences.filter((f) => {
    if (scopeFilter !== 'ALL' && f.scope !== scopeFilter) return false;
    if (statusFilter === 'ACTIVE' && f.isActive === false) return false;
    if (statusFilter === 'INACTIVE' && f.isActive !== false) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = f.name?.toLowerCase().includes(q);
      const matchRef = (f.referenceId?.name || f.referenceId?.title || '').toLowerCase().includes(q);
      return matchName || matchRef;
    }
    return true;
  });

  const fenceColumns = [
    {
      header: 'Boundary & Associated Location',
      key: 'name',
      render: (r) => {
        const refName = r.referenceId?.name || r.referenceId?.title || r.reference?.name || r.reference || 'Assigned Target';
        const isBranch = r.scope === 'BRANCH';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: isBranch ? 'var(--primary-light)' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {isBranch ? <Building2 size={17} color="var(--primary)" /> : <FolderGit2 size={17} color="#d97706" />}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                {r.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                <span style={{ fontWeight: 600, color: isBranch ? 'var(--primary)' : '#d97706' }}>{r.scope}</span> • {refName}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Center Coordinates',
      key: 'centerLatitude',
      render: (r) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.84rem', color: 'var(--text-main)' }}>
          {r.centerLatitude?.toFixed(4)}°, {r.centerLongitude?.toFixed(4)}°
        </span>
      ),
    },
    {
      header: 'Perimeter Radius',
      key: 'radiusMeters',
      render: (r) => (
        <Badge variant="neutral">
          <CircleDot size={12} style={{ marginRight: 4 }} />
          {r.radiusMeters}m perimeter
        </Badge>
      ),
    },
    {
      header: 'Status',
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
        <div style={{ display: 'flex', gap: 6 }}>
          <Button
            variant="outline"
            size="sm"
            icon={Edit2}
            onClick={() => openEditModal(r)}
            title="Edit coordinates or radius"
          >
            Edit
          </Button>
          {r.isActive !== false && (
            <Button
              variant="outline-danger"
              size="sm"
              icon={Trash2}
              onClick={() => handleDeactivate(r)}
              title="Deactivate boundary"
            >
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  const logColumns = [
    {
      header: 'Employee',
      key: 'employee',
      render: (r) => {
        const emp = r.employee;
        const name = emp?.basicInfo?.fullName || emp?.fullName || (emp?.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : '') || emp?.name || 'Staff Member';
        const code = emp?.basicInfo?.employeeCode || emp?.employeeCode || '-';
        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>
              {name}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {code} {r.gpsAccuracy ? `• Accuracy ±${r.gpsAccuracy}m` : ''}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Attendance Mode',
      key: 'attendanceType',
      render: (r) => (
        <Badge variant="neutral">{r.attendanceType || 'OFFICE'}</Badge>
      ),
    },
    {
      header: 'Resolved Location',
      key: 'address',
      render: (r) => (
        <div style={{ fontSize: '0.82rem', maxWidth: 280 }}>
          <div style={{ color: 'var(--text-main)' }}>
            {r.address || `${r.latitude?.toFixed(4)}°, ${r.longitude?.toFixed(4)}°`}
          </div>
          {r.matchedSiteIds?.length > 0 && (
            <div style={{ fontSize: '0.72rem', color: 'var(--primary)', marginTop: 2, fontWeight: 500 }}>
              Matched Sites: {r.matchedSiteIds.length} in radius
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Geofence Verification',
      key: 'permitted',
      render: (r) => {
        const isAllowed = r.permitted !== false && r.withinGeoFence !== false;
        return isAllowed ? (
          <Badge variant="success">Permitted</Badge>
        ) : (
          <Badge variant="danger">{r.reason || 'OUTSIDE_GEOFENCE'}</Badge>
        );
      },
    },
    {
      header: 'Verification Time',
      key: 'resolvedAt',
      render: (r) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {r.resolvedAt || r.timestamp ? new Date(r.resolvedAt || r.timestamp).toLocaleString() : 'Recent'}
        </span>
      ),
    },
  ];

  const S = {
    page: { display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1180, margin: '0 auto' },
    pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', boxShadow: 'var(--shadow-xs)' },
    iconWrap: { width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg, var(--primary-light), var(--primary-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--primary-border)' },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
    statCard: { background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-xs)' },
    statIconWrap: (color) => ({ width: 38, height: 38, borderRadius: 9, background: color || 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }),
    statLabel: { fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 },
    statVal: { fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginTop: 2 },
    tabBar: { display: 'flex', gap: 4, background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 4 },
    tabBtn: (active) => ({ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', fontSize: '0.86rem', fontWeight: active ? 700 : 500, color: active ? 'var(--primary)' : 'var(--text-muted)', background: active ? 'var(--bg-surface)' : 'transparent', border: 'none', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s', boxShadow: active ? 'var(--shadow-sm)' : 'none' }),
    card: { background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 22, boxShadow: 'var(--shadow-xs)' },
    filterBtn: (active) => ({ padding: '5px 14px', fontSize: '0.78rem', fontWeight: active ? 700 : 500, border: `1px solid ${active ? 'var(--primary)' : 'var(--border-color)'}`, borderRadius: 20, background: active ? 'var(--primary)' : 'transparent', color: active ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }),
  };

  return (
    <div style={S.page}>
      <ModuleSubNav items={attendanceNav} />

      {/* Header */}
      <div style={S.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={S.iconWrap}>
            <MapPin size={22} color="var(--primary)" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Geo-Location Attendance &amp; Geo-Fencing
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Circular boundaries, spatial verification gates, audit logs &amp; GPS accuracy enforcement
            </p>
          </div>
        </div>

        <Button variant="primary" icon={Plus} onClick={openCreateModal}>
          Configure Geo-Fence
        </Button>
      </div>

      {/* Quick Stats Overview Cards */}
      <div style={S.statsRow}>
        <div style={S.statCard}>
          <div style={S.statIconWrap('var(--primary-light)')}>
            <CircleDot size={18} color="var(--primary)" />
          </div>
          <div>
            <div style={S.statLabel}>Configured Fences</div>
            <div style={S.statVal}>
              {fences.length} <span style={{ fontSize: '0.76rem', color: 'var(--success)', fontWeight: 600 }}>({activeFencesCount} Active)</span>
            </div>
          </div>
        </div>

        <div style={S.statCard}>
          <div style={S.statIconWrap('var(--primary-light, #edf7f8)')}>
            <Building2 size={18} color="var(--primary, #3f929a)" />
          </div>
          <div>
            <div style={S.statLabel}>Branch Boundaries</div>
            <div style={{ ...S.statVal, color: 'var(--primary, #3f929a)' }}>{branchFencesCount}</div>
          </div>
        </div>

        <div style={S.statCard}>
          <div style={S.statIconWrap('#fef3c7')}>
            <FolderGit2 size={18} color="#d97706" />
          </div>
          <div>
            <div style={S.statLabel}>Project Site Boundaries</div>
            <div style={{ ...S.statVal, color: '#d97706' }}>{projectFencesCount}</div>
          </div>
        </div>

        <div style={S.statCard}>
          <div style={S.statIconWrap('#ede9fe')}>
            <Shield size={18} color="#7c3aed" />
          </div>
          <div>
            <div style={S.statLabel}>GPS Max Accuracy</div>
            <div style={{ ...S.statVal, color: '#7c3aed' }}>
              ±{accuracySettings.maxAcceptableAccuracyMeters}m
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={S.tabBar}>
        <button
          type="button"
          onClick={() => setActiveTab('FENCES')}
          style={S.tabBtn(activeTab === 'FENCES')}
        >
          <CircleDot size={16} />
          <span>Geo-Fence Boundaries</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('LOGS')}
          style={S.tabBtn(activeTab === 'LOGS')}
        >
          <History size={16} />
          <span>Location Audit Logs</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('POLICY')}
          style={S.tabBtn(activeTab === 'POLICY')}
        >
          <Sliders size={16} />
          <span>Accuracy &amp; Enforcement Policy</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: GEOFENCE BOUNDARIES (POST, GET, PUT, DEACTIVATE)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'FENCES' && (
        <div style={S.card}>
          {/* Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            {/* Search */}
            <div style={{ position: 'relative', minWidth: 260 }}>
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search fence name or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', height: 36, paddingLeft: 34, paddingRight: 12, borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.84rem', outline: 'none' }}
              />
            </div>

            {/* Scope & Status Filters */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { key: 'ALL', label: 'All Scopes' },
                { key: 'BRANCH', label: 'Branches' },
                { key: 'PROJECT_SITE', label: 'Project Sites' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setScopeFilter(f.key)}
                  style={S.filterBtn(scopeFilter === f.key)}
                >
                  {f.label}
                </button>
              ))}

              <div style={{ width: 1, background: 'var(--border-color)', margin: '0 4px' }} />

              {[
                { key: 'ALL', label: 'All Status' },
                { key: 'ACTIVE', label: 'Active Only' },
                { key: 'INACTIVE', label: 'Deactivated' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  style={S.filterBtn(statusFilter === f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <Table
            columns={fenceColumns}
            data={filteredFences}
            loading={loading}
            emptyMessage="No geo-fences found matching current criteria."
          />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: LOCATION AUDIT LOGS (GET /geo/location-logs)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'LOGS' && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Spatial Authorization &amp; GPS Resolution Stream
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Live stream of gate location evaluation attempts
              </div>
            </div>

            {/* Filter by Verdict */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { key: 'ALL', label: 'All Logs' },
                { key: 'PERMITTED', label: 'Permitted Only' },
                { key: 'REJECTED', label: 'Out of Boundary' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setLogFilter(f.key)}
                  style={S.filterBtn(logFilter === f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <Table
            columns={logColumns}
            data={locationLogs}
            loading={loadingLogs}
            emptyMessage="No spatial authorization logs recorded yet."
          />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: POLICY & ACCURACY CONTROLS (GET & PUT /geo/settings/accuracy-threshold)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'POLICY' && (
        <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={18} color="#7c3aed" />
              </div>
              <div>
                <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  GPS Accuracy Threshold &amp; Enforcement Policy
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Controls maximum allowed GPS drift and missing boundary fallbacks
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Slider for Max Accuracy */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 8 }}>
                  <span>Maximum Allowed GPS Inaccuracy Radius</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 700 }}>±{tempAccuracy} meters</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="10"
                  value={tempAccuracy}
                  onChange={(e) => setTempAccuracy(Number(e.target.value))}
                  style={{ width: '100%', height: 6, accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  <span>10m (High Precision)</span>
                  <span>100m (Standard Balanced)</span>
                  <span>500m (Permissive Mobile)</span>
                </div>
              </div>

              {/* Fail-Closed Toggle */}
              <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-main)' }}>
                    Strict Enforcement (Fail-Closed)
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Block attendance if employee branch has no configured geo-fence
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={accuracySettings.failClosedOnMissingFence}
                  onChange={(e) => setAccuracySettings((prev) => ({ ...prev, failClosedOnMissingFence: e.target.checked }))}
                  style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
              </div>

              <div style={{ padding: '12px 16px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
                <strong>Policy Details:</strong> When an employee registers their location at an attendance gate, the device's GPS accuracy must be within <strong>±{tempAccuracy}m</strong>. If the satellite signal is too weak or drifted beyond this threshold, the system triggers a <code>LOW_GPS_ACCURACY</code> flag.
              </div>

              <Button
                variant="primary"
                icon={Check}
                loading={savingSettings}
                onClick={handleSaveAccuracySettings}
                style={{ width: '100%', padding: '12px', fontWeight: 600, borderRadius: 10 }}
              >
                Save Enforcement Policy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CONFIGURE OR UPDATE GEOFENCE
          (POST /geo/geofences or PUT /geo/geofences/:id)
      ───────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingFence ? 'Update Geo-Fence Boundary' : 'Configure Geo-Fence Boundary'}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <Input
              label="Boundary Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Ahmedabad HQ Main Campus"
              required
            />

            {!editingFence ? (
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
                  { value: 'BRANCH', label: 'Branch Office' },
                  { value: 'PROJECT_SITE', label: 'Project Site' },
                ]}
                required
              />
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                  Scope
                </label>
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 600 }}>
                  {formData.scope}
                </div>
              </div>
            )}
          </div>

          {!editingFence && (
            <div style={{ marginBottom: 14 }}>
              {formData.scope === 'BRANCH' ? (
                <Select
                  label="Associated Branch Location"
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
          )}

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
                gap: 5,
                fontWeight: 600,
              }}
            >
              <Navigation size={14} /> Detect Current Device Coordinates via GPS
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
              label="Radius in Meters"
              type="number"
              min="10"
              max="5000"
              value={formData.radiusMeters}
              onChange={(e) => setFormData({ ...formData, radiusMeters: e.target.value })}
              placeholder="200"
              required
            />
          </div>

          {editingFence && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="fenceActiveCheck"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
              />
              <label htmlFor="fenceActiveCheck" style={{ fontSize: '0.84rem', fontWeight: 500, cursor: 'pointer' }}>
                Active Geo-Fence Boundary
              </label>
            </div>
          )}

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingFence ? 'Update Geo-Fence' : 'Configure Boundary'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default GeoFences;
