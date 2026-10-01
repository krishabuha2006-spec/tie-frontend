import React, { useState, useEffect, useCallback } from 'react';
import payrollApi from '../../api/payrollApi';
import masterApi from '../../api/masterApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  CheckCircle2, XCircle, Clock, ShieldCheck, FileText,
  AlertCircle, Loader2, Users, Building2, Sliders, History, Eye
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { extractApiData } from '../../utils/apiUtils';

export const PayrollApprovalsTab = ({ companies = [], isManagerOrAdmin = true, onRunDecided, allRuns = [] }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [pendingRuns, setPendingRuns] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  // 1. Line Item Review Modal (GET /payroll-approvals/runs/:runId/line-items)
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewingRun, setReviewingRun] = useState(null);
  const [reviewLineItems, setReviewLineItems] = useState([]);
  const [loadingReviewItems, setLoadingReviewItems] = useState(false);

  // 2. Decision Modal (PUT /payroll-approvals/runs/:runId/decide)
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decidingRun, setDecidingRun] = useState(null);
  const [decisionType, setDecisionType] = useState('APPROVED'); // 'APPROVED' or 'REJECTED'
  const [decisionRemark, setDecisionRemark] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // 3. Decision Audit History Modal (GET /payroll-approvals/runs/:runId/decisions)
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditingRun, setAuditingRun] = useState(null);
  const [decisionAuditList, setDecisionAuditList] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // 4. Approval Chain Config Modal (GET, POST, PUT /payroll-approvals/chain-config)
  const [chainConfigModalOpen, setChainConfigModalOpen] = useState(false);
  const [chainConfigs, setChainConfigs] = useState([]);
  const [loadingChainConfigs, setLoadingChainConfigs] = useState(false);
  const [editingChainConfig, setEditingChainConfig] = useState(null);
  const [chainForm, setChainForm] = useState({
    company: '',
    approvalTiers: '',
    staleAfterDays: 7,
  });
  const [submittingChainConfig, setSubmittingChainConfig] = useState(false);

  const toList = (res) => extractApiData(res, 'runs', 'items', 'lineItems', 'decisions', 'configs', 'data');

  // Load Pending Approvals (GET /payroll-approvals/pending)
  const loadPendingApprovals = useCallback(async () => {
    setLoadingPending(true);
    try {
      const params = {};
      if (selectedCompanyId) params.company = selectedCompanyId;
      const res = await payrollApi.getPendingApprovals(params);
      let list = toList(res);
      if (list.length === 0 && Array.isArray(allRuns) && allRuns.length > 0) {
        list = allRuns.filter((r) => r.status === 'SUBMITTED' || r.status === 'PENDING_APPROVAL');
      }
      setPendingRuns(list);
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
      const fallback = (allRuns || []).filter((r) => r.status === 'SUBMITTED' || r.status === 'PENDING_APPROVAL');
      setPendingRuns(fallback);
    } finally {
      setLoadingPending(false);
    }
  }, [selectedCompanyId, allRuns]);

  useEffect(() => {
    loadPendingApprovals();
  }, [loadPendingApprovals]);

  // Load Line Items for Review (GET /payroll-approvals/runs/:runId/line-items)
  const handleOpenReview = async (run) => {
    setReviewingRun(run);
    setReviewModalOpen(true);
    setLoadingReviewItems(true);
    try {
      const res = await payrollApi.getReviewLineItems(run._id);
      setReviewLineItems(toList(res));
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load run line items', 'error');
      setReviewLineItems([]);
    } finally {
      setLoadingReviewItems(false);
    }
  };

  // Open Decision Modal (PUT /payroll-approvals/runs/:runId/decide)
  const handleOpenDecisionModal = (run, type) => {
    setDecidingRun(run);
    setDecisionType(type);
    setDecisionRemark(type === 'APPROVED' ? 'Figures verified and approved by management' : '');
    setDecisionModalOpen(true);
  };

  // Submit Decision
  const handleSubmitDecision = async (e) => {
    e.preventDefault();
    if (!decidingRun?._id) return;
    if (!decisionRemark.trim()) {
      showToast('Please enter a remark or justification for this decision', 'warning');
      return;
    }

    setSubmittingDecision(true);
    try {
      await payrollApi.decidePayrollRun(decidingRun._id, {
        decision: decisionType,
        remark: decisionRemark.trim(),
      });
      showToast(`Payroll run ${decisionType.toLowerCase()} successfully!`, 'success');
      setDecisionModalOpen(false);
      setDecidingRun(null);
      await loadPendingApprovals();
      if (onRunDecided) onRunDecided();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit decision', 'error');
    } finally {
      setSubmittingDecision(false);
    }
  };

  // Open Decision Audit History (GET /payroll-approvals/runs/:runId/decisions)
  const handleOpenAuditHistory = async (run) => {
    setAuditingRun(run);
    setAuditModalOpen(true);
    setLoadingAudit(true);
    try {
      const res = await payrollApi.getDecisionAuditHistory(run._id);
      setDecisionAuditList(toList(res));
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load decision history', 'error');
      setDecisionAuditList([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Load Approval Chain Configs (GET /payroll-approvals/chain-config)
  const handleOpenChainConfigModal = async () => {
    setChainConfigModalOpen(true);
    setLoadingChainConfigs(true);
    try {
      const res = await payrollApi.getApprovalChainConfigs();
      const list = toList(res);
      setChainConfigs(list);
      const defaultComp = companies[0]?._id || '';
      setChainForm({
        company: defaultComp,
        approvalTiers: user?._id || '',
        staleAfterDays: 7,
      });
    } catch (err) {
      console.error('Error fetching chain configs:', err);
      setChainConfigs([]);
    } finally {
      setLoadingChainConfigs(false);
    }
  };

  // Save Approval Chain Config (POST or PUT /payroll-approvals/chain-config)
  const handleSaveChainConfig = async (e) => {
    e.preventDefault();
    if (!chainForm.company) {
      showToast('Company is required', 'warning');
      return;
    }

    setSubmittingChainConfig(true);
    try {
      const tiers = chainForm.approvalTiers
        ? chainForm.approvalTiers.split(',').map((id) => id.trim()).filter(Boolean)
        : [user?._id].filter(Boolean);

      const payload = {
        company: chainForm.company,
        approvalTiers: tiers,
        staleAfterDays: Number(chainForm.staleAfterDays) || 7,
      };

      if (editingChainConfig?._id) {
        await payrollApi.updateApprovalChainConfig(editingChainConfig._id, payload);
        showToast('Approval chain configuration updated', 'success');
      } else {
        await payrollApi.createApprovalChainConfig(payload);
        showToast('Approval chain configuration created', 'success');
      }

      setEditingChainConfig(null);
      const res = await payrollApi.getApprovalChainConfigs();
      setChainConfigs(toList(res));
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save chain configuration', 'error');
    } finally {
      setSubmittingChainConfig(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 1. Header Toolbar */}
      <div style={{
        background: '#fff', padding: '14px 18px', borderRadius: 10,
        border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 10
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} style={{ color: '#2563eb' }} />
            Payroll Approvals Queue (Module 15)
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
            Multi-tier executive approval gate, read-only item review &amp; immutable decision audit trail
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
          >
            <option value="">All Companies</option>
            {companies.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>

          {isManagerOrAdmin && (
            <Button
              variant="secondary"
              size="sm"
              icon={Sliders}
              onClick={handleOpenChainConfigModal}
            >
              Approval Chains
            </Button>
          )}
        </div>
      </div>

      {/* 2. Pending Runs Cards / Table */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loadingPending ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
            <div>Fetching pending payroll approvals...</div>
          </div>
        ) : pendingRuns.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
            <CheckCircle2 size={36} style={{ color: '#16a34a', margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>
              No Pending Payroll Approvals
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 0' }}>
              All submitted payroll runs have been verified and processed.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                  <th style={{ padding: '10px 16px' }}>Pay Period</th>
                  <th style={{ padding: '10px 16px' }}>Organization</th>
                  <th style={{ padding: '10px 16px' }}>Status</th>
                  <th style={{ padding: '10px 16px' }}>Gross Amount</th>
                  <th style={{ padding: '10px 16px' }}>Deductions</th>
                  <th style={{ padding: '10px 16px' }}>Net Payout</th>
                  <th style={{ padding: '10px 16px' }}>Staff Count</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRuns.map((r) => {
                  const compName = r.company?.name || companies.find((c) => c._id === r.company)?.name || 'Main Org';
                  const fromDate = r.payPeriodFrom
                    ? new Date(r.payPeriodFrom).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                    : 'Period';

                  return (
                    <tr key={r._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                        {fromDate}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{compName}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{r.branch?.name || 'All Branches'}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge variant="warning">
                          {r.status || 'PENDING_APPROVAL'}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        ₹{(r.summary?.totalGross || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#dc2626' }}>
                        -₹{(r.summary?.totalDeductions || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#16a34a' }}>
                        ₹{(r.summary?.totalNetPay || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {r.summary?.calculatedCount || (r.lineItems?.length || 0)} Staff
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Eye}
                            onClick={() => handleOpenReview(r)}
                            title="Read-Only Review of Line Items"
                          >
                            Review
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={History}
                            onClick={() => handleOpenAuditHistory(r)}
                            title="Decision Audit History"
                          />
                          {isManagerOrAdmin && (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                icon={CheckCircle2}
                                onClick={() => handleOpenDecisionModal(r, 'APPROVED')}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                icon={XCircle}
                                onClick={() => handleOpenDecisionModal(r, 'REJECTED')}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* 3. MODAL: READ-ONLY LINE ITEM REVIEW (GET /payroll-approvals/runs/:runId/line-items) */}
      {/* ================================================================== */}
      {reviewModalOpen && reviewingRun && (
        <Modal
          isOpen={true}
          onClose={() => {
            setReviewModalOpen(false);
            setReviewingRun(null);
            setReviewLineItems([]);
          }}
          title={`Review Payroll Items • ${reviewingRun.payPeriodFrom ? new Date(reviewingRun.payPeriodFrom).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'Pay Period'}`}
          maxWidth="840px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Total Net Outlay:</span>{' '}
                <strong style={{ color: '#16a34a' }}>₹{(reviewingRun.summary?.totalNetPay || 0).toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Total Deductions:</span>{' '}
                <strong style={{ color: '#dc2626' }}>-₹{(reviewingRun.summary?.totalDeductions || 0).toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Records:</span>{' '}
                <strong>{reviewLineItems.length} Staff</strong>
              </div>
            </div>

            {loadingReviewItems ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
                <div>Loading line items for review...</div>
              </div>
            ) : reviewLineItems.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                No line items available for this run.
              </div>
            ) : (
              <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 1 }}>
                    <tr style={{ textAlign: 'left', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '8px 12px' }}>Employee</th>
                      <th style={{ padding: '8px 12px' }}>Gross</th>
                      <th style={{ padding: '8px 12px' }}>Attn Loss</th>
                      <th style={{ padding: '8px 12px' }}>Statutory</th>
                      <th style={{ padding: '8px 12px' }}>Net Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewLineItems.map((item) => {
                      const empName = item.employee?.basicInfo?.fullName || item.employee?.name || 'Employee';
                      const empCode = item.employee?.basicInfo?.employeeCode || item.employee?.employeeCode || 'EMP';
                      const statSum = (item.statutoryDeductionLines || []).reduce((acc, d) => acc + (d.amount || 0), 0);

                      return (
                        <tr key={item._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{empName}</div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{empCode}</div>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            ₹{(item.grossEarnings || 0).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '8px 12px', color: item.attendanceDeductionAmount > 0 ? '#dc2626' : '#64748b' }}>
                            -₹{(item.attendanceDeductionAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '8px 12px', color: statSum > 0 ? '#dc2626' : '#64748b' }}>
                            -₹{statSum.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: '#16a34a' }}>
                            ₹{(item.netPay || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button variant="secondary" onClick={() => setReviewModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 4. MODAL: DECISION (PUT /payroll-approvals/runs/:runId/decide) */}
      {/* ================================================================== */}
      {decisionModalOpen && decidingRun && (
        <Modal
          isOpen={true}
          onClose={() => {
            setDecisionModalOpen(false);
            setDecidingRun(null);
          }}
          title={`Submit Payroll Decision: ${decisionType}`}
          maxWidth="480px"
        >
          <form onSubmit={handleSubmitDecision} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              padding: '12px 14px', borderRadius: 8,
              background: decisionType === 'APPROVED' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${decisionType === 'APPROVED' ? '#bbf7d0' : '#fecaca'}`
            }}>
              <div style={{ fontWeight: 600, color: decisionType === 'APPROVED' ? '#15803d' : '#b91c1c' }}>
                {decisionType === 'APPROVED' ? 'Approve Payroll Run' : 'Reject Payroll Run'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                Net Payout: ₹{(decidingRun.summary?.totalNetPay || 0).toLocaleString('en-IN')} &bull; Staff: {decidingRun.summary?.calculatedCount || 0}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Executive Decision Justification / Remark *
              </label>
              <textarea
                value={decisionRemark}
                onChange={(e) => setDecisionRemark(e.target.value)}
                required
                rows={3}
                placeholder="Enter audit remarks or reasons for approval/rejection..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button variant="secondary" onClick={() => setDecisionModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={decisionType === 'APPROVED' ? 'primary' : 'danger'}
                type="submit"
                loading={submittingDecision}
              >
                Confirm {decisionType}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 5. MODAL: DECISION AUDIT HISTORY (GET /payroll-approvals/runs/:runId/decisions) */}
      {/* ================================================================== */}
      {auditModalOpen && auditingRun && (
        <Modal
          isOpen={true}
          onClose={() => {
            setAuditModalOpen(false);
            setAuditingRun(null);
            setDecisionAuditList([]);
          }}
          title="Decision Audit Ledger"
          maxWidth="560px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
              Complete append-only audit trail of approval/rejection decisions for this payroll run.
            </p>

            {loadingAudit ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
                <div>Loading audit history...</div>
              </div>
            ) : decisionAuditList.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                No prior decisions recorded for this run yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {decisionAuditList.map((d, idx) => (
                  <div key={idx} style={{
                    padding: '12px 14px', borderRadius: 8,
                    background: '#f8fafc', border: '1px solid #e2e8f0',
                    display: 'flex', flexDirection: 'column', gap: 4
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Badge variant={d.decision === 'APPROVED' ? 'success' : 'danger'}>
                        {d.decision}
                      </Badge>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {d.createdAt ? new Date(d.createdAt).toLocaleString('en-IN') : 'Recent'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#1e293b', marginTop: 4 }}>
                      <strong>Remark:</strong> {d.remark || d.comments || 'No comment provided'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Sign-off by: {d.decidedBy?.name || d.decidedBy?.email || d.user?.name || 'Administrator'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="secondary" onClick={() => setAuditModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 6. MODAL: APPROVAL CHAIN CONFIGURATION (Module 15 Config) */}
      {/* ================================================================== */}
      {chainConfigModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => {
            setChainConfigModalOpen(false);
            setEditingChainConfig(null);
          }}
          title="Approval Chain Configuration"
          maxWidth="620px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Form */}
            <form onSubmit={handleSaveChainConfig} style={{
              background: '#f8fafc', padding: '14px', borderRadius: 8,
              border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 12
            }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>
                {editingChainConfig ? 'Edit Approval Chain' : 'Configure New Approval Chain'}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Company *</label>
                  <select
                    value={chainForm.company}
                    onChange={(e) => setChainForm({ ...chainForm, company: e.target.value })}
                    required
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem', boxSizing: 'border-box' }}
                  >
                    {companies.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Stale After (Days)</label>
                  <input
                    type="number"
                    value={chainForm.staleAfterDays}
                    onChange={(e) => setChainForm({ ...chainForm, staleAfterDays: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Approval Tiers (Approver User IDs, comma separated)
                </label>
                <input
                  type="text"
                  value={chainForm.approvalTiers}
                  onChange={(e) => setChainForm({ ...chainForm, approvalTiers: e.target.value })}
                  placeholder="e.g. 60d0fe4f5311236168a109cb, 60d0fe4f5311236168a109cc"
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                {editingChainConfig && (
                  <Button variant="secondary" size="sm" onClick={() => setEditingChainConfig(null)}>
                    Cancel Edit
                  </Button>
                )}
                <Button variant="primary" size="sm" type="submit" loading={submittingChainConfig}>
                  Save Chain Config
                </Button>
              </div>
            </form>

            {/* Existing Configs Table */}
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                Active Approval Chains
              </div>
              {loadingChainConfigs ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>
                  <Loader2 size={18} className="animate-spin" style={{ margin: '0 auto 6px', color: '#2563eb' }} />
                  <div>Loading configs...</div>
                </div>
              ) : chainConfigs.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', background: '#f8fafc', borderRadius: 6 }}>
                  No custom approval chains found. Default company sign-off is applied.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '7px 10px' }}>Company</th>
                      <th style={{ padding: '7px 10px' }}>Tiers</th>
                      <th style={{ padding: '7px 10px' }}>Stale Days</th>
                      <th style={{ padding: '7px 10px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chainConfigs.map((cfg) => {
                      const cName = companies.find((c) => c._id === cfg.company)?.name || cfg.company?.name || 'Company';
                      return (
                        <tr key={cfg._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{cName}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: 4, fontSize: '0.72rem' }}>
                              {(cfg.approvalTiers || []).length} Tiers
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px' }}>{cfg.staleAfterDays || 7} Days</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setEditingChainConfig(cfg);
                                setChainForm({
                                  company: cfg.company?._id || cfg.company,
                                  approvalTiers: (cfg.approvalTiers || []).join(', '),
                                  staleAfterDays: cfg.staleAfterDays || 7,
                                });
                              }}
                            >
                              Edit
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <Button variant="secondary" onClick={() => setChainConfigModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PayrollApprovalsTab;
