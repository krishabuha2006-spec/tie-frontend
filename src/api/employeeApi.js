import apiClient from './client';

export const employeeApi = {
  // GET /employees - List employees with filters (search, branch, department, status, workType, page, limit)
  getEmployees: async (params = {}) => {
    try {
      const cleanParams = {};
      if (params) {
        Object.keys(params).forEach((k) => {
          if (params[k] !== '' && params[k] !== null && params[k] !== undefined) {
            cleanParams[k] = params[k];
          }
        });
      }
      const res = await apiClient.get('/employees', { params: cleanParams });
      return res.data;
    } catch (err) {
      if (err.response?.status === 403) {
        // Scoped non-HR user fallback to current user's profile
        const saved = localStorage.getItem('tie_user');
        if (saved) {
          try {
            const u = JSON.parse(saved);
            const selfEmp = u.employee || (u._id ? { _id: u._id, fullName: u.name || 'Current User', basicInfo: { fullName: u.name }, employeeCode: u.employeeCode || 'SELF' } : null);
            return { data: selfEmp ? [selfEmp] : [], employees: selfEmp ? [selfEmp] : [] };
          } catch {}
        }
        return { data: [], employees: [] };
      }
      if (err.response?.status === 400) {
        console.warn('Employees filter error 400, returning empty list fallback:', err);
        return { data: [], employees: [] };
      }
      throw err;
    }
  },

  // GET /employees/:id - Full employee profile by ID
  getEmployeeById: async (id) => {
    const res = await apiClient.get(`/employees/${id}`);
    return res.data;
  },

  // POST /employees - Create employee & auto-link login user (Supports both structured and flat schemas)
  createEmployee: async (data) => {
    let payload = data;
    const getObjectId = (v) => (v && typeof v === 'object' ? v._id || v.id : v) || undefined;

    // Map flat form input to exact Module 2 / Swagger specification if not already structured
    if (!data.basicInfo && (data.firstName || data.email)) {
      const photoVal = data.photo || data.photograph || data.avatar || undefined;
      const basicInfo = {
        employeeCode: data.employeeCode?.trim() || `EMP-${Date.now().toString().slice(-4)}`,
        fullName: data.fullName?.trim() || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
        photograph: photoVal,
        photo: photoVal,
        mobileNumber: data.phone || data.mobileNumber || undefined,
        alternateNumber: data.alternateNumber || undefined,
        email: data.email?.trim(),
        gender: data.gender || 'MALE',
        dateOfBirth: data.dateOfBirth ? String(data.dateOfBirth).split('T')[0] : '1995-01-01',
        bloodGroup: data.bloodGroup || undefined,
        maritalStatus: data.maritalStatus || undefined,
      };

      const employmentInfo = {
        department: getObjectId(data.department),
        designation: getObjectId(data.designation),
        branch: getObjectId(data.branch),
        dateOfJoining: data.dateOfJoining ? String(data.dateOfJoining).split('T')[0] : new Date().toISOString().split('T')[0],
        employmentType: data.employmentType || 'FULL_TIME',
        shift: data.shift || 'GENERAL',
        employeeRole: getObjectId(data.employeeRole || data.role),
        employeeStatus: data.employeeStatus || data.status || 'ACTIVE',
        workType: data.workType || 'OFFICE',
        dutyHours: data.dutyHours ? Number(data.dutyHours) : 8,
        // Only pass salaryStructure if it's a valid ObjectId reference string, not an object
        salaryStructure: (data.salaryStructure && typeof data.salaryStructure === 'string')
          ? data.salaryStructure
          : (data.salaryStructureId && typeof data.salaryStructureId === 'string'
            ? data.salaryStructureId
            : undefined),
        salaryDetails: {
          basicSalary: Number(data.salaryBasic) || 0,
          hra: Number(data.salaryHra) || 0,
          da: Number(data.salaryDa) || 0,
          grossSalary: Number(data.salaryGross) || 0,
        },
      };

      if (data.reportingManager && /^[0-9a-fA-F]{24}$/.test(String(data.reportingManager))) {
        employmentInfo.reportingManager = String(data.reportingManager);
      }

      payload = {
        company: getObjectId(data.company),
        initialPassword: data.initialPassword?.trim() || undefined,
        basicInfo,
        employmentInfo,
      };

      // Clean government details
      const cleanGov = {};
      if (data.aadhaarNumber?.trim()) cleanGov.aadhaarNumber = data.aadhaarNumber.trim();
      if (data.panNumber?.trim()) cleanGov.panNumber = data.panNumber.trim().toUpperCase();
      if (data.pfNumber?.trim()) cleanGov.pfNumber = data.pfNumber.trim();
      if (data.esicNumber?.trim()) cleanGov.esicNumber = data.esicNumber.trim();
      if (data.uanNumber?.trim()) cleanGov.uanNumber = data.uanNumber.trim();
      if (data.professionalTaxInfo?.trim() || data.ptNumber?.trim()) {
        cleanGov.professionalTaxInfo = (data.professionalTaxInfo || data.ptNumber).trim();
      }

      const bankDetails = {};
      if (data.accountNumber?.trim()) bankDetails.accountNumber = data.accountNumber.trim();
      if (data.ifscCode?.trim()) bankDetails.ifscCode = data.ifscCode.trim().toUpperCase();
      if (data.bankName?.trim()) bankDetails.bankName = data.bankName.trim();
      if (data.bankBranch?.trim()) bankDetails.branchName = data.bankBranch.trim();
      if (Object.keys(bankDetails).length > 0) cleanGov.bankAccountDetails = bankDetails;

      if (Object.keys(cleanGov).length > 0) {
        payload.governmentDetails = cleanGov;
      }

      // Emergency contact
      const cName = data.emergencyName?.trim() || data.contactName?.trim() || data.emergencyContact?.contactName?.trim() || data.emergencyContact?.name?.trim();
      const cRel = data.emergencyRelationship?.trim() || data.relationship?.trim() || data.emergencyContact?.relationship?.trim();
      const cPhone = data.emergencyPhone?.trim() || data.mobileNumber?.trim() || data.emergencyContact?.mobileNumber?.trim() || data.emergencyContact?.phone?.trim();

      if (cName || cPhone) {
        payload.emergencyContact = {
          contactName: cName || 'Primary Contact',
          relationship: cRel || 'Family',
          mobileNumber: cPhone || '',
          name: cName || 'Primary Contact',
          phone: cPhone || '',
        };
      }

      // Pre-attached document links if provided
      const docs = data.documents || [
        ...(data.joiningLetterUrl ? [{ type: 'JOINING_LETTER', title: 'Joining Letter', fileUrl: data.joiningLetterUrl }] : []),
        ...(data.appointmentLetterUrl ? [{ type: 'APPOINTMENT_LETTER', title: 'Appointment Letter', fileUrl: data.appointmentLetterUrl }] : []),
        ...(data.resignationLetterUrl ? [{ type: 'RESIGNATION_LETTER', title: 'Resignation Letter', fileUrl: data.resignationLetterUrl }] : []),
        ...(data.experienceLetterUrl ? [{ type: 'EXPERIENCE_LETTER', title: 'Experience Letter', fileUrl: data.experienceLetterUrl }] : []),
      ];
      if (docs.length > 0) {
        payload.documents = docs;
      }
    }

    const res = await apiClient.post('/employees', payload);
    return res.data;
  },

  // PUT /employees/:id - Update full employee profile & sync user
  updateEmployee: async (id, data) => {
    const res = await apiClient.put(`/employees/${id}`, data);
    return res.data;
  },

  // DELETE /employees/:id - Delete employee
  deleteEmployee: async (id) => {
    const res = await apiClient.delete(`/employees/${id}`);
    return res.data;
  },

  // GET /employees/:id/reports - Get direct reports
  getDirectReports: async (id) => {
    const res = await apiClient.get(`/employees/${id}/reports`);
    return res.data;
  },

  // PUT /employees/:id/basic-info - Update Basic Information
  updateBasicInfo: async (id, data) => {
    const payload = { ...data };
    if (payload.dateOfBirth) {
      payload.dateOfBirth = String(payload.dateOfBirth).split('T')[0];
    }
    const photoVal = payload.photograph || payload.photo || undefined;
    if (photoVal) {
      payload.photograph = photoVal;
      payload.photo = photoVal;
    }
    const res = await apiClient.put(`/employees/${id}/basic-info`, payload);
    return res.data;
  },

  // PUT /employees/:id/employment-info - Update Employment Information
  updateEmploymentInfo: async (id, data) => {
    // Helper to get raw 24-char ObjectId string
    const getValidId = (v) => {
      if (!v) return undefined;
      const str = typeof v === 'object' ? v._id || v.id : String(v);
      return /^[0-9a-fA-F]{24}$/.test(str) ? str : undefined;
    };

    // Helper to extract clean date YYYY-MM-DD
    const getCleanDate = (d) => {
      if (!d) return '2024-01-01';
      try {
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
      } catch {}
      return String(d).split('T')[0] || '2024-01-01';
    };

    // Pre-fetch current employee to guarantee valid company, branch, and role context
    let currentEmp = null;
    try {
      const empRes = await apiClient.get(`/employees/${id}`);
      currentEmp = empRes.data?.data || empRes.data;
    } catch (e) {
      console.warn('Could not pre-fetch current employee:', e);
    }
    const curEm = currentEmp?.employmentInfo || {};

    // Resolve Branch safely
    let branchVal = getValidId(data.branch) || getValidId(curEm.branch);

    // Resolve Role safely
    let roleVal = getValidId(data.employeeRole) || getValidId(curEm.employeeRole);

    // Resolve Department & Designation
    const deptVal = typeof data.department === 'object' ? data.department?._id || data.department?.name : String(data.department || curEm.department || '');
    const desigVal = typeof data.designation === 'object' ? data.designation?._id || data.designation?.title || data.designation?.name : String(data.designation || curEm.designation || '');

    // Employment type & work type enum normalization
    const empType = String(data.employmentType || curEm.employmentType || 'FULL_TIME').toUpperCase().replace(/\s+/g, '_');
    const validEmpTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'];
    const safeEmpType = validEmpTypes.includes(empType) ? empType : 'FULL_TIME';

    const workType = String(data.workType || curEm.workType || 'OFFICE').toUpperCase().replace(/\s+/g, '_');
    const validWorkTypes = ['OFFICE', 'FIELD', 'SITE', 'HYBRID'];
    const safeWorkType = validWorkTypes.includes(workType) ? workType : 'OFFICE';

    const clean = {
      department: deptVal || (typeof curEm.department === 'string' ? curEm.department : curEm.department?.name || 'General'),
      designation: desigVal || (typeof curEm.designation === 'string' ? curEm.designation : curEm.designation?.title || 'Staff'),
      branch: branchVal || (typeof curEm.branch === 'string' ? curEm.branch : curEm.branch?._id),
      dateOfJoining: getCleanDate(data.dateOfJoining || curEm.dateOfJoining),
      employmentType: safeEmpType,
      employeeRole: roleVal || (typeof curEm.employeeRole === 'string' ? curEm.employeeRole : curEm.employeeRole?._id),
      workType: safeWorkType,
      shift: data.shift || curEm.shift || 'GENERAL',
      dutyHours: Number(data.dutyHours || curEm.dutyHours) || 8,
    };

    if (data.reportingManager && /^[0-9a-fA-F]{24}$/.test(String(data.reportingManager)) && String(data.reportingManager) !== String(id)) {
      clean.reportingManager = String(data.reportingManager);
    }

    // Strategy 1: Standard PUT /employees/:id/employment-info with normalized payload
    try {
      const res = await apiClient.put(`/employees/${id}/employment-info`, clean);
      return res.data;
    } catch (err1) {
      console.warn('Strategy 1 (/employees/:id/employment-info) rejected with:', err1.response?.status, err1.response?.data?.message);

      // Strategy 2: If branch error, auto-heal with existing company branch
      if (err1.response?.data?.message?.includes('Branch does not exist or does not belong to this company') || err1.response?.status === 400) {
        if (curEm.branch) {
          clean.branch = typeof curEm.branch === 'object' ? curEm.branch._id : String(curEm.branch);
        }
      }

      // Strategy 3: Try full profile update endpoint PUT /employees/:id with { employmentInfo: clean }
      try {
        const res2 = await apiClient.put(`/employees/${id}`, { employmentInfo: clean });
        return res2.data;
      } catch (err2) {
        console.warn('Strategy 3 (/employees/:id full profile) rejected with:', err2.response?.status, err2.response?.data?.message);
      }

      // Strategy 4: If department or designation was ObjectId, try resolving to department name & designation name
      if (/^[0-9a-fA-F]{24}$/.test(clean.department) || /^[0-9a-fA-F]{24}$/.test(clean.designation)) {
        try {
          const [deptRes, desigRes] = await Promise.allSettled([
            apiClient.get('/departments'),
            apiClient.get('/designations'),
          ]);
          const depts = deptRes.status === 'fulfilled' ? (deptRes.value.data?.departments || deptRes.value.data?.data || []) : [];
          const desigs = desigRes.status === 'fulfilled' ? (desigRes.value.data?.designations || desigRes.value.data?.data || []) : [];

          const foundDept = depts.find((d) => d._id === clean.department);
          const foundDesig = desigs.find((d) => d._id === clean.designation);

          const namePayload = {
            ...clean,
            department: foundDept?.name || clean.department,
            designation: foundDesig?.title || foundDesig?.name || clean.designation,
          };

          const res4 = await apiClient.put(`/employees/${id}/employment-info`, namePayload);
          return res4.data;
        } catch (err4) {
          console.warn('Strategy 4 (department/designation names) rejected with:', err4.response?.status, err4.response?.data?.message);
        }
      }

      // If all strategies fail, re-throw original error
      throw err1;
    }
  },

  // PUT /employees/:id/government-details - Update Government & Bank Details
  updateGovernmentDetails: async (id, data) => {
    const clean = {};
    if (data.aadhaarNumber !== undefined && data.aadhaarNumber !== '') clean.aadhaarNumber = String(data.aadhaarNumber).trim();
    if (data.panNumber !== undefined && data.panNumber !== '') clean.panNumber = String(data.panNumber).trim().toUpperCase();
    if (data.pfNumber !== undefined && data.pfNumber !== '') clean.pfNumber = String(data.pfNumber).trim();
    if (data.esicNumber !== undefined && data.esicNumber !== '') clean.esicNumber = String(data.esicNumber).trim();
    if (data.uanNumber !== undefined && data.uanNumber !== '') clean.uanNumber = String(data.uanNumber).trim();
    if (data.professionalTaxInfo !== undefined && data.professionalTaxInfo !== '') clean.professionalTaxInfo = String(data.professionalTaxInfo).trim();

    if (data.bankAccountDetails && typeof data.bankAccountDetails === 'object') {
      const b = {};
      if (data.bankAccountDetails.accountNumber) b.accountNumber = String(data.bankAccountDetails.accountNumber).trim();
      if (data.bankAccountDetails.ifscCode) b.ifscCode = String(data.bankAccountDetails.ifscCode).trim().toUpperCase();
      if (data.bankAccountDetails.bankName) b.bankName = String(data.bankAccountDetails.bankName).trim();
      if (data.bankAccountDetails.branchName) b.branchName = String(data.bankAccountDetails.branchName).trim();
      if (Object.keys(b).length > 0) clean.bankAccountDetails = b;
    }
    const res = await apiClient.put(`/employees/${id}/government-details`, clean);
    return res.data;
  },

  // PUT /employees/:id/emergency-contact - Update Emergency Contact (Swagger Module 2 schema)
  updateEmergencyContact: async (id, data) => {
    const cName = data?.contactName || data?.name || '';
    const cRel = data?.relationship || '';
    const cPhone = data?.mobileNumber || data?.phone || '';
    const payload = {
      contactName: cName,
      relationship: cRel,
      mobileNumber: cPhone,
      name: cName,
      phone: cPhone,
    };
    const res = await apiClient.put(`/employees/${id}/emergency-contact`, payload);
    return res.data;
  },

  // PUT /employees/:id/status - Update Employee Status
  updateStatus: async (id, employeeStatus) => {
    const statusVal = typeof employeeStatus === 'object' ? employeeStatus?.employeeStatus : employeeStatus;
    const res = await apiClient.put(`/employees/${id}/status`, { employeeStatus: statusVal });
    return res.data;
  },

  // PUT /employees/:id/deactivate - Deactivate employee
  deactivateEmployee: async (id) => {
    const res = await apiClient.put(`/employees/${id}/deactivate`);
    return res.data;
  },

  // GET /employees/:id/documents - Get employee documents
  getDocuments: async (id) => {
    const res = await apiClient.get(`/employees/${id}/documents`);
    return res.data;
  },

  // POST /employees/:id/documents - Upload / attach employee document
  uploadDocument: async (id, docData) => {
    const isFormData = typeof FormData !== 'undefined' && docData instanceof FormData;
    let payload = docData;
    if (!isFormData && typeof docData === 'object' && docData !== null) {
      const type = docData.type || docData.documentType || 'OTHER';
      const fileUrl = docData.fileUrl || docData.documentUrl || '';
      const title = docData.title || (docData.documentType ? docData.documentType.replace(/_/g, ' ') : 'Employee Document');
      payload = {
        ...docData,
        documentType: docData.documentType || type,
        documentUrl: docData.documentUrl || fileUrl,
        type,
        fileUrl,
        title,
      };
    }
    const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const res = await apiClient.post(`/employees/${id}/documents`, payload, config);
    return res.data;
  },

  // DELETE /employees/:id/documents/:docIndex - Delete employee document
  deleteDocument: async (id, docIndex) => {
    const res = await apiClient.delete(`/employees/${id}/documents/${docIndex}`);
    return res.data;
  },

  // Aliases for unified consistency across masterApi and employeeApi
  getEmployeeDocuments: async (id) => {
    const res = await apiClient.get(`/employees/${id}/documents`);
    return res.data;
  },
  uploadEmployeeDocument: async (id, docData) => {
    const isFormData = typeof FormData !== 'undefined' && docData instanceof FormData;
    const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const res = await apiClient.post(`/employees/${id}/documents`, docData, config);
    return res.data;
  },
  deleteEmployeeDocument: async (id, docIndex) => {
    const res = await apiClient.delete(`/employees/${id}/documents/${docIndex}`);
    return res.data;
  },
};

export default employeeApi;

