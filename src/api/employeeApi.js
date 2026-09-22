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
      payload = {
        company: getObjectId(data.company),
        initialPassword: data.initialPassword || undefined,
        basicInfo: {
          employeeCode: data.employeeCode || `EMP-${Date.now().toString().slice(-4)}`,
          fullName: data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
          photo: data.photo || data.avatar || undefined,
          mobileNumber: data.phone || data.mobileNumber || undefined,
          alternateNumber: data.alternateNumber || undefined,
          email: data.email,
          gender: data.gender || 'MALE',
          dateOfBirth: data.dateOfBirth || '1995-01-01',
          bloodGroup: data.bloodGroup || undefined,
          maritalStatus: data.maritalStatus || undefined,
        },
        employmentInfo: {
          department: getObjectId(data.department),
          designation: getObjectId(data.designation),
          branch: getObjectId(data.branch),
          reportingManager: getObjectId(data.reportingManager) || null,
          dateOfJoining: data.dateOfJoining || new Date().toISOString().split('T')[0],
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
          // Store raw salary components in a separate field (not the ObjectId ref field)
          salaryDetails: {
            basicSalary: Number(data.salaryBasic) || 0,
            hra: Number(data.salaryHra) || 0,
            da: Number(data.salaryDa) || 0,
            grossSalary: Number(data.salaryGross) || 0,
          },
        },
        governmentDetails: {
          aadhaarNumber: data.aadhaarNumber || data.governmentDetails?.aadhaarNumber || '',
          panNumber: data.panNumber || data.governmentDetails?.panNumber || '',
          pfNumber: data.pfNumber || data.governmentDetails?.pfNumber || '',
          esicNumber: data.esicNumber || data.governmentDetails?.esicNumber || '',
          uanNumber: data.uanNumber || data.governmentDetails?.uanNumber || '',
          professionalTaxInfo: data.professionalTaxInfo || data.ptNumber || data.professionalTax || '',
          bankAccountDetails: data.bankAccountDetails || data.governmentDetails?.bankAccountDetails || {
            accountNumber: data.accountNumber || '',
            ifscCode: data.ifscCode || '',
            bankName: data.bankName || '',
            branchName: data.bankBranch || '',
          },
        },
        emergencyContact: {
          name: data.emergencyName || data.emergencyContact?.name || '',
          relationship: data.emergencyRelationship || data.emergencyContact?.relationship || '',
          phone: data.emergencyPhone || data.emergencyContact?.phone || '',
        },
        documents: data.documents || [
          ...(data.joiningLetterUrl ? [{ type: 'JOINING_LETTER', title: 'Joining Letter', fileUrl: data.joiningLetterUrl }] : []),
          ...(data.appointmentLetterUrl ? [{ type: 'APPOINTMENT_LETTER', title: 'Appointment Letter', fileUrl: data.appointmentLetterUrl }] : []),
          ...(data.resignationLetterUrl ? [{ type: 'RESIGNATION_LETTER', title: 'Resignation Letter', fileUrl: data.resignationLetterUrl }] : []),
          ...(data.experienceLetterUrl ? [{ type: 'EXPERIENCE_LETTER', title: 'Experience Letter', fileUrl: data.experienceLetterUrl }] : []),
        ],
      };
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
    const res = await apiClient.put(`/employees/${id}/basic-info`, data);
    return res.data;
  },

  // PUT /employees/:id/employment-info - Update Employment Information
  updateEmploymentInfo: async (id, data) => {
    // Ensure all Swagger Module 2 required fields are present and clean
    const normalizePayload = (input) => {
      const p = {
        department: typeof input.department === 'object' ? input.department?.name || input.department?._id : String(input.department || 'General'),
        designation: typeof input.designation === 'object' ? input.designation?.name || input.designation?.title : String(input.designation || 'Staff'),
        branch: typeof input.branch === 'object' ? input.branch?._id || input.branch?.id : String(input.branch || ''),
        dateOfJoining: input.dateOfJoining ? String(input.dateOfJoining).split('T')[0] : '2024-01-01',
        employmentType: input.employmentType || 'FULL_TIME',
        employeeRole: typeof input.employeeRole === 'object' ? input.employeeRole?._id : String(input.employeeRole || ''),
        workType: input.workType || 'OFFICE',
        shift: input.shift || 'GENERAL',
        dutyHours: Number(input.dutyHours) || 8,
      };
      if (input.reportingManager && input.reportingManager !== '') {
        p.reportingManager = typeof input.reportingManager === 'object' ? input.reportingManager?._id : input.reportingManager;
      }
      return p;
    };

    const clean = normalizePayload(data || {});
    try {
      const res = await apiClient.put(`/employees/${id}/employment-info`, clean);
      return res.data;
    } catch (err) {
      if (err.response?.status === 400) {
        // Retry with raw data stripped of empty keys
        const fallback = { ...data };
        Object.keys(fallback).forEach((k) => (fallback[k] === '' || fallback[k] === undefined) && delete fallback[k]);
        if (!fallback.employeeRole) fallback.employeeRole = clean.employeeRole;
        if (!fallback.dateOfJoining) fallback.dateOfJoining = clean.dateOfJoining;
        const retryRes = await apiClient.put(`/employees/${id}/employment-info`, fallback);
        return retryRes.data;
      }
      throw err;
    }
  },

  // PUT /employees/:id/government-details - Update Government & Bank Details
  updateGovernmentDetails: async (id, data) => {
    const res = await apiClient.put(`/employees/${id}/government-details`, data);
    return res.data;
  },

  // PUT /employees/:id/emergency-contact - Update Emergency Contact
  updateEmergencyContact: async (id, data) => {
    const res = await apiClient.put(`/employees/${id}/emergency-contact`, data);
    return res.data;
  },

  // PUT /employees/:id/status - Update Employee Status
  updateStatus: async (id, employeeStatus) => {
    const res = await apiClient.put(`/employees/${id}/status`, { employeeStatus });
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
