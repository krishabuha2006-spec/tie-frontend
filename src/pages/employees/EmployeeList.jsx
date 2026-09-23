import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import employeeApi from '../../api/employeeApi';
import masterApi from '../../api/masterApi';
import faceApi from '../../api/faceApi';
import { useToast } from '../../context/ToastContext';
import { validateEmail, validatePhone } from '../../utils/validation';
import { saveRegisteredSelfie } from '../../utils/faceComparison';
import {
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  Filter,
  ScanFace,
  CheckCircle2,
  Clock,
  Camera,
  Save,
  X,
  Upload,
  FileText,
  Users,
  ShieldCheck,
  Building,
  Phone,
  Mail,
  CreditCard,
  HeartHandshake,
  AlertTriangle,
  RefreshCw,
  Landmark,
  Calendar,
  MapPin,
  Briefcase,
  User,
  UserX,
  Copy,
  Check,
} from 'lucide-react';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import CameraCapture from '../../components/common/CameraCapture';

// Designations are dynamically retrieved from backend master API

const extractArray = (res, key) => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (key && Array.isArray(res[key])) return res[key];
  if (key && Array.isArray(res.data?.[key])) return res.data[key];
  if (typeof res === 'object') {
    for (const val of Object.values(res)) {
      if (Array.isArray(val)) return val;
    }
  }
  return [];
};

const formatDepartment = (dept) => {
  if (!dept) return '-';
  if (typeof dept === 'string') return dept;
  return dept.name || dept.title || dept.code || '-';
};

const formatDesignation = (des) => {
  if (!des) return '-';
  if (typeof des === 'string') return des;
  return des.title || des.name || des.code || '-';
};

const formatBranch = (branch) => {
  if (!branch) return '-';
  if (typeof branch === 'string') return branch;
  return branch.name || branch.title || branch.code || '-';
};

const formatDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const DetailCard = ({ title, subtitle, icon: Icon, action, children }) => (
  <div
    style={{
      backgroundColor: '#ffffff',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      padding: '14px 16px',
      marginBottom: '12px',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
    }}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid var(--border-light)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {Icon && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '6px',
              backgroundColor: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <Icon size={15} />
          </div>
        )}
        <div>
          <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>{title}</h4>
          {subtitle && (
            <p style={{ margin: '1px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
    {children}
  </div>
);

const DetailField = ({ label, value, isMono, isBadge, badgeVariant, emptyText = 'Not Provided', icon: Icon, copyable, onEdit }) => {
  const [copied, setCopied] = useState(false);
  const isEmpty = value === undefined || value === null || value === '' || value === '-';

  const handleCopy = (e) => {
    e.stopPropagation();
    if (value) {
      navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      style={{
        padding: '7px 10px',
        backgroundColor: '#f8fafc',
        borderRadius: '6px',
        border: '1px solid #edf2f7',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minHeight: '44px',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          fontSize: '0.67rem',
          textTransform: 'uppercase',
          letterSpacing: '0.4px',
          color: 'var(--text-muted)',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {Icon && <Icon size={11} color="var(--primary)" />}
        {label}
      </span>
      {isEmpty ? (
        <span
          style={{
            color: 'var(--text-light)',
            fontSize: '0.78rem',
            fontStyle: 'italic',
          }}
        >
          {emptyText}
        </span>
      ) : isBadge ? (
        <div style={{ marginTop: 1 }}>
          <Badge variant={badgeVariant || 'primary'} style={{ fontSize: '0.72rem', padding: '2px 7px' }}>
            {value}
          </Badge>
        </div>
      ) : copyable ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 1 }}>
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-main)',
              fontFamily: 'monospace',
              letterSpacing: '0.3px',
              wordBreak: 'break-all',
              lineHeight: 1.25,
            }}
            title={String(value)}
          >
            {value}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy to clipboard'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: 4,
              color: copied ? 'var(--success)' : 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            {copied ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
          </button>
        </div>
      ) : onEdit ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 1 }}>
          <span
            style={{
              fontSize: '0.84rem',
              fontWeight: 600,
              color: 'var(--text-main)',
              fontFamily: isMono ? 'monospace' : 'inherit',
              letterSpacing: isMono ? '0.3px' : 'normal',
              wordBreak: 'break-word',
              lineHeight: 1.25,
            }}
          >
            {value}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title={`Edit ${label}`}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: 4,
              color: 'var(--primary)',
              display: 'inline-flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <Edit2 size={13} />
          </button>
        </div>
      ) : (
        <span
          style={{
            fontSize: '0.84rem',
            fontWeight: 600,
            color: 'var(--text-main)',
            fontFamily: isMono ? 'monospace' : 'inherit',
            letterSpacing: isMono ? '0.3px' : 'normal',
            wordBreak: 'break-word',
            lineHeight: 1.25,
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
};

export const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search and Filter states
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedWorkType, setSelectedWorkType] = useState('');

  // Master Data
  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [roles, setRoles] = useState([]);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Add Employee Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createTab, setCreateTab] = useState('basic'); // 'basic' | 'employment' | 'government' | 'emergency' | 'documents'

  const initialEmpState = {
    employeeCode: '',
    photo: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    alternateNumber: '',
    gender: 'MALE',
    dateOfBirth: '',
    bloodGroup: '',
    maritalStatus: '',
    company: '',
    branch: '',
    department: '',
    designation: '',
    employeeRole: '',
    reportingManager: '',
    employmentType: 'FULL_TIME',
    workType: 'OFFICE',
    shift: 'GENERAL',
    dutyHours: 8,
    employeeStatus: 'ACTIVE',
    salaryBasic: '',
    salaryHra: '',
    salaryDa: '',
    salaryGross: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
    initialPassword: '',
    aadhaarNumber: '',
    panNumber: '',
    pfNumber: '',
    esicNumber: '',
    uanNumber: '',
    ptNumber: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    bankBranch: '',
    emergencyName: '',
    emergencyRelationship: '',
    emergencyPhone: '',
    joiningLetterUrl: '',
    appointmentLetterUrl: '',
    resignationLetterUrl: '',
    experienceLetterUrl: '',
  };
  const [newEmp, setNewEmp] = useState(initialEmpState);

  // Profile Details & Edit Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [currentEmployeeDetail, setCurrentEmployeeDetail] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [editSection, setEditSection] = useState(null); // 'basic' | 'employment' | 'government' | 'emergency'
  const [editFormData, setEditFormData] = useState({});
  const [savingSection, setSavingSection] = useState(false);

  // Documents State
  const [employeeDocs, setEmployeeDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [newDocData, setNewDocData] = useState({
    type: 'JOINING_LETTER',
    title: '',
    fileUrl: '',
    file: null,
  });
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Profile Photo state for Add Employee Modal (Tab 1)
  const [showPhotoUrlInput, setShowPhotoUrlInput] = useState(false);
  const [showCameraInAddForm, setShowCameraInAddForm] = useState(false);

  const handlePhotoSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, WebP)', 'warning');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size must be under 5MB', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setNewEmp((prev) => ({ ...prev, photo: dataUrl }));
      showToast('Profile photo attached!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoRemove = () => {
    setNewEmp((prev) => ({ ...prev, photo: '' }));
  };

  // Documents state for Add Employee Modal (Tab 5)
  const [docFiles, setDocFiles] = useState({
    JOINING_LETTER: null,
    APPOINTMENT_LETTER: null,
    RESIGNATION_LETTER: null,
    EXPERIENCE_LETTER: null,
  });

  const handleDocFileSelect = (fieldKey, type, file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('File size must be under 10MB', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setNewEmp((prev) => ({
        ...prev,
        [fieldKey]: dataUrl,
      }));
      setDocFiles((prev) => ({
        ...prev,
        [type]: {
          file,
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
        },
      }));
      showToast(`${file.name} attached!`, 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleDocFileRemove = (fieldKey, type) => {
    setNewEmp((prev) => ({
      ...prev,
      [fieldKey]: '',
    }));
    setDocFiles((prev) => ({
      ...prev,
      [type]: null,
    }));
  };

  // Direct Reports State
  const [directReports, setDirectReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Face Enrollment Modal
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [employeeToEnroll, setEmployeeToEnroll] = useState(null);
  const [capturedFace, setCapturedFace] = useState(null);
  const [enrolling, setEnrolling] = useState(false);

  // Delete & Status & Deactivation Confirmations
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [employeeToDeactivate, setEmployeeToDeactivate] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [employeeToStatus, setEmployeeToStatus] = useState(null);
  const [targetStatus, setTargetStatus] = useState('ACTIVE');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const { showToast } = useToast();
  const navigate = useNavigate();
  const { isSuperAdmin, isHrAdmin } = useAuth();
  const canEnrollFace = isSuperAdmin || isHrAdmin;

  // Robust Designation Fetcher
  const fetchDesignations = async (deptFilter) => {
    try {
      let paramDept = deptFilter;
      if (deptFilter && departments && departments.length > 0) {
        const found = departments.find(
          (d) => d.name === deptFilter || d._id === deptFilter
        );
        if (found && /^[0-9a-fA-F]{24}$/.test(found._id)) {
          paramDept = found._id;
        }
      }
      const params = paramDept ? { department: paramDept } : undefined;
      const res = await masterApi.getDesignations(params);
      const list = extractArray(res, 'designations');
      if (list && list.length > 0) {
        setDesignations((prev) => {
          const map = new Map();
          prev.forEach((item) => {
            const k = typeof item === 'string' ? item : (item._id || item.title || item.name);
            if (k) map.set(k, item);
          });
          list.forEach((item) => {
            const k = typeof item === 'string' ? item : (item._id || item.title || item.name);
            if (k) map.set(k, item);
          });
          return Array.from(map.values());
        });
      }
      return list;
    } catch (e) {
      console.warn('Failed to fetch designations:', e);
      return [];
    }
  };

  // Load All System Masters
  const loadFilterMasters = async () => {
    try {
      const [dRes, bRes, desRes, cRes, rRes] = await Promise.allSettled([
        masterApi.getDepartments(),
        masterApi.getBranches(),
        masterApi.getDesignations(),
        masterApi.getCompanies(),
        masterApi.getRoles(),
      ]);
      if (dRes.status === 'fulfilled') setDepartments(extractArray(dRes.value, 'departments'));
      if (bRes.status === 'fulfilled') setBranches(extractArray(bRes.value, 'branches'));
      if (desRes.status === 'fulfilled') {
        const dList = extractArray(desRes.value, 'designations');
        setDesignations(dList);
      }
      if (cRes.status === 'fulfilled') setCompanies(extractArray(cRes.value, 'companies'));
      if (rRes.status === 'fulfilled') setRoles(extractArray(rRes.value, 'roles'));
    } catch (e) {
      console.error('Filter masters error:', e);
    }
  };

  // Load Employees with Filter & Pagination (GET /employees)
  const loadEmployees = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 10,
        search: search || undefined,
        department: selectedDept || undefined,
        branch: selectedBranch || undefined,
        status: selectedStatus || undefined,
        workType: selectedWorkType || undefined,
      };
      const res = await employeeApi.getEmployees(params);
      const list = Array.isArray(res)
        ? res
        : (Array.isArray(res?.data) ? res.data : (res?.employees || res?.data?.employees || []));

      // Immediately show employees without blocking network on parallel face calls
      setEmployees(list);
      const count = res?.total || res?.totalCount || res?.count || (Array.isArray(list) ? list.length : 0);
      setTotalCount(count);

      // Asynchronously enrich face status in background using batched calls
      const empIds = list.map((e) => e._id || e.id).filter(Boolean);
      if (empIds.length > 0) {
        faceApi.getBulkFaceStatus(empIds).then((statusMap) => {
          if (!statusMap || Object.keys(statusMap).length === 0) return;
          setEmployees((prev) =>
            prev.map((emp) => {
              const empId = emp._id || emp.id;
              const sData = statusMap[empId];
              if (!sData) return emp;
              const status = sData?.status || sData?.data?.status || 'UNREGISTERED';
              const isEnrolled = status === 'ENROLLED' || status === 'REGISTERED' || status === 'ACTIVE' || sData?.isRegistered === true;
              return { ...emp, _faceStatus: status, isFaceEnrolled: isEnrolled };
            })
          );
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
      setEmployees([]);
      if (err.response?.status === 403) {
        showToast('Access Forbidden (403): Please log in as Super Admin to manage employees', 'error');
      } else {
        showToast('Failed to load employee directory from backend', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilterMasters();
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [page, selectedDept, selectedBranch, selectedStatus, selectedWorkType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadEmployees();
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadEmployees();
  };

  // Designations memoized options — `name` is the primary field per swagger schema
  const designationOptions = useMemo(() => {
    const list = [];
    const seen = new Set();

    (designations || []).forEach((d) => {
      if (!d) return;
      // Swagger schema: field is `name`. `title` kept as fallback for legacy data.
      const label = typeof d === 'string' ? d : (d.name || d.title || d.designationName || d.code || '');
      const val = typeof d === 'string' ? d : (d._id || d.id || d.name || d.title || '');
      if (label && !seen.has(label.toLowerCase())) {
        seen.add(label.toLowerCase());
        list.push({ value: val, label });
      }
    });

    return list;
  }, [designations]);

  // Open Create Employee Modal
  const openAddModal = () => {
    if (!designations || designations.length === 0) {
      fetchDesignations();
    }
    const defaultDesig = designationOptions[0]?.value || designations[0]?._id || '';
    setNewEmp({
      ...initialEmpState,
      company: companies[0]?._id || '',
      branch: branches[0]?._id || '',
      department: departments[0]?._id || '',
      designation: defaultDesig,
      // Auto-assign lowest-privilege role ('employee') — user doesn't need to pick it
      employeeRole: (
        roles.find((r) => /^employee$/i.test(r.name || r.slug || r.displayName || '')) ||
        roles.find((r) => /(employee|staff|default)/i.test(r.name || r.slug || r.displayName || '')) ||
        roles[roles.length - 1] || // last role is usually lowest privilege
        roles[0]
      )?._id || '',
    });
    setDocFiles({
      JOINING_LETTER: null,
      APPOINTMENT_LETTER: null,
      RESIGNATION_LETTER: null,
      EXPERIENCE_LETTER: null,
    });
    setShowPhotoUrlInput(false);
    setCreateTab('basic');
    setAddModalOpen(true);
  };

  // Step-by-Step Validation for Multi-Step Employee Creation
  const validateStep = (stepKey) => {
    if (stepKey === 'basic') {
      if (!newEmp.firstName?.trim()) {
        showToast('First Name is required', 'warning');
        return false;
      }
      if (!newEmp.lastName?.trim()) {
        showToast('Last Name is required', 'warning');
        return false;
      }
      if (!newEmp.email?.trim()) {
        showToast('Official Email is required', 'warning');
        return false;
      }
      const emailErr = validateEmail(newEmp.email, { fieldName: 'Official email' });
      if (emailErr) {
        showToast(emailErr, 'warning');
        return false;
      }
      if (!newEmp.phone?.trim()) {
        showToast('Mobile Number is required', 'warning');
        return false;
      }
      const phoneErr = validatePhone(newEmp.phone, { fieldName: 'Mobile number' });
      if (phoneErr) {
        showToast(phoneErr, 'warning');
        return false;
      }
      if (newEmp.alternateNumber?.trim()) {
        const altErr = validatePhone(newEmp.alternateNumber, { required: false, fieldName: 'Alternate number' });
        if (altErr) {
          showToast(altErr, 'warning');
          return false;
        }
        const cleanPhone = newEmp.phone.replace(/\D/g, '');
        const cleanAlt = newEmp.alternateNumber.replace(/\D/g, '');
        if (cleanAlt && cleanPhone && cleanPhone === cleanAlt) {
          showToast('Mobile Number and Alternate Number cannot be the same', 'warning');
          return false;
        }
      }
      if (!newEmp.gender) {
        showToast('Gender is required', 'warning');
        return false;
      }
      if (!newEmp.dateOfBirth) {
        showToast('Date of Birth is required', 'warning');
        return false;
      }
      if (!newEmp.initialPassword?.trim()) {
        showToast('Initial Password is required', 'warning');
        return false;
      }
      if (newEmp.initialPassword.trim().length < 6) {
        showToast('Initial Password must be at least 6 characters long', 'warning');
        return false;
      }
      return true;
    }

    if (stepKey === 'employment') {
      if (!newEmp.company) {
        showToast('Company selection is required', 'warning');
        return false;
      }
      if (!newEmp.branch) {
        showToast('Branch selection is required', 'warning');
        return false;
      }
      if (!newEmp.department) {
        showToast('Department selection is required', 'warning');
        return false;
      }
      if (!newEmp.designation) {
        showToast('Designation selection is required', 'warning');
        return false;
      }
      if (!newEmp.employeeRole) {
        showToast('Assigned System Role is required', 'warning');
        return false;
      }
      if (!newEmp.employmentType) {
        showToast('Employment Type is required', 'warning');
        return false;
      }
      if (!newEmp.employeeStatus) {
        showToast('Employee Status is required', 'warning');
        return false;
      }
      if (!newEmp.workType) {
        showToast('Work Type is required', 'warning');
        return false;
      }
      if (!newEmp.dateOfJoining) {
        showToast('Date of Joining is required', 'warning');
        return false;
      }
      return true;
    }

    if (stepKey === 'government') {
      if (newEmp.panNumber?.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(newEmp.panNumber.trim())) {
        showToast('Invalid PAN format (e.g. ABCDE1234F)', 'warning');
        return false;
      }
      if (newEmp.aadhaarNumber?.trim()) {
        const cleanAadhaar = newEmp.aadhaarNumber.replace(/\D/g, '');
        if (cleanAadhaar.length !== 12) {
          showToast('Aadhaar Number must be exactly 12 digits', 'warning');
          return false;
        }
      }
      return true;
    }

    if (stepKey === 'emergency') {
      if (newEmp.emergencyPhone?.trim()) {
        const emgErr = validatePhone(newEmp.emergencyPhone, { required: false, fieldName: 'Emergency mobile phone' });
        if (emgErr) {
          showToast(emgErr, 'warning');
          return false;
        }
      }
      return true;
    }

    return true;
  };

  const handleTabClick = (targetTabKey) => {
    const stepOrder = ['basic', 'employment', 'government', 'emergency', 'documents'];
    const currentIndex = stepOrder.indexOf(createTab);
    const targetIndex = stepOrder.indexOf(targetTabKey);

    if (targetIndex <= currentIndex) {
      setCreateTab(targetTabKey);
      return;
    }

    for (let i = currentIndex; i < targetIndex; i++) {
      const stepToValidate = stepOrder[i];
      if (!validateStep(stepToValidate)) {
        setCreateTab(stepToValidate);
        return;
      }
    }
    setCreateTab(targetTabKey);
  };

  const handleNextStep = () => {
    if (!validateStep(createTab)) {
      return;
    }
    if (createTab === 'basic') setCreateTab('employment');
    else if (createTab === 'employment') setCreateTab('government');
    else if (createTab === 'government') setCreateTab('emergency');
    else if (createTab === 'emergency') setCreateTab('documents');
  };

  // Create Employee (POST /employees)
  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    const stepsToValidate = ['basic', 'employment', 'government', 'emergency'];
    for (const stepKey of stepsToValidate) {
      if (!validateStep(stepKey)) {
        setCreateTab(stepKey);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await employeeApi.createEmployee(newEmp);
      const createdEmp = res?.data || res;
      const empId = createdEmp?._id || createdEmp?.id;

      // Upload any selected binary documents to employee profile
      if (empId) {
        const fileEntries = Object.entries(docFiles).filter(([_, item]) => item && item.file);
        for (const [docType, item] of fileEntries) {
          try {
            const fd = new FormData();
            fd.append('file', item.file);
            fd.append('type', docType);
            fd.append('title', item.name || docType.replace('_', ' '));
            await employeeApi.uploadDocument(empId, fd);
          } catch (upErr) {
            console.warn(`Binary upload for ${docType} skipped (saved as data URL):`, upErr);
          }
        }
      }

      // Automatically enroll face biometrics if a selfie/photo was captured or uploaded
      let faceEnrolled = false;
      if (empId && newEmp.photo) {
        saveRegisteredSelfie(empId, createdEmp?.employeeCode || newEmp.employeeCode, newEmp.photo);
        try {
          await faceApi.enrollFace(empId, [newEmp.photo]);
          faceEnrolled = true;
          showToast('✓ Employee created & Selfie registered for face attendance!', 'success');
        } catch (fErr) {
          console.warn('Auto face enrollment warning, opening enrollment modal:', fErr);
        }
      }

      setAddModalOpen(false);
      loadEmployees();

      if (faceEnrolled) {
        // Update local employee list immediately with ENROLLED status
        setEmployees((prev) =>
          prev.map((e) =>
            (e._id === empId || e.id === empId)
              ? { ...e, _faceStatus: 'ENROLLED', isFaceEnrolled: true }
              : e
          )
        );
      } else if (createdEmp && (createdEmp._id || createdEmp.id)) {
        showToast('Employee created! Please capture a face photo to complete enrollment.', 'info');
        setEmployeeToEnroll(createdEmp);
        setCapturedFace(null);
        setEnrollModalOpen(true);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create employee', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Load Employee Documents (GET /employees/:id/documents)
  const loadEmployeeDocs = async (empId) => {
    setLoadingDocs(true);
    try {
      const res = await employeeApi.getDocuments(empId);
      const docs = Array.isArray(res)
        ? res
        : (Array.isArray(res?.data) ? res.data : (res?.documents || res?.data?.documents || []));
      setEmployeeDocs(docs);
    } catch {
      setEmployeeDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  // Load Direct Reports (GET /employees/:id/reports)
  const loadDirectReports = async (empId) => {
    setLoadingReports(true);
    try {
      const res = await employeeApi.getDirectReports(empId);
      const reports = Array.isArray(res)
        ? res
        : (Array.isArray(res?.data) ? res.data : (res?.reports || res?.data?.reports || []));
      setDirectReports(reports);
    } catch {
      setDirectReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  // Open Full Profile Modal (GET /employees/:id)
  const openDetail = async (emp) => {
    try {
      const empId = emp._id || emp.id;
      const [res, faceRes] = await Promise.allSettled([
        employeeApi.getEmployeeById(empId),
        faceApi.getFaceStatus(empId),
      ]);
      const detail = res.status === 'fulfilled' ? (res.value?.data || emp) : emp;
      const faceStatus = faceRes.status === 'fulfilled'
        ? (faceRes.value?.status || faceRes.value?.data?.status || 'UNREGISTERED')
        : 'UNREGISTERED';
      const isEnrolled = faceStatus === 'ENROLLED' || faceStatus === 'REGISTERED' || faceStatus === 'ACTIVE';
      setCurrentEmployeeDetail({ ...detail, _faceStatus: faceStatus, isFaceEnrolled: isEnrolled });
      setActiveTab('basic');
      setEditSection(null);
      setDetailModalOpen(true);
      loadEmployeeDocs(empId);
      loadDirectReports(empId);
    } catch (err) {
      setCurrentEmployeeDetail(emp);
      setActiveTab('basic');
      setEditSection(null);
      setDetailModalOpen(true);
    }
  };

  // Start Section Edit
  const startEditSection = (section) => {
    setEditSection(section);
    if (!currentEmployeeDetail) return;

    if (section === 'basic') {
      const b = currentEmployeeDetail.basicInfo || {};
      setEditFormData({
        employeeCode: b.employeeCode || currentEmployeeDetail.employeeCode || '',
        fullName: b.fullName || `${currentEmployeeDetail.firstName || ''} ${currentEmployeeDetail.lastName || ''}`.trim(),
        email: b.email || currentEmployeeDetail.email || '',
        mobileNumber: b.mobileNumber || currentEmployeeDetail.phone || currentEmployeeDetail.mobile || '',
        alternateNumber: b.alternateNumber || '',
        gender: b.gender || currentEmployeeDetail.gender || 'MALE',
        dateOfBirth: b.dateOfBirth ? new Date(b.dateOfBirth).toISOString().split('T')[0] : '1995-01-01',
        bloodGroup: b.bloodGroup || currentEmployeeDetail.bloodGroup || 'O+',
        maritalStatus: b.maritalStatus || currentEmployeeDetail.maritalStatus || 'SINGLE',
      });
    } else if (section === 'employment') {
      const em = currentEmployeeDetail.employmentInfo || {};
      const doj = em.dateOfJoining || currentEmployeeDetail.dateOfJoining;

      // Ensure department is resolved to its ObjectId
      const rawDept = em.department?._id || em.department || currentEmployeeDetail.department?._id || currentEmployeeDetail.department;
      const matchedDept = departments.find((d) => d._id === rawDept || d.name === rawDept);
      const deptId = matchedDept?._id || (/^[0-9a-fA-F]{24}$/.test(rawDept) ? rawDept : departments[0]?._id || '');

      // Ensure branch is resolved to its ObjectId
      const rawBranch = em.branch?._id || em.branch || currentEmployeeDetail.branch?._id || currentEmployeeDetail.branch;
      const matchedBranch = branches.find((b) => b._id === rawBranch || b.name === rawBranch);
      const branchId = matchedBranch?._id || (/^[0-9a-fA-F]{24}$/.test(rawBranch) ? rawBranch : branches[0]?._id || '');

      setEditFormData({
        department: deptId,
        designation: em.designation?._id || em.designation || currentEmployeeDetail.designation?._id || currentEmployeeDetail.designation || '',
        branch: branchId,
        employmentType: em.employmentType || currentEmployeeDetail.employmentType || 'FULL_TIME',
        workType: em.workType || currentEmployeeDetail.workType || 'OFFICE',
        shift: em.shift || 'GENERAL',
        dutyHours: em.dutyHours || 8,
        dateOfJoining: doj ? new Date(doj).toISOString().split('T')[0] : '2024-01-01',
        employeeRole: em.employeeRole?._id || em.employeeRole || currentEmployeeDetail.employeeRole?._id || currentEmployeeDetail.employeeRole || roles[0]?._id || '',
      });
    } else if (section === 'government') {
      const g = currentEmployeeDetail.governmentDetails || {};
      const bank = g.bankAccountDetails || currentEmployeeDetail.bankDetails || {};
      setEditFormData({
        aadhaarNumber: g.aadhaarNumber || '',
        panNumber: g.panNumber || '',
        pfNumber: g.pfNumber || '',
        esicNumber: g.esicNumber || '',
        uanNumber: g.uanNumber || '',
        bankName: bank.bankName || '',
        accountNumber: bank.accountNumber || '',
        ifscCode: bank.ifscCode || '',
        branchName: bank.branchName || '',
      });
    } else if (section === 'emergency') {
      const emg = currentEmployeeDetail.emergencyContact || {};
      setEditFormData({
        name: emg.name || '',
        relationship: emg.relationship || '',
        phone: emg.phone || '',
      });
    }
  };

  // Save Section Edit via Sub-resource PUT APIs
  const handleSaveSection = async (e) => {
    e.preventDefault();
    if (!currentEmployeeDetail?._id) return;
    setSavingSection(true);
    try {
      const empId = currentEmployeeDetail._id;
      if (editSection === 'basic') {
        if (!editFormData.email?.trim()) {
          showToast('Primary email address is required', 'warning');
          setSavingSection(false);
          return;
        }
        const emailErr = validateEmail(editFormData.email.trim(), { fieldName: 'Primary email' });
        if (emailErr) {
          showToast(emailErr, 'warning');
          setSavingSection(false);
          return;
        }
        const phoneErr = validatePhone(editFormData.mobileNumber, { fieldName: 'Mobile number' });
        if (phoneErr) {
          showToast(phoneErr, 'warning');
          setSavingSection(false);
          return;
        }
        if (editFormData.alternateNumber?.trim()) {
          const altErr = validatePhone(editFormData.alternateNumber, { required: false, fieldName: 'Alternate number' });
          if (altErr) {
            showToast(altErr, 'warning');
            setSavingSection(false);
            return;
          }
          const cleanMobile = editFormData.mobileNumber?.replace(/\D/g, '') || '';
          const cleanAlt = editFormData.alternateNumber?.replace(/\D/g, '') || '';
          if (cleanAlt && cleanMobile && cleanMobile === cleanAlt) {
            showToast('Mobile Number and Alternate Number cannot be the same', 'warning');
            setSavingSection(false);
            return;
          }
        }
        await employeeApi.updateBasicInfo(empId, editFormData);
        showToast('Basic information updated successfully', 'success');
      } else if (editSection === 'employment') {
        const em = currentEmployeeDetail.employmentInfo || {};
        const defaultRole = roles.find((r) => r.name === 'employee')?._id || roles[0]?._id || 'employee';
        const roleId =
          editFormData.employeeRole ||
          em.employeeRole?._id ||
          em.employeeRole ||
          currentEmployeeDetail.employeeRole?._id ||
          currentEmployeeDetail.employeeRole ||
          defaultRole;

        const doj = editFormData.dateOfJoining || em.dateOfJoining || currentEmployeeDetail.dateOfJoining;

        // Resolve department ObjectId
        const rawDept = editFormData.department || em.department?._id || em.department;
        const matchedDept = departments.find((d) => d._id === rawDept || d.name === rawDept);
        const deptId = matchedDept?._id || (/^[0-9a-fA-F]{24}$/.test(rawDept) ? rawDept : departments[0]?._id);

        // Resolve branch ObjectId
        const rawBranch = editFormData.branch || em.branch?._id || em.branch;
        const matchedBranch = branches.find((b) => b._id === rawBranch || b.name === rawBranch);
        const branchId = matchedBranch?._id || (/^[0-9a-fA-F]{24}$/.test(rawBranch) ? rawBranch : branches[0]?._id);

        const payload = {
          department: deptId,
          designation: editFormData.designation || em.designation || 'Staff',
          branch: branchId,
          employmentType: editFormData.employmentType || em.employmentType || 'FULL_TIME',
          workType: editFormData.workType || em.workType || 'OFFICE',
          shift: editFormData.shift || em.shift || 'GENERAL',
          dutyHours: Number(editFormData.dutyHours) || 8,
          dateOfJoining: doj ? new Date(doj).toISOString().split('T')[0] : '2024-01-01',
          employeeRole: roleId,
        };

        await employeeApi.updateEmploymentInfo(empId, payload);
        showToast('Employment details updated successfully', 'success');
      } else if (editSection === 'government') {
        const govPayload = {
          aadhaarNumber: editFormData.aadhaarNumber,
          panNumber: editFormData.panNumber,
          pfNumber: editFormData.pfNumber,
          esicNumber: editFormData.esicNumber,
          uanNumber: editFormData.uanNumber,
          bankAccountDetails: {
            bankName: editFormData.bankName,
            accountNumber: editFormData.accountNumber,
            ifscCode: editFormData.ifscCode,
            branchName: editFormData.branchName,
          },
        };
        await employeeApi.updateGovernmentDetails(empId, govPayload);
        showToast('Government & Bank details updated successfully', 'success');
      } else if (editSection === 'emergency') {
        const emgPhoneErr = validatePhone(editFormData.phone, { fieldName: 'Emergency mobile phone' });
        if (emgPhoneErr) {
          showToast(emgPhoneErr, 'warning');
          setSavingSection(false);
          return;
        }
        await employeeApi.updateEmergencyContact(empId, editFormData);
        showToast('Emergency contact updated successfully', 'success');
      }
      setEditSection(null);
      // Reload fresh profile
      const fresh = await employeeApi.getEmployeeById(empId);
      setCurrentEmployeeDetail(fresh?.data || fresh);
      loadEmployees();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update section', 'error');
    } finally {
      setSavingSection(false);
    }
  };

  // Upload Document (POST /employees/:id/documents)
  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!newDocData.file && !newDocData.fileUrl) {
      showToast('Please select a file to upload or provide a document URL', 'warning');
      return;
    }
    const docTitle = newDocData.title || newDocData.file?.name || 'Employee Document';
    setUploadingDoc(true);
    try {
      if (newDocData.file) {
        const fd = new FormData();
        fd.append('file', newDocData.file);
        fd.append('type', newDocData.type);
        fd.append('title', docTitle);
        await employeeApi.uploadDocument(currentEmployeeDetail._id, fd);
      } else {
        await employeeApi.uploadDocument(currentEmployeeDetail._id, {
          type: newDocData.type,
          title: docTitle,
          fileUrl: newDocData.fileUrl,
        });
      }
      showToast('Document attached successfully!', 'success');
      setUploadDocOpen(false);
      setNewDocData({ type: 'JOINING_LETTER', title: '', fileUrl: '', file: null });
      loadEmployeeDocs(currentEmployeeDetail._id);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to upload document', 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  // Delete Document (DELETE /employees/:id/documents/:docIndex)
  const handleDeleteDocument = async (docIndex) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await employeeApi.deleteDocument(currentEmployeeDetail._id, docIndex);
      showToast('Document deleted successfully', 'success');
      loadEmployeeDocs(currentEmployeeDetail._id);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete document', 'error');
    }
  };

  // Delete Employee (DELETE /employees/:id)
  const confirmDelete = (emp) => {
    setEmployeeToDelete(emp);
    setDeleteModalOpen(true);
  };

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    setDeleting(true);
    try {
      await employeeApi.deleteEmployee(employeeToDelete._id);
      showToast('Employee permanently deleted', 'success');
      setDeleteModalOpen(false);
      loadEmployees();
    } catch (err) {
      showToast(err.response?.data?.message || 'Cannot delete: Employee may have active direct reports', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Deactivate Employee & User Access (PUT /employees/:id/deactivate)
  const confirmDeactivate = (emp) => {
    setEmployeeToDeactivate(emp);
    setDeactivateModalOpen(true);
  };

  const handleDeactivateEmployee = async () => {
    if (!employeeToDeactivate) return;
    setDeactivating(true);
    try {
      await employeeApi.deactivateEmployee(employeeToDeactivate._id);
      showToast('Employee deactivated and user access revoked', 'success');
      setDeactivateModalOpen(false);
      loadEmployees();
      if (currentEmployeeDetail && currentEmployeeDetail._id === employeeToDeactivate._id) {
        const fresh = await employeeApi.getEmployeeById(employeeToDeactivate._id);
        setCurrentEmployeeDetail(fresh?.data || fresh);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to deactivate employee', 'error');
    } finally {
      setDeactivating(false);
    }
  };

  // Update Status (PUT /employees/:id/status)
  const openStatusModal = (emp) => {
    setEmployeeToStatus(emp);
    setTargetStatus(emp.status || 'ACTIVE');
    setStatusModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!employeeToStatus) return;
    setUpdatingStatus(true);
    try {
      await employeeApi.updateStatus(employeeToStatus._id, targetStatus);
      showToast(`Employee status transitioned to ${targetStatus}`, 'success');
      setStatusModalOpen(false);
      loadEmployees();
    } catch (err) {
      showToast(err.response?.data?.message || 'Status transition rejected', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Face Enrollment
  const openEnrollModal = (emp) => {
    setEmployeeToEnroll(emp);
    setCapturedFace(null);
    setEnrollModalOpen(true);
  };

  const handleEnrollFace = async () => {
    if (!employeeToEnroll || !capturedFace) {
      showToast('Please capture a face photograph first.', 'warning');
      return;
    }
    await doEnroll(capturedFace);
  };

  // Called automatically right after camera capture
  const handleAutoEnroll = async (img) => {
    setCapturedFace(img);
    if (!employeeToEnroll || !img) return;
    await doEnroll(img);
  };

  const doEnroll = async (img) => {
    const empId = employeeToEnroll._id || employeeToEnroll.id;
    if (!empId) {
      showToast('Invalid employee ID for face enrollment', 'error');
      return;
    }
    setEnrolling(true);
    try {
      // Check current real face status from backend
      const faceRes = await faceApi.getFaceStatus(empId);
      const currentStatus = faceRes?.status || faceRes?.data?.status || 'UNREGISTERED';
      const isAlreadyEnrolled = currentStatus === 'ENROLLED' || currentStatus === 'REGISTERED' || currentStatus === 'ACTIVE';

      if (isAlreadyEnrolled) {
        try {
          await faceApi.reEnrollFace(empId, [img]);
        } catch {
          await faceApi.enrollFace(empId, [img]);
        }
        showToast('✓ Face biometrics updated! Employee is ready for attendance.', 'success');
      } else {
        await faceApi.enrollFace(empId, [img]);
        showToast('✓ Face registered successfully! Employee can now punch attendance.', 'success');
      }

      // Update local state immediately to reflect enrollment
      setEmployees((prev) =>
        prev.map((e) =>
          (e._id === empId || e.id === empId)
            ? { ...e, _faceStatus: 'ENROLLED', isFaceEnrolled: true }
            : e
        )
      );

      // Also update detail modal if open
      if (currentEmployeeDetail && (currentEmployeeDetail._id === empId || currentEmployeeDetail.id === empId)) {
        setCurrentEmployeeDetail((prev) => ({ ...prev, _faceStatus: 'ENROLLED', isFaceEnrolled: true }));
      }

      setEnrollModalOpen(false);
    } catch (err) {
      if (err.response?.status === 403) {
        showToast(
          err.response?.data?.message || 'Access Denied: Only Super Admin / HR Admin can enroll employee faces. Please log in with an admin account.',
          'error'
        );
      } else {
        showToast(err.response?.data?.message || 'Face enrollment failed. Ensure face is clearly centered.', 'error');
      }
    } finally {
      setEnrolling(false);
    }
  };

  // Table Columns
  const columns = [
    {
      header: 'Employee Code',
      key: 'employeeCode',
      width: 120,
      minWidth: 110,
      render: (r) => (
        <span style={{ fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace' }}>
          {r?.employeeCode || r?.basicInfo?.employeeCode || (r?._id ? String(r._id).substring(0, 8).toUpperCase() : (r?.id ? String(r.id).substring(0, 8).toUpperCase() : 'EMP'))}
        </span>
      ),
    },
    {
      header: 'Employee Details',
      key: 'firstName',
      minWidth: 190,
      render: (r) => {
        const name = r.basicInfo?.fullName || (r.firstName ? `${r.firstName} ${r.lastName || ''}` : r.name || '-');
        const email = r.basicInfo?.email || r.email || '-';
        const phone = r.basicInfo?.mobileNumber || r.phone || r.mobileNumber;
        const photo = r.basicInfo?.photo || r.photo;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {photo ? (
              <img
                src={photo}
                alt={name}
                style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)', flexShrink: 0 }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-subtle)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  flexShrink: 0,
                }}
              >
                {(name.charAt(0) || 'E').toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{email}</div>
              {phone && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                  <Phone size={10} /> {phone}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Department',
      key: 'department',
      minWidth: 140,
      render: (r) => {
        const d = r.employmentInfo?.department || r.department;
        if (d && typeof d === 'object') return d.name || d.title || '-';
        if (typeof d === 'string') {
          const found = departments.find((item) => item._id === d || item.id === d);
          return found?.name || d;
        }
        return '-';
      },
    },
    {
      header: 'Designation',
      key: 'designation',
      minWidth: 150,
      render: (r) => {
        const des = r.employmentInfo?.designation || r.designation;
        if (des && typeof des === 'object') return des.title || des.name || '-';
        if (typeof des === 'string') {
          const found = designations.find((item) => item._id === des || item.id === des);
          return found?.title || found?.name || des;
        }
        return '-';
      },
    },
    {
      header: 'Branch',
      key: 'branch',
      minWidth: 130,
      render: (r) => {
        const b = r.employmentInfo?.branch || r.branch;
        if (b && typeof b === 'object') return b.name || b.title || '-';
        if (typeof b === 'string') {
          const found = branches.find((item) => item._id === b || item.id === b);
          return found?.name || b;
        }
        return '-';
      },
    },
    {
      header: 'Assigned Role',
      key: 'employeeRole',
      minWidth: 150,
      render: (r) => {
        const roleVal = r.employmentInfo?.employeeRole || r.employeeRole || r.role;
        const roleObj = typeof roleVal === 'object' ? roleVal : roles.find((item) => item._id === roleVal || item.name === roleVal);
        const roleLabel = roleObj?.displayName || roleObj?.name || (typeof roleVal === 'string' && roleVal !== '' ? roleVal : 'Employee');
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 5,
              backgroundColor: 'rgba(42, 171, 160, 0.1)',
              color: 'var(--primary)',
            }}
          >
            <ShieldCheck size={12} />
            <span>{roleLabel}</span>
          </span>
        );
      },
    },
    {
      header: 'Work Type',
      key: 'workType',
      minWidth: 100,
      render: (r) => {
        const wt = r.employmentInfo?.workType || r.workType || 'OFFICE';
        const str = typeof wt === 'string' ? wt : (wt?.name || 'OFFICE');
        return <Badge variant={str === 'SITE' ? 'warning' : str === 'FIELD' ? 'info' : 'secondary'}>{str}</Badge>;
      },
    },
    {
      header: 'Face Status',
      key: 'isFaceEnrolled',
      minWidth: 135,
      render: (r) => {
        const enrolled = r.isFaceEnrolled === true;
        return enrolled ? (
          <button
            className="btn btn-light btn-sm"
            onClick={() => openEnrollModal(r)}
            style={{
              fontSize: '0.73rem', padding: '3px 9px',
              color: '#16a34a', background: '#dcfce7',
              border: '1px solid #bbf7d0', borderRadius: 6,
              display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="Face Enrolled — Click to Re-register"
          >
            <CheckCircle2 size={13} /> Face Enrolled
          </button>
        ) : (
          <button
            className="btn btn-warning btn-sm"
            onClick={() => openEnrollModal(r)}
            style={{
              fontSize: '0.73rem', padding: '3px 9px',
              color: '#b45309', background: '#fef9c3',
              border: '1px solid #fde68a', borderRadius: 6,
              display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
              animation: 'pulse 2s infinite',
              whiteSpace: 'nowrap',
            }}
            title="Face Not Registered — Click to Register Now"
          >
            <ScanFace size={13} /> Register Face
          </button>
        );
      },
    },
    {
      header: 'Status',
      key: 'status',
      minWidth: 90,
      render: (r) => {
        const rawStatus = r.employmentInfo?.employeeStatus || r.status || 'ACTIVE';
        const st = typeof rawStatus === 'string' ? rawStatus : (rawStatus?.name || 'ACTIVE');
        const variant = st === 'ACTIVE' ? 'success' : st === 'ON_LEAVE' ? 'warning' : 'danger';
        return (
          <button
            type="button"
            onClick={() => openStatusModal(r)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            title="Click to transition status"
          >
            <Badge variant={variant}>{st}</Badge>
          </button>
        );
      },
    },
    {
      header: 'Actions',
      key: 'actions',
      width: 175,
      minWidth: 175,
      style: { textAlign: 'right' },
      render: (r) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => openDetail(r)}
            title="View & Edit 5-Tab Profile"
            style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <Eye size={13} /> Profile
          </button>
          <button
            className="btn btn-outline-warning btn-sm"
            onClick={() => confirmDeactivate(r)}
            title="Deactivate Employee & User Access (PUT /employees/:id/deactivate)"
            style={{ padding: '5px 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <UserX size={13} />
          </button>
          <button
            className="btn btn-outline-danger btn-sm"
            onClick={() => confirmDelete(r)}
            title="Delete Employee"
            style={{ padding: '5px 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header & Primary Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Employee Master Directory</h2>
        </div>
        <div>
          <Button variant="primary" icon={Plus} onClick={openAddModal}>
            Add New Employee
          </Button>
        </div>
      </div>

      {/* Multi-Parameter Search & Filter Bar */}
      <div className="card" style={{ padding: '16px 20px', overflow: 'visible', position: 'relative', zIndex: 20 }}>
        <form onSubmit={handleSearchSubmit} className="filter-toolbar">
          <div className="filter-search">
            <Input
              placeholder="Search by Name, Code, Email, Mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginBottom: 0 }}
            />
          </div>

          <div className="filter-item">
            <Select
              placeholder="All Departments"
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Departments' },
                ...departments.map((d) => ({ value: d._id, label: d.name })),
              ]}
              style={{ marginBottom: 0 }}
            />
          </div>

          <div className="filter-item">
            <Select
              placeholder="All Branches"
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Branches' },
                ...branches.map((b) => ({ value: b._id, label: b.name })),
              ]}
              style={{ marginBottom: 0 }}
            />
          </div>

          <div className="filter-item">
            <Select
              placeholder="All Statuses"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'ACTIVE', label: 'ACTIVE' },
                { value: 'ON_LEAVE', label: 'ON_LEAVE' },
                { value: 'SUSPENDED', label: 'SUSPENDED' },
                { value: 'EXITED', label: 'EXITED' },
              ]}
              style={{ marginBottom: 0 }}
            />
          </div>

          <div className="filter-item">
            <Select
              placeholder="Work Type"
              value={selectedWorkType}
              onChange={(e) => {
                setSelectedWorkType(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Work Types' },
                { value: 'OFFICE', label: 'OFFICE' },
                { value: 'FIELD', label: 'FIELD' },
                { value: 'SITE', label: 'SITE' },
                { value: 'HYBRID', label: 'HYBRID' },
              ]}
              style={{ marginBottom: 0 }}
            />
          </div>
        </form>
      </div>

      {/* Directory Table */}
      <div className="card">
        <Table columns={columns} data={employees} loading={loading} emptyMessage="No employees found matching criteria." />
        <div style={{ padding: '0 20px 16px' }}>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalCount}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      </div>

      {/* COMPREHENSIVE ADD EMPLOYEE MODAL */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add New Employee"
        size="lg"
      >
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            marginBottom: 16,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          {[
            { key: 'basic', label: '1. Basic Info' },
            { key: 'employment', label: '2. Employment' },
            { key: 'government', label: '3. Govt & Bank' },
            { key: 'emergency', label: '4. Emergency' },
            { key: 'documents', label: '5. Documents' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabClick(tab.key)}
              style={{
                flex: '1 0 auto',
                padding: '10px 14px',
                border: 'none',
                background: 'none',
                borderBottom: createTab === tab.key ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                color: createTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: createTab === tab.key ? 700 : 500,
                cursor: 'pointer',
                fontSize: '0.84rem',
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleCreateEmployee}>
          {/* TAB 1: BASIC INFORMATION */}
          {createTab === 'basic' && (
            <div className="grid-2">
              <Input
                label="Employee Code"
                value={newEmp.employeeCode}
                onChange={(e) => setNewEmp({ ...newEmp, employeeCode: e.target.value.toUpperCase() })}
                placeholder="Auto-generated if empty (e.g. EMP-1001)"
              />
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span>Profile Photo</span>
                  <button
                    type="button"
                    onClick={() => setShowPhotoUrlInput(!showPhotoUrlInput)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    {showPhotoUrlInput ? 'Switch to File Upload' : 'or enter Image URL'}
                  </button>
                </label>

                {showPhotoUrlInput ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Input
                      value={newEmp.photo}
                      onChange={(e) => setNewEmp({ ...newEmp, photo: e.target.value })}
                      placeholder="https://example.com/avatar.jpg"
                      style={{ flex: 1 }}
                    />
                    {newEmp.photo && (
                      <img
                        src={newEmp.photo}
                        alt="Preview"
                        style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)', flexShrink: 0 }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 12px',
                      border: '1px dashed var(--border-color)',
                      borderRadius: '8px',
                      backgroundColor: '#fafbfc',
                      minHeight: '52px',
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        backgroundColor: '#f1f5f9',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {newEmp.photo ? (
                        <img
                          src={newEmp.photo}
                          alt="Profile Preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Camera size={20} color="var(--text-muted)" />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <label
                          htmlFor="add-emp-photo-input"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '5px 12px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--primary)',
                            color: '#ffffff',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Upload size={13} />
                          {newEmp.photo ? 'Change Photo' : 'Upload Photo'}
                        </label>
                        <input
                          id="add-emp-photo-input"
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, image/webp"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoSelect(file);
                            e.target.value = '';
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => setShowCameraInAddForm(!showCameraInAddForm)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '5px 12px',
                            borderRadius: '6px',
                            backgroundColor: '#0d9488',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Camera size={13} />
                          {showCameraInAddForm ? 'Close Camera' : 'Take Live Selfie'}
                        </button>

                        <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                          Selfie will auto-register for biometric attendance
                        </span>
                      </div>

                      {newEmp.photo && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, backgroundColor: '#dcfce7', padding: '3px 8px', borderRadius: 4 }}>
                            ✓ Biometrics Ready
                          </span>
                          <button
                            type="button"
                            onClick={handlePhotoRemove}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '4px 8px',
                              borderRadius: '4px',
                              backgroundColor: '#fee2e2',
                              color: '#ef4444',
                              border: 'none',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {showCameraInAddForm && (
                  <div style={{ marginTop: 12, padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary)' }}>
                        Capture Employee Selfie (Look directly into the camera)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCameraInAddForm(false)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <CameraCapture
                      onCapture={(img) => {
                        setNewEmp((prev) => ({ ...prev, photo: img }));
                        setShowCameraInAddForm(false);
                        showToast('Selfie captured! Will auto-enroll on employee creation.', 'success');
                      }}
                      onCancel={() => setShowCameraInAddForm(false)}
                      label="Employee Face Photo"
                    />
                  </div>
                )}
              </div>
              <Input
                label="First Name"
                value={newEmp.firstName}
                onChange={(e) => setNewEmp({ ...newEmp, firstName: e.target.value })}
                placeholder="First name"
                required
              />
              <Input
                label="Last Name"
                value={newEmp.lastName}
                onChange={(e) => setNewEmp({ ...newEmp, lastName: e.target.value })}
                placeholder="Last name"
                required
              />
              <Input
                label="Official Email (Login ID)"
                type="email"
                value={newEmp.email}
                onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
                placeholder="email@company.com"
                required
              />
              <Input
                label="Mobile Number *"
                type="tel"
                isPhone={true}
                value={newEmp.phone}
                onChange={(e) => setNewEmp({ ...newEmp, phone: e.target.value })}
                placeholder="10-digit mobile number"
                required
              />
              <Input
                label="Alternate Number"
                type="tel"
                isPhone={true}
                value={newEmp.alternateNumber}
                onChange={(e) => setNewEmp({ ...newEmp, alternateNumber: e.target.value })}
                placeholder="10-digit alternate mobile (cannot match mobile)"
              />
              <Select
                label="Gender *"
                value={newEmp.gender}
                onChange={(e) => setNewEmp({ ...newEmp, gender: e.target.value })}
                options={[
                  { value: 'MALE', label: 'Male' },
                  { value: 'FEMALE', label: 'Female' },
                  { value: 'OTHER', label: 'Other' },
                ]}
                required
              />
              <Input
                label="Date of Birth *"
                type="date"
                value={newEmp.dateOfBirth}
                onChange={(e) => setNewEmp({ ...newEmp, dateOfBirth: e.target.value })}
                required
              />
              <Select
                label="Blood Group"
                value={newEmp.bloodGroup}
                onChange={(e) => setNewEmp({ ...newEmp, bloodGroup: e.target.value })}
                options={['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((bg) => ({ value: bg, label: bg }))}
              />
              <Select
                label="Marital Status"
                value={newEmp.maritalStatus}
                onChange={(e) => setNewEmp({ ...newEmp, maritalStatus: e.target.value })}
                options={[
                  { value: 'SINGLE', label: 'Single' },
                  { value: 'MARRIED', label: 'Married' },
                  { value: 'OTHER', label: 'Other' },
                ]}
              />
              <Input
                label="Initial Password *"
                type="password"
                value={newEmp.initialPassword}
                onChange={(e) => setNewEmp({ ...newEmp, initialPassword: e.target.value })}
                placeholder="Enter password (minimum 6 characters)"
                required
              />
            </div>
          )}

          {/* TAB 2: EMPLOYMENT INFORMATION */}
          {createTab === 'employment' && (
            <div className="grid-2">
              <Select
                label="Company"
                value={newEmp.company}
                onChange={(e) => setNewEmp({ ...newEmp, company: e.target.value })}
                options={companies.map((c) => ({ value: c._id, label: c.name }))}
                required
              />
              <Select
                label="Branch"
                value={newEmp.branch}
                onChange={(e) => setNewEmp({ ...newEmp, branch: e.target.value })}
                options={branches.map((b) => ({ value: b._id, label: b.name }))}
                required
              />
              <Select
                label="Department"
                value={newEmp.department}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewEmp({ ...newEmp, department: val });
                  if (val) fetchDesignations(val);
                }}
                options={departments.map((d) => ({ value: d._id, label: d.name }))}
                required
              />
              <Select
                label="Designation"
                placeholder="Select Designation"
                value={newEmp.designation}
                onChange={(e) => setNewEmp({ ...newEmp, designation: e.target.value })}
                options={designationOptions}
                required
              />
              <Select
                label="Reporting Manager"
                value={newEmp.reportingManager}
                onChange={(e) => setNewEmp({ ...newEmp, reportingManager: e.target.value })}
                options={[
                  { value: '', label: 'None / Top Level Manager' },
                  ...employees.map((em) => ({
                    value: em._id,
                    label: `${em.basicInfo?.fullName || `${em.firstName || ''} ${em.lastName || ''}`.trim()} (${em.basicInfo?.employeeCode || em.employeeCode || 'EMP'})`,
                  })),
                ]}
              />
              <Select
                label="Assigned System Role *"
                value={newEmp.employeeRole}
                onChange={(e) => setNewEmp({ ...newEmp, employeeRole: e.target.value })}
                options={roles.map((r) => ({ value: r._id, label: r.displayName || r.name }))}
                required
              />
              <Select
                label="Employment Type"
                value={newEmp.employmentType}
                onChange={(e) => setNewEmp({ ...newEmp, employmentType: e.target.value })}
                options={[
                  { value: 'FULL_TIME', label: 'Full Time' },
                  { value: 'PART_TIME', label: 'Part Time' },
                  { value: 'CONTRACT', label: 'Contract' },
                  { value: 'INTERN', label: 'Intern' },
                ]}
                required
              />
              <Select
                label="Employee Status"
                value={newEmp.employeeStatus}
                onChange={(e) => setNewEmp({ ...newEmp, employeeStatus: e.target.value })}
                options={[
                  { value: 'ACTIVE', label: 'ACTIVE' },
                  { value: 'PROBATION', label: 'PROBATION' },
                  { value: 'CONTRACT', label: 'CONTRACT' },
                ]}
                required
              />
              <Select
                label="Work Type"
                value={newEmp.workType}
                onChange={(e) => setNewEmp({ ...newEmp, workType: e.target.value })}
                options={[
                  { value: 'OFFICE', label: 'Office' },
                  { value: 'FIELD', label: 'Field Staff' },
                  { value: 'SITE', label: 'Site / Project' },
                  { value: 'HYBRID', label: 'Hybrid' },
                ]}
                required
              />
              <Select
                label="Shift"
                value={newEmp.shift}
                onChange={(e) => setNewEmp({ ...newEmp, shift: e.target.value })}
                options={[
                  { value: 'GENERAL', label: 'General Shift (9:00 AM - 7:00 PM)' },
                  { value: 'MORNING', label: 'Morning Shift' },
                  { value: 'EVENING', label: 'Evening Shift' },
                  { value: 'NIGHT', label: 'Night Shift' },
                ]}
              />
              <Input
                label="Daily Duty Hours"
                type="number"
                value={newEmp.dutyHours}
                onChange={(e) => setNewEmp({ ...newEmp, dutyHours: Number(e.target.value) })}
                placeholder="8"
              />
              <Input
                label="Date of Joining"
                type="date"
                value={newEmp.dateOfJoining}
                onChange={(e) => setNewEmp({ ...newEmp, dateOfJoining: e.target.value })}
                required
              />
              <Input
                label="Basic Salary (₹/month)"
                type="number"
                value={newEmp.salaryBasic}
                onChange={(e) => setNewEmp({ ...newEmp, salaryBasic: Number(e.target.value) })}
                placeholder="30000"
              />
              <Input
                label="Gross Salary / CTC (₹/month)"
                type="number"
                value={newEmp.salaryGross}
                onChange={(e) => setNewEmp({ ...newEmp, salaryGross: Number(e.target.value) })}
                placeholder="46000"
              />
            </div>
          )}

          {/* TAB 3: GOVERNMENT DETAILS */}
          {createTab === 'government' && (
            <div className="grid-2">
              <Input
                label="Aadhaar Number"
                value={newEmp.aadhaarNumber}
                onChange={(e) => setNewEmp({ ...newEmp, aadhaarNumber: e.target.value })}
                placeholder="1234 5678 9012"
              />
              <Input
                label="PAN Number"
                value={newEmp.panNumber}
                onChange={(e) => setNewEmp({ ...newEmp, panNumber: e.target.value })}
                placeholder="ABCDE1234F"
              />
              <Input
                label="PF Number"
                value={newEmp.pfNumber}
                onChange={(e) => setNewEmp({ ...newEmp, pfNumber: e.target.value })}
                placeholder="PF/12345/678"
              />
              <Input
                label="ESIC Number"
                value={newEmp.esicNumber}
                onChange={(e) => setNewEmp({ ...newEmp, esicNumber: e.target.value })}
                placeholder="ESIC/987654"
              />
              <Input
                label="Universal Account Number (UAN)"
                value={newEmp.uanNumber}
                onChange={(e) => setNewEmp({ ...newEmp, uanNumber: e.target.value })}
                placeholder="100123456789"
              />
              <Input
                label="Professional Tax (PT Number)"
                value={newEmp.ptNumber}
                onChange={(e) => setNewEmp({ ...newEmp, ptNumber: e.target.value })}
                placeholder="PT/GJ/2026/01"
              />
              <Input
                label="Bank Name"
                value={newEmp.bankName}
                onChange={(e) => setNewEmp({ ...newEmp, bankName: e.target.value })}
                placeholder="HDFC Bank"
              />
              <Input
                label="Bank Account Number"
                value={newEmp.accountNumber}
                onChange={(e) => setNewEmp({ ...newEmp, accountNumber: e.target.value })}
                placeholder="50100234567890"
              />
              <Input
                label="IFSC Code"
                value={newEmp.ifscCode}
                onChange={(e) => setNewEmp({ ...newEmp, ifscCode: e.target.value })}
                placeholder="HDFC0001234"
              />
              <Input
                label="Bank Branch"
                value={newEmp.bankBranch}
                onChange={(e) => setNewEmp({ ...newEmp, bankBranch: e.target.value })}
                placeholder="Main Branch"
              />
            </div>
          )}

          {/* TAB 4: EMERGENCY CONTACT */}
          {createTab === 'emergency' && (
            <div className="grid-2">
              <Input
                label="Contact Person Name"
                value={newEmp.emergencyName}
                onChange={(e) => setNewEmp({ ...newEmp, emergencyName: e.target.value })}
                placeholder="Suresh Sharma"
              />
              <Input
                label="Relationship"
                value={newEmp.emergencyRelationship}
                onChange={(e) => setNewEmp({ ...newEmp, emergencyRelationship: e.target.value })}
                placeholder="Father / Spouse / Guardian"
              />
              <Input
                label="Emergency Mobile Phone"
                value={newEmp.emergencyPhone}
                onChange={(e) => setNewEmp({ ...newEmp, emergencyPhone: e.target.value })}
                placeholder="+91 9876500000"
              />
            </div>
          )}

          {/* TAB 5: EMPLOYEE DOCUMENTS */}
          {createTab === 'documents' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {[
                { label: 'Joining Letter', key: 'joiningLetterUrl', type: 'JOINING_LETTER', ph: 'Or enter direct URL: https://...' },
                { label: 'Appointment Letter', key: 'appointmentLetterUrl', type: 'APPOINTMENT_LETTER', ph: 'Or enter direct URL: https://...' },
                { label: 'Resignation Letter', key: 'resignationLetterUrl', type: 'RESIGNATION_LETTER', ph: 'Optional (https://...)' },
                { label: 'Experience Letter', key: 'experienceLetterUrl', type: 'EXPERIENCE_LETTER', ph: 'Optional (https://...)' },
              ].map((doc) => {
                const fileInfo = docFiles[doc.type];
                const hasUrl = Boolean(newEmp[doc.key]);
                const isCustomUrl = hasUrl && !fileInfo && !newEmp[doc.key]?.startsWith('data:');

                return (
                  <div
                    key={doc.type}
                    style={{
                      border: fileInfo || hasUrl ? '1px solid #10b981' : '1px solid var(--border-color)',
                      borderRadius: 8,
                      padding: 14,
                      backgroundColor: fileInfo || hasUrl ? 'rgba(16, 185, 129, 0.04)' : 'var(--bg-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                        {doc.label}
                      </span>
                      {(fileInfo || hasUrl) && (
                        <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={13} />
                          Attached
                        </span>
                      )}
                    </div>

                    {fileInfo ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: '#ffffff',
                          border: '1px solid #a7f3d0',
                          borderRadius: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <FileText size={20} color="#059669" style={{ flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {fileInfo.name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fileInfo.size}</div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="light"
                          icon={X}
                          onClick={() => handleDocFileRemove(doc.key, doc.type)}
                          title="Remove document"
                          style={{ color: '#ef4444', padding: '4px 6px' }}
                        />
                      </div>
                    ) : isCustomUrl ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: '#ffffff',
                          border: '1px solid var(--border-color)',
                          borderRadius: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <FileText size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {newEmp[doc.key]}
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="light"
                          icon={X}
                          onClick={() => handleDocFileRemove(doc.key, doc.type)}
                          title="Clear URL"
                          style={{ color: '#ef4444', padding: '4px 6px' }}
                        />
                      </div>
                    ) : (
                      <div>
                        <div
                          style={{
                            border: '1.5px dashed var(--border-color, #cbd5e1)',
                            borderRadius: 6,
                            padding: '16px 12px',
                            textAlign: 'center',
                            backgroundColor: '#ffffff',
                            cursor: 'pointer',
                            transition: 'border-color 0.2s, background-color 0.2s',
                          }}
                          onClick={() => document.getElementById(`doc-upload-${doc.type}`)?.click()}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (e.dataTransfer.files?.[0]) {
                              handleDocFileSelect(doc.key, doc.type, e.dataTransfer.files[0]);
                            }
                          }}
                        >
                          <Upload size={22} color="var(--primary)" style={{ margin: '0 auto 6px', display: 'block' }} />
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary)' }}>
                            Click to Upload {doc.label}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            Drag & drop PDF, DOCX, PNG, JPG (up to 10MB)
                          </div>
                          <input
                            id={`doc-upload-${doc.type}`}
                            type="file"
                            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleDocFileSelect(doc.key, doc.type, e.target.files[0]);
                              }
                            }}
                          />
                        </div>

                        <div style={{ marginTop: 8 }}>
                          <Input
                            placeholder={doc.ph}
                            value={newEmp[doc.key] || ''}
                            onChange={(e) => setNewEmp({ ...newEmp, [doc.key]: e.target.value })}
                            style={{ fontSize: '0.78rem' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="modal-footer" style={{ margin: '20px -20px -20px', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {createTab !== 'basic' && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (createTab === 'employment') setCreateTab('basic');
                    else if (createTab === 'government') setCreateTab('employment');
                    else if (createTab === 'emergency') setCreateTab('government');
                    else if (createTab === 'documents') setCreateTab('emergency');
                  }}
                >
                  Previous Step
                </Button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {createTab !== 'documents' ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleNextStep}
                >
                  Next Step
                </Button>
              ) : null}
              <Button variant="primary" type="submit" loading={submitting}>
                Complete & Provision Employee
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* COMPREHENSIVE 5-TAB EMPLOYEE DETAIL & SUB-SECTION EDIT MODAL */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setEditSection(null);
        }}
        title={`Employee Profile: ${currentEmployeeDetail?.basicInfo?.fullName || currentEmployeeDetail?.firstName || ''} (${currentEmployeeDetail?.basicInfo?.employeeCode || currentEmployeeDetail?.employeeCode || ''})`}
        size="lg"
      >
        {currentEmployeeDetail && (
          <div>
            {/* 1. EXECUTIVE PROFILE HERO CARD */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'linear-gradient(135deg, rgba(46, 123, 133, 0.08) 0%, rgba(46, 123, 133, 0.02) 100%)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--primary-border)',
                marginBottom: 12,
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Avatar circle with Initials and status dot */}
                <div style={{ position: 'relative' }}>
                  {currentEmployeeDetail.basicInfo?.photo || currentEmployeeDetail.photo ? (
                    <img
                      src={currentEmployeeDetail.basicInfo?.photo || currentEmployeeDetail.photo}
                      alt="Profile"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        boxShadow: '0 2px 6px rgba(46, 123, 133, 0.25)',
                        border: '2px solid #ffffff',
                      }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary) 0%, #1c525a 100%)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '1.05rem',
                        boxShadow: '0 2px 6px rgba(46, 123, 133, 0.25)',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {((currentEmployeeDetail.basicInfo?.fullName || currentEmployeeDetail.firstName || 'E').charAt(0) +
                        (currentEmployeeDetail.lastName ? currentEmployeeDetail.lastName.charAt(0) : '')).toUpperCase()}
                    </div>
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor:
                        (currentEmployeeDetail.employmentInfo?.employeeStatus || currentEmployeeDetail.status) === 'ACTIVE'
                          ? 'var(--success)'
                          : 'var(--warning)',
                      border: '2px solid #ffffff',
                    }}
                    title={`Status: ${currentEmployeeDetail.employmentInfo?.employeeStatus || currentEmployeeDetail.status || 'ACTIVE'}`}
                  />
                </div>

                {/* Identity Information */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {currentEmployeeDetail.basicInfo?.fullName ||
                        `${currentEmployeeDetail.firstName || ''} ${currentEmployeeDetail.lastName || ''}`.trim()}
                    </h3>
                    <span
                      style={{
                        background: 'var(--primary-subtle)',
                        color: 'var(--primary)',
                        padding: '1px 7px',
                        borderRadius: '4px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        letterSpacing: '0.5px',
                        border: '1px solid var(--primary-border)',
                      }}
                    >
                      {currentEmployeeDetail.basicInfo?.employeeCode || currentEmployeeDetail.employeeCode || 'EMP'}
                    </span>
                    <Badge
                      variant={
                        (currentEmployeeDetail.employmentInfo?.employeeStatus || currentEmployeeDetail.status) === 'ACTIVE'
                          ? 'success'
                          : 'warning'
                      }
                      style={{ fontSize: '0.72rem', padding: '2px 7px' }}
                    >
                      {currentEmployeeDetail.employmentInfo?.employeeStatus || currentEmployeeDetail.status || 'ACTIVE'}
                    </Badge>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginTop: 4,
                      flexWrap: 'wrap',
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                      <Briefcase size={13} color="var(--primary)" />
                      {formatDesignation(currentEmployeeDetail.employmentInfo?.designation || currentEmployeeDetail.designation)} •{' '}
                      {formatDepartment(currentEmployeeDetail.employmentInfo?.department || currentEmployeeDetail.department)}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Building size={13} color="var(--primary)" />
                      {formatBranch(currentEmployeeDetail.employmentInfo?.branch || currentEmployeeDetail.branch)}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Mail size={13} color="var(--text-muted)" />
                      {currentEmployeeDetail.basicInfo?.email || currentEmployeeDetail.email || '-'}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={13} color="var(--text-muted)" />
                      {currentEmployeeDetail.basicInfo?.mobileNumber ||
                        currentEmployeeDetail.phone ||
                        currentEmployeeDetail.mobile ||
                        '-'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge variant="neutral" style={{ padding: '4px 9px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={12} />
                  {currentEmployeeDetail.employmentInfo?.workType || currentEmployeeDetail.workType || 'OFFICE'}
                </Badge>
              </div>
            </div>

            {/* 2. SEGMENTED PILL TAB NAVIGATION (Compact & Simple) */}
            <div
              style={{
                display: 'flex',
                gap: 4,
                background: 'var(--bg-subtle)',
                padding: '4px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                marginBottom: 12,
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
              }}
            >
              {[
                { key: 'basic', label: 'Basic Info', icon: User },
                { key: 'employment', label: 'Employment', icon: Briefcase },
                { key: 'government', label: 'Govt & Bank', icon: Landmark },
                { key: 'emergency', label: 'Emergency Contact', icon: HeartHandshake },
                { key: 'documents', label: 'Documents', icon: FileText },
                { key: 'reports', label: 'Direct Reports', icon: Users },
              ].map((tab) => {
                const IconComponent = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.key);
                      setEditSection(null);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      border: isActive ? '1px solid var(--border-color)' : '1px solid transparent',
                      borderRadius: '6px',
                      background: isActive ? '#ffffff' : 'transparent',
                      color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      whiteSpace: 'nowrap',
                      boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                      outline: 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <IconComponent size={14} color={isActive ? 'var(--primary)' : 'currentColor'} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* TAB 1: BASIC INFO (PUT /employees/:id/basic-info) */}
            {activeTab === 'basic' && (
              <div>
                {editSection === 'basic' ? (
                  <DetailCard
                    title="Edit Personal & Identity Details"
                    subtitle="Update primary contact info, legal name and personal attributes"
                    icon={User}
                  >
                    <form onSubmit={handleSaveSection}>
                      <div className="grid-2">
                        <Input
                          label="Full Name *"
                          value={editFormData.fullName}
                          onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                          required
                        />
                        <Input
                          label="Primary Email *"
                          type="email"
                          value={editFormData.email}
                          onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                          placeholder="employee@tietechnologies.com"
                          required
                        />
                        <Input
                          label="Mobile Number *"
                          type="tel"
                          isPhone={true}
                          value={editFormData.mobileNumber}
                          onChange={(e) => setEditFormData({ ...editFormData, mobileNumber: e.target.value })}
                          placeholder="10-digit mobile number"
                          required
                        />
                        <Input
                          label="Alternate Number"
                          type="tel"
                          isPhone={true}
                          value={editFormData.alternateNumber}
                          onChange={(e) => setEditFormData({ ...editFormData, alternateNumber: e.target.value })}
                          placeholder="10-digit alternate number"
                        />
                        <Select
                          label="Gender *"
                          value={editFormData.gender}
                          onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                          options={[
                            { value: 'MALE', label: 'Male' },
                            { value: 'FEMALE', label: 'Female' },
                            { value: 'OTHER', label: 'Other' },
                          ]}
                        />
                        <Input
                          label="Date of Birth *"
                          type="date"
                          value={editFormData.dateOfBirth}
                          onChange={(e) => setEditFormData({ ...editFormData, dateOfBirth: e.target.value })}
                        />
                        <Select
                          label="Blood Group"
                          value={editFormData.bloodGroup}
                          onChange={(e) => setEditFormData({ ...editFormData, bloodGroup: e.target.value })}
                          options={['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((bg) => ({ value: bg, label: bg }))}
                        />
                        <Select
                          label="Marital Status"
                          value={editFormData.maritalStatus}
                          onChange={(e) => setEditFormData({ ...editFormData, maritalStatus: e.target.value })}
                          options={[
                            { value: 'SINGLE', label: 'Single' },
                            { value: 'MARRIED', label: 'Married' },
                            { value: 'OTHER', label: 'Other' },
                          ]}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                        <Button variant="secondary" onClick={() => setEditSection(null)} disabled={savingSection}>
                          Cancel
                        </Button>
                        <Button variant="primary" type="submit" icon={Save} loading={savingSection}>
                          Save Basic Info
                        </Button>
                      </div>
                    </form>
                  </DetailCard>
                ) : (
                  <div>
                    {/* Identity Details Card */}
                    <DetailCard
                      title="Personal Details"
                      icon={User}
                      action={
                        <Button
                          variant="secondary"
                          icon={Edit2}
                          onClick={() => startEditSection('basic')}
                          style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                        >
                          Edit Details
                        </Button>
                      }
                    >
                      <div className="grid-3">
                        <DetailField
                          label="Employee ID / Code"
                          value={currentEmployeeDetail.basicInfo?.employeeCode || currentEmployeeDetail.employeeCode || 'N/A'}
                          isBadge
                          badgeVariant="primary"
                          icon={User}
                        />
                        <DetailField
                          label="Full Name"
                          value={
                            currentEmployeeDetail.basicInfo?.fullName ||
                            `${currentEmployeeDetail.firstName || ''} ${currentEmployeeDetail.lastName || ''}`.trim()
                          }
                        />
                        <DetailField
                          label="System Record ID"
                          value={currentEmployeeDetail._id}
                          isMono
                          copyable
                        />
                        <DetailField
                          label="Gender"
                          value={currentEmployeeDetail.basicInfo?.gender || currentEmployeeDetail.gender}
                        />
                        <DetailField
                          label="Date of Birth"
                          value={formatDate(currentEmployeeDetail.basicInfo?.dateOfBirth)}
                          icon={Calendar}
                        />
                        <DetailField
                          label="Blood Group"
                          value={currentEmployeeDetail.basicInfo?.bloodGroup}
                          isBadge={Boolean(currentEmployeeDetail.basicInfo?.bloodGroup)}
                          badgeVariant="danger"
                        />
                        <DetailField
                          label="Marital Status"
                          value={currentEmployeeDetail.basicInfo?.maritalStatus || 'SINGLE'}
                        />
                      </div>
                    </DetailCard>

                    {/* Contact Channels Card */}
                    <DetailCard
                      title="Contact Information"
                      icon={Phone}
                      action={
                        <Button
                          variant="secondary"
                          icon={Edit2}
                          onClick={() => startEditSection('basic')}
                          style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                        >
                          Edit Contact
                        </Button>
                      }
                    >
                      <div className="grid-3">
                        <DetailField
                          label="Primary Email"
                          value={currentEmployeeDetail.basicInfo?.email || currentEmployeeDetail.email}
                          icon={Mail}
                          onEdit={() => startEditSection('basic')}
                        />
                        <DetailField
                          label="Mobile Phone"
                          value={
                            currentEmployeeDetail.basicInfo?.mobileNumber ||
                            currentEmployeeDetail.phone ||
                            currentEmployeeDetail.mobile
                          }
                          icon={Phone}
                          onEdit={() => startEditSection('basic')}
                        />
                        <DetailField
                          label="Alternate Contact"
                          value={currentEmployeeDetail.basicInfo?.alternateNumber}
                          onEdit={() => startEditSection('basic')}
                        />
                      </div>
                    </DetailCard>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: EMPLOYMENT INFO (PUT /employees/:id/employment-info) */}
            {activeTab === 'employment' && (
              <div>
                {editSection === 'employment' ? (
                  <DetailCard
                    title="Edit Employment & Role Setup"
                    subtitle="Update organization branch, department, designation, and work shifts"
                    icon={Briefcase}
                  >
                    <form onSubmit={handleSaveSection}>
                      <div className="grid-2">
                        <Select
                          label="Department *"
                          value={editFormData.department}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditFormData({ ...editFormData, department: val });
                            if (val) fetchDesignations(val);
                          }}
                          options={departments.map((d) => ({ value: d._id, label: d.name }))}
                        />
                        <Select
                          label="Designation *"
                          placeholder="Select Designation"
                          value={editFormData.designation}
                          onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                          options={designationOptions}
                        />
                        <Select
                          label="Branch *"
                          value={editFormData.branch}
                          onChange={(e) => setEditFormData({ ...editFormData, branch: e.target.value })}
                          options={branches.map((b) => ({ value: b._id, label: b.name }))}
                        />
                        <Select
                          label="Employment Type"
                          value={editFormData.employmentType}
                          onChange={(e) => setEditFormData({ ...editFormData, employmentType: e.target.value })}
                          options={[
                            { value: 'FULL_TIME', label: 'Full Time' },
                            { value: 'PART_TIME', label: 'Part Time' },
                            { value: 'CONTRACT', label: 'Contract' },
                            { value: 'INTERN', label: 'Intern' },
                          ]}
                        />
                        <Select
                          label="Work Type *"
                          value={editFormData.workType}
                          onChange={(e) => setEditFormData({ ...editFormData, workType: e.target.value })}
                          options={[
                            { value: 'OFFICE', label: 'Office' },
                            { value: 'FIELD', label: 'Field Staff' },
                            { value: 'SITE', label: 'Site / Project' },
                            { value: 'HYBRID', label: 'Hybrid' },
                          ]}
                        />
                        <Input
                          label="Shift"
                          value={editFormData.shift}
                          onChange={(e) => setEditFormData({ ...editFormData, shift: e.target.value })}
                          placeholder="GENERAL"
                        />
                        <Input
                          label="Daily Duty Hours"
                          type="number"
                          value={editFormData.dutyHours}
                          onChange={(e) => setEditFormData({ ...editFormData, dutyHours: Number(e.target.value) })}
                        />
                        <Input
                          label="Date of Joining"
                          type="date"
                          value={editFormData.dateOfJoining}
                          onChange={(e) => setEditFormData({ ...editFormData, dateOfJoining: e.target.value })}
                        />
                        <Select
                          label="Assigned System Role *"
                          value={editFormData.employeeRole}
                          onChange={(e) => setEditFormData({ ...editFormData, employeeRole: e.target.value })}
                          options={roles.map((r) => ({ value: r._id, label: r.displayName || r.name || r.slug || r._id }))}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                        <Button variant="secondary" onClick={() => setEditSection(null)} disabled={savingSection}>
                          Cancel
                        </Button>
                        <Button variant="primary" type="submit" icon={Save} loading={savingSection}>
                          Save Employment Info
                        </Button>
                      </div>
                    </form>
                  </DetailCard>
                ) : (
                  <div>
                    {/* Organization & Hierarchy Card */}
                    <DetailCard
                      title="Employment & Role Details"
                      icon={Briefcase}
                      action={
                        <Button
                          variant="secondary"
                          icon={Edit2}
                          onClick={() => startEditSection('employment')}
                          style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                        >
                          Edit Details
                        </Button>
                      }
                    >
                      <div className="grid-3">
                        <DetailField
                          label="Department"
                          value={formatDepartment(currentEmployeeDetail.employmentInfo?.department || currentEmployeeDetail.department)}
                          icon={Building}
                        />
                        <DetailField
                          label="Designation"
                          value={formatDesignation(currentEmployeeDetail.employmentInfo?.designation || currentEmployeeDetail.designation)}
                          icon={Briefcase}
                        />
                        <DetailField
                          label="Assigned Branch"
                          value={formatBranch(currentEmployeeDetail.employmentInfo?.branch || currentEmployeeDetail.branch)}
                          icon={MapPin}
                        />
                        <DetailField
                          label="Employment Type"
                          value={currentEmployeeDetail.employmentInfo?.employmentType || currentEmployeeDetail.employmentType || 'FULL_TIME'}
                          isBadge
                          badgeVariant="primary"
                        />
                        <DetailField
                          label="Work Operational Type"
                          value={currentEmployeeDetail.employmentInfo?.workType || currentEmployeeDetail.workType || 'OFFICE'}
                          isBadge
                          badgeVariant="info"
                        />
                        <DetailField
                          label="Shift & Daily Hours"
                          value={`${currentEmployeeDetail.employmentInfo?.shift || 'GENERAL'} (${currentEmployeeDetail.employmentInfo?.dutyHours || 8} hrs/day)`}
                          icon={Clock}
                        />
                        <DetailField
                          label="Date of Joining"
                          value={formatDate(currentEmployeeDetail.employmentInfo?.dateOfJoining)}
                          icon={Calendar}
                        />
                        <DetailField
                          label="Employment Status"
                          value={currentEmployeeDetail.employmentInfo?.employeeStatus || currentEmployeeDetail.status || 'ACTIVE'}
                          isBadge
                          badgeVariant={
                            (currentEmployeeDetail.employmentInfo?.employeeStatus || currentEmployeeDetail.status) === 'ACTIVE'
                              ? 'success'
                              : 'warning'
                          }
                        />
                        <DetailField
                          label="Reporting Manager"
                          value={
                            currentEmployeeDetail.employmentInfo?.reportingManager?.name ||
                            currentEmployeeDetail.reportingManager?.name ||
                            'Executive Board / HR Director'
                          }
                          icon={User}
                        />
                        <DetailField
                          label="Assigned System Role"
                          value={(() => {
                            const roleRef = currentEmployeeDetail.employmentInfo?.employeeRole || currentEmployeeDetail.employeeRole;
                            if (!roleRef) return 'Not Assigned';
                            if (typeof roleRef === 'object') return roleRef.displayName || roleRef.name || roleRef.slug || 'Role Assigned';
                            const matched = roles.find((r) => r._id === roleRef || r.name === roleRef);
                            return matched ? (matched.displayName || matched.name || matched.slug) : roleRef;
                          })()}
                          isBadge
                          badgeVariant="primary"
                          icon={ShieldCheck}
                        />
                        <DetailField
                          label="Salary Structure"
                          value={
                            currentEmployeeDetail.employmentInfo?.salaryStructure?.grossSalary
                              ? `₹${Number(currentEmployeeDetail.employmentInfo.salaryStructure.grossSalary).toLocaleString('en-IN')}/mo`
                              : (currentEmployeeDetail.salaryStructure?.grossSalary ? `₹${Number(currentEmployeeDetail.salaryStructure.grossSalary).toLocaleString('en-IN')}/mo` : 'Configured')
                          }
                          isBadge
                          badgeVariant="success"
                        />
                      </div>
                    </DetailCard>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: GOVERNMENT & BANK (PUT /employees/:id/government-details) */}
            {activeTab === 'government' && (
              <div>
                {editSection === 'government' ? (
                  <DetailCard
                    title="Edit Government & Bank Details"
                    subtitle="Update statutory identification numbers and payroll disbursement bank details"
                    icon={Landmark}
                  >
                    <form onSubmit={handleSaveSection}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '0.88rem',
                          color: 'var(--text-main)',
                          marginBottom: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <ShieldCheck size={16} color="var(--primary)" /> Statutory Identification & Tax Records
                      </div>
                      <div className="grid-3" style={{ marginBottom: 20 }}>
                        <Input
                          label="Aadhaar Number"
                          value={editFormData.aadhaarNumber}
                          onChange={(e) => setEditFormData({ ...editFormData, aadhaarNumber: e.target.value })}
                          placeholder="12-digit Aadhaar Number"
                        />
                        <Input
                          label="PAN Number"
                          value={editFormData.panNumber}
                          onChange={(e) => setEditFormData({ ...editFormData, panNumber: e.target.value })}
                          placeholder="e.g. ABCDE1234F"
                        />
                        <Input
                          label="PF Number"
                          value={editFormData.pfNumber}
                          onChange={(e) => setEditFormData({ ...editFormData, pfNumber: e.target.value })}
                          placeholder="Provident Fund ID"
                        />
                        <Input
                          label="ESIC Number"
                          value={editFormData.esicNumber}
                          onChange={(e) => setEditFormData({ ...editFormData, esicNumber: e.target.value })}
                          placeholder="ESIC Insurance Number"
                        />
                        <Input
                          label="UAN Number"
                          value={editFormData.uanNumber}
                          onChange={(e) => setEditFormData({ ...editFormData, uanNumber: e.target.value })}
                          placeholder="Universal Account Number"
                        />
                      </div>

                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '0.88rem',
                          color: 'var(--text-main)',
                          marginBottom: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Landmark size={16} color="var(--primary)" /> Bank & Settlement Account
                      </div>
                      <div className="grid-2">
                        <Input
                          label="Bank Name"
                          value={editFormData.bankName}
                          onChange={(e) => setEditFormData({ ...editFormData, bankName: e.target.value })}
                          placeholder="e.g. State Bank of India"
                        />
                        <Input
                          label="Bank Account Number"
                          value={editFormData.accountNumber}
                          onChange={(e) => setEditFormData({ ...editFormData, accountNumber: e.target.value })}
                          placeholder="e.g. 123456789012"
                        />
                        <Input
                          label="IFSC Code"
                          value={editFormData.ifscCode}
                          onChange={(e) => setEditFormData({ ...editFormData, ifscCode: e.target.value })}
                          placeholder="e.g. SBIN0001234"
                        />
                        <Input
                          label="Branch Name"
                          value={editFormData.branchName}
                          onChange={(e) => setEditFormData({ ...editFormData, branchName: e.target.value })}
                          placeholder="e.g. Surat Main Branch"
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                        <Button variant="secondary" onClick={() => setEditSection(null)} disabled={savingSection}>
                          Cancel
                        </Button>
                        <Button variant="primary" type="submit" icon={Save} loading={savingSection}>
                          Save Government Details
                        </Button>
                      </div>
                    </form>
                  </DetailCard>
                ) : (
                  <div>
                    {/* Card 1: Statutory & Tax Identification */}
                    <DetailCard
                      title="Statutory & Tax Identification"
                      icon={ShieldCheck}
                      action={
                        <Button
                          variant="secondary"
                          icon={Edit2}
                          onClick={() => startEditSection('government')}
                          style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                        >
                          Edit Details
                        </Button>
                      }
                    >
                      <div className="grid-3">
                        <DetailField
                          label="Aadhaar Number"
                          value={currentEmployeeDetail.governmentDetails?.aadhaarNumber}
                          isMono
                        />
                        <DetailField
                          label="PAN Number"
                          value={currentEmployeeDetail.governmentDetails?.panNumber}
                          isMono
                        />
                        <DetailField
                          label="Provident Fund (PF) Number"
                          value={currentEmployeeDetail.governmentDetails?.pfNumber}
                          isMono
                        />
                        <DetailField
                          label="ESIC Number"
                          value={currentEmployeeDetail.governmentDetails?.esicNumber}
                          isMono
                        />
                        <DetailField
                          label="Universal Account Number (UAN)"
                          value={currentEmployeeDetail.governmentDetails?.uanNumber}
                          isMono
                        />
                        <DetailField
                          label="Professional Tax (PT)"
                          value={
                            currentEmployeeDetail.governmentDetails?.professionalTaxInfo ||
                            currentEmployeeDetail.governmentDetails?.ptNumber ||
                            currentEmployeeDetail.ptNumber
                          }
                          isMono
                        />
                      </div>
                    </DetailCard>

                    {/* Card 2: Bank & Settlement Account */}
                    <DetailCard
                      title="Bank & Settlement Account"
                      icon={Landmark}
                    >
                      <div className="grid-2">
                        <DetailField
                          label="Bank Name"
                          value={
                            currentEmployeeDetail.governmentDetails?.bankAccountDetails?.bankName ||
                            currentEmployeeDetail.bankDetails?.bankName
                          }
                          icon={Landmark}
                        />
                        <DetailField
                          label="Bank Account Number"
                          value={
                            currentEmployeeDetail.governmentDetails?.bankAccountDetails?.accountNumber ||
                            currentEmployeeDetail.bankDetails?.accountNumber
                          }
                          isMono
                          icon={CreditCard}
                        />
                        <DetailField
                          label="IFSC Code"
                          value={
                            currentEmployeeDetail.governmentDetails?.bankAccountDetails?.ifscCode ||
                            currentEmployeeDetail.bankDetails?.ifscCode
                          }
                          isMono
                        />
                        <DetailField
                          label="Branch Name"
                          value={
                            currentEmployeeDetail.governmentDetails?.bankAccountDetails?.branchName ||
                            currentEmployeeDetail.bankDetails?.branchName
                          }
                          icon={Building}
                        />
                      </div>
                    </DetailCard>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: EMERGENCY CONTACT (PUT /employees/:id/emergency-contact) */}
            {activeTab === 'emergency' && (
              <div>
                {editSection === 'emergency' ? (
                  <DetailCard
                    title="Edit Emergency Contact"
                    subtitle="Provide contact details for immediate notification during medical or site contingencies"
                    icon={HeartHandshake}
                  >
                    <form onSubmit={handleSaveSection}>
                      <div className="grid-3">
                        <Input
                          label="Contact Person Name *"
                          value={editFormData.name}
                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                          required
                        />
                        <Input
                          label="Relationship *"
                          value={editFormData.relationship}
                          onChange={(e) => setEditFormData({ ...editFormData, relationship: e.target.value })}
                          required
                        />
                        <Input
                          label="Emergency Mobile Phone *"
                          type="tel"
                          isPhone={true}
                          value={editFormData.phone}
                          onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                          placeholder="10-digit emergency number"
                          required
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                        <Button variant="secondary" onClick={() => setEditSection(null)} disabled={savingSection}>
                          Cancel
                        </Button>
                        <Button variant="primary" type="submit" icon={Save} loading={savingSection}>
                          Save Emergency Contact
                        </Button>
                      </div>
                    </form>
                  </DetailCard>
                ) : (
                  <div>
                    <DetailCard
                      title="Emergency Contact Person"
                      icon={HeartHandshake}
                      action={
                        <Button
                          variant="secondary"
                          icon={Edit2}
                          onClick={() => startEditSection('emergency')}
                          style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                        >
                          Edit Details
                        </Button>
                      }
                    >
                      <div className="grid-3">
                        <DetailField
                          label="Contact Person Name"
                          value={
                            currentEmployeeDetail.emergencyContact?.name ||
                            currentEmployeeDetail.emergencyContact?.contactName
                          }
                          icon={User}
                        />
                        <DetailField
                          label="Relationship"
                          value={currentEmployeeDetail.emergencyContact?.relationship}
                          isBadge={Boolean(currentEmployeeDetail.emergencyContact?.relationship)}
                          badgeVariant="primary"
                        />
                        <DetailField
                          label="Emergency Mobile Phone"
                          value={
                            currentEmployeeDetail.emergencyContact?.phone ||
                            currentEmployeeDetail.emergencyContact?.mobileNumber
                          }
                          icon={Phone}
                        />
                      </div>
                    </DetailCard>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: BIOMETRIC & DOCUMENTS VAULT */}
            {activeTab === 'documents' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Face Biometric Status Banner */}
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '6px',
                        background: 'var(--primary-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                      }}
                    >
                      <ScanFace size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-main)' }}>
                        Biometric Face Profile
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Facial verification vectors for Zero-Proxy check-in/out
                      </div>
                    </div>
                  </div>
                  <div>
                    {currentEmployeeDetail.isFaceEnrolled === true ? (
                      <Badge variant="success" style={{ fontSize: '0.72rem', padding: '2px 7px' }}>Face Enrolled ✓</Badge>
                    ) : (
                      <Badge variant="warning" style={{ fontSize: '0.72rem', padding: '2px 7px' }}>⚠ Enrollment Pending</Badge>
                    )}
                  </div>
                </div>

                {/* Uploaded Documents List */}
                <DetailCard
                  title="Documents Vault"
                  icon={FileText}
                  action={
                    <Button
                      variant="primary"
                      icon={Upload}
                      onClick={() => setUploadDocOpen(true)}
                      style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                    >
                      Upload Document
                    </Button>
                  }
                >
                  {loadingDocs ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                      Loading documents...
                    </div>
                  ) : employeeDocs && employeeDocs.length > 0 ? (
                    <div
                      style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                      }}
                    >
                      {employeeDocs.map((doc, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 18px',
                            borderBottom: idx < employeeDocs.length - 1 ? '1px solid var(--border-light)' : 'none',
                            backgroundColor: idx % 2 === 0 ? '#ffffff' : 'var(--bg-subtle)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: '8px',
                                backgroundColor: 'var(--primary-light)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--primary)',
                              }}
                            >
                              <FileText size={18} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                {doc.title || doc.documentType || 'Attached Document'}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                Category: <Badge variant="secondary">{doc.type || doc.documentType || 'DOCUMENT'}</Badge>
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <a
                              href={doc.fileUrl || doc.documentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                              <Eye size={13} /> View File
                            </a>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => handleDeleteDocument(idx)}
                              title="Delete Document"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        border: '1px dashed var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: 30,
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.88rem',
                        background: 'var(--bg-subtle)',
                      }}
                    >
                      <FileText size={28} color="var(--text-light)" style={{ marginBottom: 8 }} />
                      <div>No documents attached yet.</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 4 }}>
                        Click "Upload Document" to attach Appointment Letter, KYC Aadhaar/PAN, or Resignation records.
                      </div>
                    </div>
                  )}
                </DetailCard>
              </div>
            )}

            {/* TAB 6: DIRECT REPORTS (GET /employees/:id/reports) */}
            {activeTab === 'reports' && (
              <div>
                <DetailCard
                  title="Direct Reports"
                  icon={Users}
                >
                  {loadingReports ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                      Loading direct reports...
                    </div>
                  ) : directReports && directReports.length > 0 ? (
                    <div
                      style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                      }}
                    >
                      {directReports.map((r, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 18px',
                            borderBottom: i < directReports.length - 1 ? '1px solid var(--border-light)' : 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                backgroundColor: 'var(--primary-subtle)',
                                color: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.88rem',
                              }}
                            >
                              {(r.basicInfo?.fullName || r.firstName || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                {r.basicInfo?.fullName || `${r.firstName || ''} ${r.lastName || ''}`.trim()}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                {r.basicInfo?.employeeCode || r.employeeCode} •{' '}
                                {formatDesignation(r.employmentInfo?.designation || r.designation)}
                              </div>
                            </div>
                          </div>
                          <Badge variant="success">
                            {r.employmentInfo?.employeeStatus || r.status || 'ACTIVE'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        border: '1px dashed var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: 30,
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.88rem',
                        background: 'var(--bg-subtle)',
                      }}
                    >
                      <Users size={28} color="var(--text-light)" style={{ marginBottom: 8 }} />
                      <div>No direct reports assigned to this employee.</div>
                    </div>
                  )}
                </DetailCard>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* UPLOAD DOCUMENT MODAL */}
      <Modal
        isOpen={uploadDocOpen}
        onClose={() => setUploadDocOpen(false)}
        title="Upload / Attach Employee Document"
        size="md"
      >
        <form onSubmit={handleUploadDocument}>
          <Select
            label="Document Category"
            value={newDocData.type}
            onChange={(e) => setNewDocData({ ...newDocData, type: e.target.value })}
            options={[
              { value: 'JOINING_LETTER', label: 'Joining Letter' },
              { value: 'APPOINTMENT_LETTER', label: 'Appointment Letter' },
              { value: 'RESIGNATION_LETTER', label: 'Resignation Letter' },
              { value: 'EXPERIENCE_LETTER', label: 'Experience Letter' },
              { value: 'OTHER', label: 'Other Government / KYC Document' },
            ]}
            required
          />
          <Input
            label="Document Title"
            value={newDocData.title}
            onChange={(e) => setNewDocData({ ...newDocData, title: e.target.value })}
            placeholder="e.g., Signed Appointment Letter 2026"
            required
          />

          <div style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
              Select File to Upload
            </label>
            <div
              style={{
                border: newDocData.file ? '1px solid #10b981' : '1.5px dashed var(--border-color)',
                borderRadius: 6,
                padding: '14px 16px',
                textAlign: 'center',
                backgroundColor: newDocData.file ? 'rgba(16, 185, 129, 0.04)' : 'var(--bg-subtle)',
                cursor: 'pointer',
              }}
              onClick={() => document.getElementById('single-doc-file-upload')?.click()}
            >
              {newDocData.file ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={20} color="#059669" />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#059669' }}>
                        {newDocData.file.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {(newDocData.file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="light"
                    icon={X}
                    onClick={(e) => {
                      e.stopPropagation();
                      setNewDocData((prev) => ({ ...prev, file: null }));
                    }}
                  />
                </div>
              ) : (
                <div>
                  <Upload size={22} color="var(--primary)" style={{ margin: '0 auto 6px', display: 'block' }} />
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--primary)' }}>
                    Click to Choose File (PDF, DOCX, JPG, PNG)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    File will be uploaded directly to server
                  </div>
                </div>
              )}
              <input
                id="single-doc-file-upload"
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    const f = e.target.files[0];
                    setNewDocData((prev) => ({
                      ...prev,
                      file: f,
                      title: prev.title || f.name.replace(/\.[^/.]+$/, ''),
                    }));
                  }
                }}
              />
            </div>
          </div>

          <div style={{ textAlign: 'center', margin: '6px 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            — OR USE DIRECT URL —
          </div>

          <Input
            label="Document File URL (Optional if file uploaded)"
            value={newDocData.fileUrl}
            onChange={(e) => setNewDocData({ ...newDocData, fileUrl: e.target.value })}
            placeholder="https://res.cloudinary.com/tie/..."
          />
          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setUploadDocOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={uploadingDoc}>
              Attach Document
            </Button>
          </div>
        </form>
      </Modal>

      {/* UPDATE STATUS MODAL (PUT /employees/:id/status) */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Update Employee Status"
        size="sm"
      >
        <div>
          <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Transition active status for{' '}
            <strong>
              {employeeToStatus?.basicInfo?.fullName || employeeToStatus?.firstName || 'Employee'}
            </strong>
            :
          </p>
          <Select
            label="Select New Status"
            value={targetStatus}
            onChange={(e) => setTargetStatus(e.target.value)}
            options={[
              { value: 'ACTIVE', label: 'ACTIVE (Full Access)' },
              { value: 'ON_LEAVE', label: 'ON_LEAVE (Temporary Leave)' },
              { value: 'SUSPENDED', label: 'SUSPENDED (Access Revoked)' },
            ]}
          />
          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleUpdateStatus} loading={updatingStatus}>
              Confirm Transition
            </Button>
          </div>
        </div>
      </Modal>

      {/* DELETE EMPLOYEE CONFIRMATION (DELETE /employees/:id) */}
      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteEmployee}
        title="Permanently Delete Employee"
        message={`Are you sure you want to permanently delete employee "${employeeToDelete?.basicInfo?.fullName || employeeToDelete?.firstName || ''}"? This action cannot be undone and will delete linked user credentials.`}
        confirmText="Delete Employee"
        confirmVariant="danger"
        loading={deleting}
      />

      {/* DEACTIVATE EMPLOYEE CONFIRMATION (PUT /employees/:id/deactivate) */}
      <ConfirmDialog
        isOpen={deactivateModalOpen}
        onClose={() => setDeactivateModalOpen(false)}
        onConfirm={handleDeactivateEmployee}
        title="Deactivate Employee & Revoke User Access"
        message={`Are you sure you want to deactivate "${employeeToDeactivate?.basicInfo?.fullName || employeeToDeactivate?.firstName || ''}"? This will disable employee status and immediately prevent login access for their linked account.`}
        confirmText="Deactivate Access"
        confirmVariant="warning"
        loading={deactivating}
      />

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <Modal
        isOpen={enrollModalOpen}
        onClose={() => setEnrollModalOpen(false)}
        title={`Face Registration — ${employeeToEnroll?.basicInfo?.fullName || employeeToEnroll?.firstName || ''} (${employeeToEnroll?.basicInfo?.employeeCode || employeeToEnroll?.employeeCode || ''})`}
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* === ACCESS DENIED: not Super Admin or HR Admin === */}
          {!canEnrollFace ? (
            <>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                padding: '36px 24px', backgroundColor: '#fff7ed',
                border: '1px solid #fed7aa', borderRadius: 12, textAlign: 'center',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  backgroundColor: '#ffedd5', display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <AlertTriangle size={28} color="#ea580c" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#9a3412', marginBottom: 6 }}>
                    Access Denied — Insufficient Permissions
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#c2410c', lineHeight: 1.6 }}>
                    Face enrollment requires <strong>Super Admin</strong> or <strong>HR Admin</strong> role.<br />
                    Please log in with an admin account to register employee faces.
                  </div>
                </div>
                <div style={{
                  padding: '8px 14px', backgroundColor: '#ffedd5',
                  borderRadius: 8, border: '1px solid #fdba74',
                  fontSize: '0.78rem', color: '#9a3412', fontWeight: 600,
                }}>
                  🔐 Your current role does not have permission for biometric enrollment
                </div>
              </div>
              <div className="modal-footer" style={{ margin: '14px -20px -20px' }}>
                <Button variant="secondary" onClick={() => setEnrollModalOpen(false)}>
                  Close
                </Button>
              </div>
            </>
          ) : (
            /* === AUTHORIZED: Super Admin or HR Admin — show camera === */
            <>
              {/* Visual 4-Step Pipeline */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ padding: '4px 6px', borderRadius: 6, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '0.72rem', fontWeight: 700, color: '#166534' }}>
                  ✓ 1. Employee Created
                </div>
                <div style={{ padding: '4px 6px', borderRadius: 6, backgroundColor: enrolling ? '#f0fdfa' : '#eff6ff', border: `1px solid ${enrolling ? '#99f6e4' : '#3b82f6'}`, fontSize: '0.72rem', fontWeight: 700, color: enrolling ? '#0f766e' : '#1d4ed8' }}>
                  {enrolling ? '⏳ Storing...' : '▶ 2. Capture Face'}
                </div>
                <div style={{ padding: '4px 6px', borderRadius: 6, backgroundColor: capturedFace && !enrolling ? '#f0fdf4' : '#f8fafc', border: `1px solid ${capturedFace && !enrolling ? '#bbf7d0' : 'var(--border-color)'}`, fontSize: '0.72rem', fontWeight: 600, color: capturedFace && !enrolling ? '#166534' : 'var(--text-muted)' }}>
                  {capturedFace && !enrolling ? '✓ 3. Face Stored' : '3. Face Stored'}
                </div>
                <div style={{ padding: '4px 6px', borderRadius: 6, backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  4. Ready for Attendance
                </div>
              </div>

              <div style={{ padding: '10px 12px', backgroundColor: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, fontSize: '0.84rem', color: '#0f766e' }}>
                <strong>📷 Auto-capture:</strong> Look into the camera — face will be captured and stored automatically.
              </div>

              {enrolling ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '30px 20px', backgroundColor: '#f0fdfa', borderRadius: 10, border: '1px solid #99f6e4' }}>
                  <div style={{ width: 48, height: 48, border: '4px solid #0f766e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <div style={{ fontWeight: 600, color: '#0f766e', fontSize: '0.9rem' }}>Storing face biometrics...</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Please wait while we register the facial template</div>
                </div>
              ) : (
                <CameraCapture
                  onCapture={handleAutoEnroll}
                  label="Look into the camera — auto-captures & stores face"
                />
              )}

              {capturedFace && !enrolling && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', fontSize: '0.85rem', padding: '8px 12px', backgroundColor: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                  <CheckCircle2 size={16} /> Face captured and stored successfully!
                </div>
              )}

              <div className="modal-footer" style={{ margin: '14px -20px -20px' }}>
                <Button variant="secondary" onClick={() => setEnrollModalOpen(false)} disabled={enrolling}>
                  {capturedFace ? 'Close' : 'Cancel / Complete Later'}
                </Button>
                {!capturedFace && !enrolling && (
                  <Button variant="primary" icon={ScanFace} onClick={handleEnrollFace} loading={enrolling} disabled={!capturedFace}>
                    Store Face
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default EmployeeList;
