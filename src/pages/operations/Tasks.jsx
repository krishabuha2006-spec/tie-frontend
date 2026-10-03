import React, { useState, useEffect, useMemo } from 'react';
import taskApi from '../../api/taskApi';
import projectTaskApi from '../../api/projectTaskApi';
import employeeApi from '../../api/employeeApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  getEmployeeName,
  getEmployeeCode,
  formatEmployeeOption,
  filterEmployeesByBranch,
  extractEmployeeList,
} from '../../utils/employeeUtils';
import {
  Plus,
  CheckSquare,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  User,
  Calendar,
  Layers,
  Filter,
  Search,
  Eye,
  Edit2,
  TrendingUp,
  AlertTriangle,
  Play,
  Check,
  Ban,
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { operationsNav } from '../../routes/moduleNavConfig';
import { formatDateOnlyIST, getErrorMessage } from '../../utils/formatters';

export const Tasks = () => {
  const { user, isSuperAdmin, isHrAdmin, branch: globalBranch } = useAuth();
  const { showToast } = useToast();

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState('all_tasks'); // 'all_tasks' | 'my_tasks' | 'employee_tasks' | 'reports'

  // Master Data
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);

  // Tab 1: All Org Tasks (GET /tasks)
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    assignedTo: '',
    search: '',
  });

  const filteredTasks = useMemo(() => {
    if (!filters.search?.trim()) return tasks;
    const term = filters.search.toLowerCase();
    return tasks.filter((t) => {
      const title = (t.taskName || t.title || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      return title.includes(term) || desc.includes(term);
    });
  }, [tasks, filters.search]);

  // Tab 2: My Tasks (GET /tasks/me)
  const [myTasks, setMyTasks] = useState([]);
  const [loadingMyTasks, setLoadingMyTasks] = useState(false);

  // Tab 3: Employee Tasks (GET /tasks/employees/:id)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employeeTasks, setEmployeeTasks] = useState([]);
  const [loadingEmployeeTasks, setLoadingEmployeeTasks] = useState(false);

  // Tab 4: Analytics Reports
  const [overdueReport, setOverdueReport] = useState(null);
  const [completionReport, setCompletionReport] = useState(null);
  const [loadingReports, setLoadingReports] = useState(false);
  const [evaluatingOverdue, setEvaluatingOverdue] = useState(false);

  // Task Creation Modal (POST /tasks)
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(false);
  const [formData, setFormData] = useState({
    taskName: '',
    description: '',
    assignedTo: '',
    priority: 'MEDIUM',
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    project: '',
    site: '',
  });

  // Task Details & Edit Modal (GET & PUT /tasks/:id)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Cancel Task Modal (PUT /tasks/:id/cancel)
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingTask, setCancellingTask] = useState(false);

  // Load Masters
  const loadMasters = async () => {
    try {
      const empParams = { limit: 100 };
      const branchId = globalBranch?._id || globalBranch?.id;
      if (branchId && branchId !== 'ALL') {
        empParams.branch = branchId;
      }
      const [eRes, pRes] = await Promise.allSettled([
        employeeApi.getEmployees(empParams),
        projectTaskApi.getProjects(),
      ]);
      if (eRes.status === 'fulfilled') {
        let list = extractEmployeeList(eRes.value);
        if (branchId && branchId !== 'ALL') {
          list = filterEmployeesByBranch(list, branchId);
        }
        setEmployees(list);
        if (list.length > 0) setSelectedEmployeeId(list[0]._id || list[0].id);
      }
      if (pRes.status === 'fulfilled') {
        const pList = Array.isArray(pRes.value)
          ? pRes.value
          : Array.isArray(pRes.value?.data)
          ? pRes.value.data
          : pRes.value?.projects || [];
        setProjects(pList);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load All Tasks (GET /tasks)
  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.assignedTo) params.assignedTo = filters.assignedTo;

      const res = await taskApi.getTasks(params);
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.tasks)
        ? res.tasks
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setTasks(list);
    } catch (err) {
      console.error(err);
      showToast('Failed to load tasks', 'error');
    } finally {
      setLoadingTasks(false);
    }
  };

  // Load My Tasks (GET /tasks/me)
  const loadMyTasks = async () => {
    setLoadingMyTasks(true);
    try {
      const res = await taskApi.getMyTasks();
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.tasks)
        ? res.tasks
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setMyTasks(list);
    } catch (err) {
      console.error(err);
      setMyTasks([]);
    } finally {
      setLoadingMyTasks(false);
    }
  };

  // Load Specific Employee Tasks (GET /tasks/employees/:id)
  const loadEmployeeTasks = async (empId) => {
    if (!empId) return;
    setLoadingEmployeeTasks(true);
    try {
      const res = await taskApi.getEmployeeTasks(empId);
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.tasks)
        ? res.tasks
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setEmployeeTasks(list);
    } catch (err) {
      console.error(err);
      setEmployeeTasks([]);
    } finally {
      setLoadingEmployeeTasks(false);
    }
  };

  // Load Analytics Reports (GET /tasks/reports/overdue & completion-rate)
  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const [oRes, cRes] = await Promise.allSettled([
        taskApi.getOverdueReport(),
        taskApi.getCompletionRateReport(),
      ]);
      if (oRes.status === 'fulfilled') setOverdueReport(oRes.value?.data || oRes.value);
      if (cRes.status === 'fulfilled') setCompletionReport(cRes.value?.data || cRes.value);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReports(false);
    }
  };

  // Trigger Overdue Evaluation Job (POST /tasks/evaluate-overdue)
  const handleEvaluateOverdue = async () => {
    setEvaluatingOverdue(true);
    try {
      const res = await taskApi.evaluateOverdueTasks();
      showToast(res?.message || 'Overdue task evaluation job triggered successfully!', 'success');
      loadReports();
      loadTasks();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to trigger overdue evaluator', 'error');
    } finally {
      setEvaluatingOverdue(false);
    }
  };

  useEffect(() => {
    loadMasters();
  }, [globalBranch]);

  useEffect(() => {
    const handleContextChange = () => {
      loadMasters();
      if (activeTab === 'all_tasks') loadTasks();
      else if (activeTab === 'my_tasks') loadMyTasks();
      else if (activeTab === 'employee_tasks' && selectedEmployeeId) loadEmployeeTasks(selectedEmployeeId);
      else if (activeTab === 'reports') loadReports();
    };
    window.addEventListener('tie:context-changed', handleContextChange);
    return () => window.removeEventListener('tie:context-changed', handleContextChange);
  }, [globalBranch, activeTab, selectedEmployeeId]);

  useEffect(() => {
    if (activeTab === 'all_tasks') loadTasks();
    else if (activeTab === 'my_tasks') loadMyTasks();
    else if (activeTab === 'employee_tasks' && selectedEmployeeId) loadEmployeeTasks(selectedEmployeeId);
    else if (activeTab === 'reports') loadReports();
  }, [activeTab, filters, selectedEmployeeId]);

  // Open Add Task Modal
  const openAddModal = () => {
    setFormData({
      taskName: '',
      description: '',
      assignedTo: employees[0]?._id || '',
      priority: 'MEDIUM',
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      project: projects[0]?._id || '',
      site: '',
    });
    setAddModalOpen(true);
  };

  // Submit Create Task (POST /tasks)
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!formData.taskName.trim()) {
      showToast('Task name is required', 'warning');
      return;
    }
    setSubmittingTask(true);
    try {
      await taskApi.createTask(formData);
      showToast('Task created and assigned successfully!', 'success');
      setAddModalOpen(false);
      loadTasks();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create task', 'error');
    } finally {
      setSubmittingTask(false);
    }
  };

  // Lifecycle Status Change (PUT /tasks/:id/status)
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await taskApi.updateTaskStatus(taskId, newStatus);
      showToast(`Task moved to ${newStatus}`, 'success');
      if (activeTab === 'all_tasks') loadTasks();
      else if (activeTab === 'my_tasks') loadMyTasks();
      else if (activeTab === 'employee_tasks') loadEmployeeTasks(selectedEmployeeId);
      if (detailsModalOpen && selectedTask) {
        setSelectedTask((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  // Open Details Modal (GET /tasks/:id)
  const openDetails = async (task) => {
    setSelectedTask(task);
    setIsEditing(false);
    setDetailsModalOpen(true);
    try {
      const res = await taskApi.getTaskById(task._id);
      const full = res?.task || res?.data || task;
      setSelectedTask(full);
      setEditFormData({
        taskName: full.taskName || full.title || '',
        description: full.description || '',
        priority: full.priority || 'MEDIUM',
        dueDate: full.dueDate ? full.dueDate.split('T')[0] : '',
      });
    } catch {
      setEditFormData({
        taskName: task.taskName || task.title || '',
        description: task.description || '',
        priority: task.priority || 'MEDIUM',
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
      });
    }
  };

  // Save Task Edits (PUT /tasks/:id)
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;
    setSavingEdit(true);
    try {
      await taskApi.updateTask(selectedTask._id, editFormData);
      showToast('Task updated successfully!', 'success');
      setIsEditing(false);
      setSelectedTask((prev) => ({ ...prev, ...editFormData }));
      loadTasks();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update task', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Cancel Task Action (PUT /tasks/:id/cancel)
  const openCancelModal = (task) => {
    setSelectedTask(task);
    setCancelReason('Project scope revised or milestone replaced');
    setCancelModalOpen(true);
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;
    setCancellingTask(true);
    try {
      await taskApi.cancelTask(selectedTask._id, cancelReason);
      showToast('Task successfully cancelled', 'info');
      setCancelModalOpen(false);
      if (detailsModalOpen) setDetailsModalOpen(false);
      loadTasks();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to cancel task', 'error');
    } finally {
      setCancellingTask(false);
    }
  };

  // Resolve assigned employee (handles ID string, populated obj, or unassigned)
  const resolveAssignedEmployee = (assignedTo) => {
    if (!assignedTo) return null;
    const id = typeof assignedTo === 'string' ? assignedTo : (assignedTo._id || assignedTo.id);
    if (id && employees.length > 0) {
      const match = employees.find(
        (e) => (e._id || e.id) === id || e.user?._id === id || e.user === id
      );
      if (match) return match;
    }
    if (typeof assignedTo === 'object') {
      const hasName =
        assignedTo.basicInfo?.fullName ||
        assignedTo.fullName ||
        assignedTo.firstName ||
        assignedTo.name ||
        assignedTo.user?.name;
      if (hasName) return assignedTo;
    }
    return null;
  };

  // Columns for Tasks Tables
  const columns = useMemo(() => [
    {
      header: 'Task Name & Scope',
      key: 'title',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: '#ecfdf5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#059669',
              marginTop: 2,
            }}
          >
            <CheckSquare size={16} />
          </div>
          <div>
            <div
              style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--primary)', fontSize: '0.88rem' }}
              onClick={() => openDetails(r)}
              title="Click to view task details"
            >
              {r.taskName || r.title || 'Untitled Task'}
            </div>
            {r.description ? (
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  marginTop: 2,
                  maxWidth: 280,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {r.description}
              </div>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      header: 'Assigned Staff',
      key: 'assignedTo',
      render: (r) => {
        const emp = resolveAssignedEmployee(r.assignedTo);
        if (!emp) {
          return (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Unassigned
            </span>
          );
        }
        const name = getEmployeeName(emp);
        const code = getEmployeeCode(emp);
        const initial = name && name !== 'Employee' ? name.charAt(0).toUpperCase() : 'U';

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: 'var(--primary-light, #edf7f8)',
                color: 'var(--primary, #3f929a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
            <div style={{ fontSize: '0.84rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{name}</div>
              {code && code !== '-' && (
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{code}</div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Priority',
      key: 'priority',
      render: (r) => {
        const p = (r.priority || 'MEDIUM').toUpperCase();
        const v = p === 'URGENT' ? 'danger' : p === 'HIGH' ? 'warning' : p === 'LOW' ? 'neutral' : 'info';
        return <Badge variant={v}>{p}</Badge>;
      },
    },
    {
      header: 'Status',
      key: 'status',
      render: (r) => {
        const st = (r.status || 'PENDING').toUpperCase();
        const variant =
          st === 'COMPLETED'
            ? 'success'
            : st === 'IN_PROGRESS'
            ? 'info'
            : st === 'CANCELLED' || st === 'OVERDUE'
            ? 'danger'
            : 'warning';
        return <Badge variant={variant}>{st.replace('_', ' ')}</Badge>;
      },
    },
    {
      header: 'Due Date',
      key: 'dueDate',
      render: (r) => (
        <span style={{ fontSize: '0.82rem', color: r.dueDate ? 'var(--text-main)' : 'var(--text-muted)' }}>
          {r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {r.status === 'PENDING' && (
            <Button
              size="sm"
              variant="secondary"
              icon={Play}
              onClick={() => handleStatusChange(r._id, 'IN_PROGRESS')}
              style={{ fontSize: '0.76rem', padding: '4px 8px', color: '#0284c7' }}
              title="Start Working (Move to IN_PROGRESS)"
            >
              Start
            </Button>
          )}
          {r.status === 'IN_PROGRESS' && (
            <Button
              size="sm"
              variant="secondary"
              icon={Check}
              onClick={() => handleStatusChange(r._id, 'COMPLETED')}
              style={{ fontSize: '0.76rem', padding: '4px 8px', color: '#059669' }}
              title="Mark Completed"
            >
              Done
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={Eye}
            onClick={() => openDetails(r)}
            style={{ fontSize: '0.76rem', padding: '4px 8px', color: 'var(--primary)' }}
            title="View Details"
          >
            View
          </Button>
          {r.status !== 'COMPLETED' && r.status !== 'CANCELLED' && (
            <Button
              size="sm"
              variant="ghost"
              icon={Ban}
              onClick={() => openCancelModal(r)}
              style={{ fontSize: '0.76rem', padding: '4px 8px', color: '#dc2626' }}
              title="Cancel Task"
            >
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ], [employees]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ModuleSubNav items={operationsNav} />

      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Task Management</h2>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="primary" icon={Plus} onClick={openAddModal}>
            Create & Assign Task
          </Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          borderBottom: '2px solid var(--border-light)',
          marginBottom: 6,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('all_tasks')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'all_tasks' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'all_tasks' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'all_tasks' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.92rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckSquare size={17} />
          All Tasks ({tasks.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my_tasks')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'my_tasks' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'my_tasks' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'my_tasks' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.92rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <User size={17} />
          My Tasks ({myTasks.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('employee_tasks')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'employee_tasks' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'employee_tasks' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'employee_tasks' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.92rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Layers size={17} />
          Employee Tasks ({employeeTasks.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'reports' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'reports' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'reports' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.92rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <TrendingUp size={17} />
          Reports
        </button>
      </div>

      {/* TAB 1: ALL TASKS */}
      {activeTab === 'all_tasks' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Filters Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: '1 1 220px', minWidth: 200 }}>
              <Input
                placeholder="Search tasks by name or description..."
                icon={Search}
                value={filters.search || ''}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>

            <div style={{ width: 170 }}>
              <Select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                placeholder="All Statuses"
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'PENDING', label: 'PENDING' },
                  { value: 'IN_PROGRESS', label: 'IN_PROGRESS' },
                  { value: 'COMPLETED', label: 'COMPLETED' },
                  { value: 'OVERDUE', label: 'OVERDUE' },
                  { value: 'CANCELLED', label: 'CANCELLED' },
                ]}
              />
            </div>

            <div style={{ width: 170 }}>
              <Select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                placeholder="All Priorities"
                options={[
                  { value: '', label: 'All Priorities' },
                  { value: 'LOW', label: 'LOW' },
                  { value: 'MEDIUM', label: 'MEDIUM' },
                  { value: 'HIGH', label: 'HIGH' },
                  { value: 'URGENT', label: 'URGENT' },
                ]}
              />
            </div>

            <div style={{ width: 230 }}>
              <Select
                value={filters.assignedTo}
                onChange={(e) => setFilters({ ...filters, assignedTo: e.target.value })}
                placeholder="All Assigned Staff"
                options={[
                  { value: '', label: 'All Assigned Staff' },
                  ...employees.map((emp) => ({
                    value: emp._id || emp.id,
                    label: formatEmployeeOption(emp, false),
                  })),
                ]}
              />
            </div>
          </div>

          <Table columns={columns} data={filteredTasks} loading={loadingTasks} emptyMessage="No tasks found matching criteria." />
        </div>
      )}

      {/* TAB 2: MY TASKS */}
      {activeTab === 'my_tasks' && (
        <div className="card">
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Tasks Assigned to You</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Track tasks linked with your work profile, start execution, and mark them completed.
            </p>
          </div>
          <Table columns={columns} data={myTasks} loading={loadingMyTasks} emptyMessage="You have no open tasks assigned currently." />
        </div>
      )}

      {/* TAB 3: EMPLOYEE TASKS */}
      {activeTab === 'employee_tasks' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px', maxWidth: 360 }}>
              <Select
                label="Select Employee"
                value={selectedEmployeeId}
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value);
                  loadEmployeeTasks(e.target.value);
                }}
                options={employees.map((emp) => ({
                  value: emp._id || emp.id,
                  label: formatEmployeeOption(emp, true),
                }))}
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={Search}
              onClick={() => loadEmployeeTasks(selectedEmployeeId)}
              loading={loadingEmployeeTasks}
              style={{ height: '38px', marginBottom: '0px' }}
            >
              Fetch Tasks
            </Button>
          </div>

          <Table columns={columns} data={employeeTasks} loading={loadingEmployeeTasks} emptyMessage="No tasks found for this employee." />
        </div>
      )}

      {/* TAB 4: PERFORMANCE & OVERDUE REPORTS */}
      {activeTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Overdue Task Evaluator</h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Automated scheduler evaluates task deadlines against the current date and marks pending tasks OVERDUE.
              </p>
            </div>
            <Button
              variant="primary"
              icon={Play}
              onClick={handleEvaluateOverdue}
              loading={evaluatingOverdue}
              style={{ background: '#d97706', borderColor: '#d97706' }}
            >
              Trigger Overdue Evaluator Job
            </Button>
          </div>

          {/* Metrics KPIs */}
          <div className="dashboard-stats-grid">
            <div className="card" style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>OVERDUE TASKS</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
                {overdueReport?.totalOverdue ?? overdueReport?.count ?? 0}
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>ON-TIME COMPLETION RATE</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669', marginTop: 4 }}>
                {completionReport?.completionRate !== undefined ? `${completionReport.completionRate}%` : '0%'}
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>AVG COMPLETION DAYS</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary, #3f929a)', marginTop: 4 }}>
                {completionReport?.avgDaysToComplete !== undefined ? `${completionReport.avgDaysToComplete} days` : '0 days'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE TASK MODAL (POST /tasks) */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Create and Assign Task(s)">
        <form onSubmit={handleCreateTask}>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Task Name *</label>
            <Input
              value={formData.taskName}
              onChange={(e) => setFormData({ ...formData, taskName: e.target.value })}
              placeholder="e.g. Electrical cabling inspection"
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Assign To Staff *</label>
              <Select
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                placeholder="Select Employee"
                options={employees.map((emp) => ({
                  value: emp._id || emp.id,
                  label: formatEmployeeOption(emp, true),
                }))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Priority</label>
              <Select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                options={[
                  { value: 'LOW', label: 'LOW' },
                  { value: 'MEDIUM', label: 'MEDIUM' },
                  { value: 'HIGH', label: 'HIGH' },
                  { value: 'URGENT', label: 'URGENT' },
                ]}
              />
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: 12 }}>
            <Input
              label="Due Date"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />

            <div className="form-group">
              <label className="form-label">Associated Project</label>
              <Select
                value={formData.project}
                onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                placeholder="None / General Task"
                options={[
                  { value: '', label: 'None / General Task' },
                  ...projects.map((p) => ({
                    value: p._id,
                    label: `${p.name} (${p.code})`,
                  })),
                ]}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Task Description & Deliverables</label>
            <textarea
              className="form-control"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide specific guidelines, safety parameters, or required output documents."
            />
          </div>

          <div className="modal-footer" style={{ margin: '18px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingTask}>
              Create & Assign
            </Button>
          </div>
        </form>
      </Modal>

      {/* TASK DETAILS / EDIT MODAL (GET & PUT /tasks/:id) */}
      <Modal isOpen={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} title="Task Details & Lifecycle">
        {selectedTask && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!isEditing ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                    {selectedTask.taskName || selectedTask.title}
                  </h3>
                  <Badge
                    variant={
                      selectedTask.status === 'COMPLETED'
                        ? 'success'
                        : selectedTask.status === 'IN_PROGRESS'
                        ? 'info'
                        : selectedTask.status === 'CANCELLED'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {selectedTask.status || 'PENDING'}
                  </Badge>
                </div>

                <div style={{ background: 'var(--bg-subtle)', padding: 14, borderRadius: 'var(--radius-md)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>ASSIGNED TO</span>
                    <div style={{ fontWeight: 600 }}>
                      {selectedTask.assignedTo?.firstName
                        ? `${selectedTask.assignedTo.firstName} ${selectedTask.assignedTo.lastName || ''}`
                        : selectedTask.assignedTo?.name || 'Unassigned'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>PRIORITY</span>
                    <div><Badge>{selectedTask.priority || 'MEDIUM'}</Badge></div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>DUE DATE</span>
                    <div>{selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString() : 'No deadline'}</div>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>DESCRIPTION</span>
                  <p style={{ margin: '4px 0 0', fontSize: '0.88rem' }}>
                    {selectedTask.description || 'No detailed instructions provided.'}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: 14, marginTop: 6 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {selectedTask.status === 'PENDING' && (
                      <Button size="sm" variant="primary" onClick={() => handleStatusChange(selectedTask._id, 'IN_PROGRESS')}>
                        Move to In Progress
                      </Button>
                    )}
                    {selectedTask.status === 'IN_PROGRESS' && (
                      <Button size="sm" variant="primary" onClick={() => handleStatusChange(selectedTask._id, 'COMPLETED')} style={{ background: '#059669', borderColor: '#059669' }}>
                        Mark as Completed
                      </Button>
                    )}
                    {selectedTask.status !== 'CANCELLED' && selectedTask.status !== 'COMPLETED' && (
                      <Button size="sm" variant="secondary" onClick={() => openCancelModal(selectedTask)} style={{ color: '#dc2626' }}>
                        Cancel Task
                      </Button>
                    )}
                  </div>
                  <Button size="sm" variant="light" icon={Edit2} onClick={() => setIsEditing(true)}>
                    Edit Details
                  </Button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSaveEdit}>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Task Name</label>
                  <Input
                    value={editFormData.taskName}
                    onChange={(e) => setEditFormData({ ...editFormData, taskName: e.target.value })}
                    required
                  />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <Select
                      value={editFormData.priority}
                      onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                      options={[
                        { value: 'LOW', label: 'LOW' },
                        { value: 'MEDIUM', label: 'MEDIUM' },
                        { value: 'HIGH', label: 'HIGH' },
                        { value: 'URGENT', label: 'URGENT' },
                      ]}
                    />
                  </div>
                  <Input
                    label="Due Date"
                    type="date"
                    value={editFormData.dueDate}
                    onChange={(e) => setEditFormData({ ...editFormData, dueDate: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                  <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit" loading={savingEdit}>
                    Save Changes
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>

      {/* CANCEL TASK MODAL (PUT /tasks/:id/cancel) */}
      <Modal isOpen={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="Cancel Task Assignment">
        <form onSubmit={handleCancelSubmit}>
          <p style={{ margin: '0 0 12px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Are you sure you want to cancel task "<strong>{selectedTask?.taskName || selectedTask?.title}</strong>"?
          </p>
          <div className="form-group">
            <label className="form-label">Cancellation Reason *</label>
            <textarea
              className="form-control"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="State the reason why this task is being cancelled."
              required
            />
          </div>
          <div className="modal-footer" style={{ margin: '18px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setCancelModalOpen(false)}>
              Back
            </Button>
            <Button variant="primary" type="submit" loading={cancellingTask} style={{ background: '#dc2626', borderColor: '#dc2626' }}>
              Confirm Cancellation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Tasks;
