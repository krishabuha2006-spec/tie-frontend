/**
 * Universal API Response Normalizer
 * Robustly extracts array data, paginated items, or single entities
 * regardless of whether the backend returns:
 * - Direct array: [ ... ]
 * - Standard envelope: { success: true, data: [ ... ] }
 * - Named property in data: { success: true, data: { companies: [ ... ], pagination: { ... } } }
 * - Direct named property: { success: true, companies: [ ... ] }
 * - Mongoose pagination: { success: true, data: { docs: [ ... ], totalDocs: 10 } }
 */

export const extractApiData = (res, ...fallbackKeys) => {
  if (!res) return [];
  if (Array.isArray(res)) return res;

  // 1. Direct res.data array
  if (Array.isArray(res?.data)) return res.data;

  // 2. Named keys inside res.data (e.g. res.data.companies, res.data.employees)
  if (res?.data && typeof res.data === 'object') {
    for (const key of fallbackKeys) {
      if (Array.isArray(res.data[key])) return res.data[key];
    }
  }

  // 3. Named keys on root res (e.g. res.companies, res.employees, res.branches)
  if (typeof res === 'object') {
    for (const key of fallbackKeys) {
      if (Array.isArray(res[key])) return res[key];
    }
  }

  // 4. Common pagination containers & known backend resource keys
  const commonKeys = [
    'items', 'docs', 'list', 'records', 'results', 'rows',
    'projects', 'tasks', 'holidays', 'leaveTypes', 'leaveRequests', 'pendingRequests',
    'assets', 'claims', 'employees', 'users', 'companies', 'branches', 'departments',
    'designations', 'roles', 'candidates', 'runs', 'payslips', 'configs'
  ];
  if (res?.data && typeof res.data === 'object') {
    for (const ck of commonKeys) {
      if (Array.isArray(res.data[ck])) return res.data[ck];
    }
  }
  for (const ck of commonKeys) {
    if (Array.isArray(res[ck])) return res[ck];
  }

  // 5. Fallback: discover any array property in res.data
  if (res?.data && typeof res.data === 'object') {
    for (const val of Object.values(res.data)) {
      if (Array.isArray(val)) return val;
    }
  }

  // 6. Fallback: discover any array property in res
  if (typeof res === 'object') {
    for (const val of Object.values(res)) {
      if (Array.isArray(val)) return val;
    }
  }

  return [];
};

/**
 * Universal Single Entity Extractor
 * Extracts single object from responses like:
 * { success: true, data: { ... } } or { data: { company: { ... } } }
 */
export const extractApiEntity = (res, entityKey) => {
  if (!res) return null;
  if (entityKey && res[entityKey] && typeof res[entityKey] === 'object' && !Array.isArray(res[entityKey])) {
    return res[entityKey];
  }
  if (entityKey && res.data && typeof res.data === 'object' && res.data[entityKey]) {
    return res.data[entityKey];
  }
  if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
    return res.data;
  }
  if (typeof res === 'object' && !Array.isArray(res)) {
    return res;
  }
  return null;
};
