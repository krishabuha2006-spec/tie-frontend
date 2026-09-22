/**
 * Utility functions for consistent employee data handling across all modules.
 * Handles diverse employee schema shapes:
 * - Swagger / Production schema: emp.basicInfo.fullName, emp.basicInfo.employeeCode
 * - Flat / Legacy schema: emp.firstName + emp.lastName, emp.fullName, emp.name, emp.employeeCode
 * - Populated user link: emp.user.name, emp.user.email
 */

export const getEmployeeName = (emp) => {
  if (!emp) return 'Employee';
  if (typeof emp === 'string') return emp;
  return (
    emp.basicInfo?.fullName ||
    emp.fullName ||
    (emp.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : '') ||
    emp.name ||
    emp.user?.name ||
    emp.basicInfo?.email ||
    emp.email ||
    'Employee'
  );
};

export const getEmployeeCode = (emp) => {
  if (!emp || typeof emp === 'string') return '-';
  return (
    emp.basicInfo?.employeeCode ||
    emp.employeeCode ||
    emp.code ||
    '-'
  );
};

export const getEmployeeDept = (emp) => {
  if (!emp || typeof emp === 'string') return '';
  return (
    emp.employmentInfo?.department?.name ||
    emp.department?.name ||
    (typeof emp.department === 'string' ? emp.department : '') ||
    ''
  );
};

export const getEmployeeDesignation = (emp) => {
  if (!emp || typeof emp === 'string') return '';
  return (
    emp.employmentInfo?.designation?.title ||
    emp.designation?.title ||
    emp.designation?.name ||
    (typeof emp.designation === 'string' ? emp.designation : '') ||
    ''
  );
};

export const formatEmployeeOption = (emp, includeDept = true) => {
  if (!emp) return 'Employee';
  const name = getEmployeeName(emp);
  const code = getEmployeeCode(emp);
  const dept = includeDept ? getEmployeeDept(emp) : '';

  if (code && code !== '-') {
    return dept ? `${name} (${code}) • ${dept}` : `${name} (${code})`;
  }
  return dept ? `${name} • ${dept}` : name;
};

export const extractEmployeeList = (res) => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.employees)) return res.employees;
  if (Array.isArray(res?.data?.employees)) return res.data.employees;
  return [];
};
