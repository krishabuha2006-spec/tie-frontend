import apiClient from './client';

export const letterTemplateApi = {
  // 1. GET /letter-templates - List Letter Templates (Pure API)
  getLetterTemplates: async (params) => {
    const res = await apiClient.get('/letter-templates', { params });
    return res.data;
  },


  createLetterTemplate: async (data) => {
    const payload = {
      type: data.type || 'JOINING_LETTER',
      title: data.title?.trim() || (data.type === 'JOINING_LETTER' ? 'Official Joining Letter' : 'Appointment Letter'),
      bodyHtml: data.bodyHtml || '<div>Welcome to {{companyName}}</div>',
      company: data.company || undefined,
      isActive: data.isActive !== false,
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    const res = await apiClient.post('/letter-templates', payload);
    return res.data;
  },

  // 3. GET /letter-templates/{id} - Get Letter Template by ID (Pure API)
  getLetterTemplateById: async (id) => {
    const res = await apiClient.get(`/letter-templates/${id}`);
    return res.data;
  },

  // 4. PUT /letter-templates/{id} - Update Letter Template (Pure API)
  updateLetterTemplate: async (id, data) => {
    const payload = {
      type: data.type || undefined,
      title: data.title !== undefined ? data.title?.trim() : undefined,
      bodyHtml: data.bodyHtml !== undefined ? data.bodyHtml : undefined,
      company: data.company || undefined,
      isActive: data.isActive !== undefined ? data.isActive : undefined,
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    const res = await apiClient.put(`/letter-templates/${id}`, payload);
    return res.data;
  },

  // 5. DELETE /letter-templates/{id} - Delete Letter Template (Pure API)
  deleteLetterTemplate: async (id) => {
    const res = await apiClient.delete(`/letter-templates/${id}`);
    return res.data;
  },
};

export default letterTemplateApi;
