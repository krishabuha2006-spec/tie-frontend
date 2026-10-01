import React, { useState, useEffect, useCallback } from 'react';
import holidayApi from '../../api/holidayApi';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import {
  Calendar,
  CalendarDays,
  Plus,
  Trash2,
  Edit2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  HelpCircle,
  Sliders,
  Building2,
  CalendarCheck2,
  Sun,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Select from '../../components/common/Select';
import { extractApiData } from '../../utils/apiUtils';

export const HolidayManagement = () => {
  const { user, isSuperAdmin, isHrAdmin, isDirector, isBranchManager } = useAuth();
  const isManagerOrAdmin = isSuperAdmin || isHrAdmin || isDirector || isBranchManager;
  const { showToast } = useToast();
  const confirm = useConfirm();

  // Active Tab: 'calendar' | 'weekly_off' | 'copy_year' | 'checker'
  const [activeTab, setActiveTab] = useState('calendar');

  // Master Data
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);

  // Year & Filters
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [typeFilter, setTypeFilter] = useState('ALL');

  // 1. Holiday Calendar State (GET /holidays)
  const [holidays, setHolidays] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);

  // 2. Upcoming Holidays State (GET /holidays/upcoming)
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);

  // 3. Weekly-Off Configs State (GET /weekly-off-configs)
  const [weeklyOffConfigs, setWeeklyOffConfigs] = useState([]);
  const [loadingWeeklyOff, setLoadingWeeklyOff] = useState(false);

  // Modals & Forms
  // Add / Edit Holiday Modal (POST /holidays & PUT /holidays/:id)
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [submittingHoliday, setSubmittingHoliday] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    type: 'FESTIVAL',
    scope: 'COMPANY',
    isOptional: false,
    description: '',
    company: '',
  });

  // Weekly-Off Modal (POST /weekly-off-configs & PUT /weekly-off-configs/:id)
  const [weeklyOffModalOpen, setWeeklyOffModalOpen] = useState(false);
  const [editingWeeklyOff, setEditingWeeklyOff] = useState(null);
  const [submittingWeeklyOff, setSubmittingWeeklyOff] = useState(false);
  const [weeklyOffForm, setWeeklyOffForm] = useState({
    name: 'General Weekly-Off',
    days: ['SUNDAY'],
    alternateSaturdays: false,
    company: '',
    branch: '',
  });

  // Copy From Year (POST /holidays/copy-from-year)
  const [copyYearForm, setCopyYearForm] = useState({
    sourceYear: currentYear - 1,
    targetYear: currentYear,
    company: '',
  });
  const [submittingCopyYear, setSubmittingCopyYear] = useState(false);

  // Check Non-Working Day (GET /holidays/check-non-working-day)
  const [checkDate, setCheckDate] = useState(new Date().toISOString().split('T')[0]);
  const [checkingDay, setCheckingDay] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  // Safe list extractor
  const toList = (res, ...keys) =>
    extractApiData(res, ...keys, 'holidays', 'upcoming', 'configs', 'weeklyOffConfigs', 'data');

  // Load Companies & Branches
  const loadMasters = useCallback(async () => {
    try {
      const [cRes, bRes] = await Promise.allSettled([
        masterApi.getCompanies(),
        masterApi.getBranches(),
      ]);
      const compList = cRes.status === 'fulfilled' ? toList(cRes.value, 'companies') : [];
      const branchList = bRes.status === 'fulfilled' ? toList(bRes.value, 'branches') : [];
      setCompanies(compList);
      setBranches(branchList);
      if (compList.length > 0) {
        setHolidayForm((prev) => ({ ...prev, company: compList[0]._id }));
        setWeeklyOffForm((prev) => ({ ...prev, company: compList[0]._id }));
        setCopyYearForm((prev) => ({ ...prev, company: compList[0]._id }));
      }
    } catch (err) {
      console.error('Error loading masters:', err);
    }
  }, []);

  // 1. Load Holidays (GET /holidays)
  const loadHolidays = useCallback(async () => {
    setLoadingHolidays(true);
    try {
      const params = {};
      if (selectedYear) params.year = selectedYear;
      if (typeFilter && typeFilter !== 'ALL') params.type = typeFilter;
      params.scope = 'COMPANY';
      const res = await holidayApi.getHolidays(params);
      const list = toList(res, 'holidays');
      // Sort chronologically
      list.sort((a, b) => new Date(a.date) - new Date(b.date));
      setHolidays(list);
    } catch (err) {
      console.error('Error loading holidays:', err);
      setHolidays([]);
    } finally {
      setLoadingHolidays(false);
    }
  }, [selectedYear, typeFilter]);

  // 2. Load Upcoming Holidays (GET /holidays/upcoming)
  const loadUpcoming = useCallback(async () => {
    setLoadingUpcoming(true);
    try {
      const res = await holidayApi.getUpcomingHolidays();
      const list = toList(res, 'holidays', 'upcoming');
      setUpcomingHolidays(list);
    } catch (err) {
      console.error('Error loading upcoming holidays:', err);
      setUpcomingHolidays([]);
    } finally {
      setLoadingUpcoming(false);
    }
  }, []);

  // 3. Load Weekly-Off Configs (GET /weekly-off-configs)
  const loadWeeklyOffConfigs = useCallback(async () => {
    setLoadingWeeklyOff(true);
    try {
      const res = await holidayApi.getWeeklyOffConfigs();
      const list = toList(res, 'weeklyOffConfigs', 'configs');
      setWeeklyOffConfigs(list);
    } catch (err) {
      console.error('Error loading weekly off configs:', err);
      setWeeklyOffConfigs([]);
    } finally {
      setLoadingWeeklyOff(false);
    }
  }, []);

  // Initial mount
  useEffect(() => {
    loadMasters();
    loadUpcoming();
  }, [loadMasters, loadUpcoming]);

  // Tab switch effect: dynamic backend sync
  useEffect(() => {
    if (activeTab === 'calendar') loadHolidays();
    else if (activeTab === 'weekly_off') loadWeeklyOffConfigs();
  }, [activeTab, loadHolidays, loadWeeklyOffConfigs]);

  // Create or Update Holiday (POST /holidays or PUT /holidays/:id)
  const handleSaveHoliday = async (e) => {
    e.preventDefault();
    if (!holidayForm.name.trim() || !holidayForm.date) {
      showToast('Holiday name and date are required', 'warning');
      return;
    }

    setSubmittingHoliday(true);
    try {
      const targetCompany =
        holidayForm.company ||
        (companies.length > 0 ? companies[0]._id : null) ||
        user?.company?._id ||
        (typeof user?.company === 'string' ? user.company : null);

      const targetBranch =
        holidayForm.branch ||
        (branches.length > 0 ? branches[0]._id : null) ||
        user?.branch?._id ||
        (typeof user?.branch === 'string' ? user.branch : null);

      const scope = holidayForm.scope || 'COMPANY';
      const reference = scope === 'BRANCH' ? targetBranch : targetCompany;

      const payload = {
        name: holidayForm.name.trim(),
        date: holidayForm.date,
        type: holidayForm.type || 'FESTIVAL',
        scope,
        reference,
        isOptional: Boolean(holidayForm.isOptional),
        isActive: true,
      };

      if (editingHoliday?._id) {
        await holidayApi.updateHoliday(editingHoliday._id, payload);
        showToast('Holiday updated successfully!', 'success');
      } else {
        await holidayApi.createHoliday(payload);
        showToast('Holiday created and published to calendar!', 'success');
      }

      setHolidayModalOpen(false);
      setEditingHoliday(null);
      setHolidayForm({
        name: '',
        date: new Date().toISOString().split('T')[0],
        type: 'FESTIVAL',
        scope: 'COMPANY',
        isOptional: false,
        description: '',
        company: companies[0]?._id || '',
      });

      await loadHolidays();
      await loadUpcoming();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save holiday', 'error');
    } finally {
      setSubmittingHoliday(false);
    }
  };

  const handleOpenEditHoliday = (h) => {
    setEditingHoliday(h);
    setHolidayForm({
      name: h.name || '',
      date: h.date ? h.date.split('T')[0] : '',
      type: h.type || 'FESTIVAL',
      scope: h.scope || 'COMPANY',
      isOptional: Boolean(h.isOptional),
      description: h.description || '',
      company: h.company?._id || h.company || '',
    });
    setHolidayModalOpen(true);
  };

  // Delete Holiday (DELETE /holidays/:id)
  const handleDeleteHoliday = async (holiday) => {
    const holidayId = typeof holiday === 'object' ? holiday._id : holiday;
    const holidayName = typeof holiday === 'object' ? holiday.name : 'this holiday';

    const isConfirmed = await confirm({
      title: 'Remove Holiday',
      message: `Are you sure you want to remove "${holidayName}" from the company holiday calendar? This cannot be undone.`,
      confirmText: 'Yes, Remove Holiday',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!isConfirmed) return;

    try {
      await holidayApi.deleteHoliday(holidayId);
      showToast('Holiday removed from calendar', 'info');
      await loadHolidays();
      await loadUpcoming();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete holiday', 'error');
    }
  };

  // Copy Holidays from Year (POST /holidays/copy-from-year)
  const handleCopyYear = async (e) => {
    e.preventDefault();
    if (!copyYearForm.sourceYear || !copyYearForm.targetYear) {
      showToast('Please provide source and target years', 'warning');
      return;
    }
    if (copyYearForm.sourceYear === copyYearForm.targetYear) {
      showToast('Source Year and Target Year must be different', 'warning');
      return;
    }

    setSubmittingCopyYear(true);
    try {
      const res = await holidayApi.copyHolidaysFromYear(copyYearForm);
      showToast(`Holidays duplicated from ${copyYearForm.sourceYear} to ${copyYearForm.targetYear}!`, 'success');
      setSelectedYear(copyYearForm.targetYear);
      setActiveTab('calendar');
      await loadHolidays();
      await loadUpcoming();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to copy holidays across years', 'error');
    } finally {
      setSubmittingCopyYear(false);
    }
  };

  // Check Non-Working Day (GET /holidays/check-non-working-day)
  const handleCheckNonWorkingDay = async (e) => {
    if (e) e.preventDefault();
    if (!checkDate) return;
    setCheckingDay(true);
    setCheckResult(null);
    try {
      const res = await holidayApi.checkNonWorkingDay(checkDate);
      setCheckResult(res?.data || res);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to check non-working day', 'error');
    } finally {
      setCheckingDay(false);
    }
  };

  // Create or Update Weekly-Off (POST /weekly-off-configs or PUT /weekly-off-configs/:id)
  const handleSaveWeeklyOff = async (e) => {
    e.preventDefault();
    if (!weeklyOffForm.name.trim() || weeklyOffForm.days.length === 0) {
      showToast('Policy name and at least one weekly-off day are required', 'warning');
      return;
    }

    setSubmittingWeeklyOff(true);
    try {
      if (editingWeeklyOff?._id) {
        await holidayApi.updateWeeklyOffConfig(editingWeeklyOff._id, weeklyOffForm);
        showToast('Weekly-Off configuration updated!', 'success');
      } else {
        await holidayApi.createWeeklyOffConfig(weeklyOffForm);
        showToast('Weekly-Off configuration created!', 'success');
      }
      setWeeklyOffModalOpen(false);
      setEditingWeeklyOff(null);
      setWeeklyOffForm({
        name: 'General Weekly-Off',
        days: ['SUNDAY'],
        alternateSaturdays: false,
        company: companies[0]?._id || '',
        branch: '',
      });
      await loadWeeklyOffConfigs();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save weekly-off config', 'error');
    } finally {
      setSubmittingWeeklyOff(false);
    }
  };

  const handleOpenEditWeeklyOff = (w) => {
    setEditingWeeklyOff(w);
    setWeeklyOffForm({
      name: w.name || '',
      days: w.days || ['SUNDAY'],
      alternateSaturdays: Boolean(w.alternateSaturdays),
      company: w.company?._id || w.company || '',
      branch: w.branch?._id || w.branch || '',
    });
    setWeeklyOffModalOpen(true);
  };

  // Toggle Day Selection
  const toggleWeeklyOffDay = (day) => {
    setWeeklyOffForm((prev) => {
      const exists = prev.days.includes(day);
      const nextDays = exists ? prev.days.filter((d) => d !== day) : [...prev.days, day];
      return { ...prev, days: nextDays };
    });
  };

  // Compute Holiday stats
  const totalInYear = holidays.length;
  const mandatoryCount = holidays.filter((h) => !h.isOptional).length;
  const optionalCount = holidays.filter((h) => h.isOptional).length;

  const daysOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-family)' }}>
      {/* 1. Header Card */}
      <div style={{
        background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
        padding: '16px 20px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 14
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, #1e565d 100%)',
            color: '#fff', padding: 10, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Calendar size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              Holiday &amp; Weekly-Off Management
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              National, Festival &amp; Company calendars, weekly-off configurations, and day exclusions
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {isManagerOrAdmin && (
            <>
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => {
                  setEditingHoliday(null);
                  setHolidayForm({
                    name: '',
                    date: new Date().toISOString().split('T')[0],
                    type: 'FESTIVAL',
                    scope: 'COMPANY',
                    isOptional: false,
                    description: '',
                    company: companies[0]?._id || '',
                  });
                  setHolidayModalOpen(true);
                }}
              >
                Add Holiday
              </Button>

              <Button
                variant="secondary"
                icon={Sliders}
                onClick={() => {
                  setEditingWeeklyOff(null);
                  setWeeklyOffForm({
                    name: 'General Weekly-Off',
                    days: ['SUNDAY'],
                    alternateSaturdays: false,
                    company: companies[0]?._id || '',
                    branch: '',
                  });
                  setWeeklyOffModalOpen(true);
                }}
              >
                Configure Weekly-Off
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'var(--primary-light, #edf7f8)', color: 'var(--primary, #3f929a)', padding: 10, borderRadius: 8 }}>
            <CalendarDays size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {totalInYear} Holidays
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total in {selectedYear}</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#16a34a15', color: '#16a34a', padding: 10, borderRadius: 8 }}>
            <CalendarCheck2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#16a34a' }}>
              {mandatoryCount} Gazetted
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Mandatory Paid Holidays</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#d9770615', color: '#d97706', padding: 10, borderRadius: 8 }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#d97706' }}>
              {optionalCount} Optional
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Floating / Restricted Holidays</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#8b5cf615', color: '#8b5cf6', padding: 10, borderRadius: 8 }}>
            <Sun size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {weeklyOffConfigs.length} Policies
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Weekly-Off Configurations</div>
          </div>
        </div>
      </div>

      {/* 3. Upcoming Holidays Strip */}
      {upcomingHolidays.length > 0 && (
        <div style={{
          background: 'linear-gradient(90deg, #f0fdf4 0%, #e0f2fe 100%)',
          borderRadius: 10, border: '1px solid #bbf7d0', padding: '12px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={18} color="#16a34a" />
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#166534' }}>
              Next Upcoming Holiday:
            </span>
            <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a' }}>
              {upcomingHolidays[0]?.name}
            </span>
            <span style={{ fontSize: '0.82rem', color: '#475569' }}>
              &bull; {new Date(upcomingHolidays[0]?.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge variant="success">{upcomingHolidays[0]?.type || 'HOLIDAY'}</Badge>
            {upcomingHolidays.length > 1 && (
              <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                +{upcomingHolidays.length - 1} more coming up
              </span>
            )}
          </div>
        </div>
      )}

      {/* 4. Navigation Tabs */}
      <div style={{
        display: 'flex', gap: 6, background: '#fff', padding: '6px',
        borderRadius: 10, border: '1px solid #e2e8f0', width: 'fit-content'
      }}>
        <button
          onClick={() => setActiveTab('calendar')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 7, border: 'none', fontSize: '0.84rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === 'calendar' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'calendar' ? '#fff' : '#64748b',
          }}
        >
          <Calendar size={15} /> Holiday Calendar ({holidays.length})
        </button>

        <button
          onClick={() => setActiveTab('weekly_off')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 7, border: 'none', fontSize: '0.84rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === 'weekly_off' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'weekly_off' ? '#fff' : '#64748b',
          }}
        >
          <Sliders size={15} /> Weekly-Off Configs ({weeklyOffConfigs.length})
        </button>

        {isManagerOrAdmin && (
          <button
            onClick={() => setActiveTab('copy_year')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
              borderRadius: 7, border: 'none', fontSize: '0.84rem', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              background: activeTab === 'copy_year' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'copy_year' ? '#fff' : '#64748b',
            }}
          >
            <Copy size={15} /> Copy Year
          </button>
        )}

        <button
          onClick={() => setActiveTab('checker')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 7, border: 'none', fontSize: '0.84rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === 'checker' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'checker' ? '#fff' : '#64748b',
          }}
        >
          <HelpCircle size={15} /> Non-Working Day Checker
        </button>
      </div>

      {/* ================================================================== */}
      {/* TAB 1: HOLIDAY CALENDAR */}
      {/* ================================================================== */}
      {activeTab === 'calendar' && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Filters Bar */}
          <div style={{
            padding: '12px 18px', borderBottom: '1px solid #e2e8f0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>Calendar Year:</span>
                <Select
                  value={String(selectedYear)}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  style={{ minWidth: 110 }}
                  options={[currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => ({ value: String(y), label: String(y) }))}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>Type:</span>
                <Select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{ minWidth: 180 }}
                  options={[
                    { value: 'ALL', label: 'All Holiday Types' },
                    { value: 'NATIONAL', label: 'National / Gazetted' },
                    { value: 'FESTIVAL', label: 'Festival' },
                    { value: 'COMPANY', label: 'Company Specific' },
                    { value: 'OPTIONAL', label: 'Optional' },
                  ]}
                />
              </div>
            </div>

            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Showing {holidays.length} Holidays in {selectedYear}
            </span>
          </div>

          {loadingHolidays ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Clock size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <div>Loading holiday calendar from backend...</div>
            </div>
          ) : holidays.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Calendar size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600 }}>No holidays registered for {selectedYear}</div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                {isManagerOrAdmin
                  ? 'Click "Add Holiday" above or use "Copy Year" to import from a previous year.'
                  : 'Contact HR Administration for organization calendar updates.'}
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '10px 16px' }}>Date</th>
                    <th style={{ padding: '10px 16px' }}>Holiday Name</th>
                    <th style={{ padding: '10px 16px' }}>Type</th>
                    <th style={{ padding: '10px 16px' }}>Scope</th>
                    <th style={{ padding: '10px 16px' }}>Classification</th>
                    <th style={{ padding: '10px 16px' }}>Description</th>
                    {isManagerOrAdmin && <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((h) => {
                    const dateObj = h.date ? new Date(h.date) : null;
                    const dateStr = dateObj
                      ? dateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                      : '—';

                    return (
                      <tr key={h._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--primary)' }}>
                          {dateStr}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                          {h.name}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge variant="neutral">{h.type || 'FESTIVAL'}</Badge>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>
                          {h.scope || 'COMPANY'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge variant={h.isOptional ? 'warning' : 'success'}>
                            {h.isOptional ? 'OPTIONAL' : 'MANDATORY'}
                          </Badge>
                        </td>
                        <td style={{ padding: '12px 16px', maxWidth: 240, color: '#64748b' }}>
                          {h.description || '—'}
                        </td>
                        {isManagerOrAdmin && (
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={Edit2}
                                onClick={() => handleOpenEditHoliday(h)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                icon={Trash2}
                                onClick={() => handleDeleteHoliday(h)}
                              />
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 2: WEEKLY-OFF CONFIGURATIONS */}
      {/* ================================================================== */}
      {activeTab === 'weekly_off' && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                Weekly-Off Schedule Policies
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Defines weekend and scheduled off-days across branches and corporate entities
              </p>
            </div>
            {isManagerOrAdmin && (
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setEditingWeeklyOff(null);
                  setWeeklyOffForm({
                    name: 'General Weekly-Off',
                    days: ['SUNDAY'],
                    alternateSaturdays: false,
                    company: companies[0]?._id || '',
                    branch: '',
                  });
                  setWeeklyOffModalOpen(true);
                }}
              >
                New Weekly-Off Policy
              </Button>
            )}
          </div>

          {loadingWeeklyOff ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Clock size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <div>Loading weekly-off policies...</div>
            </div>
          ) : weeklyOffConfigs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
              <Sliders size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600 }}>No weekly-off configurations registered</div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                Click &ldquo;New Weekly-Off Policy&rdquo; to establish corporate weekend schedules.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {weeklyOffConfigs.map((w) => {
                const dayBadges = (w.days || []).map((d) => d.toUpperCase());
                return (
                  <div key={w._id} style={{
                    background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0',
                    padding: 16, display: 'flex', flexDirection: 'column', gap: 12
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>{w.name}</span>
                      <Badge variant="primary">ACTIVE</Badge>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {dayBadges.map((day) => (
                        <span key={day} style={{
                          background: '#e0f2fe', color: '#0369a1', fontSize: '0.72rem',
                          fontWeight: 700, padding: '3px 8px', borderRadius: 6
                        }}>
                          {day}
                        </span>
                      ))}
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div>Alternate Saturdays: <strong>{w.alternateSaturdays ? 'Yes (2nd & 4th Off)' : 'No'}</strong></div>
                      {w.company && <div>Company: <strong>{w.company?.name || 'All Entities'}</strong></div>}
                      {w.branch && <div>Branch: <strong>{w.branch?.name || 'All Branches'}</strong></div>}
                    </div>

                    {isManagerOrAdmin && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Edit2}
                          onClick={() => handleOpenEditWeeklyOff(w)}
                        >
                          Edit Config
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 3: YEAR DUPLICATION */}
      {/* ================================================================== */}
      {activeTab === 'copy_year' && isManagerOrAdmin && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 22, maxWidth: 540 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Copy size={20} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Duplicate Holidays to New Year
            </h3>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: '#64748b' }}>
            Copy all standard recurring festival and gazetted holidays from a past year to the upcoming calendar year automatically.
          </p>

          <form onSubmit={handleCopyYear} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Source Year *</label>
                <input
                  type="number"
                  value={copyYearForm.sourceYear}
                  onChange={(e) => setCopyYearForm({ ...copyYearForm, sourceYear: Number(e.target.value) })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Target Year *</label>
                <input
                  type="number"
                  value={copyYearForm.targetYear}
                  onChange={(e) => setCopyYearForm({ ...copyYearForm, targetYear: Number(e.target.value) })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Target Company Entity</label>
              <select
                value={copyYearForm.company}
                onChange={(e) => setCopyYearForm({ ...copyYearForm, company: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                <option value="">All Companies</option>
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            <Button
              variant="primary"
              type="submit"
              icon={Copy}
              loading={submittingCopyYear}
              style={{ marginTop: 6 }}
            >
              Duplicate Holidays
            </Button>
          </form>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 4: NON-WORKING DAY CHECKER */}
      {/* ================================================================== */}
      {activeTab === 'checker' && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 22, maxWidth: 540 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <HelpCircle size={20} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Interactive Non-Working Day Verification
            </h3>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: '#64748b' }}>
            Verify whether a specified date qualifies as a working day, gazetted holiday, or scheduled weekly-off in backend logic.
          </p>

          <form onSubmit={handleCheckNonWorkingDay} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Select Date *</label>
              <input
                type="date"
                value={checkDate}
                onChange={(e) => setCheckDate(e.target.value)}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>
            <Button variant="primary" type="submit" loading={checkingDay}>
              Verify Date
            </Button>
          </form>

          {checkResult && (
            <div style={{
              background: checkResult.isNonWorkingDay || checkResult.isHoliday || checkResult.isWeeklyOff ? '#fef3c7' : '#f0fdf4',
              borderRadius: 8, border: `1px solid ${checkResult.isNonWorkingDay || checkResult.isHoliday || checkResult.isWeeklyOff ? '#fde68a' : '#bbf7d0'}`,
              padding: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {checkResult.isNonWorkingDay || checkResult.isHoliday || checkResult.isWeeklyOff ? (
                  <AlertCircle size={20} color="#d97706" />
                ) : (
                  <CheckCircle2 size={20} color="#16a34a" />
                )}
                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                  {checkResult.isNonWorkingDay || checkResult.isHoliday || checkResult.isWeeklyOff
                    ? 'Non-Working Day (Holiday / Off)'
                    : 'Standard Official Working Day'}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#334155' }}>
                {checkResult.reason || checkResult.holiday?.name || (checkResult.isWeeklyOff ? 'Scheduled Weekly-Off' : 'Regular Working Shift')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: ADD / EDIT HOLIDAY (POST /holidays & PUT /holidays/:id) */}
      {/* ================================================================== */}
      {holidayModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => {
            setHolidayModalOpen(false);
            setEditingHoliday(null);
          }}
          title={editingHoliday ? `Edit Holiday: ${editingHoliday.name}` : 'Add New Corporate Holiday'}
          maxWidth="480px"
        >
          <form onSubmit={handleSaveHoliday} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Holiday Name *</label>
              <input
                type="text"
                placeholder="e.g. Diwali, Republic Day"
                value={holidayForm.name}
                onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Date *</label>
                <input
                  type="date"
                  value={holidayForm.date}
                  onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Type</label>
                <select
                  value={holidayForm.type}
                  onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                >
                  <option value="NATIONAL">National / Gazetted</option>
                  <option value="FESTIVAL">Festival</option>
                  <option value="COMPANY_SPECIFIC">Company Specific</option>
                  <option value="OPTIONAL">Optional / Floating</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Scope</label>
                <select
                  value={holidayForm.scope}
                  onChange={(e) => setHolidayForm({ ...holidayForm, scope: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                >
                  <option value="COMPANY">COMPANY</option>
                  <option value="BRANCH">BRANCH</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', marginTop: 16 }}>
                <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={holidayForm.isOptional}
                    onChange={(e) => setHolidayForm({ ...holidayForm, isOptional: e.target.checked })}
                  />
                  Optional / Floating Holiday
                </label>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Description / Notes</label>
              <textarea
                rows={2}
                placeholder="Optional notes or details"
                value={holidayForm.description}
                onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setHolidayModalOpen(false);
                  setEditingHoliday(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submittingHoliday}>
                {editingHoliday ? 'Save Changes' : 'Create Holiday'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* MODAL: WEEKLY-OFF CONFIG (POST /weekly-off-configs & PUT /weekly-off-configs/:id) */}
      {/* ================================================================== */}
      {weeklyOffModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => {
            setWeeklyOffModalOpen(false);
            setEditingWeeklyOff(null);
          }}
          title={editingWeeklyOff ? `Edit Weekly-Off: ${editingWeeklyOff.name}` : 'Configure Weekly-Off Schedule'}
          maxWidth="500px"
        >
          <form onSubmit={handleSaveWeeklyOff} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Policy Name *</label>
              <input
                type="text"
                placeholder="e.g. Standard 5.5-Day Shift"
                value={weeklyOffForm.name}
                onChange={(e) => setWeeklyOffForm({ ...weeklyOffForm, name: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>Weekly-Off Days *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {daysOfWeek.map((d) => {
                  const isChecked = weeklyOffForm.days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleWeeklyOffDay(d)}
                      style={{
                        padding: '6px 12px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700,
                        border: isChecked ? '1px solid var(--primary)' : '1px solid #cbd5e1',
                        background: isChecked ? 'var(--primary)' : '#fff',
                        color: isChecked ? '#fff' : '#475569',
                        cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      {d.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={weeklyOffForm.alternateSaturdays}
                  onChange={(e) => setWeeklyOffForm({ ...weeklyOffForm, alternateSaturdays: e.target.checked })}
                />
                Alternate Saturdays Off (2nd &amp; 4th Saturday Off)
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Company Entity</label>
                <select
                  value={weeklyOffForm.company}
                  onChange={(e) => setWeeklyOffForm({ ...weeklyOffForm, company: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                >
                  <option value="">All Companies</option>
                  {companies.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Branch Location</label>
                <select
                  value={weeklyOffForm.branch}
                  onChange={(e) => setWeeklyOffForm({ ...weeklyOffForm, branch: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setWeeklyOffModalOpen(false);
                  setEditingWeeklyOff(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submittingWeeklyOff}>
                {editingWeeklyOff ? 'Update Policy' : 'Create Policy'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};

export default HolidayManagement;
