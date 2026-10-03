import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import recruitmentApi from '../../api/recruitmentApi';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import {
  Plus,
  FileText,
  Search,
  Eye,
  Edit2,
  Trash2,
  CheckCircle,
  FileCheck,
  Building2,
  Copy,
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

const DEFAULT_JOINING_TEMPLATE = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 700px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
  <div style="border-bottom: 2px solid #2e7b85; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="color: #2e7b85; margin: 0; font-size: 1.4rem;">{{companyName}}</h2>
    <p style="margin: 4px 0 0; font-size: 0.85rem; color: #64748b;">Human Resources &amp; Talent Acquisition</p>
  </div>

  <p><strong>Date:</strong> {{currentDate}}</p>
  <p><strong>To:</strong><br/>
  <strong>{{fullName}}</strong><br/>
  Candidate Ref: {{candidateEmail}}</p>

  <h3 style="color: #0f172a; margin-top: 24px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">Subject: Official Joining &amp; Offer Confirmation</h3>

  <p>Dear <strong>{{fullName}}</strong>,</p>

  <p>We are delighted to confirm your appointment at <strong>{{companyName}}</strong> for the position of <strong>{{designation}}</strong> in the <strong>{{department}}</strong> department.</p>

  <div style="background-color: #f8fafc; border-left: 4px solid #2e7b85; padding: 12px 16px; margin: 18px 0; border-radius: 4px;">
    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
      <tr>
        <td style="padding: 6px 0; color: #64748b; width: 40%;"><strong>Designation:</strong></td>
        <td style="padding: 6px 0; font-weight: 600;">{{designation}}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b;"><strong>Department:</strong></td>
        <td style="padding: 6px 0; font-weight: 600;">{{department}}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b;"><strong>Date of Joining:</strong></td>
        <td style="padding: 6px 0; font-weight: 600; color: #2e7b85;">{{joiningDate}}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b;"><strong>Annual CTC:</strong></td>
        <td style="padding: 6px 0; font-weight: 600;">₹{{ctc}}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b;"><strong>Probation Period:</strong></td>
        <td style="padding: 6px 0; font-weight: 600;">{{probationPeriod}} Months</td>
      </tr>
    </table>
  </div>

  <p>Please report to the office on your joining date at 09:30 AM with original copies of your academic and identification documents.</p>

  <p style="margin-top: 32px;">Warm regards,<br/>
  <strong>Authorized Signatory</strong><br/>
  {{companyName}}
  </p>
</div>`;

const DEFAULT_APPOINTMENT_TEMPLATE = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 700px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
  <div style="border-bottom: 2px solid #8b5cf6; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="color: #8b5cf6; margin: 0; font-size: 1.4rem;">{{companyName}}</h2>
    <p style="margin: 4px 0 0; font-size: 0.85rem; color: #64748b;">Formal Letter of Appointment</p>
  </div>

  <p><strong>Date:</strong> {{currentDate}}</p>
  <p><strong>Employee:</strong> <strong>{{fullName}}</strong></p>

  <h3 style="color: #0f172a; margin-top: 24px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">APPOINTMENT LETTER</h3>

  <p>Dear <strong>{{fullName}}</strong>,</p>

  <p>With reference to your employment offer and subsequent joining, we take great pleasure in appointing you as <strong>{{designation}}</strong> in the <strong>{{department}}</strong> department effective from <strong>{{joiningDate}}</strong>.</p>

  <p><strong>1. Remuneration &amp; Benefits:</strong> Your total Annual Cost to Company (CTC) shall be ₹{{ctc}} per annum, subject to statutory deductions.</p>
  <p><strong>2. Probation Period:</strong> You shall be on probation for a period of {{probationPeriod}} months from your date of joining.</p>
  <p><strong>3. Code of Conduct:</strong> You agree to abide by the rules, policies, and professional ethics established by {{companyName}}.</p>

  <p style="margin-top: 36px;">Sincerely,<br/>
  <strong>Human Resources Department</strong><br/>
  {{companyName}}
  </p>
</div>`;

const AVAILABLE_TOKENS = [
  { token: '{{fullName}}', desc: 'Candidate Full Name' },
  { token: '{{companyName}}', desc: 'Company Title' },
  { token: '{{designation}}', desc: 'Job Title / Role' },
  { token: '{{department}}', desc: 'Department Name' },
  { token: '{{joiningDate}}', desc: 'Date of Joining' },
  { token: '{{ctc}}', desc: 'Annual Compensation' },
  { token: '{{probationPeriod}}', desc: 'Probation (Months)' },
  { token: '{{candidateEmail}}', desc: 'Email Address' },
  { token: '{{currentDate}}', desc: "Today's Date" },
];

export const LetterTemplates = () => {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const textareaRef = useRef(null);

  const [templates, setTemplates] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Preview Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    type: 'JOINING_LETTER',
    company: '',
    bodyHtml: '',
    isActive: true,
  });

  // Load all templates & companies from backend (GET /letter-templates, GET /companies)
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, cRes] = await Promise.allSettled([
        recruitmentApi.getLetterTemplates(),
        masterApi.getCompanies(),
      ]);

      const tList = tRes.status === 'fulfilled' ? extractApiData(tRes.value, 'templates', 'data') : [];
      const cList = cRes.status === 'fulfilled' ? extractApiData(cRes.value, 'companies', 'data') : [];

      setTemplates(Array.isArray(tList) ? tList : []);
      setCompanies(Array.isArray(cList) ? cList : []);
    } catch {
      setTemplates([]);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Create Modal
  const openAddModal = () => {
    setEditingTemplate(null);
    setFormData({
      title: 'Official Joining Letter',
      type: 'JOINING_LETTER',
      company: companies[0]?._id || '',
      bodyHtml: DEFAULT_JOINING_TEMPLATE,
      isActive: true,
    });
    setModalOpen(true);
  };

  // Open Edit Modal (GET /letter-templates/:id)
  const openEditModal = async (tpl) => {
    setEditingTemplate(tpl);
    setFormData({
      title: tpl.title || '',
      type: tpl.type || 'JOINING_LETTER',
      company: tpl.company?._id || (typeof tpl.company === 'string' ? tpl.company : '') || companies[0]?._id || '',
      bodyHtml: tpl.bodyHtml || '',
      isActive: tpl.isActive !== false,
    });
    setModalOpen(true);

    if (tpl._id) {
      try {
        const res = await recruitmentApi.getLetterTemplateById(tpl._id);
        const item = res?.data || res?.template || res;
        if (item && item._id === tpl._id) {
          setFormData((prev) => ({
            ...prev,
            title: item.title || prev.title,
            type: item.type || prev.type,
            company: item.company?._id || (typeof item.company === 'string' ? item.company : '') || prev.company,
            bodyHtml: item.bodyHtml !== undefined ? item.bodyHtml : prev.bodyHtml,
            isActive: item.isActive !== undefined ? item.isActive !== false : prev.isActive,
          }));
        }
      } catch (err) {
        console.warn('Could not fetch template details by ID, using local state:', err);
      }
    }
  };

  // Open Preview Modal (GET /letter-templates/:id)
  const openPreviewModal = async (tpl) => {
    setPreviewTemplate(tpl);
    setPreviewModalOpen(true);
    setLoadingPreview(true);

    try {
      const res = await recruitmentApi.getLetterTemplateById(tpl._id);
      const item = res?.data || res?.template || res;
      if (item && item._id === tpl._id) {
        setPreviewTemplate(item);
      }
    } catch (err) {
      console.warn('Could not fetch template detail for preview, using table row:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Insert token chip into textarea at current cursor position
  const handleInsertToken = (token) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setFormData((prev) => ({ ...prev, bodyHtml: prev.bodyHtml + token }));
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.bodyHtml;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const newText = before + token + after;

    setFormData((prev) => ({ ...prev, bodyHtml: newText }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    }, 50);
  };

  // Handle Type Change and offer default template switch
  const handleTypeChange = (newType) => {
    setFormData((prev) => {
      let updatedBody = prev.bodyHtml;
      let updatedTitle = prev.title;
      // Pre-fill appropriate default if creating new template
      if (!editingTemplate) {
        if (newType === 'JOINING_LETTER') {
          updatedTitle = 'Official Joining Letter';
          updatedBody = DEFAULT_JOINING_TEMPLATE;
        } else if (newType === 'APPOINTMENT_LETTER') {
          updatedTitle = 'Standard Appointment Letter';
          updatedBody = DEFAULT_APPOINTMENT_TEMPLATE;
        }
      }
      return {
        ...prev,
        type: newType,
        title: updatedTitle,
        bodyHtml: updatedBody,
      };
    });
  };

  // Submit Handler (POST /letter-templates or PUT /letter-templates/:id)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title?.trim()) {
      showToast('Template title is required', 'warning');
      return;
    }
    if (!formData.bodyHtml?.trim()) {
      showToast('Template HTML content cannot be empty', 'warning');
      return;
    }

    setSubmitting(true);
    const payload = {
      title: formData.title.trim(),
      type: formData.type,
      company: formData.company || undefined,
      bodyHtml: formData.bodyHtml,
      isActive: Boolean(formData.isActive),
    };

    try {
      if (editingTemplate?._id) {
        await recruitmentApi.updateLetterTemplate(editingTemplate._id, payload);
        showToast(`Template "${payload.title}" updated successfully!`, 'success');
      } else {
        await recruitmentApi.createLetterTemplate(payload);
        showToast(`Template "${payload.title}" created successfully!`, 'success');
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to save letter template', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Handler (DELETE /letter-templates/:id)
  const handleDelete = async (tpl) => {
    const isConfirmed = await confirm({
      title: 'Delete Letter Template',
      message: `Are you sure you want to delete template "${tpl.title || tpl.type}"? This cannot be undone.`,
      confirmText: 'Delete Template',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!isConfirmed) return;

    try {
      await recruitmentApi.deleteLetterTemplate(tpl._id);
      showToast(`Template "${tpl.title || tpl.type}" deleted successfully`, 'success');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to delete letter template', 'error');
    }
  };

  // Quick Stats
  const stats = useMemo(() => {
    const total = templates.length;
    const joining = templates.filter((t) => t.type === 'JOINING_LETTER').length;
    const appointment = templates.filter((t) => t.type === 'APPOINTMENT_LETTER').length;
    const active = templates.filter((t) => t.isActive !== false).length;
    return { total, joining, appointment, active };
  }, [templates]);

  // Client Filtered List
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      // Type Filter
      if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;

      // Company Filter
      if (companyFilter) {
        const cId = t.company?._id || (typeof t.company === 'string' ? t.company : '');
        if (cId !== companyFilter) return false;
      }

      // Search Filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = t.title?.toLowerCase().includes(q);
        const matchesType = t.type?.toLowerCase().includes(q);
        const matchesHtml = t.bodyHtml?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesType && !matchesHtml) return false;
      }

      return true;
    });
  }, [templates, typeFilter, companyFilter, search]);

  // Generate Sample HTML Preview with Mock Values Substituted
  const previewHtml = useMemo(() => {
    if (!previewTemplate?.bodyHtml) return '<p>No content available</p>';
    let html = previewTemplate.bodyHtml;
    const sampleReplacements = {
      '{{fullName}}': 'Rahul Sharma',
      '{{companyName}}': previewTemplate.company?.name || 'TIE Corporation India Pvt Ltd',
      '{{designation}}': 'Senior Project Engineer',
      '{{department}}': 'Engineering & Operations',
      '{{joiningDate}}': '15 October 2026',
      '{{ctc}}': '12,50,000',
      '{{probationPeriod}}': '3',
      '{{candidateEmail}}': 'rahul.sharma@example.com',
      '{{currentDate}}': new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    };

    Object.entries(sampleReplacements).forEach(([key, val]) => {
      html = html.split(key).join(val);
    });

    return html;
  }, [previewTemplate]);

  // Table Columns
  const columns = [
    {
      header: 'Template Title',
      key: 'title',
      render: (r) => (
        <div>
          <div
            style={{ fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => openPreviewModal(r)}
            title="Click to preview generated letter"
          >
            <FileText size={16} color={r.type === 'JOINING_LETTER' ? 'var(--primary)' : '#8b5cf6'} />
            <span>{r.title || (r.type === 'JOINING_LETTER' ? 'Joining Letter' : 'Appointment Letter')}</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {r.company?.name || 'All Assigned Companies'}
          </div>
        </div>
      ),
    },
    {
      header: 'Document Type',
      key: 'type',
      render: (r) => (
        <Badge variant={r.type === 'JOINING_LETTER' ? 'info' : 'purple'}>
          {r.type === 'JOINING_LETTER' ? 'Joining Letter' : 'Appointment Letter'}
        </Badge>
      ),
    },
    {
      header: 'Supported Tokens',
      key: 'bodyHtml',
      render: (r) => {
        const foundTokens = AVAILABLE_TOKENS.filter((t) => (r.bodyHtml || '').includes(t.token)).map((t) => t.token);
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 320 }}>
            {foundTokens.length > 0 ? (
              foundTokens.slice(0, 4).map((tok) => (
                <span
                  key={tok}
                  style={{
                    fontSize: '0.72rem',
                    fontFamily: 'monospace',
                    padding: '2px 5px',
                    borderRadius: 4,
                    backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-main)',
                  }}
                >
                  {tok}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No dynamic tokens</span>
            )}
            {foundTokens.length > 4 && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                +{foundTokens.length - 4} more
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Status',
      key: 'isActive',
      render: (r) => (
        <Badge variant={r.isActive !== false ? 'success' : 'secondary'}>
          {r.isActive !== false ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Button
            size="sm"
            variant="ghost"
            icon={Eye}
            onClick={() => openPreviewModal(r)}
            title="Preview Template"
            style={{ color: 'var(--primary)' }}
          />
          <Button
            size="sm"
            variant="ghost"
            icon={Edit2}
            onClick={() => openEditModal(r)}
            title="Edit Template"
            style={{ color: 'var(--primary)' }}
          />
          <Button
            size="sm"
            variant="ghost"
            icon={Trash2}
            onClick={() => handleDelete(r)}
            title="Delete Template"
            style={{ color: '#dc2626' }}
          />
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ModuleSubNav items={recruitmentNav} />

      {/* Header & Primary Action */}
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
            <FileText size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Letter Templates
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Configure Joining and Appointment letter HTML templates with dynamic employee merge tokens
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button variant="primary" icon={Plus} onClick={openAddModal}>
            Create Template
          </Button>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(46, 123, 133, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1 }}>{stats.total}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Total Templates</div>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileCheck size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6', lineHeight: 1 }}>{stats.joining}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Joining Letters</div>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#8b5cf6', lineHeight: 1 }}>{stats.appointment}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Appointment Letters</div>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981', lineHeight: 1 }}>{stats.active}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Active &amp; Ready</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 280, maxWidth: '100%' }}>
          <Input
            icon={Search}
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 0 }}
            inputStyle={{ height: 38, fontSize: '0.84rem' }}
          />
        </div>

        <div style={{ width: 200 }}>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Document Types' },
              { value: 'JOINING_LETTER', label: 'Joining Letters' },
              { value: 'APPOINTMENT_LETTER', label: 'Appointment Letters' },
            ]}
            style={{ marginBottom: 0 }}
          />
        </div>

        {companies.length > 1 && (
          <div style={{ width: 200 }}>
            <Select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              options={[
                { value: '', label: 'All Companies' },
                ...companies.map((c) => ({ value: c._id, label: c.name })),
              ]}
              style={{ marginBottom: 0 }}
            />
          </div>
        )}

        {(search || typeFilter !== 'ALL' || companyFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setTypeFilter('ALL');
              setCompanyFilter('');
            }}
            style={{ fontSize: '0.8rem', height: 38 }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Templates Table */}
      <div className="card">
        <Table
          columns={columns}
          data={filteredTemplates}
          loading={loading}
          emptyMessage="No letter templates found. Click 'Create Template' to configure an official joining or appointment letter."
        />
      </div>

      {/* Create / Edit Modal (POST /letter-templates & PUT /letter-templates/:id) */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTemplate ? 'Edit Letter Template' : 'Create New Letter Template'}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="grid-2">
            <Input
              label="Template Title *"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter template title"
              required
            />

            <Select
              label="Document Type *"
              value={formData.type}
              onChange={(e) => handleTypeChange(e.target.value)}
              options={[
                { value: 'JOINING_LETTER', label: 'Joining Letter' },
                { value: 'APPOINTMENT_LETTER', label: 'Appointment Letter' },
              ]}
              required
            />
          </div>

          <div className="grid-2">
            {companies.length > 0 && (
              <Select
                label="Company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                options={[
                  { value: '', label: '-- Default / Global Company --' },
                  ...companies.map((c) => ({ value: c._id, label: c.name })),
                ]}
              />
            )}

            <Select
              label="Status *"
              value={formData.isActive ? 'true' : 'false'}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
              options={[
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
              required
            />
          </div>

          {/* Quick Insert Tokens Helper Bar */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
              Click to Insert Dynamic Tokens:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {AVAILABLE_TOKENS.map((item) => (
                <button
                  key={item.token}
                  type="button"
                  onClick={() => handleInsertToken(item.token)}
                  style={{
                    backgroundColor: 'var(--primary-light, #f0f7f8)',
                    border: '1px solid var(--primary-border, #bce1e6)',
                    color: 'var(--primary)',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: '0.76rem',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title={item.desc}
                >
                  <Copy size={11} /> {item.token}
                </button>
              ))}
            </div>
          </div>

          {/* HTML Template Editor */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ marginBottom: 4 }}>
              HTML Body Content *
            </label>
            <textarea
              ref={textareaRef}
              className="form-control"
              value={formData.bodyHtml}
              onChange={(e) => setFormData({ ...formData, bodyHtml: e.target.value })}
              rows={8}
              style={{
                width: '100%',
                fontSize: '0.82rem',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                resize: 'vertical',
                lineHeight: 1.4,
              }}
              required
            />
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Tip: Tokens inside double braces (e.g. &#123;&#123;fullName&#125;&#125;) will be automatically replaced with the actual employee / candidate data when onboarding letters are generated.
            </div>
          </div>

          <div className="modal-footer" style={{ margin: '16px -20px -20px' }}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingTemplate ? 'Update Template' : 'Save Template'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Letter Live Preview Modal (GET /letter-templates/:id) */}
      <Modal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title={`Preview: ${previewTemplate?.title || 'Letter Template'}`}
      >
        {loadingPreview ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading template preview from server...
          </div>
        ) : previewTemplate ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <Badge variant={previewTemplate.type === 'JOINING_LETTER' ? 'info' : 'purple'}>
                {previewTemplate.type === 'JOINING_LETTER' ? 'Joining Letter' : 'Appointment Letter'}
              </Badge>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Sample preview with mock employee data populated
              </div>
            </div>

            {/* Document Render Canvas */}
            <div
              style={{
                backgroundColor: '#ffffff',
                padding: 16,
                borderRadius: 8,
                border: '1px solid var(--border)',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
                maxHeight: '440px',
                overflowY: 'auto',
              }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />

            <div className="modal-footer" style={{ margin: '14px -20px -20px' }}>
              <Button variant="secondary" onClick={() => setPreviewModalOpen(false)}>
                Close Preview
              </Button>
              <Button
                variant="primary"
                icon={Edit2}
                onClick={() => {
                  setPreviewModalOpen(false);
                  openEditModal(previewTemplate);
                }}
              >
                Edit Template
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default LetterTemplates;
