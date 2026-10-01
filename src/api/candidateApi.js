import apiClient from './client';

export const candidateApi = {
  // 1. GET /candidates - List Candidates (Pure API)
  getCandidates: async (params) => {
    const res = await apiClient.get('/candidates', { params });
    return res.data;
  },

  // 2. POST /candidates - Add Candidate to Job Opening (Pure API)
  createCandidate: async (data) => {
    const payload = {
      jobOpening: data.jobOpening?._id || data.jobOpening,
      fullName: data.fullName?.trim(),
      mobileNumber: data.mobileNumber?.trim(),
      email: data.email?.trim()?.toLowerCase(),
      source: data.source || 'JOB_PORTAL',
      resumeUrl: data.resumeUrl || undefined,
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    const res = await apiClient.post('/candidates', payload);
    return res.data;
  },

  // 3. GET /candidates/{id} - Get Candidate Details (Pure API)
  getCandidateById: async (id) => {
    const res = await apiClient.get(`/candidates/${id}`);
    return res.data;
  },

  // 4. PUT /candidates/{id}/stage - Update Candidate Stage (Pure API)
  updateCandidateStage: async (id, currentStage) => {
    const res = await apiClient.put(`/candidates/${id}/stage`, { currentStage });
    return res.data;
  },

  // 5. PUT /candidates/{id}/interview-notes - Add Interview Notes (Pure API)
  addInterviewNotes: async (id, stage, notes) => {
    const res = await apiClient.put(`/candidates/${id}/interview-notes`, { stage, notes });
    return res.data;
  },

  // 6. PUT /candidates/{id}/offer - Update Offer Details & Acceptance (Pure API)
  updateOffer: async (id, offerData = {}) => {
    const payload = {
      designation: offerData.designation?._id || offerData.designation || undefined,
      department: offerData.department?._id || offerData.department || undefined,
      branch: offerData.branch?._id || offerData.branch || undefined,
      dateOfJoining: offerData.dateOfJoining || offerData.joiningDate || undefined,
      probationPeriodMonths: offerData.probationPeriodMonths !== undefined ? Number(offerData.probationPeriodMonths) : 3,
      accepted: offerData.accepted !== undefined ? Boolean(offerData.accepted) : undefined,
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    const res = await apiClient.put(`/candidates/${id}/offer`, payload);
    return res.data;
  },

  // 7. PUT /candidates/{id}/convert - Convert Candidate to Employee (Pure API)
  convertCandidateToEmployee: async (id) => {
    const res = await apiClient.put(`/candidates/${id}/convert`);
    return res.data;
  },

  // 8. PUT /candidates/{id}/onboarding/generate-letters - Generate Joining & Appointment Letters (Pure API)
  generateOnboardingLetters: async (id) => {
    const res = await apiClient.put(`/candidates/${id}/onboarding/generate-letters`);
    return res.data;
  },
};

export default candidateApi;
