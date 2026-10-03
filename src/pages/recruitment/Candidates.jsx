import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import recruitmentApi from '../../api/recruitmentApi';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { validateEmail, validatePhone } from '../../utils/validation';
import { useAuth } from '../../context/AuthContext';
import {
  Plus,
  UserPlus,
  FileText,
  CheckCircle2,
  Calendar,
  MessageSquare,
  ScanFace,
  Search,
  Users,
  Trash2,
  X,
  Eye,
  Award,
  Clock,
  Check,
  TrendingUp,
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { recruitmentNav } from '../../routes/moduleNavConfig';
import { extractApiData } from '../../utils/apiUtils';

export const Candidates = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const { branch: globalBranch } = useAuth();

  const activeBranchId = globalBranch?._id || globalBranch?.id;
  const isAllBranches = !activeBranchId || activeBranchId === 'ALL';

  const filterJobId = searchParams.get('jobId') || '';

  // Data state
  const [candidates, setCandidates] = useState([]);
  const [jobOpenings, setJobOpenings] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [selectedJobFilter, setSelectedJobFilter] = useState(filterJobId);

  // Active candidate for actions
  const [activeCandidate, setActiveCandidate] = useState(null);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailedCandidate, setDetailedCandidate] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [interviewModalOpen, setInterviewModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [onboardModalOpen, setOnboardModalOpen] = useState(false);

  // Forms
  const [candidateForm, setCandidateForm] = useState({
    jobOpening: '',
    fullName: '',
    email: '',
    phone: '',
    source: 'JOB_PORTAL',
    resumeUrl: '',
  });

  const [interviewForm, setInterviewForm] = useState({
    roundName: 'Technical Interview',
    scheduledAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    mode: 'ONLINE',
    meetingLink: '',
  });

  const [feedbackForm, setFeedbackForm] = useState({
    score: 8,
    feedback: 'Good technical understanding and problem solving ability.',
    status: 'PASSED',
  });

  const [offerForm, setOfferForm] = useState({
    joiningDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    probationPeriodMonths: 3,
    department: '',
    designation: '',
  });

  // Sync URL query param with filter state
  useEffect(() => {
    setSelectedJobFilter(filterJobId);
  }, [filterJobId]);

  // Load all candidates and related master data from backend
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, jRes, deptRes, desigRes] = await Promise.all([
        recruitmentApi.getCandidates(),
        recruitmentApi.getJobOpenings().catch(() => ({ data: [] })),
        masterApi.getDepartments().catch(() => ({ data: [] })),
        masterApi.getDesignations().catch(() => ({ data: [] })),
      ]);

      const cList = extractApiData(cRes, 'candidates', 'data');
      const jList = extractApiData(jRes, 'jobs', 'jobOpenings', 'data');
      const deptList = extractApiData(deptRes, 'departments', 'data');
      const desigList = extractApiData(desigRes, 'designations', 'data');

      setCandidates(cList);
      setJobOpenings(jList);
      setDepartments(deptList);
      setDesignations(desigList);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to load recruitment data from server', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
    const handleContextChange = () => loadData();
    window.addEventListener('tie:context-changed', handleContextChange);
    return () => window.removeEventListener('tie:context-changed', handleContextChange);
  }, [loadData, globalBranch]);

  // View Candidate Details (GET /candidates/:id)
  const handleViewDetails = async (cand) => {
    setActiveCandidate(cand);
    setDetailedCandidate(cand);
    setDetailModalOpen(true);
    setLoadingDetail(true);
    try {
      const res = await recruitmentApi.getCandidateById(cand._id);
      const detail = res?.data || res?.candidate || res;
      if (detail && detail._id) {
        setDetailedCandidate(detail);
      }
    } catch (err) {
      console.warn('Could not fetch detailed candidate from server, showing row data:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Register Candidate Application (POST /candidates)
  const handleCreateCandidate = async (e) => {
    e.preventDefault();
    if (!candidateForm.jobOpening) {
      showToast('Please select a job opening vacancy', 'warning');
      return;
    }
    if (!candidateForm.fullName.trim()) {
      showToast('Candidate full name is required', 'warning');
      return;
    }
    const emailErr = validateEmail(candidateForm.email, { fieldName: 'Candidate email' });
    if (emailErr) {
      showToast(emailErr, 'warning');
      return;
    }
    const phoneErr = validatePhone(candidateForm.phone, { fieldName: 'Phone number' });
    if (phoneErr) {
      showToast(phoneErr, 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await recruitmentApi.applyCandidate({
        jobOpening: candidateForm.jobOpening,
        fullName: candidateForm.fullName.trim(),
        mobileNumber: candidateForm.phone.trim(),
        email: candidateForm.email.trim(),
        source: candidateForm.source || 'JOB_PORTAL',
        resumeUrl: candidateForm.resumeUrl?.trim() || undefined,
      });

      showToast('Candidate application registered successfully!', 'success');
      setAddModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to register candidate', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Update Candidate Pipeline Stage (PUT /candidates/:id/stage)
  const handleUpdateStage = async (cand, newStage) => {
    try {
      await recruitmentApi.updateCandidateStage(cand._id, newStage);
      showToast(`Candidate moved to ${newStage}`, 'success');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update candidate stage', 'error');
    }
  };

  // Schedule Interview (PUT /candidates/:id/interview-notes + stage advance)
  const handleScheduleInterview = async (e) => {
    e.preventDefault();
    if (!activeCandidate) return;
    setSubmitting(true);
    try {
      await recruitmentApi.scheduleInterview(activeCandidate._id, interviewForm);
      await recruitmentApi.updateCandidateStage(activeCandidate._id, 'INTERVIEW');
      showToast('Interview round scheduled successfully!', 'success');
      setInterviewModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to schedule interview', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Feedback & Evaluation Notes (PUT /candidates/:id/interview-notes)
  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!activeCandidate) return;
    setSubmitting(true);
    try {
      await recruitmentApi.submitInterviewFeedback(activeCandidate._id, feedbackForm);
      showToast('Interview feedback and evaluation recorded!', 'success');
      setFeedbackModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit feedback', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Generate Offer (PUT /candidates/:id/offer)
  const handleGenerateOffer = async (e) => {
    e.preventDefault();
    if (!activeCandidate) return;
    setSubmitting(true);
    try {
      await recruitmentApi.generateOffer(activeCandidate._id, {
        dateOfJoining: offerForm.joiningDate,
        probationPeriodMonths: Number(offerForm.probationPeriodMonths) || 3,
        department: offerForm.department || activeCandidate.jobOpening?.department?._id || undefined,
        designation: offerForm.designation || undefined,
      });
      await recruitmentApi.updateCandidateStage(activeCandidate._id, 'OFFER');
      showToast('Offer terms generated for candidate!', 'success');
      setOfferModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to generate offer', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Accept Offer (PUT /candidates/:id/offer with accepted: true)
  const handleAcceptOffer = async (cand) => {
    try {
      const offerInfo = cand.offerDetails || {};
      const jobOpening = cand.jobOpening || {};
      await recruitmentApi.acceptOffer(cand._id, {
        designation: offerInfo.designation?._id || offerInfo.designation || jobOpening.designation?._id || jobOpening.designation || designations[0]?._id,
        department: offerInfo.department?._id || offerInfo.department || jobOpening.department?._id || jobOpening.department || departments[0]?._id,
        branch: offerInfo.branch?._id || offerInfo.branch || jobOpening.branch?._id || jobOpening.branch,
        dateOfJoining: offerInfo.dateOfJoining || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      });
      showToast(`Offer marked as accepted for ${cand.fullName || 'Candidate'}!`, 'success');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to accept offer', 'error');
    }
  };

  // 1-Click Convert Candidate to Employee (PUT /candidates/:id/convert)
  const handleExecuteOnboard = async () => {
    if (!activeCandidate) return;
    setSubmitting(true);
    try {
      const res = await recruitmentApi.convertCandidateToEmployee(activeCandidate._id, {});
      showToast(res?.message || 'Candidate converted to active Employee successfully!', 'success');
      setOnboardModalOpen(false);
      await loadData();
      window.dispatchEvent(new Event('employee-updated'));
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to convert candidate to employee', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Generate Joining & Appointment Letters (PUT /candidates/:id/onboarding/generate-letters)
  const handleGenerateLetters = async (cand) => {
    const isActuallyConverted = Boolean(cand.convertedEmployee || cand.isConverted || cand.onboardedEmployeeId);
    if (!isActuallyConverted) {
      const shouldConvert = await confirm({
        title: 'Candidate Not Converted Yet',
        message: `Candidate "${cand.fullName || 'Candidate'}" must be converted to an Employee before generating Joining & Appointment letters.\n\nWould you like to convert them to an Employee now?`,
        confirmText: 'Convert to Employee',
        cancelText: 'Cancel',
      });
      if (!shouldConvert) return;

      try {
        await recruitmentApi.convertCandidateToEmployee(cand._id, {});
        showToast('Candidate converted to Employee! Generating letters...', 'success');
        await recruitmentApi.generateOnboardingLetters(cand._id);
        showToast(`Joining and Appointment letters generated and attached for ${cand.fullName || 'Employee'}!`, 'success');
        await loadData();
      } catch (err) {
        showToast(err.response?.data?.message || 'Failed to convert candidate', 'error');
      }
      return;
    }

    try {
      await recruitmentApi.generateOnboardingLetters(cand._id);
      showToast(`Joining and Appointment letters generated and attached for ${cand.fullName || 'Employee'}!`, 'success');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to generate onboarding letters', 'error');
    }
  };

  // Withdraw Candidate Application (PUT /candidates/:id/stage with WITHDRAWN)
  const handleDeleteCandidate = async (cand) => {
    const candName = cand.fullName || `${cand.firstName || ''} ${cand.lastName || ''}`.trim() || 'Candidate';
    const isConfirmed = await confirm({
      title: 'Withdraw Candidate Application',
      message: `Are you sure you want to withdraw application for "${candName}"? This will mark the application as WITHDRAWN in the pipeline.`,
      confirmText: 'Withdraw Application',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!isConfirmed) return;
    try {
      await recruitmentApi.updateCandidateStage(cand._id, 'WITHDRAWN');
      showToast(`Candidate "${candName}" application marked as withdrawn`, 'success');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to withdraw candidate application', 'error');
    }
  };

  // Stage Badge Visuals
  const getStageVariant = (st) => {
    switch (st) {
      case 'CONVERTED':
      case 'HIRED':
      case 'ONBOARDED':
        return 'success';
      case 'OFFER':
      case 'OFFER_ACCEPTED':
      case 'INTERVIEW_PASSED':
        return 'primary';
      case 'SCREENING':
      case 'INTERVIEW':
      case 'SHORTLISTED':
        return 'info';
      case 'REJECTED':
      case 'WITHDRAWN':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  // Filtered List
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // Branch Filter
      if (!isAllBranches && activeBranchId) {
        const cBranchId = c.jobOpening?.branch?._id || c.jobOpening?.branch?.id || c.jobOpening?.branch || c.branch?._id || c.branch?.id || (typeof c.branch === 'string' ? c.branch : null);
        const cBranchName = (c.jobOpening?.branch?.name || c.branch?.name || '').toLowerCase().trim();
        const activeBranchName = (globalBranch?.name || '').toLowerCase().trim();

        if (cBranchId) {
          if (String(cBranchId) !== String(activeBranchId)) return false;
        } else if (cBranchName && activeBranchName) {
          if (cBranchName !== activeBranchName) return false;
        }
      }

      // Job Filter
      if (selectedJobFilter) {
        const cJobId = c.jobOpening?._id || c.jobOpening?.id || (typeof c.jobOpening === 'string' ? c.jobOpening : null);
        if (cJobId !== selectedJobFilter) return false;
      }

      // Stage Filter
      if (stageFilter !== 'ALL') {
        const stage = c.currentStage || c.stage || 'APPLIED';
        if (stageFilter === 'CONVERTED' && !(c.isFrozen || ['CONVERTED', 'HIRED', 'ONBOARDED'].includes(stage))) return false;
        if (stageFilter === 'OFFER' && !['OFFER', 'OFFER_ACCEPTED'].includes(stage)) return false;
        if (stageFilter === 'INTERVIEW' && stage !== 'INTERVIEW') return false;
        if (stageFilter === 'SCREENING' && stage !== 'SCREENING') return false;
        if (stageFilter === 'APPLIED' && stage !== 'APPLIED') return false;
        if (stageFilter === 'REJECTED' && stage !== 'REJECTED') return false;
      }

      // Search
      if (search.trim()) {
        const s = search.toLowerCase();
        const name = (c.fullName || `${c.firstName || ''} ${c.lastName || ''}`).toLowerCase();
        const email = (c.email || '').toLowerCase();
        const phone = (c.mobileNumber || c.phone || '').toLowerCase();
        const jobTitle = (c.jobOpening?.title || '').toLowerCase();
        if (!name.includes(s) && !email.includes(s) && !phone.includes(s) && !jobTitle.includes(s)) return false;
      }

      return true;
    });
  }, [candidates, selectedJobFilter, stageFilter, search, isAllBranches, activeBranchId, globalBranch]);

  // Quick Pipeline Stats (computed on filtered list)
  const stats = useMemo(() => {
    const total = filteredCandidates.length;
    const inPipeline = filteredCandidates.filter((c) => {
      const st = c.currentStage || c.stage || 'APPLIED';
      return ['APPLIED', 'SCREENING', 'INTERVIEW'].includes(st);
    }).length;
    const offers = filteredCandidates.filter((c) => {
      const st = c.currentStage || c.stage || 'APPLIED';
      return ['OFFER', 'OFFER_ACCEPTED'].includes(st);
    }).length;
    const converted = filteredCandidates.filter((c) => {
      const st = c.currentStage || c.stage || 'APPLIED';
      return c.isFrozen || ['CONVERTED', 'HIRED', 'ONBOARDED'].includes(st);
    }).length;

    return { total, inPipeline, offers, converted };
  }, [filteredCandidates]);

  const currentFilteredJob = selectedJobFilter ? jobOpenings.find((j) => j._id === selectedJobFilter) : null;

  // Table Columns
  const columns = [
    {
      header: 'Candidate Name',
      key: 'fullName',
      render: (r) => (
        <div>
          <div
            style={{ fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
            onClick={() => handleViewDetails(r)}
            title="Click to view full application details"
          >
            {r.fullName || `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'Candidate'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {r.email} • {r.mobileNumber || r.phone}
          </div>
        </div>
      ),
    },
    {
      header: 'Applied Vacancy',
      key: 'jobOpening',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: '0.84rem' }}>
            {r.jobOpening?.title || 'General Vacancy'}
          </div>
          {r.jobOpening?.department?.name && (
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {r.jobOpening.department.name}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Source',
      key: 'source',
      render: (r) => <Badge variant="neutral">{r.source || 'JOB_PORTAL'}</Badge>,
    },
    {
      header: 'Pipeline Stage',
      key: 'currentStage',
      render: (r) => {
        const stage = r.currentStage || r.stage || r.status || 'APPLIED';
        return <Badge variant={getStageVariant(stage)}>{stage}</Badge>;
      },
    },
    {
      header: 'Actions & Progression',
      key: 'actions',
      render: (r) => {
        const stage = r.currentStage || r.stage || r.status || 'APPLIED';
        const isConverted = Boolean(r.isConverted || r.convertedEmployee || r.onboardedEmployeeId);
        const empId = r.convertedEmployee?._id || r.convertedEmployee || r.onboardedEmployeeId;

        if (isConverted) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontSize: '0.82rem', fontWeight: 600 }}>
                <CheckCircle2 size={14} /> Converted
              </span>
              <Button
                size="sm"
                variant="ghost"
                icon={FileText}
                onClick={() => handleGenerateLetters(r)}
                title="Generate Joining & Appointment Letters"
              >
                Letters
              </Button>
              {empId && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={ScanFace}
                  onClick={() => navigate(`/attendance/face-punch?tab=register&empId=${empId}`)}
                  title="Enroll face punch recognition"
                >
                  Face Enroll
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                icon={Eye}
                onClick={() => handleViewDetails(r)}
                title="View candidate details"
              />
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* View Details */}
            <Button
              size="sm"
              variant="ghost"
              icon={Eye}
              onClick={() => handleViewDetails(r)}
              title="View Candidate Details"
            />

            {/* Stage: APPLIED */}
            {stage === 'APPLIED' && (
              <Button size="sm" variant="secondary" onClick={() => handleUpdateStage(r, 'SCREENING')}>
                Shortlist
              </Button>
            )}

            {/* Stage: SCREENING or APPLIED */}
            {(stage === 'SCREENING' || stage === 'APPLIED') && (
              <Button
                size="sm"
                variant="light"
                icon={Calendar}
                onClick={() => {
                  setActiveCandidate(r);
                  setInterviewModalOpen(true);
                }}
              >
                Schedule
              </Button>
            )}

            {/* Stage: INTERVIEW */}
            {stage === 'INTERVIEW' && (
              <>
                <Button
                  size="sm"
                  variant="light"
                  icon={MessageSquare}
                  onClick={() => {
                    setActiveCandidate(r);
                    setFeedbackModalOpen(true);
                  }}
                >
                  Feedback
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={FileText}
                  onClick={() => {
                    setActiveCandidate(r);
                    setOfferForm({
                      joiningDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
                      probationPeriodMonths: 3,
                      department: r.jobOpening?.department?._id || '',
                      designation: designations[0]?._id || '',
                    });
                    setOfferModalOpen(true);
                  }}
                >
                  Offer
                </Button>
              </>
            )}

            {/* Stage: OFFER or unconverted CONVERTED */}
            {(stage === 'OFFER' || stage === 'CONVERTED') && (
              <>
                {stage === 'OFFER' && (
                  <Button
                    size="sm"
                    variant="light"
                    icon={Check}
                    onClick={() => handleAcceptOffer(r)}
                    title="Mark offer as accepted"
                  >
                    Accept Offer
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="primary"
                  icon={UserPlus}
                  onClick={() => {
                    setActiveCandidate(r);
                    setOnboardModalOpen(true);
                  }}
                >
                  1-Click Convert
                </Button>
              </>
            )}

            {/* Reject Option */}
            {stage !== 'REJECTED' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleUpdateStage(r, 'REJECTED')}
                style={{ color: 'var(--danger)', fontSize: '0.78rem' }}
              >
                Reject
              </Button>
            )}

            {/* Delete Option */}
            {!isConverted && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteCandidate(r)}
                title="Delete candidate application"
                style={{ color: '#dc2626' }}
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ModuleSubNav items={recruitmentNav} />

      {/* Header & Main Action */}
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
            <Users size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Candidate Hiring Pipeline
              </h2>
              {selectedJobFilter && (
                <Badge variant="info" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
                  <span>Job: {currentFilteredJob?.title || selectedJobFilter}</span>
                  <X
                    size={13}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams);
                      newParams.delete('jobId');
                      setSearchParams(newParams);
                      setSelectedJobFilter('');
                    }}
                    title="Clear Job Filter"
                  />
                </Badge>
              )}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Track candidate screening, interview notes, offer acceptance, and employee conversion
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => {
              setCandidateForm({
                jobOpening: jobOpenings[0]?._id || '',
                fullName: '',
                email: '',
                phone: '',
                source: 'JOB_PORTAL',
                resumeUrl: '',
              });
              setAddModalOpen(true);
            }}
          >
            Register Candidate
          </Button>
        </div>
      </div>

      {/* Quick Pipeline Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(46, 123, 133, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1 }}>{stats.total}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Total Candidates</div>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6', lineHeight: 1 }}>{stats.inPipeline}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>In Screening / Interview</div>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#8b5cf6', lineHeight: 1 }}>{stats.offers}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Offers Extended</div>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981', lineHeight: 1 }}>{stats.converted}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Converted Employees</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 280, maxWidth: '100%' }}>
          <Input
            icon={Search}
            placeholder="Search name, email, phone, role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 0 }}
            inputStyle={{ height: 38, fontSize: '0.84rem' }}
          />
        </div>

        <div style={{ width: 180 }}>
          <Select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Pipeline Stages' },
              { value: 'APPLIED', label: 'Applied' },
              { value: 'SCREENING', label: 'Screening' },
              { value: 'INTERVIEW', label: 'Interview' },
              { value: 'OFFER', label: 'Offer' },
              { value: 'CONVERTED', label: 'Converted' },
              { value: 'REJECTED', label: 'Rejected' },
            ]}
            style={{ marginBottom: 0 }}
          />
        </div>

        {jobOpenings.length > 0 && (
          <div style={{ width: 220 }}>
            <Select
              value={selectedJobFilter}
              onChange={(e) => setSelectedJobFilter(e.target.value)}
              options={[
                { value: '', label: 'All Vacancies' },
                ...jobOpenings.map((j) => ({ value: j._id, label: j.title })),
              ]}
              style={{ marginBottom: 0 }}
            />
          </div>
        )}

        {(search || stageFilter !== 'ALL' || selectedJobFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setStageFilter('ALL');
              setSelectedJobFilter('');
              const newParams = new URLSearchParams(searchParams);
              newParams.delete('jobId');
              setSearchParams(newParams);
            }}
            style={{ fontSize: '0.8rem', height: 38 }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Candidates Table */}
      <div className="card">
        <Table
          columns={columns}
          data={filteredCandidates}
          loading={loading}
          emptyMessage="No candidates currently in hiring pipeline. Click 'Register Candidate' to add one."
        />
      </div>

      {/* Candidate Details Modal (GET /candidates/:id) */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Candidate Profile: ${detailedCandidate?.fullName || 'Candidate'}`}
      >
        {loadingDetail ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading candidate details from server...
          </div>
        ) : detailedCandidate ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid-2">
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Full Name</div>
                <div style={{ fontSize: '0.94rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  {detailedCandidate.fullName || `${detailedCandidate.firstName || ''} ${detailedCandidate.lastName || ''}` || 'Candidate'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Pipeline Stage</div>
                <Badge variant={getStageVariant(detailedCandidate.currentStage || detailedCandidate.stage)}>
                  {detailedCandidate.currentStage || detailedCandidate.stage || 'APPLIED'}
                </Badge>
              </div>
            </div>

            <div className="grid-2">
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Email Address</div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>{detailedCandidate.email || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Contact Number</div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>{detailedCandidate.mobileNumber || detailedCandidate.phone || '—'}</div>
              </div>
            </div>

            <div className="grid-2">
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Applied Vacancy</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>
                  {detailedCandidate.jobOpening?.title || 'General Vacancy'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Source</div>
                <div style={{ fontSize: '0.88rem' }}>{detailedCandidate.source || 'JOB_PORTAL'}</div>
              </div>
            </div>

            {detailedCandidate.resumeUrl && (
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>Resume / Portfolio</div>
                <a
                  href={detailedCandidate.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', fontSize: '0.85rem', textDecoration: 'underline' }}
                >
                  View Candidate Resume
                </a>
              </div>
            )}

            {/* Interview Notes History */}
            {Array.isArray(detailedCandidate.interviewNotes) && detailedCandidate.interviewNotes.length > 0 && (
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                  Interview Notes &amp; Evaluations
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detailedCandidate.interviewNotes.map((note, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'var(--bg-subtle, #f8fafc)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        fontSize: '0.82rem',
                      }}
                    >
                      {note.notes || note.feedback || JSON.stringify(note)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Offer Details if present */}
            {detailedCandidate.offer && (
              <div style={{ padding: 10, borderRadius: 8, backgroundColor: 'rgba(139, 92, 246, 0.08)', border: '1px solid #8b5cf6' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#8b5cf6', marginBottom: 4 }}>
                  Offer Terms
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                  Date of Joining: {detailedCandidate.offer.dateOfJoining ? new Date(detailedCandidate.offer.dateOfJoining).toLocaleDateString() : 'Pending'}<br />
                  Probation: {detailedCandidate.offer.probationPeriodMonths || 3} months<br />
                  Accepted: {detailedCandidate.offer.accepted ? 'Yes' : 'Pending Acceptance'}
                </div>
              </div>
            )}

            <div className="modal-footer" style={{ margin: '14px -20px -20px' }}>
              <Button variant="secondary" onClick={() => setDetailModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Register Candidate Modal (POST /candidates) */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Register Candidate Application">
        <form onSubmit={handleCreateCandidate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Select
            label="Applied Job Opening *"
            value={candidateForm.jobOpening}
            onChange={(e) => setCandidateForm({ ...candidateForm, jobOpening: e.target.value })}
            options={jobOpenings.map((j) => ({ value: j._id, label: `${j.title} (${j.department?.name || 'Open'})` }))}
            required
          />

          <div className="grid-2">
            <Input
              label="Full Name *"
              value={candidateForm.fullName}
              onChange={(e) => setCandidateForm({ ...candidateForm, fullName: e.target.value })}
              placeholder="Enter full name"
              required
            />

            <Input
              label="Contact Phone *"
              type="tel"
              value={candidateForm.phone}
              onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })}
              placeholder="Enter phone number"
              required
            />
          </div>

          <div className="grid-2">
            <Input
              label="Email Address *"
              type="email"
              value={candidateForm.email}
              onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })}
              placeholder="Enter email address"
              required
            />

            <Select
              label="Application Source"
              value={candidateForm.source}
              onChange={(e) => setCandidateForm({ ...candidateForm, source: e.target.value })}
              options={[
                { value: 'JOB_PORTAL', label: 'Job Portal (LinkedIn / Naukri / Indeed)' },
                { value: 'REFERRAL', label: 'Employee Referral' },
                { value: 'WALK_IN', label: 'Walk-In / Direct Application' },
                { value: 'OTHER', label: 'Other Sourcing Channel' },
              ]}
            />
          </div>

          <Input
            label="Resume Document URL"
            value={candidateForm.resumeUrl}
            onChange={(e) => setCandidateForm({ ...candidateForm, resumeUrl: e.target.value })}
            placeholder="Enter resume link"
          />

          <div className="modal-footer" style={{ margin: '16px -20px -20px' }}>
            <Button variant="secondary" type="button" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Register Candidate
            </Button>
          </div>
        </form>
      </Modal>

      {/* Schedule Interview Modal (PUT /candidates/:id/interview-notes) */}
      <Modal
        isOpen={interviewModalOpen}
        onClose={() => setInterviewModalOpen(false)}
        title={`Schedule Interview: ${activeCandidate?.fullName || 'Candidate'}`}
      >
        <form onSubmit={handleScheduleInterview} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            label="Round / Assessment Title *"
            value={interviewForm.roundName}
            onChange={(e) => setInterviewForm({ ...interviewForm, roundName: e.target.value })}
            placeholder="Enter round title"
            required
          />

          <div className="grid-2">
            <Input
              label="Scheduled Date & Time *"
              type="datetime-local"
              value={interviewForm.scheduledAt}
              onChange={(e) => setInterviewForm({ ...interviewForm, scheduledAt: e.target.value })}
              required
            />

            <Select
              label="Interview Mode"
              value={interviewForm.mode}
              onChange={(e) => setInterviewForm({ ...interviewForm, mode: e.target.value })}
              options={[
                { value: 'ONLINE', label: 'Online Video (Google Meet / Teams)' },
                { value: 'OFFLINE', label: 'In-Person (Office / On-Site)' },
                { value: 'PHONE', label: 'Telephonic Screening' },
              ]}
              required
            />
          </div>

          <Input
            label="Meeting Link / Location Room"
            value={interviewForm.meetingLink}
            onChange={(e) => setInterviewForm({ ...interviewForm, meetingLink: e.target.value })}
            placeholder="Enter meeting link or location"
          />

          <div className="modal-footer" style={{ margin: '16px -20px -20px' }}>
            <Button variant="secondary" type="button" onClick={() => setInterviewModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Confirm &amp; Schedule
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Interview Feedback Modal (PUT /candidates/:id/interview-notes) */}
      <Modal
        isOpen={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        title={`Interview Feedback: ${activeCandidate?.fullName || 'Candidate'}`}
      >
        <form onSubmit={handleSubmitFeedback} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="grid-2">
            <Input
              label="Evaluation Score (1 to 10) *"
              type="number"
              min="1"
              max="10"
              value={feedbackForm.score}
              onChange={(e) => setFeedbackForm({ ...feedbackForm, score: e.target.value })}
              required
            />

            <Select
              label="Round Verdict *"
              value={feedbackForm.status}
              onChange={(e) => setFeedbackForm({ ...feedbackForm, status: e.target.value })}
              options={[
                { value: 'PASSED', label: 'Passed / Recommend Next Round' },
                { value: 'HOLD', label: 'On Hold' },
                { value: 'REJECTED', label: 'Reject' },
              ]}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ marginBottom: 6 }}>
              Interviewer Observations &amp; Notes *
            </label>
            <textarea
              className="form-control"
              value={feedbackForm.feedback}
              onChange={(e) => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })}
              placeholder="Strengths, technical depth, communication, and recommendation notes..."
              rows={3}
              style={{ width: '100%', fontSize: '0.86rem' }}
              required
            />
          </div>

          <div className="modal-footer" style={{ margin: '16px -20px -20px' }}>
            <Button variant="secondary" type="button" onClick={() => setFeedbackModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Record Feedback
            </Button>
          </div>
        </form>
      </Modal>

      {/* Generate Offer Modal (PUT /candidates/:id/offer) */}
      <Modal
        isOpen={offerModalOpen}
        onClose={() => setOfferModalOpen(false)}
        title={`Generate Offer: ${activeCandidate?.fullName || 'Candidate'}`}
      >
        <form onSubmit={handleGenerateOffer} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="grid-2">
            <Input
              label="Expected Date of Joining *"
              type="date"
              value={offerForm.joiningDate}
              onChange={(e) => setOfferForm({ ...offerForm, joiningDate: e.target.value })}
              required
            />

            <Input
              label="Probation Period (Months) *"
              type="number"
              min="1"
              max="12"
              value={offerForm.probationPeriodMonths}
              onChange={(e) => setOfferForm({ ...offerForm, probationPeriodMonths: e.target.value })}
              required
            />
          </div>

          <div className="grid-2">
            <Select
              label="Offered Department"
              value={offerForm.department}
              onChange={(e) => setOfferForm({ ...offerForm, department: e.target.value })}
              options={[
                { value: '', label: '-- Default from Vacancy --' },
                ...departments.map((d) => ({ value: d._id, label: d.name })),
              ]}
            />

            <Select
              label="Offered Designation"
              value={offerForm.designation}
              onChange={(e) => setOfferForm({ ...offerForm, designation: e.target.value })}
              options={[
                { value: '', label: '-- Default / Assign Later --' },
                ...designations.map((d) => ({ value: d._id, label: d.name || d.title })),
              ]}
            />
          </div>

          <div className="modal-footer" style={{ margin: '16px -20px -20px' }}>
            <Button variant="secondary" type="button" onClick={() => setOfferModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Generate Offer Terms
            </Button>
          </div>
        </form>
      </Modal>

      {/* 1-Click Convert to Employee Modal (PUT /candidates/:id/convert) */}
      <Modal
        isOpen={onboardModalOpen}
        onClose={() => setOnboardModalOpen(false)}
        title={`1-Click Convert to Employee: ${activeCandidate?.fullName || 'Candidate'}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-main)', margin: 0 }}>
            Convert <strong>{activeCandidate?.fullName || 'Candidate'}</strong> into an active employee master record in the system database.
          </p>
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              backgroundColor: 'rgba(42, 171, 160, 0.08)',
              border: '1px solid var(--primary)',
              fontSize: '0.82rem',
              color: 'var(--text-main)',
            }}
          >
            • Creates an Employee record linked to this candidate profile<br />
            • Sets face registration pending flag for biometric attendance<br />
            • Permanently freezes candidate and archives from active hiring pipeline
          </div>

          <div className="modal-footer" style={{ margin: '16px -20px -20px' }}>
            <Button variant="secondary" type="button" onClick={() => setOnboardModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon={UserPlus} onClick={handleExecuteOnboard} loading={submitting}>
              Confirm &amp; Convert to Employee
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Candidates;
