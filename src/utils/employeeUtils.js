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

export const getEmployeeBranch = (emp) => {
  if (!emp || typeof emp === 'string') return '';
  return (
    emp.employmentInfo?.branch?.name ||
    emp.branch?.name ||
    (typeof emp.branch === 'string' ? emp.branch : '') ||
    ''
  );
};

export const filterEmployeesByBranch = (employees = [], branchIdOrName = '') => {
  if (!Array.isArray(employees) || !branchIdOrName || branchIdOrName === 'ALL') {
    return employees;
  }
  const cleanTarget = String(branchIdOrName).trim().toLowerCase();
  return employees.filter((emp) => {
    if (!emp) return false;
    const b = emp.employmentInfo?.branch || emp.branch;
    const bId = String(b?._id || b?.id || (typeof b === 'string' ? b : '')).trim().toLowerCase();
    const bName = String(b?.name || (typeof b === 'string' ? b : '')).trim().toLowerCase();
    return (
      (bId && bId === cleanTarget) ||
      (bName && (bName === cleanTarget || cleanTarget.includes(bName) || bName.includes(cleanTarget)))
    );
  });
};

export const formatEmployeeOption = (emp, includeDept = true, includeBranch = false) => {
  if (!emp) return 'Employee';
  const name = getEmployeeName(emp);
  const code = getEmployeeCode(emp);
  const dept = includeDept ? getEmployeeDept(emp) : '';
  const branch = includeBranch ? getEmployeeBranch(emp) : '';

  const details = [];
  if (code && code !== '-') details.push(code);
  if (dept) details.push(dept);
  if (branch) details.push(branch);

  if (details.length > 0) {
    return `${name} (${details.join(' • ')})`;
  }
  return name;
};

export const extractEmployeeList = (res) => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.employees)) return res.employees;
  if (Array.isArray(res?.data?.employees)) return res.data.employees;
  return [];
};

