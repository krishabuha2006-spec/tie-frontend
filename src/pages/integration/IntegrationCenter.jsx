import React, { useState, useEffect } from 'react';
import integrationApi from '../../api/integrationApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Cpu,
  ShieldCheck,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Play,
  RefreshCw,
  Plus,
  Layers,
  Database,
  Lock,
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';

export const IntegrationCenter = () => {
  const { user, isSuperAdmin } = useAuth();
  const { showToast } = useToast();

  // Active Tab: 'contracts' | 'health_checks'
  const [activeTab, setActiveTab] = useState('contracts');

  // Contracts State
  const [contracts, setContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(false);

  // Health Checks State
  const [latestCheck, setLatestCheck] = useState(null);
  const [checkHistory, setCheckHistory] = useState([]);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [runningSuite, setRunningSuite] = useState(false);

  // Register Contract Modal
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractForm, setContractForm] = useState({
    contractName: '',
    sourceModule: 'Module 14: Payroll',
    targetModule: 'Module 20: Assets',
    specification: 'Automatic recovery deduction linking',
  });
  const [submittingContract, setSubmittingContract] = useState(false);

  useEffect(() => {
    loadContracts();
    loadHealthData();
  }, []);

  const loadContracts = async () => {
    setLoadingContracts(true);
    try {
      const res = await integrationApi.getContracts();
      const list = Array.isArray(res) ? res : res?.data || res?.contracts || [];
      setContracts(list);
    } catch (err) {
      showToast('Failed to load contract ledger', 'error');
    } finally {
      setLoadingContracts(false);
    }
  };

  const loadHealthData = async () => {
    setLoadingHealth(true);
    try {
      const [latestRes, histRes] = await Promise.all([
        integrationApi.getLatestHealthCheck().catch(() => null),
        integrationApi.getHealthCheckHistory().catch(() => ({ data: [] })),
      ]);
      setLatestCheck(latestRes?.data || latestRes || null);
      const histList = Array.isArray(histRes) ? histRes : histRes?.data || histRes?.runs || [];
      setCheckHistory(histList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHealth(false);
    }
  };

  const handleRunHealthCheckSuite = async () => {
    setRunningSuite(true);
    try {
      const res = await integrationApi.runHealthChecks();
      showToast('Integration health check suite executed across all contracts!', 'success');
      setLatestCheck(res?.data || res);
      loadHealthData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Health check execution finished', 'info');
    } finally {
      setRunningSuite(false);
    }
  };

  const handleSaveContract = async (e) => {
    e.preventDefault();
    setSubmittingContract(true);
    try {
      await integrationApi.registerContract(contractForm);
      showToast('New cross-module contract registered!', 'success');
      setContractModalOpen(false);
      loadContracts();
    } catch (err) {
      showToast(err.response?.data?.message || 'Contract registration failed', 'error');
    } finally {
      setSubmittingContract(false);
    }
  };

  const contractColumns = [
    {
      header: 'Contract Name',
      key: 'name',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={16} color="var(--primary)" />
          <span style={{ fontWeight: 600 }}>{r.name || r.contractName}</span>
        </div>
      ),
    },
    {
      header: 'Source Module',
      key: 'sourceModule',
      render: (r) => <Badge variant="secondary">{r.sourceModule}</Badge>,
    },
    {
      header: 'Target Module',
      key: 'targetModule',
      render: (r) => <Badge variant="primary">{r.targetModule}</Badge>,
    },
    {
      header: 'Contract Enforcement',
      key: 'status',
      render: (r) => (
        <Badge variant={r.status === 'ENFORCED' ? 'success' : 'warning'}>
          {r.status || 'ENFORCED'}
        </Badge>
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
            Integration Center
          </h2>
        </div>

        {isSuperAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="outline"
              icon={Plus}
              onClick={() => setContractModalOpen(true)}
            >
              Register Contract
            </Button>
            <Button
              variant="primary"
              icon={Play}
              loading={runningSuite}
              onClick={handleRunHealthCheckSuite}
            >
              Run Integration Suite
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('contracts')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'contracts' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'contracts' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'contracts' ? 700 : 500,
            cursor: 'pointer',
          }}
        >
          <Cpu size={16} />
          <span>Cross-Module Contracts ({contracts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('health_checks')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'health_checks' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'health_checks' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'health_checks' ? 700 : 500,
            cursor: 'pointer',
          }}
        >
          <Activity size={16} />
          <span>System Health Probes & Audits</span>
        </button>
      </div>

      {/* TAB 1: CONTRACTS */}
      {activeTab === 'contracts' && (
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
              Standard contract registry verifying seamless bi-directional data flow between modules.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="sm" variant="outline" icon={Plus} onClick={() => setContractModalOpen(true)}>
                New Contract
              </Button>
              <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadContracts}>
                Refresh Ledger
              </Button>
            </div>
          </div>
          <Table columns={contractColumns} data={contracts} loading={loadingContracts} emptyMessage="No integration contracts registered in database. Click 'New Contract' to register one." />
        </div>
      )}

      {/* TAB 2: HEALTH PROBES */}
      {activeTab === 'health_checks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Latest Check Card */}
          {latestCheck ? (
            <div
              style={{
                padding: 20,
                borderRadius: 'var(--radius-md)',
                backgroundColor: (latestCheck.failingContractsCount || 0) === 0 ? '#f6ffed' : '#fff1f0',
                border: (latestCheck.failingContractsCount || 0) === 0 ? '1px solid #b7eb8f' : '1px solid #ffa39e',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    backgroundColor: (latestCheck.failingContractsCount || 0) === 0 ? '#52c41a' : '#f5222d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                  }}
                >
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '1.15rem', color: (latestCheck.failingContractsCount || 0) === 0 ? '#274f13' : '#a8071a' }}>
                    {latestCheck.status || ((latestCheck.failingContractsCount || 0) === 0 ? 'All Contracts Healthy' : 'Probes Identified Issues')}
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Latest Probe Executed: {latestCheck.executedAt ? new Date(latestCheck.executedAt).toLocaleString() : 'Just now'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ textAlign: 'center', padding: '8px 16px', backgroundColor: '#fff', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ACTIVE CONTRACTS</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {latestCheck.activeContractsCount ?? contracts.length}
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '8px 16px', backgroundColor: '#fff', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FAILING PROBES</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: (latestCheck.failingContractsCount || 0) === 0 ? 'var(--success)' : '#dc2626' }}>
                    {latestCheck.failingContractsCount ?? 0}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 6 }}>No Probe Runs Recorded in Database</div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                Click "Run Integration Suite" above to execute real automated probes across active contracts.
              </div>
              <Button variant="primary" icon={Play} loading={runningSuite} onClick={handleRunHealthCheckSuite}>
                Run Integration Suite
              </Button>
            </div>
          )}
        </div>
      )}

      {/* MODAL */}
      <Modal
        isOpen={contractModalOpen}
        onClose={() => setContractModalOpen(false)}
        title="Register New Contract Definition"
      >
        <form onSubmit={handleSaveContract}>
          <Input
            label="Contract Name"
            value={contractForm.contractName}
            onChange={(e) => setContractForm({ ...contractForm, contractName: e.target.value })}
            placeholder="e.g. M14-M20: Damage Cost Deduction"
            required
          />
          <div className="grid-2">
            <Input
              label="Source Module"
              value={contractForm.sourceModule}
              onChange={(e) => setContractForm({ ...contractForm, sourceModule: e.target.value })}
              required
            />
            <Input
              label="Target Module"
              value={contractForm.targetModule}
              onChange={(e) => setContractForm({ ...contractForm, targetModule: e.target.value })}
              required
            />
          </div>
          <Input
            label="Integration Specification"
            value={contractForm.specification}
            onChange={(e) => setContractForm({ ...contractForm, specification: e.target.value })}
            required
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setContractModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingContract}>
              Register Contract
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default IntegrationCenter;
