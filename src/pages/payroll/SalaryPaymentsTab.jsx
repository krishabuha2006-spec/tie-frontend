import React, { useState, useEffect, useCallback, useMemo } from 'react';
import payrollApi from '../../api/payrollApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import {
  CreditCard, DollarSign, CheckCircle2, AlertCircle, XCircle,
  Plus, Eye, History, FileText, Search, Loader2, RefreshCw, Send, AlertTriangle
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { extractApiData } from '../../utils/apiUtils';

export const SalaryPaymentsTab = ({ runs = [], isManagerOrAdmin = false }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();

  // Run selection
  const [selectedRunId, setSelectedRunId] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Payments State
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [initiatingPayments, setInitiatingPayments] = useState(false);

  // 1. Record Payment Leg Modal (POST /salary-payments/:id/record-leg)
  const [legModalOpen, setLegModalOpen] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(null);
  const [submittingLeg, setSubmittingLeg] = useState(false);
  const [legForm, setLegForm] = useState({
    mode: 'BANK_TRANSFER',
    amount: '',
    referenceNumber: '',
  });

  // 2. Payment Details Modal (GET /salary-payments/:id)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [viewingPayment, setViewingPayment] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // 3. Mark Leg Failed Modal (PUT /salary-payments/:id/legs/:legIndex/mark-failed)
  const [failModalOpen, setFailModalOpen] = useState(false);
  const [failingLegIndex, setFailingLegIndex] = useState(null);
  const [failureReason, setFailureReason] = useState('');
  const [submittingFail, setSubmittingFail] = useState(false);

  // 4. Employee Payment History Modal (GET /salary-payments/employees/:employeeId)
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [employeePayments, setEmployeePayments] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 5. Outstanding Report Modal (GET /salary-payments/reports/outstanding)
  const [outstandingModalOpen, setOutstandingModalOpen] = useState(false);
  const [outstandingReport, setOutstandingReport] = useState(null);
  const [loadingOutstanding, setLoadingOutstanding] = useState(false);

  const toList = (res) => extractApiData(res, 'payments', 'items', 'history', 'data');

  // Auto-select first approved run or first run
  useEffect(() => {
    if (!selectedRunId && runs.length > 0) {
      const approvedRun = runs.find((r) => r.status === 'APPROVED');
      setSelectedRunId(approvedRun ? approvedRun._id : runs[0]._id);
    }
  }, [runs, selectedRunId]);

  // Load Payments for selected run (GET /salary-payments/runs/:payrollRunId)
  const loadPayments = useCallback(async () => {
    if (!selectedRunId) {
      setPayments([]);
      return;
    }
    setLoadingPayments(true);
    try {
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const res = await payrollApi.getSalaryPaymentsForRun(selectedRunId, params);
      setPayments(toList(res));
    } catch (err) {
      console.error('Error loading salary payments:', err);
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  }, [selectedRunId, statusFilter]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Selected run object
  const currentRun = useMemo(() => {
    return runs.find((r) => r._id === selectedRunId) || null;
  }, [runs, selectedRunId]);

  // Filtered Payments for search
  const filteredPayments = useMemo(() => {
    if (!searchQuery.trim()) return payments;
    const q = searchQuery.toLowerCase();
    return payments.filter((p) => {
      const name = (p.employee?.basicInfo?.fullName || p.employee?.name || '').toLowerCase();
      const code = (p.employee?.basicInfo?.employeeCode || p.employee?.employeeCode || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [payments, searchQuery]);

  // Initiate Batch Payments (POST /salary-payments/runs/:payrollRunId/initiate)
  const handleInitiatePayments = async () => {
    if (!selectedRunId) return;
    const isConfirmed = await confirm({
      title: 'Initiate Batch Salary Payments',
      message: 'Are you sure you want to initiate salary disbursement records for this approved payroll run? This will prepare split payment legs for all employees in this cycle.',
      confirmText: 'Initiate Disbursements',
      cancelText: 'Cancel',
      variant: 'info',
    });
    if (!isConfirmed) return;

    setInitiatingPayments(true);
    try {
      await payrollApi.initiateSalaryPayments(selectedRunId);
      showToast('Batch salary payments initiated successfully!', 'success');
      await loadPayments();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to initiate payments. Ensure run is APPROVED.', 'error');
    } finally {
      setInitiatingPayments(false);
    }
  };

  // Open Record Leg Modal (POST /salary-payments/:id/record-leg)
  const handleOpenRecordLeg = (p) => {
    setRecordingPayment(p);
    const balance = Math.max(0, (p.netPayable || 0) - (p.paidAmount || 0));
    setLegForm({
      mode: 'BANK_TRANSFER',
      amount: balance || '',
      referenceNumber: `TXN-${Date.now().toString().slice(-6)}`,
    });
    setLegModalOpen(true);
  };

  // Submit Payment Leg
  const handleSubmitLeg = async (e) => {
    e.preventDefault();
    if (!recordingPayment?._id) return;
    const amt = Number(legForm.amount);
    if (!amt || amt <= 0) {
      showToast('Please enter a valid disbursement amount', 'warning');
      return;
    }

    setSubmittingLeg(true);
    try {
      await payrollApi.recordPaymentLeg(recordingPayment._id, {
        mode: legForm.mode,
        amount: amt,
        referenceNumber: legForm.referenceNumber.trim(),
      });
      showToast('Payment leg recorded successfully!', 'success');
      setLegModalOpen(false);
      setRecordingPayment(null);
      await loadPayments();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to record payment leg', 'error');
    } finally {
      setSubmittingLeg(false);
    }
  };

  // Open Details Modal (GET /salary-payments/:id)
  const handleOpenDetails = async (id) => {
    setLoadingDetails(true);
    setDetailsModalOpen(true);
    try {
      const res = await payrollApi.getSalaryPaymentById(id);
      const data = res?.data || res?.salaryPayment || res;
      setViewingPayment(data);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load payment details', 'error');
      setDetailsModalOpen(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Open Mark Leg Failed Modal (PUT /salary-payments/:id/legs/:legIndex/mark-failed)
  const handleOpenMarkFailed = (payment, legIndex) => {
    setViewingPayment(payment);
    setFailingLegIndex(legIndex);
    setFailureReason('Bank transfer bounced due to invalid account/IFSC');
    setFailModalOpen(true);
  };

  // Submit Mark Leg Failed
  const handleSubmitMarkFailed = async (e) => {
    e.preventDefault();
    if (!viewingPayment?._id || failingLegIndex === null) return;
    if (!failureReason.trim()) {
      showToast('Failure reason is required', 'warning');
      return;
    }

    setSubmittingFail(true);
    try {
      await payrollApi.markPaymentLegFailed(viewingPayment._id, failingLegIndex, {
        failureReason: failureReason.trim(),
      });
      showToast('Payment leg marked as FAILED & reconciled', 'success');
      setFailModalOpen(false);
      setFailingLegIndex(null);
      // Reload details & payments
      const res = await payrollApi.getSalaryPaymentById(viewingPayment._id);
      setViewingPayment(res?.data || res);
      await loadPayments();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update payment leg', 'error');
    } finally {
      setSubmittingFail(false);
    }
  };

  // Open Employee History (GET /salary-payments/employees/:employeeId)
  const handleOpenEmployeeHistory = async (emp) => {
    const empId = emp?._id || emp;
    setViewingEmployee(emp);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await payrollApi.getEmployeeSalaryPayments(empId);
      setEmployeePayments(toList(res));
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load employee history', 'error');
      setEmployeePayments([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Open Outstanding Report (GET /salary-payments/reports/outstanding)
  const handleOpenOutstandingReport = async () => {
    setOutstandingModalOpen(true);
    setLoadingOutstanding(true);
    try {
      const params = {};
      if (selectedRunId) params.payrollRun = selectedRunId;
      const res = await payrollApi.getOutstandingSalaryPayments(params);
      setOutstandingReport(res?.data || res);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to fetch outstanding report', 'error');
      setOutstandingReport(null);
    } finally {
      setLoadingOutstanding(false);
    }
  };

  // Payment totals for current run
  const totalPayableSum = payments.reduce((acc, p) => acc + (p.netPayable || 0), 0);
  const totalPaidSum = payments.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
  const totalBalanceSum = Math.max(0, totalPayableSum - totalPaidSum);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 1. Control & Filter Toolbar */}
      <div style={{
        background: '#fff', padding: '14px 18px', borderRadius: 10,
        border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 10
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={18} style={{ color: '#2563eb' }} />
            Salary Payment Execution (Module 17)
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
            Multi-leg split disbursements (Bank/Cash/Cheque/UPI), overpayment guards &amp; bounce reconciliation
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Select Run */}
          <select
            value={selectedRunId}
            onChange={(e) => setSelectedRunId(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
          >
            {runs.map((r) => {
              const pStr = r.payPeriodFrom ? new Date(r.payPeriodFrom).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Run';
              const orgName = r.branch?.name || r.company?.name || 'Main Office';
              return (
                <option key={r._id} value={r._id}>
                  {pStr} • {orgName} ({r.status})
                </option>
              );
            })}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
            <option value="PAID">PAID</option>
            <option value="FAILED">FAILED</option>
          </select>

          {/* Outstanding Report Button */}
          <Button
            variant="secondary"
            size="sm"
            icon={FileText}
            onClick={handleOpenOutstandingReport}
          >
            Outstanding Report
          </Button>

          {/* Initiate Batch Button */}
          {isManagerOrAdmin && currentRun && payments.length === 0 && (
            <Button
              variant="primary"
              size="sm"
              icon={Send}
              loading={initiatingPayments}
              onClick={handleInitiatePayments}
              title="Initiate batch salary payments for this run (POST /salary-payments/runs/:id/initiate)"
            >
              Initiate Batch Payments
            </Button>
          )}
        </div>
      </div>

      {/* 2. Run Financial Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div style={{ background: '#fff', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>TOTAL NET PAYABLE</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
            ₹{totalPayableSum.toLocaleString('en-IN')}
          </div>
        </div>
        <div style={{ background: '#fff', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>DISBURSED / PAID</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#16a34a', marginTop: 4 }}>
            ₹{totalPaidSum.toLocaleString('en-IN')}
          </div>
        </div>
        <div style={{ background: '#fff', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 600 }}>OUTSTANDING BALANCE</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626', marginTop: 4 }}>
            ₹{totalBalanceSum.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* 3. Payments Table */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ position: 'relative', width: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '6px 10px 6px 30px', borderRadius: 6,
                border: '1px solid #cbd5e1', fontSize: '0.78rem', boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
            {filteredPayments.length} Salary Payment Records
          </div>
        </div>

        {loadingPayments ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
            <div>Loading live salary payments...</div>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
            <CreditCard size={36} style={{ color: '#94a3b8', margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>
              No Salary Payments Initiated for This Run
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 12px' }}>
              {currentRun?.status === 'APPROVED'
                ? 'The run is approved. Click "Initiate Batch Payments" above to generate split payment entries.'
                : 'Select an APPROVED payroll run to process salary disbursements.'}
            </p>
            {isManagerOrAdmin && currentRun?.status === 'APPROVED' && (
              <Button variant="primary" size="sm" icon={Send} loading={initiatingPayments} onClick={handleInitiatePayments}>
                Initiate Batch Payments Now
              </Button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                  <th style={{ padding: '10px 16px' }}>Employee</th>
                  <th style={{ padding: '10px 16px' }}>Net Payable</th>
                  <th style={{ padding: '10px 16px' }}>Amount Paid</th>
                  <th style={{ padding: '10px 16px' }}>Balance</th>
                  <th style={{ padding: '10px 16px' }}>Disbursement Legs</th>
                  <th style={{ padding: '10px 16px' }}>Status</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => {
                  const empName = p.employee?.basicInfo?.fullName || p.employee?.name || 'Staff Member';
                  const empCode = p.employee?.basicInfo?.employeeCode || p.employee?.employeeCode || 'EMP';
                  const balance = Math.max(0, (p.netPayable || 0) - (p.paidAmount || 0));
                  const legs = p.paymentLegs || [];

                  return (
                    <tr key={p._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{empName}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{empCode}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        ₹{(p.netPayable || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#16a34a' }}>
                        ₹{(p.paidAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: balance > 0 ? '#dc2626' : '#16a34a' }}>
                        ₹{balance.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {legs.length === 0 ? (
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No legs recorded</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {legs.map((leg, idx) => (
                              <span
                                key={idx}
                                style={{
                                  padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600,
                                  background: leg.status === 'FAILED' ? '#fee2e2' : '#f0fdf4',
                                  color: leg.status === 'FAILED' ? '#b91c1c' : '#15803d'
                                }}
                              >
                                {leg.mode}: ₹{leg.amount} ({leg.status || 'PAID'})
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge variant={p.status === 'PAID' ? 'success' : p.status === 'PARTIALLY_PAID' ? 'warning' : p.status === 'FAILED' ? 'danger' : 'secondary'}>
                          {p.status || 'PENDING'}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Eye}
                            onClick={() => handleOpenDetails(p._id)}
                            title="Inspect Single Salary Payment (GET /salary-payments/:id)"
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={History}
                            onClick={() => handleOpenEmployeeHistory(p.employee)}
                            title="Employee Disbursement History (GET /salary-payments/employees/:id)"
                          />
                          {p.status !== 'PAID' && isManagerOrAdmin && (
                            <Button
                              variant="primary"
                              size="sm"
                              icon={Plus}
                              onClick={() => handleOpenRecordLeg(p)}
                              title="Record Payment Leg (POST /salary-payments/:id/record-leg)"
                            >
                              Pay Leg
                            </Button>
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
      {/* 4. MODAL: RECORD PAYMENT LEG (POST /salary-payments/:id/record-leg) */}
      {/* ================================================================== */}
      {legModalOpen && recordingPayment && (
        <Modal
          isOpen={true}
          onClose={() => {
            setLegModalOpen(false);
            setRecordingPayment(null);
          }}
          title="Record Salary Payment Leg"
          maxWidth="480px"
        >
          <form onSubmit={handleSubmitLeg} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>
                  {recordingPayment.employee?.basicInfo?.fullName || recordingPayment.employee?.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Total Net: ₹{(recordingPayment.netPayable || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 600 }}>REMAINING BALANCE</div>
                <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '1rem' }}>
                  ₹{Math.max(0, (recordingPayment.netPayable || 0) - (recordingPayment.paidAmount || 0)).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Disbursement Mode *
              </label>
              <select
                value={legForm.mode}
                onChange={(e) => setLegForm({ ...legForm, mode: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              >
                <option value="BANK_TRANSFER">BANK_TRANSFER (NEFT / RTGS / IMPS)</option>
                <option value="UPI">UPI (Unified Payments Interface)</option>
                <option value="CHEQUE">CHEQUE (Company Corporate Cheque)</option>
                <option value="CASH">CASH (Physical Cash Voucher)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Payment Amount (₹) *
              </label>
              <input
                type="number"
                value={legForm.amount}
                onChange={(e) => setLegForm({ ...legForm, amount: e.target.value })}
                required
                max={Math.max(0, (recordingPayment.netPayable || 0) - (recordingPayment.paidAmount || 0)) || undefined}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Reference / Transaction Number
              </label>
              <input
                type="text"
                value={legForm.referenceNumber}
                onChange={(e) => setLegForm({ ...legForm, referenceNumber: e.target.value })}
                placeholder="e.g. UTR / Cheque No / UPI Ref"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button variant="secondary" onClick={() => setLegModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submittingLeg}>
                Record Payment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 5. MODAL: PAYMENT DETAILS (GET /salary-payments/:id) */}
      {/* ================================================================== */}
      {detailsModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => {
            setDetailsModalOpen(false);
            setViewingPayment(null);
          }}
          title="Salary Payment Breakdown & Legs"
          maxWidth="640px"
        >
          {loadingDetails || !viewingPayment ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
              <div>Fetching salary payment details...</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Header Info */}
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                    {viewingPayment.employee?.basicInfo?.fullName || viewingPayment.employee?.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Code: {viewingPayment.employee?.basicInfo?.employeeCode || viewingPayment.employee?.employeeCode || 'EMP'}
                  </div>
                </div>
                <Badge variant={viewingPayment.status === 'PAID' ? 'success' : viewingPayment.status === 'PARTIALLY_PAID' ? 'warning' : 'danger'}>
                  {viewingPayment.status}
                </Badge>
              </div>

              {/* Amount Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div style={{ background: '#f0fdf4', padding: '10px 12px', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 600 }}>NET PAYABLE</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#15803d', marginTop: 2 }}>
                    ₹{(viewingPayment.netPayable || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ background: '#eff6ff', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 600 }}>AMOUNT PAID</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1d4ed8', marginTop: 2 }}>
                    ₹{(viewingPayment.paidAmount || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ background: '#fef2f2', padding: '10px 12px', borderRadius: 6, border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '0.7rem', color: '#991b1b', fontWeight: 600 }}>REMAINING</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#b91c1c', marginTop: 2 }}>
                    ₹{Math.max(0, (viewingPayment.netPayable || 0) - (viewingPayment.paidAmount || 0)).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Legs Table */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                  Disbursement Legs History
                </h4>
                {(viewingPayment.paymentLegs && viewingPayment.paymentLegs.length > 0) ? (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                          <th style={{ padding: '8px 10px' }}>Mode</th>
                          <th style={{ padding: '8px 10px' }}>Amount</th>
                          <th style={{ padding: '8px 10px' }}>Ref / Txn ID</th>
                          <th style={{ padding: '8px 10px' }}>Status</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingPayment.paymentLegs.map((leg, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>{leg.mode}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: '#16a34a' }}>
                              ₹{(leg.amount || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '8px 10px', color: '#475569' }}>
                              {leg.referenceNumber || 'N/A'}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <Badge variant={leg.status === 'FAILED' ? 'danger' : 'success'}>
                                {leg.status || 'PAID'}
                              </Badge>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              {leg.status !== 'FAILED' && isManagerOrAdmin && (
                                <Button
                                  variant="danger"
                                  size="sm"
                                  icon={AlertTriangle}
                                  onClick={() => handleOpenMarkFailed(viewingPayment, idx)}
                                  title="Mark Leg as Failed (PUT /salary-payments/:id/legs/:legIndex/mark-failed)"
                                >
                                  Mark Failed
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: 16, background: '#f8fafc', borderRadius: 6, color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center' }}>
                    No payment legs recorded yet.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <Button variant="secondary" onClick={() => setDetailsModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 6. MODAL: MARK LEG FAILED (PUT /salary-payments/:id/legs/:legIndex/mark-failed) */}
      {/* ================================================================== */}
      {failModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setFailModalOpen(false)}
          title="Mark Payment Leg as Failed"
          maxWidth="440px"
        >
          <form onSubmit={handleSubmitMarkFailed} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: '0.8rem', color: '#991b1b' }}>
              Marking this disbursement leg as failed will revert the disbursed amount and update reconciliation balances.
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Failure Reason *
              </label>
              <textarea
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                required
                rows={3}
                placeholder="e.g. Bank transfer bounced due to invalid IFSC code"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" onClick={() => setFailModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" type="submit" loading={submittingFail}>
                Confirm Reversal
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 7. MODAL: EMPLOYEE PAYMENT HISTORY (GET /salary-payments/employees/:id) */}
      {/* ================================================================== */}
      {historyModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => {
            setHistoryModalOpen(false);
            setViewingEmployee(null);
            setEmployeePayments([]);
          }}
          title={`Disbursement History: ${viewingEmployee?.basicInfo?.fullName || viewingEmployee?.name || 'Employee'}`}
          maxWidth="680px"
        >
          {loadingHistory ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
              <div>Loading employee payment history...</div>
            </div>
          ) : employeePayments.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
              No historical payment disbursements recorded for this employee.
            </div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px' }}>Pay Period</th>
                    <th style={{ padding: '8px 10px' }}>Net Payable</th>
                    <th style={{ padding: '8px 10px' }}>Amount Paid</th>
                    <th style={{ padding: '8px 10px' }}>Status</th>
                    <th style={{ padding: '8px 10px' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {employeePayments.map((ep) => (
                    <tr key={ep._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                        {ep.payrollRun?.payPeriodFrom ? new Date(ep.payrollRun.payPeriodFrom).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Period'}
                      </td>
                      <td style={{ padding: '8px 10px' }}>₹{(ep.netPayable || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: '#16a34a' }}>
                        ₹{(ep.paidAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <Badge variant={ep.status === 'PAID' ? 'success' : 'warning'}>
                          {ep.status || 'PAID'}
                        </Badge>
                      </td>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>
                        {ep.createdAt ? new Date(ep.createdAt).toLocaleDateString('en-IN') : 'Recent'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <Button variant="secondary" onClick={() => setHistoryModalOpen(false)}>
              Close
            </Button>
          </div>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 8. MODAL: OUTSTANDING REPORT (GET /salary-payments/reports/outstanding) */}
      {/* ================================================================== */}
      {outstandingModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => {
            setOutstandingModalOpen(false);
            setOutstandingReport(null);
          }}
          title="Outstanding Salary Payments Report"
          maxWidth="640px"
        >
          {loadingOutstanding ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
              <div>Generating outstanding payments report from backend...</div>
            </div>
          ) : !outstandingReport ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
              No outstanding payment records found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                <div style={{ background: '#fef2f2', padding: '12px 14px', borderRadius: 8, border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '0.72rem', color: '#991b1b', fontWeight: 600 }}>TOTAL OUTSTANDING LIABILITIES</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#b91c1c', marginTop: 4 }}>
                    ₹{(outstandingReport.totalOutstanding || outstandingReport.totalBalance || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>UNPAID EMPLOYEES COUNT</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                    {outstandingReport.unpaidCount || (outstandingReport.items?.length || 0)} Staff
                  </div>
                </div>
              </div>

              {/* Items Breakdown */}
              {outstandingReport.items && outstandingReport.items.length > 0 && (
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Employee</th>
                        <th style={{ padding: '8px 10px' }}>Net Payable</th>
                        <th style={{ padding: '8px 10px' }}>Paid</th>
                        <th style={{ padding: '8px 10px' }}>Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outstandingReport.items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                            {it.employee?.basicInfo?.fullName || it.employee?.name || 'Employee'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>₹{(it.netPayable || 0).toLocaleString('en-IN')}</td>
                          <td style={{ padding: '8px 10px', color: '#16a34a' }}>₹{(it.paidAmount || 0).toLocaleString('en-IN')}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: '#dc2626' }}>
                            ₹{(it.balance || ((it.netPayable || 0) - (it.paidAmount || 0))).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <Button variant="secondary" onClick={() => setOutstandingModalOpen(false)}>
                  Close Report
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default SalaryPaymentsTab;
