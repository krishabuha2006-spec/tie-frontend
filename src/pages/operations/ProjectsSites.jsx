import React, { useState, useEffect } from 'react';
import projectTaskApi from '../../api/projectTaskApi';
import masterApi from '../../api/masterApi';
import employeeApi from '../../api/employeeApi';
import { useToast } from '../../context/ToastContext';
import {
  getEmployeeName,
  getEmployeeCode,
  formatEmployeeOption,
  extractEmployeeList,
} from '../../utils/employeeUtils';
import {
  Plus,
  FolderKanban,
  MapPin,
  HardHat,
  Compass,
  Trash2,
  Layers,
  Eye,
  CheckSquare,
  Clock,
  Calendar,
  User,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { operationsNav } from '../../routes/moduleNavConfig';

export const ProjectsSites = () => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState('projects'); // 'projects' | 'tasks'

  // Projects State
  const [projects, setProjects] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Single Project Details Modal State (GET /projects/:id)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedProjectDetails, setSelectedProjectDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Sites modal & management (GET & POST /projects/:projectId/sites, PUT /projects/sites/:id/deactivate)
  const [sitesModalOpen, setSitesModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectSites, setProjectSites] = useState([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [addSiteModalOpen, setAddSiteModalOpen] = useState(false);
  const [submittingSite, setSubmittingSite] = useState(false);

  // Tasks State (GET /projects/tasks, POST /projects/tasks)
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskFilters, setTaskFilters] = useState({
    status: '',
    assignedTo: '',
    site: '',
  });
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    projectId: '',
    siteId: '',
    assignedTo: '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    deadline: '',
  });

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    company: '',
    clientName: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
  });

  const [siteForm, setSiteForm] = useState({
    name: '',
    code: '',
    latitude: '',
    longitude: '',
    radiusInMeters: 500,
    street: '',
    city: '',
    state: '',
  });

  const { showToast } = useToast();

  // Load Projects Master & Supporting Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, cRes, eRes] = await Promise.allSettled([
        projectTaskApi.getProjects(),
        masterApi.getCompanies(),
        employeeApi.getEmployees({ limit: 100 }),
      ]);

      if (pRes.status === 'fulfilled') {
        const pVal = pRes.value;
        const pList = Array.isArray(pVal)
          ? pVal
          : Array.isArray(pVal?.data)
          ? pVal.data
          : pVal?.projects || [];
        setProjects(pList);
      }
      if (cRes.status === 'fulfilled') {
        const cVal = cRes.value;
        const cList = Array.isArray(cVal)
          ? cVal
          : Array.isArray(cVal?.data)
          ? cVal.data
          : cVal?.companies || [];
        setCompanies(cList);
      }
      if (eRes.status === 'fulfilled') {
        const eList = extractEmployeeList(eRes.value);
        setEmployees(eList);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to load projects master data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load Site Tasks (GET /projects/tasks)
  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const params = {};
      if (taskFilters.status) params.status = taskFilters.status;
      if (taskFilters.assignedTo) params.assignedTo = taskFilters.assignedTo;
      if (taskFilters.site) params.site = taskFilters.site;

      const res = await projectTaskApi.getSiteTasks(params);
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.tasks)
        ? res.tasks
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setTasks(list);
    } catch (err) {
      console.error('Failed to load site tasks', err);
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'tasks') {
      loadTasks();
    }
  }, [activeTab, taskFilters]);

  // Open Add Project Modal
  const openAddModal = () => {
    setFormData({
      name: '',
      code: '',
      company: companies[0]?._id || '',
      clientName: '',
      description: '',
      startDate: new Date().toISOString().split('T')[0],
    });
    setProjectModalOpen(true);
  };

  // Submit Create Project (POST /projects)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await projectTaskApi.createProject(formData);
      showToast('Project registered successfully!', 'success');
      setProjectModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create project', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Project Details Modal (GET /projects/:id)
  const openProjectDetails = async (project) => {
    setLoadingDetails(true);
    setDetailsModalOpen(true);
    try {
      const res = await projectTaskApi.getProjectById(project._id);
      setSelectedProjectDetails(res?.project || res?.data || project);
    } catch {
      setSelectedProjectDetails(project);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Open Sites Drawer / Modal (GET /projects/:projectId/sites)
  const openSitesModal = async (project) => {
    setSelectedProject(project);
    setSitesModalOpen(true);
    loadSites(project._id);
  };

  const loadSites = async (projectId) => {
    setLoadingSites(true);
    try {
      const res = await projectTaskApi.getProjectSites(projectId);
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.sites || [];
      setProjectSites(list);
    } catch {
      setProjectSites([]);
    } finally {
      setLoadingSites(false);
    }
  };

  const handleDetectSiteGPS = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSiteForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
          radiusInMeters: 500,
        }));
        showToast('GPS coordinates locked for 500m Site GeoFence!', 'success');
      },
      () => {
        showToast('Unable to lock GPS coordinates. Please grant location permissions.', 'warning');
      }
    );
  };

  // Create Project Site (POST /projects/:projectId/sites)
  const handleCreateSiteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSubmittingSite(true);
    const payload = {
      name: siteForm.name.trim(),
      code: siteForm.code.toUpperCase().trim(),
      geoFence:
        siteForm.latitude && siteForm.longitude
          ? {
              latitude: parseFloat(siteForm.latitude),
              longitude: parseFloat(siteForm.longitude),
              radiusInMeters: parseInt(siteForm.radiusInMeters, 10) || 500,
            }
          : undefined,
      address: {
        street: siteForm.street,
        city: siteForm.city,
        state: siteForm.state,
      },
    };

    try {
      await projectTaskApi.createProjectSite(selectedProject._id, payload);
      showToast(`Site "${siteForm.name}" created with 500m GeoFence!`, 'success');
      setAddSiteModalOpen(false);
      setSiteForm({
        name: '',
        code: '',
        latitude: '',
        longitude: '',
        radiusInMeters: 500,
        street: '',
        city: '',
        state: '',
      });
      loadSites(selectedProject._id);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create site', 'error');
    } finally {
      setSubmittingSite(false);
    }
  };

  // Deactivate Project Site (PUT /projects/sites/:id/deactivate)
  const handleDeactivateSite = async (siteId) => {
    if (!window.confirm('Are you sure you want to deactivate this project site?')) return;
    try {
      await projectTaskApi.deactivateProjectSite(siteId);
      showToast('Project site deactivated', 'success');
      if (selectedProject) loadSites(selectedProject._id);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to deactivate site', 'error');
    }
  };

  // Open Assign Task Modal
  const openAssignTaskModal = (defaultProjId = '', defaultSiteId = '') => {
    const proj = defaultProjId || projects[0]?._id || '';
    setTaskForm({
      projectId: proj,
      siteId: defaultSiteId || '',
      assignedTo: employees[0]?._id || '',
      title: '',
      description: '',
      priority: 'MEDIUM',
      deadline: '',
    });
    setTaskModalOpen(true);
  };

  // Submit Assign Task (POST /projects/tasks)
  const handleAssignTaskSubmit = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) {
      showToast('Task title is required', 'warning');
      return;
    }
    setSubmittingTask(true);
    const payload = {
      project: taskForm.projectId || undefined,
      site: taskForm.siteId || undefined,
      assignedTo: taskForm.assignedTo || undefined,
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || undefined,
      priority: taskForm.priority,
      deadline: taskForm.deadline || undefined,
      status: 'PENDING',
    };

    try {
      await projectTaskApi.createSiteTask(payload);
      showToast(`Site Task "${taskForm.title}" assigned successfully!`, 'success');
      setTaskModalOpen(false);
      loadTasks();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to assign site task', 'error');
    } finally {
      setSubmittingTask(false);
    }
  };

  // Projects Columns
  const columns = [
    {
      header: 'Project Name',
      key: 'name',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FolderKanban size={20} color="var(--primary)" />
          <div>
            <div
              style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--primary)' }}
              onClick={() => openProjectDetails(r)}
              title="Click to view full details (GET /projects/:id)"
            >
              {r.name}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {r.description || 'No description provided'}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Code',
      key: 'code',
      render: (r) => <Badge variant="primary">{r.code}</Badge>,
    },
    {
      header: 'Client',
      key: 'clientName',
      render: (r) => r.clientName || 'Internal Company Project',
    },
    {
      header: 'Sites (500m GeoFences)',
      key: 'sites',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Button
            variant="light"
            size="sm"
            icon={HardHat}
            onClick={() => openSitesModal(r)}
            style={{ fontSize: '0.78rem', padding: '3px 8px' }}
          >
            {r.sites?.length || 0} Sites Manage
          </Button>
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (r) => <Badge variant="success">{r.status || 'Active'}</Badge>,
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button
            variant="light"
            size="sm"
            icon={Eye}
            onClick={() => openProjectDetails(r)}
            style={{ fontSize: '0.76rem', padding: '3px 8px' }}
            title="View Project Details (GET /projects/:id)"
          >
            Details
          </Button>
          <Button
            variant="light"
            size="sm"
            icon={Plus}
            onClick={() => {
              setSelectedProject(r);
              setAddSiteModalOpen(true);
            }}
            style={{ fontSize: '0.76rem', padding: '3px 8px', color: '#0f766e' }}
            title="Add 500m GeoFence Site"
          >
            + Site
          </Button>
        </div>
      ),
    },
  ];

  // Tasks Columns
  const taskColumns = [
    {
      header: 'Task Title & Scope',
      key: 'title',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckSquare size={18} color="#059669" />
          <div>
            <div style={{ fontWeight: 600 }}>{r.title || r.name}</div>
            {r.description && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.description}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Site Location',
      key: 'site',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#d97706', fontSize: '0.86rem' }}>
            {r.site?.name || 'Project Site'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {r.project?.name || 'Assigned Project'}
          </div>
        </div>
      ),
    },
    {
      header: 'Assigned Engineer',
      key: 'assignedTo',
      render: (r) => {
        const emp = r.assignedTo || {};
        const name = getEmployeeName(emp);
        const code = getEmployeeCode(emp);
        return (
          <div style={{ fontSize: '0.84rem' }}>
            <div style={{ fontWeight: 600 }}>{name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {code !== '-' ? code : ''}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Priority',
      key: 'priority',
      render: (r) => {
        const p = r.priority || 'MEDIUM';
        const v = p === 'URGENT' ? 'danger' : p === 'HIGH' ? 'warning' : 'neutral';
        return <Badge variant={v}>{p}</Badge>;
      },
    },
    {
      header: 'Status',
      key: 'status',
      render: (r) => {
        const st = r.status || 'PENDING';
        return (
          <Badge variant={st === 'COMPLETED' ? 'success' : st === 'IN_PROGRESS' ? 'info' : 'warning'}>
            {st}
          </Badge>
        );
      },
    },
    {
      header: 'Deadline',
      key: 'deadline',
      render: (r) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {r.deadline ? new Date(r.deadline).toLocaleDateString() : 'Open'}
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ModuleSubNav items={operationsNav} />

      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Projects &amp; Field Sites</h2>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {activeTab === 'projects' ? (
            <Button variant="primary" icon={Plus} onClick={openAddModal}>
              Add Project
            </Button>
          ) : (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => openAssignTaskModal()}
              style={{ background: '#059669', borderColor: '#059669' }}
            >
              Assign Site Task
            </Button>
          )}
          <Button
            variant="light"
            icon={RotateCcw}
            onClick={() => {
              if (activeTab === 'projects') loadData();
              else loadTasks();
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          borderBottom: '2px solid var(--border-light)',
          marginBottom: 6,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'projects' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'projects' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'projects' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.92rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <FolderKanban size={17} />
          Projects Master & 500m Sites ({projects.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'tasks' ? '3px solid #059669' : '3px solid transparent',
            color: activeTab === 'tasks' ? '#059669' : 'var(--text-muted)',
            fontWeight: activeTab === 'tasks' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.92rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckSquare size={17} />
          Site Task Assignments ({tasks.length})
        </button>
      </div>

      {/* TAB 1: PROJECTS MASTER */}
      {activeTab === 'projects' && (
        <div className="card">
          <Table columns={columns} data={projects} loading={loading} emptyMessage="No projects registered yet." />
        </div>
      )}

      {/* TAB 2: SITE TASKS */}
      {activeTab === 'tasks' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Filters Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ minWidth: 160 }}>
              <select
                value={taskFilters.status}
                onChange={(e) => setTaskFilters({ ...taskFilters, status: e.target.value })}
                className="form-control"
                style={{ fontSize: '0.85rem' }}
              >
                <option value="">All Statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="COMPLETED">COMPLETED</option>
              </select>
            </div>

            <div style={{ minWidth: 200 }}>
              <select
                value={taskFilters.assignedTo}
                onChange={(e) => setTaskFilters({ ...taskFilters, assignedTo: e.target.value })}
                className="form-control"
                style={{ fontSize: '0.85rem' }}
              >
                <option value="">All Engineers</option>
                {employees.map((emp) => (
                  <option key={emp._id || emp.id} value={emp._id || emp.id}>
                    {formatEmployeeOption(emp, false)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginLeft: 'auto' }}>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => openAssignTaskModal()}
                style={{ background: '#059669', borderColor: '#059669' }}
              >
                + Assign Site Task
              </Button>
            </div>
          </div>

          <Table
            columns={taskColumns}
            data={tasks}
            loading={loadingTasks}
            emptyMessage="No site tasks created yet. Assign a task to enable attendance task-linking at 500m candidate sites."
          />
        </div>
      )}

      {/* VIEW PROJECT DETAILS MODAL (GET /projects/:id) */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={`Project Details: ${selectedProjectDetails?.name || ''}`}
        size="lg"
      >
        {selectedProjectDetails && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, background: 'var(--bg-subtle)', padding: 14, borderRadius: 'var(--radius-md)' }}>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>PROJECT CODE</span>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{selectedProjectDetails.code || '-'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>CLIENT</span>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{selectedProjectDetails.clientName || 'Internal'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>START DATE</span>
                <div style={{ fontSize: '0.9rem' }}>{selectedProjectDetails.startDate ? new Date(selectedProjectDetails.startDate).toLocaleDateString() : '-'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>STATUS</span>
                <div><Badge variant="success">{selectedProjectDetails.status || 'Active'}</Badge></div>
              </div>
            </div>

            {selectedProjectDetails.description && (
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>DESCRIPTION</span>
                <p style={{ margin: '4px 0 0', fontSize: '0.88rem' }}>{selectedProjectDetails.description}</p>
              </div>
            )}

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                  Active Project Sites & 500m GeoFences ({selectedProjectDetails.sites?.length || 0})
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => {
                    setSelectedProject(selectedProjectDetails);
                    setAddSiteModalOpen(true);
                  }}
                  style={{ fontSize: '0.74rem' }}
                >
                  + Add Site
                </Button>
              </div>

              {selectedProjectDetails.sites?.length > 0 ? (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  {selectedProjectDetails.sites.map((s, idx) => (
                    <div
                      key={s._id || idx}
                      style={{
                        padding: '10px 14px',
                        borderBottom: idx < selectedProjectDetails.sites.length - 1 ? '1px solid var(--border-light)' : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{s.name} ({s.code || 'SITE'})</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          {s.address?.city ? `${s.address.city}, ` : ''}{s.address?.state || ''}
                        </div>
                      </div>
                      <Badge variant="success" style={{ fontSize: '0.72rem' }}>
                        <Compass size={12} style={{ marginRight: 4 }} /> 500m GeoFence Active
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No physical sites configured under this project yet.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Add Project Modal (POST /projects) */}
      <Modal isOpen={projectModalOpen} onClose={() => setProjectModalOpen(false)} title="Register Client Project">
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <Input
              label="Project Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Metro Expansion Phase 2"
              required
            />
            <Input
              label="Project Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="PRJ-METRO"
              required
            />
            <Select
              label="Company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              options={companies.map((c) => ({ value: c._id, label: c.name }))}
              required
            />
            <Input
              label="Client Name"
              value={formData.clientName}
              onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
              placeholder="e.g. Municipal Corporation"
            />
          </div>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Project Description</label>
            <textarea
              className="form-control"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Scope of work and regional site milestones"
            />
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setProjectModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Register Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manage Project Sites Modal (GET /projects/:id/sites) */}
      <Modal
        isOpen={sitesModalOpen}
        onClose={() => setSitesModalOpen(false)}
        title={`Sites for: ${selectedProject?.name || ''} (${selectedProject?.code || ''})`}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              Configured 500m GeoFence sites for field workers, biometric attendance, and task execution.
            </p>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setAddSiteModalOpen(true)}
            >
              Add Project Site
            </Button>
          </div>

          {loadingSites ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading project sites...
            </div>
          ) : projectSites && projectSites.length > 0 ? (
            <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {projectSites.map((s, idx) => {
                const gf = s.geoFence || {};
                return (
                  <div
                    key={s._id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderBottom: idx < projectSites.length - 1 ? '1px solid var(--border-light)' : 'none',
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : 'var(--bg-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <HardHat size={18} color="var(--primary)" />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                          <span>Code: <strong>{s.code || 'SITE'}</strong></span>
                          {s.address?.city && <span>• {s.address.city}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {gf.latitude && gf.longitude ? (
                        <Badge variant="success" style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Compass size={12} /> {gf.radiusInMeters || 500}m GeoFence
                        </Badge>
                      ) : (
                        <Badge variant="neutral" style={{ fontSize: '0.72rem' }}>500m Standard</Badge>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => handleDeactivateSite(s._id)}
                        title="Deactivate Project Site (PUT /projects/sites/:id/deactivate)"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              No sites configured for this project yet. Click "Add Project Site" to set up a 500m GeoFence location.
            </div>
          )}
        </div>
      </Modal>

      {/* Add Project Site Sub-Modal (POST /projects/:id/sites) */}
      <Modal
        isOpen={addSiteModalOpen}
        onClose={() => setAddSiteModalOpen(false)}
        title={`Add New Site to ${selectedProject?.name || ''}`}
        size="md"
      >
        <form onSubmit={handleCreateSiteSubmit}>
          <div className="grid-2">
            <Input
              label="Site Name *"
              value={siteForm.name}
              onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
              placeholder="e.g. North Gate Pier 4"
              required
            />
            <Input
              label="Site Code *"
              value={siteForm.code}
              onChange={(e) => setSiteForm({ ...siteForm, code: e.target.value })}
              placeholder="SITE-N4"
              required
            />
          </div>

          <div style={{ margin: '14px 0 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Compass size={15} color="var(--primary)" /> 500m GeoFence Coordinates
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleDetectSiteGPS}
              style={{ fontSize: '0.74rem' }}
            >
              Lock Current GPS
            </button>
          </div>

          <div className="grid-3">
            <Input
              label="Latitude"
              type="number"
              step="any"
              value={siteForm.latitude}
              onChange={(e) => setSiteForm({ ...siteForm, latitude: e.target.value })}
              placeholder="23.0225"
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              value={siteForm.longitude}
              onChange={(e) => setSiteForm({ ...siteForm, longitude: e.target.value })}
              placeholder="72.5714"
            />
            <Input
              label="Radius (Meters)"
              type="number"
              value={siteForm.radiusInMeters}
              onChange={(e) => setSiteForm({ ...siteForm, radiusInMeters: e.target.value })}
              placeholder="500"
            />
          </div>

          <div className="grid-2" style={{ marginTop: 10 }}>
            <Input
              label="City"
              value={siteForm.city}
              onChange={(e) => setSiteForm({ ...siteForm, city: e.target.value })}
              placeholder="Ahmedabad"
            />
            <Input
              label="State"
              value={siteForm.state}
              onChange={(e) => setSiteForm({ ...siteForm, state: e.target.value })}
              placeholder="Gujarat"
            />
          </div>

          <div className="modal-footer" style={{ margin: '18px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setAddSiteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingSite}>
              Create Site
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Task Modal (POST /projects/tasks) */}
      <Modal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        title="Assign Task for Site Employee"
      >
        <form onSubmit={handleAssignTaskSubmit}>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Task Title *</label>
            <Input
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              placeholder="e.g. Inspect Foundation Anchor Bolts"
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Project</label>
              <select
                className="form-control"
                value={taskForm.projectId}
                onChange={(e) => setTaskForm({ ...taskForm, projectId: e.target.value })}
              >
                <option value="">Select Project</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Assign To Engineer *</label>
              <select
                className="form-control"
                value={taskForm.assignedTo}
                onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                required
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp._id || emp.id} value={emp._id || emp.id}>
                    {formatEmployeeOption(emp, true)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: 12 }}>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                className="form-control"
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>

            <Input
              label="Deadline Date"
              type="date"
              value={taskForm.deadline}
              onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Task Instructions / Description</label>
            <textarea
              className="form-control"
              rows={3}
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              placeholder="Specific safety requirements, measurements, or quality checklists"
            />
          </div>

          <div className="modal-footer" style={{ margin: '18px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setTaskModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingTask} style={{ background: '#059669', borderColor: '#059669' }}>
              Assign Task
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProjectsSites;
