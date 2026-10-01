import apiClient from './client';
import { extractApiData } from '../utils/apiUtils';

export const calendarApi = {
  // 1. Unified Organization Calendar Events (GET /calendar/events)
  // Backend schema: startDate, endDate, companyId, branchId
  getEvents: async ({ startDate, endDate, companyId, branchId } = {}) => {
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (companyId) params.companyId = companyId;
      if (branchId) params.branchId = branchId;

      const res = await apiClient.get('/calendar/events', { params });
      return res.data;
    } catch (err) {
      console.warn('Backend /calendar/events request fallback:', err.message);
      return { success: false, events: [] };
    }
  },

  // 2. Personal Office Attendance History (GET /attendance/office/me)
  getMyOfficeAttendance: async ({ from, to, limit = 100 } = {}) => {
    try {
      const res = await apiClient.get('/attendance/office/me', {
        params: { from, to, limit },
      });
      return res.data;
    } catch (err) {
      console.warn('Error fetching my office attendance:', err.message);
      return { success: false, records: [] };
    }
  },

  // 3. Employee Office Attendance History for Managers/Admins (GET /attendance/office/employees/:id)
  getEmployeeOfficeAttendance: async (employeeId, { from, to, limit = 100 } = {}) => {
    if (!employeeId) return { success: false, records: [] };
    try {
      const res = await apiClient.get(`/attendance/office/employees/${employeeId}`, {
        params: { from, to, limit },
      });
      return res.data;
    } catch (err) {
      console.warn(`Error fetching office attendance for ${employeeId}:`, err.message);
      return { success: false, records: [] };
    }
  },

  // 4. Personal Field Attendance (GET /attendance/field/me)
  getMyFieldAttendance: async ({ from, to, limit = 100 } = {}) => {
    try {
      const res = await apiClient.get('/attendance/field/me', {
        params: { from, to, limit },
      });
      return res.data;
    } catch {
      return { success: false, records: [] };
    }
  },

  // 5. Employee Field Attendance for Managers/Admins (GET /attendance/field/employees/:id)
  getEmployeeFieldAttendance: async (employeeId, { from, to, limit = 100 } = {}) => {
    if (!employeeId) return { success: false, records: [] };
    try {
      const res = await apiClient.get(`/attendance/field/employees/${employeeId}`, {
        params: { from, to, limit },
      });
      return res.data;
    } catch {
      return { success: false, records: [] };
    }
  },

  // 6. Corporate Holidays (GET /holidays)
  getHolidays: async ({ year, scope = 'COMPANY' } = {}) => {
    try {
      const params = { scope };
      if (year) params.year = year;
      const res = await apiClient.get('/holidays', { params });
      return res.data;
    } catch {
      return { success: false, data: [] };
    }
  },

  // 7. Weekly-Off Configurations (GET /weekly-off-configs)
  getWeeklyOffConfigs: async () => {
    try {
      const res = await apiClient.get('/weekly-off-configs');
      return res.data;
    } catch {
      return { success: false, data: [] };
    }
  },

  // 8. Personal Leave Requests (GET /leave/requests/me)
  getMyLeaves: async ({ year } = {}) => {
    try {
      const res = await apiClient.get('/leave/requests/me', {
        params: year ? { year } : {},
      });
      return res.data;
    } catch {
      return { success: false, leaveRequests: [] };
    }
  },

  // 9. Employee Leave Requests (GET /leave/requests/employees/:id)
  getEmployeeLeaves: async (employeeId, { year } = {}) => {
    if (!employeeId) return { success: false, leaveRequests: [] };
    try {
      const res = await apiClient.get(`/leave/requests/employees/${employeeId}`, {
        params: year ? { year } : {},
      });
      return res.data;
    } catch {
      return { success: false, leaveRequests: [] };
    }
  },
};

export default calendarApi;
