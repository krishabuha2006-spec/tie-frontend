import React, { useState, useEffect, useCallback } from 'react';
import payrollApi from '../../api/payrollApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import {
  FileText, Plus, Edit2, Trash2, Eye, CheckCircle2,
  Code, Loader2, Sparkles, Building2
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { extractApiData } from '../../utils/apiUtils';

export const PayslipTemplatesTab = ({ companies = [], isManagerOrAdmin = false }) => {
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  // Create / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [submittingTemplate, setSubmittingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    company: '',
    title: '',
    header: '<div style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px;"><h2>{{companyName}}</h2><p>{{companyAddress}}</p></div>',
    footer: '<div style="text-align: center; border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 20px; font-size: 11px; color: #64748b;">This is a computer-generated payslip and does not require a physical signature.</div>',
    bodyHtml: '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;"><div><h3>Earnings</h3><p>Basic: ₹{{basicSalary}}</p><p>HRA: ₹{{hra}}</p></div><div><h3>Deductions</h3><p>PF: ₹{{pfDeduction}}</p><p>Tax: ₹{{taxDeduction}}</p></div></div><div style="margin-top: 16px; font-weight: bold; font-size: 16px;">Net Pay: ₹{{netPay}}</div>',
    showAttendanceSummary: true,
    showBankDetails: true,
    showPAN: true,
    isActive: true,
  });

  // Preview Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const toList = (res) => extractApiData(res, 'templates', 'data');

  // Load Templates (GET /payslip-templates)
  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const params = {};
      if (selectedCompanyId) params.company = selectedCompanyId;
      const res = await payrollApi.getPayslipTemplates(params);
      setTemplates(toList(res));
    } catch (err) {
      console.error('Error loading payslip templates:', err);
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingTemplate(null);
    setFormData({
      company: selectedCompanyId || companies[0]?._id || '',
      title: 'Standard Corporate Payslip',
      header: '<div style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px;"><h2>{{companyName}}</h2><p>{{companyAddress}}</p></div>',
      footer: '<div style="text-align: center; border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 20px; font-size: 11px; color: #64748b;">This is a computer-generated payslip and does not require a physical signature.</div>',
      bodyHtml: '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;"><div><h3>Earnings</h3><p>Basic: ₹{{basicSalary}}</p><p>HRA: ₹{{hra}}</p></div><div><h3>Deductions</h3><p>PF: ₹{{pfDeduction}}</p><p>Tax: ₹{{taxDeduction}}</p></div></div><div style="margin-top: 16px; font-weight: bold; font-size: 16px;">Net Pay: ₹{{netPay}}</div>',
      showAttendanceSummary: true,
      showBankDetails: true,
      showPAN: true,
      isActive: true,
    });
    setModalOpen(true);
  };

  // Open Edit Modal (GET /payslip-templates/:id or prepopulate)
  const handleOpenEditModal = async (tpl) => {
    setEditingTemplate(tpl);
    try {
      const res = await payrollApi.getPayslipTemplateById(tpl._id);
      const data = res?.data || res?.template || res || tpl;
      setFormData({
        company: data.company?._id || data.company || companies[0]?._id || '',
        title: data.title || '',
        header: data.header || '',
        footer: data.footer || '',
        bodyHtml: data.bodyHtml || '',
        showAttendanceSummary: data.showAttendanceSummary !== false,
        showBankDetails: data.showBankDetails !== false,
        showPAN: data.showPAN !== false,
        isActive: data.isActive !== false,
      });
    } catch {
      setFormData({
        company: tpl.company?._id || tpl.company || companies[0]?._id || '',
        title: tpl.title || '',
        header: tpl.header || '',
        footer: tpl.footer || '',
        bodyHtml: tpl.bodyHtml || '',
        showAttendanceSummary: tpl.showAttendanceSummary !== false,
        showBankDetails: tpl.showBankDetails !== false,
        showPAN: tpl.showPAN !== false,
        isActive: tpl.isActive !== false,
      });
    }
    setModalOpen(true);
  };

  // Submit Create or Update (POST or PUT /payslip-templates)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast('Template title is required', 'warning');
      return;
    }
    if (!formData.bodyHtml.trim()) {
      showToast('Template body HTML is required', 'warning');
      return;
    }

    setSubmittingTemplate(true);
    try {
      const payload = {
        company: formData.company || companies[0]?._id,
        title: formData.title.trim(),
        header: formData.header,
        footer: formData.footer,
        bodyHtml: formData.bodyHtml,
        showAttendanceSummary: Boolean(formData.showAttendanceSummary),
        showBankDetails: Boolean(formData.showBankDetails),
        showPAN: Boolean(formData.showPAN),
        isActive: Boolean(formData.isActive),
      };

      if (editingTemplate?._id) {
        await payrollApi.updatePayslipTemplate(editingTemplate._id, payload);
        showToast('Payslip template updated successfully!', 'success');
      } else {
        await payrollApi.createPayslipTemplate(payload);
        showToast('Payslip template created successfully!', 'success');
      }

      setModalOpen(false);
      setEditingTemplate(null);
      await loadTemplates();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save template', 'error');
    } finally {
      setSubmittingTemplate(false);
    }
  };

  // Delete Template (DELETE /payslip-templates/:id)
  const handleDeleteTemplate = async (id) => {
    const isConfirmed = await confirm({
      title: 'Delete Payslip Template',
      message: 'Are you sure you want to delete this payslip template? This action cannot be undone.',
      confirmText: 'Delete Template',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!isConfirmed) return;

    setDeletingTemplateId(id);
    try {
      await payrollApi.deletePayslipTemplate(id);
      showToast('Payslip template deleted', 'success');
      await loadTemplates();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete template', 'error');
    } finally {
      setDeletingTemplateId(null);
    }
  };

  // Open Preview Modal (GET /payslip-templates/:id)
  const handleOpenPreview = async (tpl) => {
    setLoadingPreview(true);
    setPreviewModalOpen(true);
    try {
      const res = await payrollApi.getPayslipTemplateById(tpl._id);
      const data = res?.data || res?.template || res || tpl;
      setPreviewTemplate(data);
    } catch {
      setPreviewTemplate(tpl);
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 1. Header Bar */}
      <div style={{
        background: '#fff', padding: '14px 18px', borderRadius: 10,
        border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 10
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} style={{ color: '#2563eb' }} />
            Payslip Layout Templates (Module 16)
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
            Customizable HTML &amp; token interpolation templates for batch &amp; electronic salary generation
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
          >
            <option value="">All Organizations</option>
            {companies.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>

          {isManagerOrAdmin && (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={handleOpenCreateModal}
            >
              Add Template
            </Button>
          )}
        </div>
      </div>

      {/* 2. Templates List / Table */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loadingTemplates ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
            <div>Loading payslip templates...</div>
          </div>
        ) : templates.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
            <FileText size={36} style={{ color: '#94a3b8', margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>
              No Payslip Templates Configured
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 12px' }}>
              Create your first customizable payslip template for standard payroll payouts.
            </p>
            {isManagerOrAdmin && (
              <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenCreateModal}>
                Create Payslip Template
              </Button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                  <th style={{ padding: '10px 16px' }}>Template Title</th>
                  <th style={{ padding: '10px 16px' }}>Company</th>
                  <th style={{ padding: '10px 16px' }}>Included Sections</th>
                  <th style={{ padding: '10px 16px' }}>Status</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((tpl) => {
                  const compName = tpl.company?.name || companies.find((c) => c._id === tpl.company)?.name || 'All Companies';
                  const sections = [];
                  if (tpl.showAttendanceSummary) sections.push('Attendance');
                  if (tpl.showBankDetails) sections.push('Bank');
                  if (tpl.showPAN) sections.push('PAN');

                  return (
                    <tr key={tpl._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                        {tpl.title}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        {compName}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {sections.map((s, i) => (
                            <span key={i} style={{ background: '#f1f5f9', color: '#334155', padding: '2px 6px', borderRadius: 4, fontSize: '0.72rem' }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge variant={tpl.isActive !== false ? 'success' : 'secondary'}>
                          {tpl.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Eye}
                            onClick={() => handleOpenPreview(tpl)}
                            title="Preview Payslip Layout"
                          />
                          {isManagerOrAdmin && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={Edit2}
                                onClick={() => handleOpenEditModal(tpl)}
                                title="Edit Template"
                              />
                              <Button
                                variant="danger"
                                size="sm"
                                icon={Trash2}
                                loading={deletingTemplateId === tpl._id}
                                onClick={() => handleDeleteTemplate(tpl._id)}
                                title="Delete Template"
                              />
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
      {/* 3. MODAL: CREATE / EDIT PAYSLIP TEMPLATE */}
      {/* ================================================================== */}
      {modalOpen && (
        <Modal
          isOpen={true}
          onClose={() => {
            setModalOpen(false);
            setEditingTemplate(null);
          }}
          title={editingTemplate ? `Edit Template: ${editingTemplate.title}` : 'Create Payslip Template'}
          maxWidth="640px"
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Company *
                </label>
                <select
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                >
                  {companies.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Template Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="e.g. Standard Corporate Payslip"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Header HTML
              </label>
              <textarea
                value={formData.header}
                onChange={(e) => setFormData({ ...formData, header: e.target.value })}
                rows={2}
                placeholder="Custom HTML header..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem', boxSizing: 'border-box', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Body HTML (Tokens Supported) *</label>
                <span style={{ fontSize: '0.7rem', color: '#2563eb' }}>
                  Tokens: &#123;&#123;employeeName&#125;&#125;, &#123;&#123;netPay&#125;&#125;, &#123;&#123;basicSalary&#125;&#125;, &#123;&#123;hra&#125;&#125;
                </span>
              </div>
              <textarea
                value={formData.bodyHtml}
                onChange={(e) => setFormData({ ...formData, bodyHtml: e.target.value })}
                required
                rows={5}
                placeholder="Custom HTML body..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem', boxSizing: 'border-box', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Footer HTML
              </label>
              <textarea
                value={formData.footer}
                onChange={(e) => setFormData({ ...formData, footer: e.target.value })}
                rows={2}
                placeholder="Custom HTML footer..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem', boxSizing: 'border-box', fontFamily: 'monospace' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', background: '#f8fafc', padding: '10px 12px', borderRadius: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.showAttendanceSummary}
                  onChange={(e) => setFormData({ ...formData, showAttendanceSummary: e.target.checked })}
                />
                Show Attendance Summary
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.showBankDetails}
                  onChange={(e) => setFormData({ ...formData, showBankDetails: e.target.checked })}
                />
                Show Bank Details
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.showPAN}
                  onChange={(e) => setFormData({ ...formData, showPAN: e.target.checked })}
                />
                Show PAN Number
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                Active Template
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submittingTemplate}>
                {editingTemplate ? 'Update Template' : 'Save Template'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 4. MODAL: PREVIEW PAYSLIP TEMPLATE */}
      {/* ================================================================== */}
      {previewModalOpen && previewTemplate && (
        <Modal
          isOpen={true}
          onClose={() => {
            setPreviewModalOpen(false);
            setPreviewTemplate(null);
          }}
          title={`Preview: ${previewTemplate.title}`}
          maxWidth="640px"
        >
          {loadingPreview ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
              <div>Rendering template preview...</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8,
                padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                {previewTemplate.header && (
                  <div dangerouslySetInnerHTML={{ __html: previewTemplate.header.replace('{{companyName}}', 'ACME GLOBAL TECH CORP').replace('{{companyAddress}}', 'Corporate Tower, Financial District') }} />
                )}

                <div style={{ margin: '16px 0' }} dangerouslySetInnerHTML={{ __html: previewTemplate.bodyHtml.replace('{{employeeName}}', 'John Doe').replace('{{basicSalary}}', '45,000').replace('{{hra}}', '18,000').replace('{{pfDeduction}}', '5,400').replace('{{taxDeduction}}', '200').replace('{{netPay}}', '57,400') }} />

                {previewTemplate.footer && (
                  <div dangerouslySetInnerHTML={{ __html: previewTemplate.footer }} />
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setPreviewModalOpen(false)}>
                  Close Preview
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default PayslipTemplatesTab;
