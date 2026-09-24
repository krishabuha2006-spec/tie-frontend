import React, { useState, useEffect } from 'react';
import performanceApi from '../../api/performanceApi';
import masterApi from '../../api/masterApi';
import employeeApi from '../../api/employeeApi';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useAuth } from '../../context/AuthContext';
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
  const { user, isSuperAdmin, isHrAdmin } = useAuth();
  const canManage = isSuperAdmin || isHrAdmin;
  const { showToast } = useToast();

  // Active Tab: 'cycles' | 'self' | 'manager_queue' | 'templates'
  const [activeTab, setActiveTab] = useState(canManage ? 'cycles' : 'self');

  // Master Data
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  // =========================================================================
  // TAB 1: REVIEW CYCLES & REVIEWS (Module 21)
  // =========================================================================
  const [allReviews, setAllReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [submittingCycle, setSubmittingCycle] = useState(false);
  const [cycleForm, setCycleForm] = useState({
    reviewCycle: 'Q3-2026',
    cycleStart: '2026-07-01',
    cycleEnd: '2026-09-30',
    kraTemplate: '',
    scope: {
      company: '',
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
  const [managerRemarks, setManagerRemarks] = useState('');
  const [submittingManager, setSubmittingManager] = useState(false);

  // =========================================================================
  // TAB 4: KRA TEMPLATES (Module 21)
  // =========================================================================
  const [kraTemplates, setKraTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [submittingTemplate, setSubmittingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    company: '',
    kraItems: [
      { name: 'Core Deliverables & Quality', weight: 40, description: 'Delivery of assigned projects and defect rates' },
      { name: 'Attendance, Punctuality & Discipline', weight: 30, description: 'Biometric shift compliance and availability' },
      { name: 'Leadership & Team Collaboration', weight: 30, description: 'Cross-functional help and peer support' },
    ],
  });

  // Review Details Modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedReviewDetails, setSelectedReviewDetails] = useState(null);

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
  }, [activeTab]);

  const loadMasters = async () => {
    try {
      const [cRes, dRes, eRes, tplRes] = await Promise.all([
        masterApi.getCompanies().catch(() => ({ data: [] })),
        masterApi.getDepartments().catch(() => ({ data: [] })),
        employeeApi.getEmployees({ limit: 100 }).catch(() => ({ data: [] })),
        performanceApi.getKraTemplates().catch(() => ({ data: [] })),
      ]);
      const compList = extractApiData(cRes, 'companies', 'data');
      const deptList = extractApiData(dRes, 'departments', 'data');
      const empList = extractApiData(eRes, 'employees', 'data');
      const tpls = extractApiData(tplRes, 'templates', 'kraTemplates', 'data');

      setCompanies(compList);
      setDepartments(deptList);
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
      const res = await performanceApi.getPendingManagerReviews();
      const list = extractApiData(res, 'reviews', 'data');
      setAllReviews(list);
    } catch (err) {
      showToast('Failed to load performance reviews', 'error');
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
      await performanceApi.initiateReviewCycle(cycleForm);
      showToast('Review cycle initiated and employee appraisals generated!', 'success');
      setCycleModalOpen(false);
      loadAllReviews();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to initiate review cycle', 'error');
    } finally {
      setSubmittingCycle(false);
    }
  };

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
        // Evaluator / Admin accounts without an employee profile do not have personal self-service reviews
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
    const items = review.kraTemplate?.kraItems || review.kraItems || [];
    setSelfRatings(
      items.map((i) => ({
        kraItemName: i.name || i.kraItemName || 'KRA Item',
        selfRating: 3,
        remarks: '',
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
    } catch (err) {
      showToast('Failed to load pending evaluations', 'error');
    } finally {
      setLoadingManagerQueue(false);
    }
  };

  const openManagerModal = (review) => {
    setActiveReviewForManager(review);
    const items = review.kraTemplate?.kraItems || review.kraItems || [];
    setManagerRatings(
      items.map((i) => ({
        kraItemName: i.name || i.kraItemName || 'KRA Item',
        managerRating: 3,
      }))
    );
    setManagerRemarks('');
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
        })),
        remarks: managerRemarks,
      });
      showToast('Manager evaluation complete and overall appraisal scored!', 'success');
      setManagerModalOpen(false);
      loadManagerQueue();
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
        kraItems: (tpl.kraItems && tpl.kraItems.length > 0)
          ? tpl.kraItems.map((item) => ({
              name: item.name || '',
              weightPercent: item.weightPercent ?? item.weight ?? 0,
              metricType: item.metricType || 'MANUAL_RATING',
              description: item.description || '',
            }))
          : [{ name: '', weightPercent: 100, metricType: 'MANUAL_RATING', description: '' }],
      });
    } else {
      setEditingTemplateId(null);
      setTemplateForm({
        name: '',
        company: companies[0]?._id || '',
        kraItems: [
          { name: '', weightPercent: 100, metricType: 'MANUAL_RATING', description: '' },
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
        { name: '', weightPercent: remainder, metricType: 'MANUAL_RATING', description: '' },
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
        showToast('KRA template updated!', 'success');
      } else {
        await performanceApi.createKraTemplate(templateForm);
        showToast('KRA template created!', 'success');
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
      message: 'Are you sure you want to deactivate this KRA template? It will no longer be available for assignment.',
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

  const handleViewDetails = async (review) => {
    try {
      const res = await performanceApi.getReviewById(review._id);
      setSelectedReviewDetails(res?.data || res || review);
    } catch (err) {
      setSelectedReviewDetails(review);
    }
    setDetailsModalOpen(true);
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
            <div style={{ fontWeight: 600 }}>
              {r.employee?.firstName ? `${r.employee.firstName} ${r.employee.lastName || ''}` : r.employee?.name || 'Staff Member'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {r.employee?.employeeCode || '-'} • {r.employee?.department?.name || 'Department'}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Review Cycle',
      key: 'reviewCycle',
      render: (r) => <span style={{ fontWeight: 600 }}>{r.reviewCycle || 'Q3-2026'}</span>,
    },
    {
      header: 'Self Score',
      key: 'selfScore',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Star size={14} color="#f5a532" fill="#f5a532" />
          <span style={{ fontWeight: 600 }}>{r.selfScore ? `${r.selfScore}/5` : 'Pending'}</span>
        </div>
      ),
    },
    {
      header: 'Manager Score',
      key: 'managerScore',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Star size={14} color="var(--primary)" fill="var(--primary)" />
          <span style={{ fontWeight: 700 }}>{r.managerScore ? `${r.managerScore}/5` : 'Pending'}</span>
        </div>
      ),
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
        return <Badge variant={colors[s] || 'secondary'}>{s}</Badge>;
      },
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="sm" variant="secondary" icon={Eye} onClick={() => handleViewDetails(r)}>
            View Appraisal
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
          <div style={{ fontWeight: 600 }}>{r.reviewCycle || 'Annual Appraisal'}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Template: {r.kraTemplate?.name || 'Standard Role KRA'}
          </div>
        </div>
      ),
    },
    {
      header: 'Your Self Rating',
      key: 'selfScore',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Star size={14} color="#f5a532" fill="#f5a532" />
          <span style={{ fontWeight: 600 }}>{r.selfScore ? `${r.selfScore}/5` : 'Not Submitted'}</span>
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
      header: 'Template Name',
      key: 'name',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={16} color="var(--primary)" />
          <span style={{ fontWeight: 600 }}>{r.name}</span>
        </div>
      ),
    },
    {
      header: 'Company',
      key: 'company',
      render: (r) => r.company?.name || 'All Companies',
    },
    {
      header: 'KRA Items Count',
      key: 'items',
      render: (r) => `${r.kraItems?.length || 0} Key Performance Areas`,
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
          {canManage && activeTab === 'cycles' && (
            <Button variant="primary" icon={Plus} onClick={() => setCycleModalOpen(true)}>
              Initiate Review Cycle
            </Button>
          )}
          {canManage && activeTab === 'templates' && (
            <Button variant="primary" icon={Plus} onClick={() => openTemplateModal()}>
              Create KRA Template
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--border-color)',
          overflowX: 'auto',
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
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'cycles' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeTab === 'cycles' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'cycles' ? 700 : 500,
              cursor: 'pointer',
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
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'self' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'self' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'self' ? 700 : 500,
            cursor: 'pointer',
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
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'manager_queue' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeTab === 'manager_queue' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'manager_queue' ? 700 : 500,
              cursor: 'pointer',
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
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'templates' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeTab === 'templates' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'templates' ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            <Layers size={16} />
            <span>KRA Templates ({kraTemplates.length})</span>
          </button>
        )}
      </div>

      {/* TAB 1: ALL REVIEWS */}
      {activeTab === 'cycles' && (
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
              Active review documents automatically linked with attendance and task completion scores.
            </div>
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadAllReviews}>
              Refresh Appraisals
            </Button>
          </div>
          <Table columns={reviewColumns} data={allReviews} loading={loadingReviews} emptyMessage="No performance review cycles initiated." />
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
              Your self-appraisal submissions for official review cycles.
            </div>
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadMyReviews}>
              Refresh
            </Button>
          </div>
          <Table
            columns={selfColumns}
            data={myReviews}
            loading={loadingMyReviews}
            emptyMessage={
              isSuperAdmin || isHrAdmin
                ? 'Admin/Evaluator accounts do not have personal self-assessment appraisals. Employee self-appraisals will appear under Appraisal Reviews and Manager Queue.'
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
              Reviews where employee self-ratings are submitted, awaiting reporting manager sign-off.
            </div>
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadManagerQueue}>
              Refresh Queue
            </Button>
          </div>
          <Table columns={reviewColumns} data={managerQueue} loading={loadingManagerQueue} emptyMessage="No reviews awaiting manager evaluation." />
        </div>
      )}

      {/* TAB 4: KRA TEMPLATES */}
      {activeTab === 'templates' && (
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
              Role-specific KRA templates with weighted scoring formulas.
            </div>
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadTemplates}>
              Refresh Templates
            </Button>
          </div>
          <Table columns={templateColumns} data={kraTemplates} loading={loadingTemplates} emptyMessage="No KRA templates configured." />
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALS */}
      {/* ===================================================================== */}

      {/* 1. INITIATE REVIEW CYCLE MODAL */}
      <Modal
        isOpen={cycleModalOpen}
        onClose={() => setCycleModalOpen(false)}
        title="Initiate Performance Review Cycle"
      >
        <form onSubmit={handleInitiateCycle}>
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
            label="KRA Template"
            value={cycleForm.kraTemplate}
            onChange={(e) => setCycleForm({ ...cycleForm, kraTemplate: e.target.value })}
            options={kraTemplates.map((t) => ({ value: t._id, label: t.name }))}
            required
          />

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

      {/* 2. SUBMIT SELF ASSESSMENT MODAL */}
      <Modal
        isOpen={selfAssessmentModalOpen}
        onClose={() => setSelfAssessmentModalOpen(false)}
        title="Submit Self-Assessment (1 - 5 Scale)"
        size="md"
      >
        <form onSubmit={handleSubmitSelfAssessment}>
          <div style={{ marginBottom: 14, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
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
                  borderRadius: 6,
                  backgroundColor: 'var(--bg-subtle)',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{item.kraItemName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 500 }}>Rating:</label>
                  <select
                    className="form-control"
                    style={{ width: '120px' }}
                    value={item.selfRating}
                    onChange={(e) => {
                      const updated = [...selfRatings];
                      updated[idx].selfRating = Number(e.target.value);
                      setSelfRatings(updated);
                    }}
                  >
                    <option value="1">1 - Needs Improvement</option>
                    <option value="2">2 - Developing</option>
                    <option value="3">3 - Competent / Meets</option>
                    <option value="4">4 - Highly Effective</option>
                    <option value="5">5 - Role Model / Top</option>
                  </select>
                </div>
              </div>
            ))
          )}
          </div>

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

      {/* 3. SUBMIT MANAGER EVALUATION MODAL */}
      <Modal
        isOpen={managerModalOpen}
        onClose={() => setManagerModalOpen(false)}
        title={`Manager Evaluation: ${activeReviewForManager?.employee?.firstName || 'Staff'}`}
        size="md"
      >
        <form onSubmit={handleSubmitManagerReview}>
          <div style={{ marginBottom: 14, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Evaluate employee performance and assign authoritative score.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {managerRatings.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                No specific KRA items linked to this review cycle. Please consult HR / Administrator.
              </div>
            ) : (
              managerRatings.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 12,
                    border: '1px solid var(--border-color)',
                    borderRadius: 6,
                    backgroundColor: 'var(--bg-subtle)',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{item.kraItemName}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 500 }}>Manager Score:</label>
                    <select
                      className="form-control"
                      style={{ width: '130px' }}
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
                </div>
              ))
            )}
          </div>

          <Input
            label="Manager Appraiser Remarks"
            value={managerRemarks}
            onChange={(e) => setManagerRemarks(e.target.value)}
            placeholder="Feedback on strengths and development areas"
            required
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setManagerModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingManager}>
              Complete Appraisal
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. KRA TEMPLATE MODAL */}
      <Modal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title={editingTemplateId ? 'Edit KRA Template' : 'New KRA Template'}
        size="lg"
      >
        <form onSubmit={handleSaveTemplate}>
          <div className="grid-2">
            <Input
              label="Template Name"
              value={templateForm.name}
              onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
              placeholder="e.g. Senior Software Engineer / Field Sales"
              required
            />
            <Select
              label="Company"
              value={templateForm.company}
              onChange={(e) => setTemplateForm({ ...templateForm, company: e.target.value })}
              options={companies.map((c) => ({ value: c._id, label: c.name }))}
            />
          </div>

          <div style={{ marginTop: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>KRA Target Areas</h4>
                {(() => {
                  const currentSum = templateForm.kraItems.reduce((acc, it) => acc + (Number(it.weightPercent) || 0), 0);
                  const is100 = currentSum === 100;
                  return (
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 12,
                      backgroundColor: is100 ? '#dcfce7' : '#fee2e2',
                      color: is100 ? '#15803d' : '#b91c1c',
                    }}>
                      Total Weight: {currentSum}% {is100 ? '✓' : '(Must be 100%)'}
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
                    const remainder = 100 - (base * count);
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
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 2.5fr 40px',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <Input
                  value={item.name}
                  placeholder="KRA Area Name (e.g. Code Quality)"
                  onChange={(e) => {
                    const copy = [...templateForm.kraItems];
                    copy[idx].name = e.target.value;
                    setTemplateForm({ ...templateForm, kraItems: copy });
                  }}
                  required
                />
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={item.weightPercent}
                  placeholder="Weight %"
                  onChange={(e) => {
                    const copy = [...templateForm.kraItems];
                    copy[idx].weightPercent = e.target.value === '' ? '' : Number(e.target.value);
                    setTemplateForm({ ...templateForm, kraItems: copy });
                  }}
                  required
                />
                <Input
                  value={item.description}
                  placeholder="Measurement Criteria / Goals"
                  onChange={(e) => {
                    const copy = [...templateForm.kraItems];
                    copy[idx].description = e.target.value;
                    setTemplateForm({ ...templateForm, kraItems: copy });
                  }}
                />
                <Button
                  size="sm"
                  type="button"
                  variant="danger"
                  icon={Trash2}
                  onClick={() => removeKraItemRow(idx)}
                  disabled={templateForm.kraItems.length <= 1}
                />
              </div>
            ))}
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setTemplateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingTemplate}>
              Save KRA Template
            </Button>
          </div>
        </form>
      </Modal>

      {/* 5. REVIEW DETAILS MODAL */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title="Appraisal Performance Summary"
        size="md"
      >
        {selectedReviewDetails && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: 12, backgroundColor: 'var(--bg-subtle)', borderRadius: 6 }}>
              <div style={{ fontWeight: 600 }}>
                {selectedReviewDetails.employee?.firstName} {selectedReviewDetails.employee?.lastName}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Cycle: {selectedReviewDetails.reviewCycle} • Status: <Badge>{selectedReviewDetails.status}</Badge>
              </div>
            </div>

            <div className="grid-2">
              <div style={{ border: '1px solid var(--border-color)', padding: 12, borderRadius: 6 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Self Assessment Score</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f5a532' }}>
                  {selectedReviewDetails.selfScore ? `${selectedReviewDetails.selfScore}/5` : 'Pending'}
                </div>
              </div>
              <div style={{ border: '1px solid var(--border-color)', padding: 12, borderRadius: 6, backgroundColor: 'var(--primary-light)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--primary)' }}>Final Manager Rating</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {selectedReviewDetails.managerScore ? `${selectedReviewDetails.managerScore}/5` : 'Pending'}
                </div>
              </div>
            </div>

            {selectedReviewDetails.remarks && (
              <div style={{ fontSize: '0.85rem' }}>
                <strong>Manager Feedback:</strong> {selectedReviewDetails.remarks}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PerformanceReviews;
