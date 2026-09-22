import React, { useState, useEffect, useCallback } from 'react';
import recruitmentApi from '../../api/recruitmentApi';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { Plus, FileText, RefreshCw, Search } from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { recruitmentNav } from '../../routes/moduleNavConfig';

export const LetterTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    company: '',
    title: '',
    type: 'JOINING_LETTER',
    bodyHtml: '',
  });

  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, cRes] = await Promise.all([
        recruitmentApi.getLetterTemplates(),
        masterApi.getCompanies(),
      ]);

      const tList = tRes?.data || tRes?.templates || (Array.isArray(tRes) ? tRes : []);
      const cList = cRes?.data || cRes?.companies || (Array.isArray(cRes) ? cRes : []);

      setTemplates(tList);
      setCompanies(cList);
    } catch (err) {
      console.error(err);
      showToast('Failed to load letter templates from server', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAddModal = () => {
    setFormData({
      company: companies[0]?._id || '',
      title: '',
      type: 'JOINING_LETTER',
      bodyHtml: '<p>Dear <strong>{{fullName}}</strong>,</p><p>We are pleased to welcome you to <strong>{{companyName}}</strong> as <strong>{{designation}}</strong>.</p><p>Date of Joining: <strong>{{joiningDate}}</strong><br/>Annual CTC: <strong>₹{{ctc}}</strong></p>',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast('Template title is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await recruitmentApi.createLetterTemplate(formData);
      showToast('Letter template saved successfully!', 'success');
      setModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save template', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTemplates = templates.filter((t) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return t.title?.toLowerCase().includes(s) || t.type?.toLowerCase().includes(s);
  });

  const columns = [
    {
      header: 'Template Title',
      key: 'title',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={16} color="var(--primary)" />
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            {r.title || (r.type === 'JOINING_LETTER' ? 'Joining Letter' : 'Appointment Letter')}
          </span>
        </div>
      ),
    },
    {
      header: 'Document Type',
      key: 'type',
      render: (r) => <Badge variant="info">{r.type?.replace('_', ' ')}</Badge>,
    },
    {
      header: 'Placeholders Supported',
      key: 'bodyHtml',
      render: () => (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {`{{fullName}}, {{companyName}}, {{designation}}, {{joiningDate}}, {{ctc}}`}
        </span>
      ),
    },
    {
      header: 'Status',
      key: 'isActive',
      render: (r) => <Badge variant={r.isActive !== false ? 'success' : 'secondary'}>Active</Badge>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ModuleSubNav items={recruitmentNav} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={22} color="var(--primary)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Letter Templates
            </h2>
            <Badge variant="primary">{templates.length} Templates</Badge>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button variant="secondary" icon={RefreshCw} onClick={loadData} loading={loading}>
            Refresh
          </Button>
          <Button variant="primary" icon={Plus} onClick={openAddModal}>
            Create Template
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: '8px 14px' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
          <Input
            placeholder="Search templates..."
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
        data={filteredTemplates}
        loading={loading}
        emptyMessage="No letter templates found. Click 'Create Template' to define one."
      />

      {/* Create Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create Letter Template">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            label="Template Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Official Joining Letter 2026"
            required
          />

          <div className="grid-2">
            <Select
              label="Template Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              options={[
                { value: 'JOINING_LETTER', label: 'Joining Letter' },
                { value: 'APPOINTMENT_LETTER', label: 'Appointment Letter' },
              ]}
              required
            />

            <Select
              label="Company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              options={companies.map((c) => ({ value: c._id, label: c.name }))}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
              Template HTML Content (Supports tokens like &#123;&#123;fullName&#125;&#125;, &#123;&#123;companyName&#125;&#125;, &#123;&#123;designation&#125;&#125;)
            </label>
            <textarea
              className="form-control"
              value={formData.bodyHtml}
              onChange={(e) => setFormData({ ...formData, bodyHtml: e.target.value })}
              rows={6}
              style={{ width: '100%', fontSize: '0.84rem', fontFamily: 'monospace' }}
              required
            />
          </div>

          <div className="modal-footer" style={{ margin: '16px -20px -20px' }}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Save Template
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LetterTemplates;
