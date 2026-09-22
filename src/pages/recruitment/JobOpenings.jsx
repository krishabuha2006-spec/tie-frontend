import React, { useState, useEffect, useCallback } from 'react';
import recruitmentApi from '../../api/recruitmentApi';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { Plus, Briefcase, RefreshCw, XCircle, Search } from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { recruitmentNav } from '../../routes/moduleNavConfig';

export const JobOpenings = () => {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [jobs, setJobs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    department: '',
    branch: '',
    company: '',
    numberOfOpenings: 1,
    employmentType: 'FULL_TIME',
    workType: 'OFFICE',
    description: '',
    requirements: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [jRes, dRes, bRes, cRes] = await Promise.all([
        recruitmentApi.getJobOpenings(),
        masterApi.getDepartments(),
        masterApi.getBranches(),
        masterApi.getCompanies(),
      ]);

      const jobsList = jRes?.data || jRes?.jobs || jRes?.jobOpenings || (Array.isArray(jRes) ? jRes : []);
      const deptList = dRes?.data || dRes?.departments || (Array.isArray(dRes) ? dRes : []);
      const branchList = bRes?.data || bRes?.branches || (Array.isArray(bRes) ? bRes : []);
      const compList = cRes?.data || cRes?.companies || (Array.isArray(cRes) ? cRes : []);

      setJobs(jobsList);
      setDepartments(deptList);
      setBranches(branchList);
      setCompanies(compList);
    } catch (err) {
      console.error(err);
      showToast('Failed to load job openings from server', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAddModal = () => {
    setFormData({
      title: '',
      department: departments[0]?._id || '',
      branch: branches[0]?._id || '',
      company: companies[0]?._id || '',
      numberOfOpenings: 1,
      employmentType: 'FULL_TIME',
      workType: 'OFFICE',
      description: '',
      requirements: '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast('Job title is required', 'error');
      return;
    }
    if (!formData.department) {
      showToast('Please select a department', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await recruitmentApi.createJobOpening(formData);
      showToast('Job opening created successfully!', 'success');
      setModalOpen(false);
      await loadData();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) {
        showToast(err.response?.data?.message || 'A job opening with the same title already exists in this department. Please use a different title or update the existing one.', 'error');
      } else {
        showToast(err.response?.data?.message || 'Failed to create job opening', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseJob = async (job) => {
    try {
      await recruitmentApi.closeJobOpening(job._id);
      showToast('Job opening closed successfully', 'info');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to close job opening', 'error');
    }
  };

  const handleDeleteJob = async (job) => {
    const isConfirmed = await confirm({
      title: 'Delete Job Opening',
      message: `Are you sure you want to delete job opening "${job.title}"? This cannot be undone.`,
      confirmText: 'Delete Opening',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!isConfirmed) return;
    try {
      await recruitmentApi.deleteJobOpening(job._id);
      showToast('Job opening deleted successfully', 'success');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete job opening', 'error');
    }
  };

  const filteredJobs = jobs.filter((j) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      j.title?.toLowerCase().includes(s) ||
      j.department?.name?.toLowerCase().includes(s) ||
      j.branch?.name?.toLowerCase().includes(s) ||
      j.workType?.toLowerCase().includes(s)
    );
  });

  const columns = [
    {
      header: 'Job Title',
      key: 'title',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.title}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {r.branch?.name ? `${r.branch.name} • ` : ''}{r.company?.name || ''}
          </div>
        </div>
      ),
    },
    {
      header: 'Department',
      key: 'department',
      render: (r) => (
        <span style={{ fontSize: '0.84rem', fontWeight: 500 }}>
          {r.department?.name || r.department?.code || '-'}
        </span>
      ),
    },
    {
      header: 'Vacancies',
      key: 'numberOfOpenings',
      render: (r) => (
        <span style={{ fontWeight: 600, fontSize: '0.84rem' }}>
          {r.numberOfOpenings || r.numberOfPositions || 1} Openings
        </span>
      ),
    },
    {
      header: 'Employment / Work Type',
      key: 'workType',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Badge variant="info">{r.workType || 'OFFICE'}</Badge>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            {(r.employmentType || 'FULL_TIME').replace('_', ' ')}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (r) => (
        <Badge variant={r.status === 'OPEN' ? 'success' : 'secondary'}>
          {r.status || 'OPEN'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {r.status === 'OPEN' && (
            <Button variant="secondary" size="sm" onClick={() => handleCloseJob(r)}>
              Close
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteJob(r)}
            style={{ color: '#dc2626' }}
            title="Delete Job Opening"
          >
            <XCircle size={15} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ModuleSubNav items={recruitmentNav} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Briefcase size={22} color="var(--primary)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Job Vacancies
            </h2>
            <Badge variant="primary">{jobs.length} Total Postings</Badge>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button variant="secondary" icon={RefreshCw} onClick={loadData} loading={loading}>
            Refresh
          </Button>
          <Button variant="primary" icon={Plus} onClick={openAddModal}>
            Create Job Opening
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: '8px 14px' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
          <Input
            placeholder="Search job postings..."
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

      {/* Table */}
      <Table
        columns={columns}
        data={filteredJobs}
        loading={loading}
        emptyMessage="No job openings found. Click 'Create Job Opening' to post a vacancy."
      />

      {/* Create Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Post New Job Vacancy"
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            label="Job Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Senior Project Engineer"
            required
          />

          <div className="grid-2">
            <Select
              label="Department"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              options={departments.map((d) => ({ value: d._id, label: d.name }))}
              required
            />

            <Select
              label="Branch"
              value={formData.branch}
              onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
              options={branches.map((b) => ({ value: b._id, label: b.name }))}
            />
          </div>

          <div className="grid-3">
            <Input
              label="Openings"
              type="number"
              min="1"
              value={formData.numberOfOpenings}
              onChange={(e) => setFormData({ ...formData, numberOfOpenings: e.target.value })}
              required
            />

            <Select
              label="Employment Type"
              value={formData.employmentType}
              onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
              options={[
                { value: 'FULL_TIME', label: 'Full Time' },
                { value: 'PART_TIME', label: 'Part Time' },
                { value: 'CONTRACT', label: 'Contract' },
                { value: 'INTERN', label: 'Intern' },
              ]}
              required
            />

            <Select
              label="Work Type"
              value={formData.workType}
              onChange={(e) => setFormData({ ...formData, workType: e.target.value })}
              options={[
                { value: 'OFFICE', label: 'Office' },
                { value: 'FIELD', label: 'Field' },
                { value: 'SITE', label: 'Site' },
                { value: 'HYBRID', label: 'Hybrid' },
              ]}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
              Job Description
            </label>
            <textarea
              className="form-control"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Responsibilities, role overview, and expectations..."
              rows={3}
              style={{ width: '100%', fontSize: '0.84rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
              Requirements (One per line)
            </label>
            <textarea
              className="form-control"
              value={formData.requirements}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              placeholder="e.g. B.E. Mechanical Engineering&#10;3+ years experience in MEP project execution"
              rows={2}
              style={{ width: '100%', fontSize: '0.84rem' }}
            />
          </div>

          <div className="modal-footer" style={{ margin: '16px -20px -20px' }}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Post Job Opening
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default JobOpenings;
