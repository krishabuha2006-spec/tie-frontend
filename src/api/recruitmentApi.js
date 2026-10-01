import apiClient from './client';

export const recruitmentApi = {
  // Step 1: Letter Templates (Pure API)
  getLetterTemplates: async (params) => {
    const res = await apiClient.get('/letter-templates', { params });
    return res.data;
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
      isActive: data.isActive !== false,
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    const res = await apiClient.post('/letter-templates', payload);
    return res.data;
  },
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
  deleteLetterTemplate: async (id) => {
    const res = await apiClient.delete(`/letter-templates/${id}`);
    return res.data;
  },

  // Step 2: Job Openings (Pure API)
  getJobOpenings: async (params) => {
    const res = await apiClient.get('/job-openings', { params });
    return res.data;
  },
  getJobOpeningById: async (id) => {
    const res = await apiClient.get(`/job-openings/${id}`);
    return res.data;
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

    // Strip undefined properties
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    const res = await apiClient.put(`/job-openings/${id}`, payload);
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
    const res = await apiClient.get('/candidates', { params });
    return res.data;
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
    const validSources = ['REFERRAL', 'JOB_PORTAL', 'WALK_IN', 'OTHER'];
    let source = data.source || 'JOB_PORTAL';
    if (!validSources.includes(source)) {
      if (['CAREERS_PAGE', 'DIRECT', 'WALK_IN'].includes(source)) {
        source = 'WALK_IN';
      } else if (['CAMPUS', 'AGENCY'].includes(source)) {
        source = 'OTHER';
      } else {
        source = 'JOB_PORTAL';
      }
    }

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
    // Backend doesn't expose DELETE /candidates/:id route in Swagger; withdraw via PUT /stage
    return recruitmentApi.updateCandidateStage(id, 'WITHDRAWN');
  },

  // Step 4: Update Candidate Pipeline Stage
  updateCandidateStage: async (id, stageOrStatus) => {
    if (stageOrStatus === 'CONVERTED' || stageOrStatus === 'HIRED') {
      return recruitmentApi.convertCandidate(id);
    }
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
      designation: offerData.designation?._id || offerData.designation || undefined,
      department: offerData.department?._id || offerData.department || undefined,
      branch: offerData.branch?._id || offerData.branch || undefined,
      dateOfJoining: offerData.dateOfJoining || offerData.joiningDate || undefined,
      probationPeriodMonths: Number(offerData.probationPeriodMonths) || 3,
      offeredSalary: offerData.offeredSalary !== undefined ? Number(offerData.offeredSalary) : undefined,
      ...offerData,
      accepted: true,
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
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
    try {
      const res = await apiClient.put(`/candidates/${id}/onboarding/generate-letters`, letterData);
      return res.data;
    } catch (err) {
      const errMsg = String(err.response?.data?.message || err.response?.data?.error || '').toLowerCase();
      if (err.response?.status === 400 && errMsg.includes('not converted')) {
        try {
          await apiClient.put(`/candidates/${id}/convert`, {});
          const retryRes = await apiClient.put(`/candidates/${id}/onboarding/generate-letters`, letterData);
          return retryRes.data;
        } catch {
          throw err;
        }
      }
      throw err;
    }
  },
};

export default recruitmentApi;
