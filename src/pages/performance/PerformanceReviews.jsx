import React, { useState, useEffect, useMemo } from 'react';
import performanceApi from '../../api/performanceApi';
import masterApi from '../../api/masterApi';
import employeeApi from '../../api/employeeApi';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useAuth } from '../../context/AuthContext';
import {
  getEmployeeName,
  getEmployeeCode,
  formatEmployeeOption,
  extractEmployeeList,
} from '../../utils/employeeUtils';
import {
  Plus,
  Award,
  Star,
  CheckCircle2,
  Clock,
  UserCheck,
  Layers,
  Edit2,
  Trash2,
  Eye,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  Search,
  Filter,
  Check,
  AlertCircle,
  BarChart2,
  Settings,
  Sliders,
  Calendar,
  Building2,
  Briefcase,
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import { extractApiData } from '../../utils/apiUtils';

export const PerformanceReviews = () => {
  const confirm = useConfirm();
  const { user, isSuperAdmin, isHrAdmin, isDirector, isBranchManager, hasPermission } = useAuth();
  const canManage =
    isSuperAdmin ||
    isHrAdmin ||
    isDirector ||
    isBranchManager ||
    Boolean(user?.isSuperAdmin) ||
    Boolean(user?.role?.isSuperAdmin) ||
    (typeof hasPermission === 'function' && hasPermission('performance.manage')) ||
    user?.permissions?.hrms?.performanceReviews?.manage === true;
  const { showToast } = useToast();

  // Active Tab: 'cycles' | 'self' | 'manager_queue' | 'templates'
  const [activeTab, setActiveTab] = useState(canManage ? 'cycles' : 'self');

  // Master Data
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);

  // =========================================================================
  // TAB 1: REVIEW CYCLES & REVIEWS (Module 21)
  // =========================================================================
  const [allReviews, setAllReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('');
  const [reviewSearchTerm, setReviewSearchTerm] = useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState('ALL');
  const [reviewCycleFilter, setReviewCycleFilter] = useState('ALL');

  // Initiate Cycle Modal
  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [submittingCycle, setSubmittingCycle] = useState(false);
  const [cycleForm, setCycleForm] = useState({
    reviewCycle: 'Q3-2026',
    cycleStart: '2026-07-01',
    cycleEnd: '2026-09-30',
    kraTemplate: '',
    scope: {
      company: '',
      branch: '',
      department: '',
    },
  });

  // =========================================================================
  // TAB 2: MY SELF-ASSESSMENT (Module 21)
  // =========================================================================
  const [myReviews, setMyReviews] = useState([]);
  const [loadingMyReviews, setLoadingMyReviews] = useState(false);
  const [selfAssessmentModalOpen, setSelfAssessmentModalOpen] = useState(false);
  const [activeReviewForSelf, setActiveReviewForSelf] = useState(null);
  const [selfRatings, setSelfRatings] = useState([]);
  const [submittingSelf, setSubmittingSelf] = useState(false);

  // =========================================================================
  // TAB 3: PENDING MANAGER REVIEWS (Module 21)
  // =========================================================================
  const [managerQueue, setManagerQueue] = useState([]);
  const [loadingManagerQueue, setLoadingManagerQueue] = useState(false);
  const [managerModalOpen, setManagerModalOpen] = useState(false);
  const [activeReviewForManager, setActiveReviewForManager] = useState(null);
  const [managerRatings, setManagerRatings] = useState([]);
  const [managerOverallComment, setManagerOverallComment] = useState('');
  const [submittingManager, setSubmittingManager] = useState(false);

  // =========================================================================
  // TAB 4: KRA TEMPLATES (Module 21)
  // =========================================================================
  const [kraTemplates, setKraTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [templateCompanyFilter, setTemplateCompanyFilter] = useState('ALL');
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [submittingTemplate, setSubmittingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    company: '',
    requireSelfAssessment: true,
    kraItems: [
      {
        name: 'Task Completion & Project Delivery',
        weightPercent: 40,
        metricType: 'SYSTEM_DERIVED',
        systemMetricSource: 'TASK_COMPLETION_RATE',
        targetValue: 90,
        description: 'Sprints, milestones, and task completion percentage from Module 17',
      },
      {
        name: 'Attendance Consistency & Punctuality',
        weightPercent: 30,
        metricType: 'SYSTEM_DERIVED',
        systemMetricSource: 'PUNCTUALITY',
        targetValue: 95,
        description: 'On-time arrival and biometric shift compliance from Module 12',
      },
      {
        name: 'Leadership & Cross-Functional Collaboration',
        weightPercent: 30,
        metricType: 'MANUAL_RATING',
        systemMetricSource: '',
        targetValue: '',
        description: 'Code reviews, peer assistance, and team leadership',
      },
    ],
  });

  // Review Details Modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedReviewDetails, setSelectedReviewDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // -------------------------------------------------------------------------
  // INITIAL LOAD
  // -------------------------------------------------------------------------
  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    if (activeTab === 'cycles') loadAllReviews();
    else if (activeTab === 'self') loadMyReviews();
    else if (activeTab === 'manager_queue') loadManagerQueue();
    else if (activeTab === 'templates') loadTemplates();
  }, [activeTab, selectedEmployeeFilter]);

  const loadMasters = async () => {
    try {
      const [cRes, dRes, bRes, eRes, tplRes] = await Promise.all([
        masterApi.getCompanies().catch(() => ({ data: [] })),
        masterApi.getDepartments().catch(() => ({ data: [] })),
        masterApi.getBranches().catch(() => ({ data: [] })),
        employeeApi.getEmployees({ limit: 200 }).catch(() => ({ data: [] })),
        performanceApi.getKraTemplates().catch(() => ({ data: [] })),
      ]);
      const compList = extractApiData(cRes, 'companies', 'data');
      const deptList = extractApiData(dRes, 'departments', 'data');
      const branchList = extractApiData(bRes, 'branches', 'data');
      const empList = extractEmployeeList(eRes);
      const tpls = extractApiData(tplRes, 'templates', 'kraTemplates', 'data');

      setCompanies(compList);
      setDepartments(deptList);
      setBranches(branchList);
      setEmployees(empList);
      setKraTemplates(tpls);

      if (tpls.length > 0) {
        setCycleForm((prev) => ({ ...prev, kraTemplate: tpls[0]._id }));
      }
      if (compList.length > 0) {
        setTemplateForm((prev) => ({ ...prev, company: compList[0]._id }));
      }
    } catch (err) {
      console.error('Failed to load performance masters:', err);
    }
  };

  // -------------------------------------------------------------------------
  // CYCLES & REVIEWS (TAB 1)
  // -------------------------------------------------------------------------
  const loadAllReviews = async () => {
    setLoadingReviews(true);
    try {
      if (selectedEmployeeFilter) {
        const res = await performanceApi.getEmployeeReviews(selectedEmployeeFilter);
        setAllReviews(extractApiData(res, 'reviews', 'data'));
      } else {
        const [pendingRes, meRes] = await Promise.allSettled([
          performanceApi.getPendingManagerReviews(),
          performanceApi.getMyReviews(),
        ]);
        const pList = pendingRes.status === 'fulfilled' ? extractApiData(pendingRes.value, 'reviews', 'data') : [];
        const mList = meRes.status === 'fulfilled' ? extractApiData(meRes.value, 'reviews', 'data') : [];
        const map = new Map();
        [...pList, ...mList].forEach((r) => {
          if (r?._id) map.set(r._id, r);
        });

        if (employees.length > 0 && map.size === 0) {
          const empResults = await Promise.allSettled(
            employees.slice(0, 10).map((emp) => performanceApi.getEmployeeReviews(emp._id))
          );
          empResults.forEach((er) => {
            if (er.status === 'fulfilled') {
              const list = extractApiData(er.value, 'reviews', 'data');
              list.forEach((r) => {
                if (r?._id) map.set(r._id, r);
              });
            }
          });
        }
        setAllReviews(Array.from(map.values()));
      }
    } catch {
      setAllReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleInitiateCycle = async (e) => {
    e.preventDefault();
    if (!cycleForm.kraTemplate) {
      showToast('Please select a KRA Template', 'error');
      return;
    }
    setSubmittingCycle(true);
    try {
      const payload = {
        reviewCycle: cycleForm.reviewCycle,
        cycleStart: cycleForm.cycleStart,
        cycleEnd: cycleForm.cycleEnd,
        kraTemplate: cycleForm.kraTemplate,
        scope: {
          ...(cycleForm.scope?.company ? { company: cycleForm.scope.company } : {}),
          ...(cycleForm.scope?.branch ? { branch: cycleForm.scope.branch } : {}),
          ...(cycleForm.scope?.department ? { department: cycleForm.scope.department } : {}),
        },
      };
      await performanceApi.initiateReviewCycle(payload);
      showToast('Review cycle initiated and employee appraisals generated!', 'success');
      setCycleModalOpen(false);
      loadAllReviews();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to initiate review cycle', 'error');
    } finally {
      setSubmittingCycle(false);
    }
  };

  // Filtered reviews memo for Tab 1
  const filteredAllReviews = useMemo(() => {
    return allReviews.filter((r) => {
      // 1. Search term
      if (reviewSearchTerm.trim()) {
        const q = reviewSearchTerm.toLowerCase();
        const empName = getEmployeeName(r.employee).toLowerCase();
        const empCode = getEmployeeCode(r.employee).toLowerCase();
        const cycle = (r.reviewCycle || '').toLowerCase();
        const tplName = (r.kraTemplate?.name || '').toLowerCase();
        if (!empName.includes(q) && !empCode.includes(q) && !cycle.includes(q) && !tplName.includes(q)) {
          return false;
        }
      }
      // 2. Status filter
      if (reviewStatusFilter !== 'ALL') {
        const s = r.status || 'SELF_ASSESSMENT_PENDING';
        if (s !== reviewStatusFilter) return false;
      }
      // 3. Cycle filter
      if (reviewCycleFilter !== 'ALL') {
        if (r.reviewCycle !== reviewCycleFilter) return false;
      }
      return true;
    });
  }, [allReviews, reviewSearchTerm, reviewStatusFilter, reviewCycleFilter]);

  // Extract distinct review cycles
  const distinctCycles = useMemo(() => {
    const set = new Set();
    allReviews.forEach((r) => {
      if (r.reviewCycle) set.add(r.reviewCycle);
    });
    return Array.from(set);
  }, [allReviews]);

  // -------------------------------------------------------------------------
  // SELF-ASSESSMENT (TAB 2)
  // -------------------------------------------------------------------------
  const loadMyReviews = async () => {
    setLoadingMyReviews(true);
    try {
      const empId = user?.employeeId || user?.employee?._id || (typeof user?.employee === 'string' ? user.employee : null);
      let res;
      if (empId) {
        try {
          res = await performanceApi.getEmployeeReviews(empId);
        } catch {
          res = await performanceApi.getMyReviews();
        }
      } else if (isSuperAdmin || isHrAdmin) {
        res = { data: [] };
      } else {
        res = await performanceApi.getMyReviews();
      }
      const list = extractApiData(res, 'reviews', 'data');
      setMyReviews(list);
    } catch (err) {
      if (err.response?.status === 400) {
        setMyReviews([]);
      } else {
        showToast('Failed to load your appraisals', 'error');
      }
    } finally {
      setLoadingMyReviews(false);
    }
  };

  const openSelfModal = (review) => {
    setActiveReviewForSelf(review);
    const items = (Array.isArray(review.kraScores) && review.kraScores.length > 0)
      ? review.kraScores
      : (review.kraTemplate?.kraItems || review.kraItems || []);
    setSelfRatings(
      items.map((i) => ({
        kraItemName: i.kraItemName || i.name || 'KRA Item',
        weightPercent: i.weightPercent ?? i.weight ?? 0,
        metricType: i.metricType || 'MANUAL_RATING',
        systemMetricSource: i.systemMetricSource || '',
        description: i.description || '',
        selfRating: i.selfRating || 3,
      }))
    );
    setSelfAssessmentModalOpen(true);
  };

  const handleSubmitSelfAssessment = async (e) => {
    e.preventDefault();
    setSubmittingSelf(true);
    try {
      await performanceApi.submitSelfAssessment(activeReviewForSelf._id, {
        selfRatings: selfRatings.map((r) => ({
          kraItemName: r.kraItemName,
          selfRating: Number(r.selfRating),
        })),
      });
      showToast('Self-assessment ratings submitted successfully!', 'success');
      setSelfAssessmentModalOpen(false);
      loadMyReviews();
      if (canManage) loadAllReviews();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit self-assessment', 'error');
    } finally {
      setSubmittingSelf(false);
    }
  };

  // -------------------------------------------------------------------------
  // MANAGER QUEUE (TAB 3)
  // -------------------------------------------------------------------------
  const loadManagerQueue = async () => {
    setLoadingManagerQueue(true);
    try {
      const res = await performanceApi.getPendingManagerReviews();
      const list = extractApiData(res, 'reviews', 'data');
      setManagerQueue(list);
    } catch {
      setManagerQueue([]);
    } finally {
      setLoadingManagerQueue(false);
    }
  };

  const openManagerModal = (review) => {
    setActiveReviewForManager(review);
    const items = (Array.isArray(review.kraScores) && review.kraScores.length > 0)
      ? review.kraScores
      : (review.kraTemplate?.kraItems || review.kraItems || []);
    // Match with existing self ratings if available
    const existingSelfMap = {};
    if (Array.isArray(review.selfRatings)) {
      review.selfRatings.forEach((sr) => {
        existingSelfMap[sr.kraItemName] = sr.selfRating;
      });
    }

    setManagerRatings(
      items.map((i) => {
        const itemName = i.kraItemName || i.name || 'KRA Item';
        return {
          kraItemName: itemName,
          weightPercent: i.weightPercent ?? i.weight ?? 0,
          description: i.description || '',
          selfRating: i.selfRating ?? existingSelfMap[itemName] ?? 3,
          managerRating: i.managerRating || 3,
          managerComment: i.managerComment || '',
        };
      })
    );
    setManagerOverallComment(review.overallComment || '');
    setManagerModalOpen(true);
  };

  const handleSubmitManagerReview = async (e) => {
    e.preventDefault();
    setSubmittingManager(true);
    try {
      await performanceApi.submitManagerReview(activeReviewForManager._id, {
        managerRatings: managerRatings.map((r) => ({
          kraItemName: r.kraItemName,
          managerRating: Number(r.managerRating),
          managerComment: r.managerComment || '',
        })),
        overallComment: managerOverallComment || 'Performance review completed.',
      });
      showToast('Manager evaluation complete and overall appraisal scored!', 'success');
      setManagerModalOpen(false);
      loadManagerQueue();
      if (canManage) loadAllReviews();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to complete evaluation', 'error');
    } finally {
      setSubmittingManager(false);
    }
  };

  // -------------------------------------------------------------------------
  // KRA TEMPLATES (TAB 4)
  // -------------------------------------------------------------------------
  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await performanceApi.getKraTemplates();
      const list = extractApiData(res, 'templates', 'kraTemplates', 'data');
      setKraTemplates(list);
    } catch (err) {
      showToast('Failed to load KRA templates', 'error');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const openTemplateModal = (tpl = null) => {
    if (tpl) {
      setEditingTemplateId(tpl._id);
      setTemplateForm({
        name: tpl.name || '',
        company: tpl.company?._id || tpl.company || companies[0]?._id || '',
        requireSelfAssessment: tpl.requireSelfAssessment !== undefined ? tpl.requireSelfAssessment : true,
        kraItems: (tpl.kraItems && tpl.kraItems.length > 0)
          ? tpl.kraItems.map((item) => ({
              name: item.name || '',
              weightPercent: item.weightPercent ?? item.weight ?? 0,
              metricType: item.metricType || 'MANUAL_RATING',
              systemMetricSource: item.systemMetricSource || '',
              targetValue: item.targetValue !== undefined ? item.targetValue : '',
              description: item.description || '',
            }))
          : [
              {
                name: 'Core Deliverables & Quality',
                weightPercent: 40,
                metricType: 'SYSTEM_DERIVED',
                systemMetricSource: 'TASK_COMPLETION_RATE',
                targetValue: 90,
                description: '',
              },
            ],
      });
    } else {
      setEditingTemplateId(null);
      setTemplateForm({
        name: '',
        company: companies[0]?._id || '',
        requireSelfAssessment: true,
        kraItems: [
          {
            name: 'Task Completion & Project Delivery',
            weightPercent: 40,
            metricType: 'SYSTEM_DERIVED',
            systemMetricSource: 'TASK_COMPLETION_RATE',
            targetValue: 90,
            description: 'Sprints and task delivery from Module 17',
          },
          {
            name: 'Attendance Consistency & Punctuality',
            weightPercent: 30,
            metricType: 'SYSTEM_DERIVED',
            systemMetricSource: 'PUNCTUALITY',
            targetValue: 95,
            description: 'On-time shift arrival and attendance from Module 12',
          },
          {
            name: 'Leadership & Teamwork',
            weightPercent: 30,
            metricType: 'MANUAL_RATING',
            systemMetricSource: '',
            targetValue: '',
            description: 'Collaboration and mentorship',
          },
        ],
      });
    }
    setTemplateModalOpen(true);
  };

  const addKraItemRow = () => {
    const currentSum = templateForm.kraItems.reduce((acc, it) => acc + (Number(it.weightPercent) || 0), 0);
    const remainder = Math.max(0, 100 - currentSum);
    setTemplateForm({
      ...templateForm,
      kraItems: [
        ...templateForm.kraItems,
        {
          name: '',
          weightPercent: remainder,
          metricType: 'MANUAL_RATING',
          systemMetricSource: '',
          targetValue: '',
          description: '',
        },
      ],
    });
  };

  const removeKraItemRow = (idx) => {
    const updated = [...templateForm.kraItems];
    updated.splice(idx, 1);
    setTemplateForm({ ...templateForm, kraItems: updated });
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    const currentSum = templateForm.kraItems.reduce((acc, it) => acc + (Number(it.weightPercent) || 0), 0);
    if (currentSum !== 100) {
      showToast(`Total weight must equal exactly 100%. Current sum: ${currentSum}%.`, 'error');
      return;
    }
    setSubmittingTemplate(true);
    try {
      if (editingTemplateId) {
        await performanceApi.updateKraTemplate(editingTemplateId, templateForm);
        showToast('KRA template updated successfully!', 'success');
      } else {
        await performanceApi.createKraTemplate(templateForm);
        showToast('KRA template created successfully!', 'success');
      }
      setTemplateModalOpen(false);
      loadTemplates();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save KRA template', 'error');
    } finally {
      setSubmittingTemplate(false);
    }
  };

  const handleDeactivateTemplate = async (id) => {
    const isConfirmed = await confirm({
      title: 'Deactivate KRA Template',
      message: 'Are you sure you want to deactivate this KRA template? It will no longer be available for review cycles.',
      confirmText: 'Deactivate',
      cancelText: 'Cancel',
      variant: 'warning',
    });
    if (!isConfirmed) return;
    try {
      await performanceApi.deactivateKraTemplate(id);
      showToast('KRA template deactivated', 'info');
      loadTemplates();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to deactivate template', 'error');
    }
  };

  // View Detailed Review
  const handleViewDetails = async (review) => {
    setLoadingDetails(true);
    setDetailsModalOpen(true);
    setSelectedReviewDetails(review);
    try {
      const res = await performanceApi.getReviewById(review._id);
      setSelectedReviewDetails(res?.data || res || review);
    } catch (err) {
      setSelectedReviewDetails(review);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Filtered KRA templates memo
  const filteredTemplates = useMemo(() => {
    return kraTemplates.filter((tpl) => {
      if (templateSearchTerm.trim()) {
        const q = templateSearchTerm.toLowerCase();
        const nameMatch = (tpl.name || '').toLowerCase().includes(q);
        const compMatch = (tpl.company?.name || '').toLowerCase().includes(q);
        if (!nameMatch && !compMatch) return false;
      }
      if (templateCompanyFilter !== 'ALL') {
        const cId = tpl.company?._id || tpl.company;
        if (cId !== templateCompanyFilter) return false;
      }
      return true;
    });
  }, [kraTemplates, templateSearchTerm, templateCompanyFilter]);

  // Helper for performance tier
  const getPerformanceTier = (score) => {
    const s = Number(score) || 0;
    if (s >= 4.5) return { label: 'Outstanding (Tier 1)', color: '#52c41a', variant: 'success' };
    if (s >= 3.5) return { label: 'Commendable (Tier 2)', color: '#1890ff', variant: 'primary' };
    if (s >= 2.5) return { label: 'Competent (Tier 3)', color: '#722ed1', variant: 'purple' };
    if (s >= 1.5) return { label: 'Developing (Tier 4)', color: '#faad14', variant: 'warning' };
    return { label: 'Unsatisfactory (Tier 5)', color: '#f5222d', variant: 'danger' };
  };

  // =========================================================================
  // TABLE COLUMNS
  // =========================================================================

  const reviewColumns = [
    {
      header: 'Employee',
      key: 'employee',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              backgroundColor: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <Award size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{getEmployeeName(r.employee)}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {getEmployeeCode(r.employee) !== '-' ? `Code: ${getEmployeeCode(r.employee)} • ` : ''}
              {r.employee?.department?.name || 'General'}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Review Cycle & KRA',
      key: 'reviewCycle',
      render: (r) => (
        <div>
          <span style={{ fontWeight: 600 }}>{r.reviewCycle || 'Q3-2026'}</span>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {r.kraTemplate?.name || 'Standard KRA'}
          </div>
        </div>
      ),
    },
    {
      header: 'Self Score',
      key: 'selfScore',
      render: (r) => {
        const s = r.selfScore;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Star size={14} color="#faad14" fill="#faad14" />
            <span style={{ fontWeight: 600 }}>{s ? `${Number(s).toFixed(1)} / 5.0` : 'Pending'}</span>
          </div>
        );
      },
    },
    {
      header: 'Manager Score',
      key: 'managerScore',
      render: (r) => {
        const s = r.managerScore || r.overallScore;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Star size={14} color="var(--primary)" fill="var(--primary)" />
            <span style={{ fontWeight: 700, color: s ? 'var(--primary)' : 'inherit' }}>
              {s ? `${Number(s).toFixed(1)} / 5.0` : 'Pending'}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Status',
      key: 'status',
      render: (r) => {
        const s = r.status || 'SELF_ASSESSMENT_PENDING';
        const colors = {
          SELF_ASSESSMENT_PENDING: 'warning',
          MANAGER_REVIEW_PENDING: 'primary',
          COMPLETED: 'success',
        };
        const labels = {
          SELF_ASSESSMENT_PENDING: 'Self-Assessment Pending',
          MANAGER_REVIEW_PENDING: 'Manager Review Pending',
          COMPLETED: 'Completed & Scored',
        };
        return <Badge variant={colors[s] || 'secondary'}>{labels[s] || s}</Badge>;
      },
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="sm" variant="secondary" icon={Eye} onClick={() => handleViewDetails(r)}>
            Appraisal
          </Button>
          {r.status === 'MANAGER_REVIEW_PENDING' && canManage && (
            <Button size="sm" variant="primary" icon={CheckCircle2} onClick={() => openManagerModal(r)}>
              Evaluate
            </Button>
          )}
        </div>
      ),
    },
  ];

  const selfColumns = [
    {
      header: 'Review Period',
      key: 'reviewCycle',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.reviewCycle || 'Performance Appraisal'}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            KRA Template: <strong>{r.kraTemplate?.name || 'Standard KRA'}</strong>
          </div>
        </div>
      ),
    },
    {
      header: 'Your Self Rating',
      key: 'selfScore',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Star size={14} color="#faad14" fill="#faad14" />
          <span style={{ fontWeight: 600 }}>{r.selfScore ? `${Number(r.selfScore).toFixed(1)} / 5.0` : 'Not Submitted'}</span>
        </div>
      ),
    },
    {
      header: 'Appraisal Status',
      key: 'status',
      render: (r) => {
        const s = r.status || 'SELF_ASSESSMENT_PENDING';
        const colors = {
          SELF_ASSESSMENT_PENDING: 'warning',
          MANAGER_REVIEW_PENDING: 'primary',
          COMPLETED: 'success',
        };
        return <Badge variant={colors[s] || 'secondary'}>{s}</Badge>;
      },
    },
    {
      header: 'Final Score',
      key: 'finalScore',
      render: (r) => {
        const s = r.managerScore || r.overallScore;
        return s ? (
          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{Number(s).toFixed(1)} / 5.0</span>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Awaiting Manager</span>
        );
      },
    },
    {
      header: 'Action',
      key: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          {r.status === 'SELF_ASSESSMENT_PENDING' ? (
            <Button size="sm" variant="primary" icon={Edit2} onClick={() => openSelfModal(r)}>
              Submit Self Assessment
            </Button>
          ) : (
            <Button size="sm" variant="secondary" icon={Eye} onClick={() => handleViewDetails(r)}>
              View Results
            </Button>
          )}
        </div>
      ),
    },
  ];

  const templateColumns = [
    {
      header: 'Template Name & Company',
      key: 'name',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              backgroundColor: '#f6ffed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#52c41a',
            }}
          >
            <Layers size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{r.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {r.company?.name || 'All Companies / Global'}
              {r.requireSelfAssessment ? ' • Self-Assessment Required' : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'KRA Performance Areas',
      key: 'items',
      render: (r) => {
        const count = r.kraItems?.length || 0;
        const totalW = (r.kraItems || []).reduce((acc, it) => acc + (it.weightPercent || it.weight || 0), 0);
        return (
          <div>
            <div style={{ fontWeight: 600 }}>{count} Performance Goals</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Total Weight: {totalW}%
            </div>
          </div>
        );
      },
    },
    {
      header: 'Status',
      key: 'isActive',
      render: (r) => (
        <Badge variant={r.isActive !== false ? 'success' : 'secondary'}>
          {r.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="sm" variant="secondary" icon={Edit2} onClick={() => openTemplateModal(r)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => handleDeactivateTemplate(r._id)} />
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            KRA &amp; Performance Reviews
          </h2>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {canManage && (
            <>
              <Button variant="secondary" icon={Layers} onClick={() => openTemplateModal()}>
                New KRA Template
              </Button>
              <Button variant="primary" icon={Plus} onClick={() => setCycleModalOpen(true)}>
                Initiate Review Cycle
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          background: '#fff',
          padding: '6px',
          borderRadius: 10,
          border: '1px solid var(--border-color)',
          width: 'fit-content',
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        {canManage && (
          <button
            type="button"
            onClick={() => setActiveTab('cycles')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 7,
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'cycles' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'cycles' ? '#fff' : 'var(--text-muted)',
            }}
          >
            <Award size={16} />
            <span>Appraisal Reviews ({allReviews.length})</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('self')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 7,
            border: 'none',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeTab === 'self' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'self' ? '#fff' : 'var(--text-muted)',
          }}
        >
          <UserCheck size={16} />
          <span>My Self-Assessments ({myReviews.length})</span>
        </button>

        {canManage && (
          <button
            type="button"
            onClick={() => setActiveTab('manager_queue')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 7,
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'manager_queue' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'manager_queue' ? '#fff' : 'var(--text-muted)',
            }}
          >
            <Clock size={16} />
            <span>Manager Evaluation Queue ({managerQueue.length})</span>
          </button>
        )}

        {canManage && (
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 7,
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'templates' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'templates' ? '#fff' : 'var(--text-muted)',
            }}
          >
            <Layers size={16} />
            <span>KRA Templates ({kraTemplates.length})</span>
          </button>
        )}
      </div>

      {/* TAB 1: ALL REVIEWS */}
      {activeTab === 'cycles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Quick Metrics Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#e6f7ff', color: '#1890ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Appraisals</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{allReviews.length}</div>
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fffbe6', color: '#faad14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pending Self-Assessment</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#faad14' }}>
                  {allReviews.filter((r) => r.status === 'SELF_ASSESSMENT_PENDING').length}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f0f5ff', color: '#2f54eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Awaiting Manager Sign-off</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2f54eb' }}>
                  {allReviews.filter((r) => r.status === 'MANAGER_REVIEW_PENDING').length}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f6ffed', color: '#52c41a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Star size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Completed &amp; Scored</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#52c41a' }}>
                  {allReviews.filter((r) => r.status === 'COMPLETED').length}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            {/* Filter Bar */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                backgroundColor: 'var(--bg-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1 }}>
                <div style={{ position: 'relative', width: 230, minWidth: 180 }}>
                  <Search
                    size={16}
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    value={reviewSearchTerm}
                    onChange={(e) => setReviewSearchTerm(e.target.value)}
                    placeholder="Search employee, code, cycle..."
                    style={{
                      width: '100%',
                      height: 38,
                      padding: '0 10px 0 32px',
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      fontSize: '0.82rem',
                      outline: 'none',
                      backgroundColor: '#fff',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Employee Filter */}
                <div style={{ width: 230, minWidth: 180 }}>
                  <Select
                    placeholder="All Appraisals (Queue)"
                    value={selectedEmployeeFilter}
                    onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
                    options={[
                      { value: '', label: 'All Appraisals (Queue)' },
                      ...employees.map((emp) => ({
                        value: emp._id || emp.id,
                        label: formatEmployeeOption(emp, true),
                      })),
                    ]}
                    style={{ height: 38, fontSize: '0.82rem', marginBottom: 0 }}
                  />
                </div>

                {/* Status Filter */}
                <div style={{ width: 190, minWidth: 150 }}>
                  <Select
                    placeholder="All Statuses"
                    value={reviewStatusFilter}
                    onChange={(e) => setReviewStatusFilter(e.target.value)}
                    options={[
                      { value: 'ALL', label: 'All Statuses' },
                      { value: 'SELF_ASSESSMENT_PENDING', label: 'Self-Assessment Pending' },
                      { value: 'MANAGER_REVIEW_PENDING', label: 'Manager Review Pending' },
                      { value: 'COMPLETED', label: 'Completed' },
                    ]}
                    style={{ height: 38, fontSize: '0.82rem', marginBottom: 0 }}
                  />
                </div>

                {/* Cycle Filter */}
                {distinctCycles.length > 0 && (
                  <div style={{ width: 160, minWidth: 130 }}>
                    <Select
                      placeholder="All Cycles"
                      value={reviewCycleFilter}
                      onChange={(e) => setReviewCycleFilter(e.target.value)}
                      options={[
                        { value: 'ALL', label: 'All Cycles' },
                        ...distinctCycles.map((cyc) => ({ value: cyc, label: cyc })),
                      ]}
                      style={{ height: 38, fontSize: '0.82rem', marginBottom: 0 }}
                    />
                  </div>
                )}
              </div>
            </div>

            <Table
              columns={reviewColumns}
              data={filteredAllReviews}
              loading={loadingReviews}
              emptyMessage="No performance review cycles or employee appraisals found."
            />
          </div>
        </div>
      )}

      {/* TAB 2: MY SELF-ASSESSMENT */}
      {activeTab === 'self' && (
        <div className="card">
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-subtle)',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Your self-appraisal submissions for active review cycles with manager rating protection.
            </div>
          </div>
          <Table
            columns={selfColumns}
            data={myReviews}
            loading={loadingMyReviews}
            emptyMessage={
              isSuperAdmin || isHrAdmin
                ? 'Admin/Evaluator accounts do not have personal self-assessment appraisals. Employee self-appraisals appear under Appraisal Reviews and Manager Queue.'
                : 'No active self-assessment appraisals pending.'
            }
          />
        </div>
      )}

      {/* TAB 3: MANAGER QUEUE */}
      {activeTab === 'manager_queue' && (
        <div className="card">
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-subtle)',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Reviews where employee self-ratings are submitted, awaiting reporting manager evaluation and weighted scoring.
            </div>
          </div>
          <Table
            columns={reviewColumns}
            data={managerQueue}
            loading={loadingManagerQueue}
            emptyMessage="No reviews awaiting manager evaluation."
          />
        </div>
      )}

      {/* TAB 4: KRA TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="card">
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              backgroundColor: 'var(--bg-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <div style={{ position: 'relative', width: 240 }}>
                <Search
                  size={16}
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                />
                <input
                  type="text"
                  value={templateSearchTerm}
                  onChange={(e) => setTemplateSearchTerm(e.target.value)}
                  placeholder="Search KRA template..."
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 32px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
              </div>

              {companies.length > 1 && (
                <div style={{ width: 200, minWidth: 160 }}>
                  <Select
                    placeholder="All Companies"
                    value={templateCompanyFilter}
                    onChange={(e) => setTemplateCompanyFilter(e.target.value)}
                    options={[
                      { value: 'ALL', label: 'All Companies' },
                      ...companies.map((c) => ({
                        value: c._id,
                        label: c.name,
                      })),
                    ]}
                    style={{ height: 38, fontSize: '0.82rem', marginBottom: 0 }}
                  />
                </div>
              )}
            </div>

            <Button size="sm" variant="primary" icon={Plus} onClick={() => openTemplateModal()}>
              Create KRA Template
            </Button>
          </div>
          <Table
            columns={templateColumns}
            data={filteredTemplates}
            loading={loadingTemplates}
            emptyMessage="No KRA templates configured. Click 'Create KRA Template' to add one."
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALS */}
      {/* ===================================================================== */}

      {/* 1. INITIATE REVIEW CYCLE MODAL (POST /performance-reviews/cycles/initiate) */}
      <Modal
        isOpen={cycleModalOpen}
        onClose={() => setCycleModalOpen(false)}
        title="Initiate Performance Review Cycle"
      >
        <form onSubmit={handleInitiateCycle}>
          <div style={{ marginBottom: 14, padding: '10px 14px', background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 8, fontSize: '0.82rem', color: '#0050b3' }}>
            Initiating this cycle will aggregate live performance signals and automatically generate review documents for eligible employees.
          </div>

          <Input
            label="Review Cycle Label"
            value={cycleForm.reviewCycle}
            onChange={(e) => setCycleForm({ ...cycleForm, reviewCycle: e.target.value })}
            placeholder="e.g. Q3-2026 / Annual Review 2026"
            required
          />
          <div className="grid-2">
            <Input
              label="Cycle Start Date"
              type="date"
              value={cycleForm.cycleStart}
              onChange={(e) => setCycleForm({ ...cycleForm, cycleStart: e.target.value })}
              required
            />
            <Input
              label="Cycle End Date"
              type="date"
              value={cycleForm.cycleEnd}
              onChange={(e) => setCycleForm({ ...cycleForm, cycleEnd: e.target.value })}
              required
            />
          </div>

          <Select
            label="KRA Template Policy"
            value={cycleForm.kraTemplate}
            onChange={(e) => setCycleForm({ ...cycleForm, kraTemplate: e.target.value })}
            options={kraTemplates.map((t) => ({
              value: t._id,
              label: `${t.name} (${t.kraItems?.length || 0} Performance Areas)`,
            }))}
            required
          />

          <div className="grid-2" style={{ marginTop: 8 }}>
            {companies.length > 0 && (
              <Select
                label="Scope: Company (Optional)"
                value={cycleForm.scope.company}
                onChange={(e) =>
                  setCycleForm({
                    ...cycleForm,
                    scope: { ...cycleForm.scope, company: e.target.value },
                  })
                }
                options={[
                  { value: '', label: 'All Companies / Global' },
                  ...companies.map((c) => ({ value: c._id, label: c.name })),
                ]}
              />
            )}
            {departments.length > 0 && (
              <Select
                label="Scope: Department (Optional)"
                value={cycleForm.scope.department}
                onChange={(e) =>
                  setCycleForm({
                    ...cycleForm,
                    scope: { ...cycleForm.scope, department: e.target.value },
                  })
                }
                options={[
                  { value: '', label: 'All Departments' },
                  ...departments.map((d) => ({ value: d._id, label: d.name })),
                ]}
              />
            )}
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setCycleModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingCycle}>
              Launch Review Cycle
            </Button>
          </div>
        </form>
      </Modal>

      {/* 2. SUBMIT SELF ASSESSMENT MODAL (PUT /performance-reviews/:id/self-assessment) */}
      <Modal
        isOpen={selfAssessmentModalOpen}
        onClose={() => setSelfAssessmentModalOpen(false)}
        title="Submit Self-Assessment (1 - 5 Scale)"
        size="md"
      >
        <form onSubmit={handleSubmitSelfAssessment}>
          <div style={{ marginBottom: 14, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Rate your performance on each Key Result Area. 1 = Unsatisfactory, 3 = Meets Expectations, 5 = Outstanding.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {selfRatings.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                No specific KRA items linked to this review cycle. Please consult HR / Administrator.
              </div>
            ) : (
              selfRatings.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 12,
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{item.kraItemName}</span>
                      {item.description && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {item.description}
                        </div>
                      )}
                    </div>
                    {item.weightPercent > 0 && (
                      <Badge variant="secondary">Weight: {item.weightPercent}%</Badge>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 500 }}>Your Rating:</label>
                    <select
                      className="form-control"
                      style={{ width: '180px', padding: '6px 10px', fontSize: '0.84rem' }}
                      value={item.selfRating}
                      onChange={(e) => {
                        const updated = [...selfRatings];
                        updated[idx].selfRating = Number(e.target.value);
                        setSelfRatings(updated);
                      }}
                    >
                      <option value="1">1 - Needs Improvement</option>
                      <option value="2">2 - Developing</option>
                      <option value="3">3 - Competent / Meets Goals</option>
                      <option value="4">4 - Highly Effective / Exceeds</option>
                      <option value="5">5 - Role Model / Outstanding</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Computed Preview */}
          {selfRatings.length > 0 && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#f6ffed',
                border: '1px solid #b7eb8f',
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 600, color: '#389e0d', fontSize: '0.85rem' }}>Estimated Self-Assessment Score:</span>
              <span style={{ fontWeight: 800, color: '#52c41a', fontSize: '1.1rem' }}>
                {(
                  selfRatings.reduce((acc, it) => acc + (Number(it.selfRating) || 3) * ((it.weightPercent || 100 / selfRatings.length) / 100), 0)
                ).toFixed(2)} / 5.0
              </span>
            </div>
          )}

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setSelfAssessmentModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingSelf}>
              Submit Ratings
            </Button>
          </div>
        </form>
      </Modal>

      {/* 3. SUBMIT MANAGER EVALUATION MODAL (PUT /performance-reviews/:id/manager-review) */}
      <Modal
        isOpen={managerModalOpen}
        onClose={() => setManagerModalOpen(false)}
        title={`Manager Appraisal: ${getEmployeeName(activeReviewForManager?.employee)}`}
        size="md"
      >
        <form onSubmit={handleSubmitManagerReview}>
          <div style={{ marginBottom: 14, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Evaluate employee performance against assigned KRA targets and assign the authoritative rating.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {managerRatings.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                No specific KRA items linked to this review cycle.
              </div>
            ) : (
              managerRatings.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 12,
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{item.kraItemName}</span>
                      {item.description && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {item.description}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {item.weightPercent > 0 && <Badge variant="secondary">{item.weightPercent}%</Badge>}
                      <Badge variant="warning">Self: {item.selfRating}/5</Badge>
                    </div>
                  </div>

                  <div className="grid-2" style={{ marginTop: 8 }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                        Manager Rating:
                      </label>
                      <select
                        className="form-control"
                        style={{ width: '100%', padding: '6px 10px', fontSize: '0.84rem' }}
                        value={item.managerRating}
                        onChange={(e) => {
                          const updated = [...managerRatings];
                          updated[idx].managerRating = Number(e.target.value);
                          setManagerRatings(updated);
                        }}
                      >
                        <option value="1">1 - Unsatisfactory</option>
                        <option value="2">2 - Developing</option>
                        <option value="3">3 - Meets Goal</option>
                        <option value="4">4 - Exceeds Goal</option>
                        <option value="5">5 - Outstanding</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                        KRA Feedback / Comment:
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={item.managerComment || ''}
                        onChange={(e) => {
                          const updated = [...managerRatings];
                          updated[idx].managerComment = e.target.value;
                          setManagerRatings(updated);
                        }}
                        placeholder="Optional feedback on deliverables"
                        style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Computed Preview */}
          {managerRatings.length > 0 && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#e6f7ff',
                border: '1px solid #91d5ff',
                marginBottom: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 600, color: '#0050b3', fontSize: '0.85rem' }}>Final Weighted Overall Score:</span>
              <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.1rem' }}>
                {(
                  managerRatings.reduce((acc, it) => acc + (Number(it.managerRating) || 3) * ((it.weightPercent || 100 / managerRatings.length) / 100), 0)
                ).toFixed(2)} / 5.0
              </span>
            </div>
          )}

          <Input
            label="Overall Manager Appraiser Feedback / Remarks"
            value={managerOverallComment}
            onChange={(e) => setManagerOverallComment(e.target.value)}
            placeholder="Feedback on key accomplishments, leadership, and quarterly growth areas"
            required
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setManagerModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingManager}>
              Complete Appraisal &amp; Finalize Score
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. KRA TEMPLATE MODAL (POST / PUT /kra-templates) */}
      <Modal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title={editingTemplateId ? 'Edit KRA Template' : 'New KRA Template Policy'}
        size="lg"
      >
        <form onSubmit={handleSaveTemplate}>
          <div className="grid-2">
            <Input
              label="Template Name"
              value={templateForm.name}
              onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
              placeholder="e.g. Senior Software Engineer / Operations Specialist"
              required
            />
            {companies.length > 0 && (
              <Select
                label="Company Allocation"
                value={templateForm.company}
                onChange={(e) => setTemplateForm({ ...templateForm, company: e.target.value })}
                options={[
                  { value: '', label: 'All Companies / Global Policy' },
                  ...companies.map((c) => ({ value: c._id, label: c.name })),
                ]}
              />
            )}
          </div>

          <div style={{ marginTop: 12, marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={templateForm.requireSelfAssessment}
                onChange={(e) =>
                  setTemplateForm({ ...templateForm, requireSelfAssessment: e.target.checked })
                }
              />
              <span><strong>Require Employee Self-Assessment</strong> prior to manager evaluation</span>
            </label>
          </div>

          {/* Dynamic KRA Areas */}
          <div style={{ marginTop: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>KRA Target Areas</h4>
                {(() => {
                  const currentSum = templateForm.kraItems.reduce((acc, it) => acc + (Number(it.weightPercent) || 0), 0);
                  const is100 = currentSum === 100;
                  return (
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 12,
                        backgroundColor: is100 ? '#dcfce7' : '#fee2e2',
                        color: is100 ? '#15803d' : '#b91c1c',
                      }}
                    >
                      Total Weight: {currentSum}% {is100 ? '(100% OK)' : `(Must equal 100%, difference: ${100 - currentSum}%)`}
                    </span>
                  );
                })()}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="sm"
                  type="button"
                  variant="light"
                  onClick={() => {
                    const count = templateForm.kraItems.length;
                    if (count === 0) return;
                    const base = Math.floor(100 / count);
                    const remainder = 100 - base * count;
                    const distributed = templateForm.kraItems.map((it, i) => ({
                      ...it,
                      weightPercent: i === 0 ? base + remainder : base,
                    }));
                    setTemplateForm({ ...templateForm, kraItems: distributed });
                  }}
                >
                  Distribute Evenly
                </Button>
                <Button size="sm" type="button" variant="secondary" icon={Plus} onClick={addKraItemRow}>
                  Add KRA Area
                </Button>
              </div>
            </div>

            {templateForm.kraItems.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-subtle)',
                  marginBottom: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 2 }}>
                    <Input
                      label="Goal / KRA Name"
                      value={item.name}
                      placeholder="e.g. Project Delivery & Defect Rate"
                      onChange={(e) => {
                        const copy = [...templateForm.kraItems];
                        copy[idx].name = e.target.value;
                        setTemplateForm({ ...templateForm, kraItems: copy });
                      }}
                      required
                    />
                  </div>
                  <div style={{ width: 110 }}>
                    <Input
                      label="Weight %"
                      type="number"
                      min="1"
                      max="100"
                      value={item.weightPercent}
                      placeholder="%"
                      onChange={(e) => {
                        const copy = [...templateForm.kraItems];
                        copy[idx].weightPercent = e.target.value === '' ? '' : Number(e.target.value);
                        setTemplateForm({ ...templateForm, kraItems: copy });
                      }}
                      required
                    />
                  </div>
                  <div style={{ flex: 1.5 }}>
                    <Select
                      label="Metric Type"
                      value={item.metricType || 'MANUAL_RATING'}
                      onChange={(e) => {
                        const copy = [...templateForm.kraItems];
                        copy[idx].metricType = e.target.value;
                        setTemplateForm({ ...templateForm, kraItems: copy });
                      }}
                      options={[
                        { value: 'MANUAL_RATING', label: 'Manual Rating (1 - 5)' },
                        { value: 'SYSTEM_DERIVED', label: 'System Derived (Auto-signal)' },
                        { value: 'QUANTITATIVE_TARGET', label: 'Quantitative Target' },
                      ]}
                    />
                  </div>
                  <div style={{ paddingTop: 20 }}>
                    <Button
                      size="sm"
                      type="button"
                      variant="danger"
                      icon={Trash2}
                      onClick={() => removeKraItemRow(idx)}
                      disabled={templateForm.kraItems.length <= 1}
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <Input
                    label="Measurement Criteria / Goals"
                    value={item.description}
                    placeholder="e.g. Sprints delivered on schedule, SLA adherence"
                    onChange={(e) => {
                      const copy = [...templateForm.kraItems];
                      copy[idx].description = e.target.value;
                      setTemplateForm({ ...templateForm, kraItems: copy });
                    }}
                  />
                  {item.metricType === 'SYSTEM_DERIVED' ? (
                    <Select
                      label="Live Signal Aggregator Source"
                      value={item.systemMetricSource || 'TASK_COMPLETION_RATE'}
                      onChange={(e) => {
                        const copy = [...templateForm.kraItems];
                        copy[idx].systemMetricSource = e.target.value;
                        setTemplateForm({ ...templateForm, kraItems: copy });
                      }}
                      options={[
                        { value: 'TASK_COMPLETION_RATE', label: 'Task Completion Rate (Module 17)' },
                        { value: 'PUNCTUALITY', label: 'Punctuality Score (Module 12)' },
                        { value: 'ATTENDANCE_CONSISTENCY', label: 'Attendance Consistency (Module 12)' },
                      ]}
                    />
                  ) : item.metricType === 'QUANTITATIVE_TARGET' ? (
                    <Input
                      label="Target Value"
                      type="number"
                      value={item.targetValue || ''}
                      placeholder="e.g. 100"
                      onChange={(e) => {
                        const copy = [...templateForm.kraItems];
                        copy[idx].targetValue = e.target.value;
                        setTemplateForm({ ...templateForm, kraItems: copy });
                      }}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setTemplateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingTemplate}>
              {editingTemplateId ? 'Update KRA Template' : 'Save KRA Template'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 5. REVIEW DETAILS AUDIT MODAL (GET /performance-reviews/:id) */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title="Appraisal Performance Summary &amp; Audit"
        size="lg"
      >
        {loadingDetails ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
            <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 8px' }} />
            <div>Loading appraisal audit details...</div>
          </div>
        ) : selectedReviewDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Employee banner */}
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 8,
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    background: '#e6f7ff',
                    color: '#1890ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Award size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                    {getEmployeeName(selectedReviewDetails.employee)}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Code: {getEmployeeCode(selectedReviewDetails.employee)} •{' '}
                    {selectedReviewDetails.employee?.department?.name || 'Department'} • Cycle: {selectedReviewDetails.reviewCycle}
                  </div>
                </div>
              </div>
              <Badge
                variant={
                  selectedReviewDetails.status === 'COMPLETED'
                    ? 'success'
                    : selectedReviewDetails.status === 'MANAGER_REVIEW_PENDING'
                    ? 'primary'
                    : 'warning'
                }
              >
                {selectedReviewDetails.status}
              </Badge>
            </div>

            {/* Score Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 12,
              }}
            >
              <div style={{ border: '1px solid #ffe58f', padding: 12, borderRadius: 8, background: '#fffbe6' }}>
                <div style={{ fontSize: '0.75rem', color: '#d48806', fontWeight: 600 }}>Self-Assessment Score</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#faad14' }}>
                  {selectedReviewDetails.selfScore ? `${Number(selectedReviewDetails.selfScore).toFixed(1)} / 5.0` : 'Pending'}
                </div>
              </div>

              <div style={{ border: '1px solid var(--border-color)', padding: 12, borderRadius: 8, background: 'var(--primary-light)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>Final Manager Score</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {selectedReviewDetails.managerScore || selectedReviewDetails.overallScore
                    ? `${Number(selectedReviewDetails.managerScore || selectedReviewDetails.overallScore).toFixed(1)} / 5.0`
                    : 'Pending'}
                </div>
              </div>

              {(selectedReviewDetails.managerScore || selectedReviewDetails.overallScore) && (
                <div style={{ border: '1px solid #b7eb8f', padding: 12, borderRadius: 8, background: '#f6ffed' }}>
                  <div style={{ fontSize: '0.75rem', color: '#389e0d', fontWeight: 600 }}>Performance Band</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#52c41a' }}>
                    {getPerformanceTier(selectedReviewDetails.managerScore || selectedReviewDetails.overallScore).label}
                  </div>
                </div>
              )}
            </div>

            {/* Itemized Table */}
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8 }}>
                KRA Targets &amp; Weighted Scoring Breakdown
              </h4>
              <table className="table" style={{ width: '100%', fontSize: '0.84rem' }}>
                <thead>
                  <tr>
                    <th>KRA Target</th>
                    <th>Weight</th>
                    <th>Metric Type</th>
                    <th>Self Rating</th>
                    <th>Manager Rating</th>
                    <th>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {((Array.isArray(selectedReviewDetails.kraScores) && selectedReviewDetails.kraScores.length > 0)
                    ? selectedReviewDetails.kraScores
                    : (selectedReviewDetails.kraTemplate?.kraItems || selectedReviewDetails.kraItems || [])
                  ).map((item, idx) => {
                    const itemName = item.kraItemName || item.name;
                    const selfR = item.selfRating ?? selectedReviewDetails.selfRatings?.find((s) => s.kraItemName === itemName)?.selfRating;
                    const mgrR = item.managerRating ? { managerRating: item.managerRating, managerComment: item.managerComment } : selectedReviewDetails.managerRatings?.find((m) => m.kraItemName === itemName);
                    return (
                      <tr key={idx}>
                        <td>
                          <strong>{itemName}</strong>
                          {item.description && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.description}</div>
                          )}
                        </td>
                        <td>{item.weightPercent || item.weight || '-'}%</td>
                        <td>
                          <Badge variant="secondary">{item.metricType || 'MANUAL'}</Badge>
                        </td>
                        <td>
                          {selfR ? <Badge variant="warning">{selfR} / 5</Badge> : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                        </td>
                        <td>
                          {mgrR?.managerRating ? (
                            <Badge variant="primary">{mgrR.managerRating} / 5</Badge>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {mgrR?.managerComment || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Manager Remarks */}
            {(selectedReviewDetails.overallComment || selectedReviewDetails.remarks) && (
              <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                <strong>Manager Feedback:</strong> {selectedReviewDetails.overallComment || selectedReviewDetails.remarks}
              </div>
            )}

            <div className="modal-footer" style={{ margin: '10px -20px -20px', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                {selectedReviewDetails.status === 'MANAGER_REVIEW_PENDING' && canManage && (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={CheckCircle2}
                    onClick={() => {
                      setDetailsModalOpen(false);
                      openManagerModal(selectedReviewDetails);
                    }}
                  >
                    Evaluate Appraisal
                  </Button>
                )}
              </div>
              <Button variant="secondary" onClick={() => setDetailsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default PerformanceReviews;
