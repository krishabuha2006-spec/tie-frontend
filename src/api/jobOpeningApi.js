import apiClient from './client';

export const jobOpeningApi = {
  // GET /job-openings - List Job Openings (Pure API)
  getJobOpenings: async (params) => {
    const res = await apiClient.get('/job-openings', { params });
    return res.data;
  },

  // GET /job-openings/{id} - Get Job Opening by ID (Pure API)
  getJobOpeningById: async (id) => {
    const res = await apiClient.get(`/job-openings/${id}`);
    return res.data;
  },

  // POST /job-openings - Create Job Opening (Pure API)
  createJobOpening: async (data) => {
    const payload = {
      title: data.title?.trim(),
      department: data.department?._id || data.department,
      branch: data.branch?._id || data.branch || undefined,
      company: data.company?._id || data.company || undefined,
      numberOfOpenings: Number(data.numberOfOpenings || data.numberOfPositions) || 1,
      employmentType: data.employmentType || data.jobType || 'FULL_TIME',
      workType: data.workType || 'OFFICE',
      description: data.description?.trim() || '',
      requirements: Array.isArray(data.requirements)
        ? data.requirements
        : (data.requirements ? data.requirements.split('\n').map((s) => s.trim()).filter(Boolean) : []),
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    const res = await apiClient.post('/job-openings', payload);
    return res.data;
  },

  // PUT /job-openings/{id} - Update Job Opening (Pure API)
  updateJobOpening: async (id, data) => {
    const payload = {
      title: data.title !== undefined ? data.title?.trim() : undefined,
      department: data.department?._id || data.department || undefined,
      branch: data.branch?._id || data.branch || undefined,
      company: data.company?._id || data.company || undefined,
      numberOfOpenings: data.numberOfOpenings !== undefined ? Number(data.numberOfOpenings) : undefined,
      employmentType: data.employmentType || data.jobType || undefined,
      workType: data.workType || undefined,
      status: data.status || undefined,
      description: data.description !== undefined ? data.description?.trim() : undefined,
      requirements: Array.isArray(data.requirements)
        ? data.requirements
        : (typeof data.requirements === 'string' ? data.requirements.split('\n').map((s) => s.trim()).filter(Boolean) : undefined),
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    const res = await apiClient.put(`/job-openings/${id}`, payload);
    return res.data;
  },

  // PUT /job-openings/{id}/close - Close Job Opening (Pure API)
  closeJobOpening: async (id) => {
    const res = await apiClient.put(`/job-openings/${id}/close`);
    return res.data;
  },

  // DELETE /job-openings/{id} - Delete Job Opening (Pure API)
  deleteJobOpening: async (id) => {
    const res = await apiClient.delete(`/job-openings/${id}`);
    return res.data;
  },
};

export default jobOpeningApi;
