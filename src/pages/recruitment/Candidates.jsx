import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import recruitmentApi from '../../api/recruitmentApi';
import { useToast } from '../../context/ToastContext';
import { validateEmail, validatePhone } from '../../utils/validation';
import {
  Plus,
  UserPlus,
  FileText,
  CheckCircle2,
  Calendar,
  MessageSquare,
  ScanFace,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { recruitmentNav } from '../../routes/moduleNavConfig';

export const Candidates = () => {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [jobOpenings, setJobOpenings] = useState([]);
  const [letterTemplates, setLetterTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  // Active candidate for modals
  const [activeCandidate, setActiveCandidate] = useState(null);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [interviewModalOpen, setInterviewModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [onboardModalOpen, setOnboardModalOpen] = useState(false);

  // Register Candidate form
  const [candidateForm, setCandidateForm] = useState({
    jobOpening: '',
    fullName: '',
    email: '',
    phone: '',
    source: 'JOB_PORTAL',
    resumeUrl: '',
  });

  // Schedule Interview form
  const [interviewForm, setInterviewForm] = useState({
    roundName: 'Technical Interview',
    scheduledAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    mode: 'ONLINE',
    meetingLink: '',
  });

  // Interview Feedback form
  const [feedbackForm, setFeedbackForm] = useState({
    score: 8,
    feedback: 'Good technical understanding and problem solving ability.',
    status: 'PASSED',
  });

  // Generate Offer form
  const [offerForm, setOfferForm] = useState({
    joiningDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    probationPeriodMonths: 3,
  });

  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, jRes, tRes] = await Promise.all([
        recruitmentApi.getCandidates(),
        recruitmentApi.getJobOpenings(),
        recruitmentApi.getLetterTemplates(),
      ]);

      const cList = cRes?.data || cRes?.candidates || (Array.isArray(cRes) ? cRes : []);
      const jList = jRes?.data || jRes?.jobs || jRes?.jobOpenings || (Array.isArray(jRes) ? jRes : []);
      const tList = tRes?.data || tRes?.templates || tRes?.letterTemplates || (Array.isArray(tRes) ? tRes : []);

      setCandidates(cList);
      setJobOpenings(jList);
      setLetterTemplates(tList);
    } catch (err) {
      console.error(err);
      showToast('Failed to load recruitment data from server', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Register Candidate Application
  const handleCreateCandidate = async (e) => {
    e.preventDefault();
    if (!candidateForm.jobOpening) {
      showToast('Please select a job opening vacancy', 'error');
      return;
    }
    if (!candidateForm.fullName.trim()) {
      showToast('Candidate full name is required', 'error');
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
      showToast(err.response?.data?.message || 'Failed to apply candidate', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Update Candidate Stage
  const handleUpdateStage = async (cand, newStage) => {
    try {
      await recruitmentApi.updateCandidateStage(cand._id, newStage);
      showToast(`Candidate moved to ${newStage}`, 'success');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update candidate stage', 'error');
    }
  };

  // Schedule Interview
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

  // Submit Feedback
  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!activeCandidate) return;
    setSubmitting(true);
    try {
      await recruitmentApi.submitInterviewFeedback(activeCandidate._id, feedbackForm);
      showToast('Interview feedback recorded successfully!', 'success');
      setFeedbackModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit feedback', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Generate Offer
  const handleGenerateOffer = async (e) => {
    e.preventDefault();
    if (!activeCandidate) return;
    setSubmitting(true);
    try {
      await recruitmentApi.generateOffer(activeCandidate._id, {
        dateOfJoining: offerForm.joiningDate,
        probationPeriodMonths: offerForm.probationPeriodMonths,
      });
      await recruitmentApi.updateCandidateStage(activeCandidate._id, 'OFFER');
      showToast('Offer details generated for candidate!', 'success');
      setOfferModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to generate offer', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 1-Click Convert Candidate to Employee
  const handleExecuteOnboard = async () => {
    if (!activeCandidate) return;
    setSubmitting(true);
    try {
      const res = await recruitmentApi.convertCandidateToEmployee(activeCandidate._id, {});
      showToast(res?.message || 'Candidate converted to Employee successfully!', 'success');
      setOnboardModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to convert candidate', 'error');
    } finally {
      setSubmitting(false);
    }
  };

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

  const filteredCandidates = candidates.filter((c) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    const name = (c.fullName || `${c.firstName || ''} ${c.lastName || ''}`).toLowerCase();
    const email = (c.email || '').toLowerCase();
    const phone = (c.mobileNumber || c.phone || '').toLowerCase();
    const jobTitle = (c.jobOpening?.title || '').toLowerCase();
    return name.includes(s) || email.includes(s) || phone.includes(s) || jobTitle.includes(s);
  });

  const columns = [
    {
      header: 'Candidate Name',
      key: 'fullName',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            {r.fullName || `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'Candidate'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
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
        const isConverted = r.isFrozen || stage === 'CONVERTED' || stage === 'HIRED' || stage === 'ONBOARDED';
        const empId = r.convertedEmployee?._id || r.convertedEmployee || r.onboardedEmployeeId;

        if (isConverted) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontSize: '0.82rem', fontWeight: 600 }}>
                <CheckCircle2 size={14} /> Converted to Employee
              </span>
              {empId && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={ScanFace}
                  onClick={() => navigate(`/attendance/face-punch?tab=register&empId=${empId}`)}
                >
                  Face Enroll
                </Button>
              )}
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
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
                    setOfferModalOpen(true);
                  }}
                >
                  Offer
                </Button>
              </>
            )}

            {/* Stage: OFFER */}
            {stage === 'OFFER' && (
              <>
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

            {stage !== 'REJECTED' && (
              <button
                type="button"
                onClick={() => handleUpdateStage(r, 'REJECTED')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--danger)',
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                Reject
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ModuleSubNav items={recruitmentNav} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={22} color="var(--primary)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Candidate Hiring Pipeline
            </h2>
            <Badge variant="primary">{candidates.length} Candidates</Badge>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button variant="secondary" icon={RefreshCw} onClick={loadData} loading={loading}>
            Refresh
          </Button>
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

      {/* Search Bar */}
      <div className="card" style={{ padding: '8px 14px' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
          <Input
            placeholder="Search candidates by name, email, role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 30, fontSize: '0.82rem', height: 32 }}
          />
          <Search
            size={13}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }}
          />
        </div>
      </div>

      {/* Candidates Table */}
      <Table
        columns={columns}
        data={filteredCandidates}
        loading={loading}
        emptyMessage="No candidates currently in hiring pipeline. Click 'Register Candidate' to add one."
      />

      {/* Register Candidate Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Register Candidate Application">
        <form onSubmit={handleCreateCandidate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Select
            label="Applied Job Opening"
            value={candidateForm.jobOpening}
            onChange={(e) => setCandidateForm({ ...candidateForm, jobOpening: e.target.value })}
            options={jobOpenings.map((j) => ({
              value: j._id,
              label: `${j.title} (${j.branch?.name || 'All Branches'})`,
            }))}
            required
          />

          <Input
            label="Full Name"
            value={candidateForm.fullName}
            onChange={(e) => setCandidateForm({ ...candidateForm, fullName: e.target.value })}
            placeholder="e.g. Rohan Sharma"
            required
          />

          <div className="grid-2">
            <Input
              label="Email Address"
              type="email"
              value={candidateForm.email}
              onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })}
              placeholder="e.g. rohan.sharma@example.com"
              required
            />
            <Input
              label="Phone Number"
              type="tel"
              isPhone={true}
              value={candidateForm.phone}
              onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })}
              placeholder="10-digit mobile number"
              required
            />
          </div>

          <div className="grid-2">
            <Select
              label="Application Source"
              value={candidateForm.source}
              onChange={(e) => setCandidateForm({ ...candidateForm, source: e.target.value })}
              options={[
                { value: 'JOB_PORTAL', label: 'Job Portal' },
                { value: 'REFERRAL', label: 'Employee Referral' },
                { value: 'WALK_IN', label: 'Walk-In' },
                { value: 'OTHER', label: 'Other' },
              ]}
              required
            />

            <Input
              label="Resume URL (Optional)"
              value={candidateForm.resumeUrl}
              onChange={(e) => setCandidateForm({ ...candidateForm, resumeUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="modal-footer" style={{ margin: '16px -20px -20px' }}>
            <Button variant="secondary" type="button" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Add Candidate
            </Button>
          </div>
        </form>
      </Modal>

      {/* Schedule Interview Modal */}
      <Modal
        isOpen={interviewModalOpen}
        onClose={() => setInterviewModalOpen(false)}
        title={`Schedule Interview: ${activeCandidate?.fullName || activeCandidate?.firstName || 'Candidate'}`}
      >
        <form onSubmit={handleScheduleInterview} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            label="Round Title"
            value={interviewForm.roundName}
            onChange={(e) => setInterviewForm({ ...interviewForm, roundName: e.target.value })}
            placeholder="e.g. Technical Round 1"
            required
          />

          <div className="grid-2">
            <Input
              label="Interview Date & Time"
              type="datetime-local"
              value={interviewForm.scheduledAt}
              onChange={(e) => setInterviewForm({ ...interviewForm, scheduledAt: e.target.value })}
              required
            />
            <Select
              label="Meeting Mode"
              value={interviewForm.mode}
              onChange={(e) => setInterviewForm({ ...interviewForm, mode: e.target.value })}
              options={[
                { value: 'ONLINE', label: 'Online Video Call' },
                { value: 'IN_PERSON', label: 'In-Person Branch' },
                { value: 'PHONE', label: 'Telephonic Screening' },
              ]}
            />
          </div>

          <Input
            label="Meeting Link / Venue"
            value={interviewForm.meetingLink}
            onChange={(e) => setInterviewForm({ ...interviewForm, meetingLink: e.target.value })}
            placeholder="e.g. https://meet.google.com/... or Head Office Boardroom"
          />

          <div className="modal-footer" style={{ margin: '16px -20px -20px' }}>
            <Button variant="secondary" type="button" onClick={() => setInterviewModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Schedule Interview
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Feedback Modal */}
      <Modal
        isOpen={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        title={`Record Feedback: ${activeCandidate?.fullName || activeCandidate?.firstName || 'Candidate'}`}
      >
        <form onSubmit={handleSubmitFeedback} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            label="Rating Score (1-10)"
            type="number"
            min="1"
            max="10"
            value={feedbackForm.score}
            onChange={(e) => setFeedbackForm({ ...feedbackForm, score: Number(e.target.value) })}
            required
          />

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
              Evaluation Comments
            </label>
            <textarea
              className="form-control"
              value={feedbackForm.feedback}
              onChange={(e) => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })}
              rows={3}
              style={{ width: '100%', fontSize: '0.84rem' }}
              required
            />
          </div>

          <div className="modal-footer" style={{ margin: '16px -20px -20px' }}>
            <Button variant="secondary" type="button" onClick={() => setFeedbackModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Save Evaluation
            </Button>
          </div>
        </form>
      </Modal>

      {/* Generate Offer Modal */}
      <Modal
        isOpen={offerModalOpen}
        onClose={() => setOfferModalOpen(false)}
        title={`Generate Offer: ${activeCandidate?.fullName || activeCandidate?.firstName || 'Candidate'}`}
      >
        <form onSubmit={handleGenerateOffer} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            label="Expected Date of Joining"
            type="date"
            value={offerForm.joiningDate}
            onChange={(e) => setOfferForm({ ...offerForm, joiningDate: e.target.value })}
            required
          />

          <Input
            label="Probation Period (Months)"
            type="number"
            min="1"
            max="12"
            value={offerForm.probationPeriodMonths}
            onChange={(e) => setOfferForm({ ...offerForm, probationPeriodMonths: e.target.value })}
            required
          />

          <div className="modal-footer" style={{ margin: '16px -20px -20px' }}>
            <Button variant="secondary" type="button" onClick={() => setOfferModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Generate Offer
            </Button>
          </div>
        </form>
      </Modal>

      {/* 1-Click Convert to Employee Modal */}
      <Modal
        isOpen={onboardModalOpen}
        onClose={() => setOnboardModalOpen(false)}
        title={`1-Click Convert to Employee: ${activeCandidate?.fullName || activeCandidate?.firstName || 'Candidate'}`}
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
            ✓ Creates Employee record linked to candidate<br />
            ✓ Sets face registration pending flag<br />
            ✓ Automatically archives candidate from active hiring pipeline
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
