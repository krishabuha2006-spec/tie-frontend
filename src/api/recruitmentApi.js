import apiClient from './client';

export const recruitmentApi = {
  // Step 1: Letter Templates
  getLetterTemplates: async (params) => {
    try {
      const res = await apiClient.get('/letter-templates', { params });
      return res.data;
    } catch (err) {
      if (err?.response?.status === 403) return { data: [], templates: [] };
      throw err;
    }
  },
  getLetterTemplateById: async (id) => {
    const res = await apiClient.get(`/letter-templates/${id}`);
    return res.data;
  },
  createLetterTemplate: async (data) => {
    const payload = {
      type: data.type || 'JOINING_LETTER',
      title: data.title?.trim() || (data.type === 'JOINING_LETTER' ? 'Official Joining Letter' : 'Appointment Letter'),
      bodyHtml: data.bodyHtml || '<div>Welcome to {{companyName}}</div>',
      company: data.company || undefined,
    };
    const res = await apiClient.post('/letter-templates', payload);
    return res.data;
  },
  updateLetterTemplate: async (id, data) => {
    const res = await apiClient.put(`/letter-templates/${id}`, data);
    return res.data;
  },
  deleteLetterTemplate: async (id) => {
    const res = await apiClient.delete(`/letter-templates/${id}`);
    return res.data;
  },

  // Step 2: Job Openings
  getJobOpenings: async (params) => {
    try {
      const res = await apiClient.get('/job-openings', { params });
      return res.data;
    } catch (err) {
      const status = err?.response?.status;
      // 400/403 = permission/bad-request; 409 = server-side conflict (e.g. duplicate index), handle gracefully
      if (status === 400 || status === 403 || status === 409) return { data: [], jobs: [] };
      throw err;
    }
  },
  getJobOpeningById: async (id) => {
    try {
      const res = await apiClient.get(`/job-openings/${id}`);
      return res.data;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409 || status === 404 || status === 403) return null;
      throw err;
    }
  },
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
    const res = await apiClient.post('/job-openings', payload);
    return res.data;
  },
  updateJobOpening: async (id, data) => {
    const res = await apiClient.put(`/job-openings/${id}`, data);
    return res.data;
  },
  closeJobOpening: async (id) => {
    const res = await apiClient.put(`/job-openings/${id}/close`);
    return res.data;
  },
  deleteJobOpening: async (id) => {
    const res = await apiClient.delete(`/job-openings/${id}`);
    return res.data;
  },

  // Step 3: Candidates
  getCandidates: async (params) => {
    try {
      const res = await apiClient.get('/candidates', { params });
      return res.data;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403 || status === 409 || status === 502 || status === 404 || status === 500) {
        return { data: [], candidates: [] };
      }
      throw err;
    }
  },
  getCandidateById: async (id) => {
    const res = await apiClient.get(`/candidates/${id}`);
    return res.data;
  },
  applyCandidate: async (data) => {
    const fullName = (
      data.fullName ||
      `${data.firstName || ''} ${data.lastName || ''}`.trim() ||
      'Candidate'
    ).trim();

    const mobileNumber = String(data.mobileNumber || data.phone || '').trim();
    const email = String(data.email || '').trim().toLowerCase();
    const jobOpening = data.jobOpening?._id || data.jobOpening;
    const source = data.source || 'JOB_PORTAL';

    const payload = {
      jobOpening,
      fullName,
      mobileNumber,
      email,
      source,
      resumeUrl: data.resumeUrl || undefined,
    };

    const res = await apiClient.post('/candidates', payload);
    return res.data;
  },
  createCandidate: async (data) => {
    return recruitmentApi.applyCandidate(data);
  },
  deleteCandidate: async (id) => {
    const res = await apiClient.delete(`/candidates/${id}`);
    return res.data;
  },

  // Step 4: Update Candidate Pipeline Stage
  updateCandidateStage: async (id, stageOrStatus) => {
    const stageMap = {
      APPLIED: 'APPLIED',
      SHORTLISTED: 'SCREENING',
      SCREENING: 'SCREENING',
      INTERVIEW_SCHEDULED: 'INTERVIEW',
      INTERVIEW_PASSED: 'INTERVIEW',
      INTERVIEW: 'INTERVIEW',
      OFFER_GENERATED: 'OFFER',
      OFFER_ACCEPTED: 'OFFER',
      OFFER: 'OFFER',
      HIRED: 'CONVERTED',
      ONBOARDED: 'CONVERTED',
      CONVERTED: 'CONVERTED',
      REJECTED: 'REJECTED',
      WITHDRAWN: 'WITHDRAWN',
    };
    const stage = stageMap[stageOrStatus] || stageOrStatus;
    const res = await apiClient.put(`/candidates/${id}/stage`, { currentStage: stage });
    return res.data;
  },
  updateCandidateStatus: async (id, status) => {
    return recruitmentApi.updateCandidateStage(id, status);
  },

  // Step 5: Schedule Interview Round / Notes
  scheduleInterview: async (id, interviewData) => {
    const notes = `Round: ${interviewData.roundName || 'Technical Interview'} | Scheduled: ${interviewData.scheduledAt || 'Upcoming'} | Mode: ${interviewData.mode || 'ONLINE'} | Details: ${interviewData.meetingLink || 'N/A'}`;
    const res = await apiClient.put(`/candidates/${id}/interview-notes`, {
      stage: 'INTERVIEW',
      notes,
    });
    return res.data;
  },

  // Step 6: Interview Feedback & Evaluation Notes
  submitInterviewFeedback: async (id, feedbackData) => {
    const notes = `Feedback Rating: ${feedbackData.score || 5}/10 | Verdict: ${feedbackData.status || 'PASSED'} | Evaluation: ${feedbackData.feedback || 'Completed evaluation'}`;
    const res = await apiClient.put(`/candidates/${id}/interview-notes`, {
      stage: 'INTERVIEW',
      notes,
    });
    return res.data;
  },

  // Step 7: Update Offer Details & Acceptance
  generateOffer: async (id, offerData) => {
    const payload = {
      designation: offerData.designation?._id || offerData.designation || undefined,
      department: offerData.department?._id || offerData.department || undefined,
      branch: offerData.branch?._id || offerData.branch || undefined,
      dateOfJoining: offerData.joiningDate || offerData.dateOfJoining || undefined,
      probationPeriodMonths: Number(offerData.probationPeriodMonths) || 3,
      accepted: false,
    };
    const res = await apiClient.put(`/candidates/${id}/offer`, payload);
    return res.data;
  },

  // Step 8: Accept Offer
  acceptOffer: async (id, offerData = {}) => {
    const payload = {
      ...offerData,
      accepted: true,
    };
    const res = await apiClient.put(`/candidates/${id}/offer`, payload);
    return res.data;
  },

  // Step 9: 1-Click Convert Candidate to Active Employee
  onboardCandidate: async (id, onboardingData = {}) => {
    const res = await apiClient.put(`/candidates/${id}/convert`, onboardingData);
    return res.data;
  },
  convertCandidateToEmployee: async (id, onboardingData = {}) => {
    return recruitmentApi.onboardCandidate(id, onboardingData);
  },

  // Attach Joining & Appointment Letters
  generateOnboardingLetters: async (id, letterData = {}) => {
    const res = await apiClient.put(`/candidates/${id}/onboarding/generate-letters`, letterData);
    return res.data;
  },
};

export default recruitmentApi;
