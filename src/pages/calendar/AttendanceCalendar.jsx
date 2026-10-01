import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import calendarApi from '../../api/calendarApi';
import employeeApi from '../../api/employeeApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Timer,
  Sparkles,
  Users,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Coffee,
  Briefcase,
  MapPin,
  RefreshCw,
  Info,
  CalendarDays,
  CalendarOff,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  FileText,
  Gift,
  User,
  Search,
  ChevronDown,
  Check,
  X,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';

export const AttendanceCalendar = () => {
  const { user, isSuperAdmin, isHrAdmin, isDirector, isBranchManager } = useAuth();
  const canSelectStaff = isSuperAdmin || isHrAdmin || isDirector || isBranchManager;
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Current real-world date
  const realToday = useMemo(() => new Date(), []);

  // State: selected month & year (defaults to current date)
  const [currentDate, setCurrentDate] = useState(new Date());

  // State: Selected Employee (defaults to logged-in employee)
  const myEmpId = user?.employee?._id || user?.employee || user?._id;
  const [selectedEmpId, setSelectedEmpId] = useState(myEmpId || '');
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const empDropdownRef = useRef(null);

  // Data states
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [weeklyOffConfigs, setWeeklyOffConfigs] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  // Day detail modal state
  const [selectedDayData, setSelectedDayData] = useState(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);

  // ─── Format Helpers ──────────────────────────────────────────────────────────
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthName = monthNames[month];

  // Helper: Format Time 12H (HH:MM AM/PM)
  const formatTime12 = (isoStr) => {
    if (!isoStr) return '--:--';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '--:--';
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '--:--';
    }
  };

  // Helper: Format Duration (e.g. "8 hrs 47 mins")
  const formatDuration = (hoursNum) => {
    if (hoursNum == null || isNaN(hoursNum) || hoursNum <= 0) return '0 hrs';
    const totalMinutes = Math.round(hoursNum * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m} mins`;
    if (m === 0) return `${h} hrs`;
    return `${h} hrs ${m} mins`;
  };

  // ─── Load Employee Masters (for managers/admins) ─────────────────────────────
  useEffect(() => {
    if (!canSelectStaff) return;
    const fetchStaff = async () => {
      setLoadingEmployees(true);
      try {
        const res = await employeeApi.getEmployees({ limit: 200 });
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.employees)
          ? res.employees
          : Array.isArray(res)
          ? res
          : [];
        setEmployees(list);
      } catch (err) {
        console.error('Error fetching employee list for calendar:', err);
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchStaff();
  }, [canSelectStaff]);

  // Ensure default selectedEmpId is populated once user is ready
  useEffect(() => {
    if (myEmpId && !selectedEmpId) {
      setSelectedEmpId(myEmpId);
    }
  }, [myEmpId, selectedEmpId]);

  // ─── Fetch Calendar, Attendance & Holiday Data ───────────────────────────────
  const fetchMonthData = useCallback(async () => {
    setLoading(true);
    const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    try {
      // 1. Unified Calendar Events (GET /calendar/events)
      const eventsPromise = calendarApi.getEvents({
        startDate: startStr,
        endDate: endStr,
      });

      // 2. Attendance History: for selected employee or self
      const empToFetch = selectedEmpId || myEmpId;
      const isSelf = !selectedEmpId || selectedEmpId === myEmpId;

      const officePromise = isSelf
        ? calendarApi.getMyOfficeAttendance({ from: startStr, to: endStr, limit: 100 })
        : calendarApi.getEmployeeOfficeAttendance(empToFetch, { from: startStr, to: endStr, limit: 100 });

      const fieldPromise = isSelf
        ? calendarApi.getMyFieldAttendance({ from: startStr, to: endStr, limit: 100 })
        : calendarApi.getEmployeeFieldAttendance(empToFetch, { from: startStr, to: endStr, limit: 100 });

      // 3. Corporate Holidays (GET /holidays)
      const holidaysPromise = calendarApi.getHolidays({ year, scope: 'COMPANY' });

      // 4. Weekly-Off Configs (GET /weekly-off-configs)
      const weeklyOffPromise = calendarApi.getWeeklyOffConfigs();

      // 5. Approved Leaves
      const leavesPromise = isSelf
        ? calendarApi.getMyLeaves({ year })
        : calendarApi.getEmployeeLeaves(empToFetch, { year });

      const [eventsRes, officeRes, fieldRes, holidayRes, weeklyOffRes, leavesRes] = await Promise.allSettled([
        eventsPromise,
        officePromise,
        fieldPromise,
        holidaysPromise,
        weeklyOffPromise,
        leavesPromise,
      ]);

      // Parse Events
      const evList = eventsRes.status === 'fulfilled' && eventsRes.value?.events
        ? eventsRes.value.events
        : [];
      setCalendarEvents(evList);

      // Parse Attendance Records (Office + Field)
      const officeRecords = officeRes.status === 'fulfilled'
        ? (officeRes.value?.records || officeRes.value?.data || (Array.isArray(officeRes.value) ? officeRes.value : []))
        : [];
      const fieldRecords = fieldRes.status === 'fulfilled'
        ? (fieldRes.value?.records || fieldRes.value?.data || (Array.isArray(fieldRes.value) ? fieldRes.value : []))
        : [];
      setAttendanceRecords([...officeRecords, ...fieldRecords]);

      // Parse Holidays
      const holList = holidayRes.status === 'fulfilled'
        ? (holidayRes.value?.data || holidayRes.value?.holidays || (Array.isArray(holidayRes.value) ? holidayRes.value : []))
        : [];
      setHolidays(holList);

      // Parse Weekly Offs
      const woList = weeklyOffRes.status === 'fulfilled'
        ? (weeklyOffRes.value?.data || weeklyOffRes.value?.configs || (Array.isArray(weeklyOffRes.value) ? weeklyOffRes.value : []))
        : [];
      setWeeklyOffConfigs(woList);

      // Parse Leaves
      const lList = leavesRes.status === 'fulfilled'
        ? (leavesRes.value?.leaveRequests || leavesRes.value?.requests || (Array.isArray(leavesRes.value) ? leavesRes.value : []))
        : [];
      setLeaves(lList);
    } catch (err) {
      console.error('Error fetching calendar month data:', err);
      showToast('Could not fetch all calendar entries', 'error');
    } finally {
      setLoading(false);
    }
  }, [year, month, selectedEmpId, myEmpId, showToast]);

  useEffect(() => {
    fetchMonthData();
  }, [fetchMonthData]);

  // ─── Build Days for the Calendar Grid ────────────────────────────────────────
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday, 1 = Monday...
  const prevMonthDays = new Date(year, month, 0).getDate();

  // Weekly-Off Days (Default Sunday = 0)
  const weeklyOffDaysSet = useMemo(() => {
    const s = new Set([0]); // Sunday default
    if (weeklyOffConfigs.length > 0) {
      const active = weeklyOffConfigs.find((c) => c.isActive !== false) || weeklyOffConfigs[0];
      if (active?.days && Array.isArray(active.days)) {
        s.clear();
        active.days.forEach((dayName) => {
          const map = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
          if (map[dayName] != null) s.add(map[dayName]);
        });
      }
    }
    return s;
  }, [weeklyOffConfigs]);

  // Map each day of the month to its data object
  const daysData = useMemo(() => {
    const map = {};

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(year, month, d);
      const dayOfWeek = dayDate.getDay();

      const isSundayOrWeeklyOff = weeklyOffDaysSet.has(dayOfWeek);

      // 1. Check Holiday (from holidays or calendarEvents)
      const holidayObj = holidays.find((h) => {
        const hDate = (h.date || '').split('T')[0];
        return hDate === dateStr;
      });

      const holidayEvent = calendarEvents.find((e) => {
        const eDate = (e.date || e.startDate || '').split('T')[0];
        return e.category === 'HOLIDAY' && eDate === dateStr;
      });

      const holiday = holidayObj || holidayEvent;

      // 2. Check Approved Leave
      const leave = leaves.find((l) => {
        if (l.status !== 'APPROVED') return false;
        const from = (l.fromDate || '').split('T')[0];
        const to = (l.toDate || '').split('T')[0];
        return dateStr >= from && dateStr <= to;
      });

      // 3. Check Attendance Record
      const attRecord = attendanceRecords.find((r) => {
        const d1 = (r.attendanceDate || '').split('T')[0];
        if (d1 === dateStr) return true;
        const d2 = (r.firstCheckInTime || '').split('T')[0];
        if (d2 === dateStr) return true;
        if (Array.isArray(r.punches)) {
          return r.punches.some((p) => {
            const pIn = (p.checkInTime || '').split('T')[0];
            const pOut = (p.checkOutTime || '').split('T')[0];
            return pIn === dateStr || pOut === dateStr;
          });
        }
        return false;
      });

      // 4. Check Birthday / Anniversary events
      const specialEvents = calendarEvents.filter((e) => {
        const eDate = (e.date || e.startDate || '').split('T')[0];
        return (e.category === 'BIRTHDAY' || e.category === 'WORK_ANNIVERSARY') && eDate === dateStr;
      });

      // Determine day status
      let status = 'FUTURE';
      const isPastOrToday = dayDate <= realToday;

      if (holiday) {
        status = 'HOLIDAY';
      } else if (isSundayOrWeeklyOff) {
        status = 'WEEKLY_OFF';
      } else if (leave) {
        status = 'LEAVE';
      } else if (attRecord) {
        const rawStatus = (attRecord.attendanceStatus || '').toUpperCase();
        const hasPunches =
          (Array.isArray(attRecord.punches) && attRecord.punches.length > 0) ||
          Boolean(attRecord.firstCheckInTime) ||
          Number(attRecord.totalWorkingHours) > 0;

        if (rawStatus === 'HALF_DAY') {
          status = 'HALF_DAY';
        } else if (rawStatus === 'ABSENT' && !hasPunches) {
          status = 'ABSENT';
        } else {
          // If marked PRESENT or if punches/checkIn exist, it is PRESENT
          status = 'PRESENT';
        }
      } else if (isPastOrToday) {
        // Working day in the past with no record = Absent
        status = 'ABSENT';
      } else {
        status = 'UPCOMING';
      }

      // Check In / Check Out extraction
      let firstIn = null;
      let lastOut = null;
      let durationHours = 0;
      let isLate = false;

      if (attRecord) {
        firstIn = attRecord.firstCheckInTime;
        lastOut = attRecord.lastCheckOutTime;
        durationHours = attRecord.totalWorkingHours || 0;
        isLate = Boolean(attRecord.lateStatus?.isLate);

        // Fallback to punches array if summary fields missing
        if (Array.isArray(attRecord.punches) && attRecord.punches.length > 0) {
          if (!firstIn) firstIn = attRecord.punches[0].checkInTime;
          if (!lastOut) lastOut = attRecord.punches[attRecord.punches.length - 1].checkOutTime;
          if (!durationHours) {
            const sumPunches = attRecord.punches.reduce((acc, p) => acc + (Number(p.workingHours) || 0), 0);
            if (sumPunches > 0) durationHours = sumPunches;
          }
        }
      }

      map[d] = {
        dayNum: d,
        dateStr,
        dayOfWeek,
        isSundayOrWeeklyOff,
        holiday,
        leave,
        attRecord,
        specialEvents,
        status,
        firstIn,
        lastOut,
        durationHours,
        isLate,
        isToday:
          realToday.getFullYear() === year &&
          realToday.getMonth() === month &&
          realToday.getDate() === d,
      };
    }

    return map;
  }, [daysInMonth, year, month, weeklyOffDaysSet, holidays, calendarEvents, leaves, attendanceRecords, realToday]);

  // ─── Calculate Summary KPI Metrics (Exact 8 metrics matching reference image) ─
  const summaryMetrics = useMemo(() => {
    let totalDays = daysInMonth;
    let weeklyOffCount = 0;
    let holidayCount = 0;
    let presentCount = 0;
    let leaveCount = 0;
    let lateCount = 0;
    let absentCount = 0;

    Object.values(daysData).forEach((d) => {
      if (d.status === 'WEEKLY_OFF') weeklyOffCount++;
      else if (d.status === 'HOLIDAY') holidayCount++;
      else if (d.status === 'PRESENT') {
        presentCount++;
        if (d.isLate) lateCount++;
      } else if (d.status === 'HALF_DAY') {
        presentCount += 0.5;
        if (d.isLate) lateCount++;
      } else if (d.status === 'LEAVE') {
        leaveCount++;
      } else if (d.status === 'ABSENT') {
        absentCount++;
      }
    });

    // Working days = Total Days minus Weekly Offs and Official Holidays
    const workingDays = Math.max(0, totalDays - weeklyOffCount - holidayCount);

    return {
      totalDays,
      workingDays,
      weeklyOffCount,
      holidayCount,
      presentCount,
      leaveCount,
      lateCount,
      absentCount,
    };
  }, [daysInMonth, daysData]);

  // ─── Month Navigation ────────────────────────────────────────────────────────
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Safe extractor for employee display details
  const getEmployeeInfo = useCallback((emp) => {
    if (!emp) return { name: 'Staff Member', code: '', designation: '', initials: 'EM' };
    const name =
      emp.basicInfo?.fullName ||
      emp.fullName ||
      (emp.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : '') ||
      emp.user?.name ||
      emp.name ||
      'Staff Member';
    const code = emp.basicInfo?.employeeCode || emp.employeeCode || emp.code || '';
    const designation =
      emp.employmentInfo?.designation?.name ||
      (typeof emp.designation === 'string' ? emp.designation : emp.designation?.name) ||
      (typeof emp.employmentInfo?.designation === 'string' ? emp.employmentInfo.designation : '') ||
      '';
    const initials = name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'EM';
    return { name, code, designation, initials };
  }, []);

  // Avatar pastel color generator
  const getAvatarColor = useCallback((str) => {
    const colors = [
      { bg: '#e0f2fe', text: '#0369a1' },
      { bg: '#fef3c7', text: '#b45309' },
      { bg: '#dcfce7', text: '#15803d' },
      { bg: '#f3e8ff', text: '#7e22ce' },
      { bg: '#ffe4e6', text: '#be123c' },
      { bg: '#ccfbf1', text: '#0f766e' },
      { bg: '#f1f5f9', text: '#475569' },
    ];
    let hash = 0;
    for (let i = 0; i < (str || '').length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }, []);

  // Close custom employee dropdown on click outside
  useEffect(() => {
    if (!empDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (empDropdownRef.current && !empDropdownRef.current.contains(e.target)) {
        setEmpDropdownOpen(false);
        setEmpSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [empDropdownOpen]);

  // Filtered team members based on search
  const filteredStaffList = useMemo(() => {
    const others = employees.filter((e) => String(e._id || e.id) !== String(myEmpId));
    if (!empSearch.trim()) return others;
    const q = empSearch.toLowerCase().trim();
    return others.filter((emp) => {
      const { name, code, designation } = getEmployeeInfo(emp);
      return (
        name.toLowerCase().includes(q) ||
        code.toLowerCase().includes(q) ||
        designation.toLowerCase().includes(q)
      );
    });
  }, [employees, myEmpId, empSearch, getEmployeeInfo]);

  // Current active employee info
  const isViewingSelf = !selectedEmpId || String(selectedEmpId) === String(myEmpId);
  const activeEmpInfo = useMemo(() => {
    if (isViewingSelf) {
      return {
        name: user?.name || 'Self',
        code: user?.employee?.employeeCode || '',
        designation: user?.role?.displayName || user?.role?.name || 'Staff Member',
        initials: (user?.name || 'S').slice(0, 2).toUpperCase(),
        color: { bg: '#e0f2fe', text: '#0369a1' },
      };
    }
    const found = employees.find((e) => String(e._id || e.id) === String(selectedEmpId));
    const info = getEmployeeInfo(found);
    return {
      ...info,
      color: getAvatarColor(info.name),
    };
  }, [isViewingSelf, user, employees, selectedEmpId, getEmployeeInfo, getAvatarColor]);

  // Selected employee metadata
  const activeEmployee = useMemo(() => {
    if (isViewingSelf) return user;
    const found = employees.find((e) => e._id === selectedEmpId || e.id === selectedEmpId);
    return found || user;
  }, [isViewingSelf, selectedEmpId, employees, user]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-family)' }}>
      {/* ─── 1. Header Bar: Month Selector & Navigation ────────────────────────── */}
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: '16px 22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        {/* Month Title & Prev/Today/Next Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, #337a82 100%)',
                color: '#fff',
                padding: 10,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(63, 146, 154, 0.25)',
              }}
            >
              <CalendarDays size={22} />
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '1.35rem',
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{monthName} {year}</span>
            </h2>
          </div>

          {/* Quick Month Nav Group */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#f1f5f9',
              borderRadius: 8,
              padding: '3px',
              border: '1px solid #e2e8f0',
            }}
          >
            <button
              onClick={handlePrevMonth}
              title="Previous Month"
              style={{
                background: 'transparent',
                border: 'none',
                padding: '6px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#475569',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <ChevronLeft size={16} />
            </button>

            <button
              onClick={handleToday}
              style={{
                background: '#fff',
                border: '1px solid #cbd5e1',
                padding: '4px 14px',
                borderRadius: 6,
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--primary)',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              Today
            </button>

            <button
              onClick={handleNextMonth}
              title="Next Month"
              style={{
                background: 'transparent',
                border: 'none',
                padding: '6px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#475569',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Right Controls: Employee Picker (Admins/Managers) + Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {canSelectStaff && (
            <div style={{ position: 'relative' }} ref={empDropdownRef}>
              {/* Custom Dropdown Trigger */}
              <button
                type="button"
                onClick={() => setEmpDropdownOpen((prev) => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 12px',
                  background: '#fff',
                  border: empDropdownOpen ? '1px solid var(--primary, #3f929a)' : '1px solid #cbd5e1',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  fontWeight: 500,
                  color: '#1e293b',
                  boxShadow: empDropdownOpen
                    ? '0 0 0 2px rgba(63, 146, 154, 0.15)'
                    : '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s ease',
                  height: 38,
                  minWidth: 200,
                  maxWidth: 280,
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                  <User size={14} color="#64748b" style={{ flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isViewingSelf ? `My Calendar (${user?.name || 'Self'})` : activeEmpInfo.name}
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  color="#64748b"
                  style={{
                    transform: empDropdownOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0,
                  }}
                />
              </button>

              {/* Floating Menu Card */}
              {empDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 5px)',
                    right: 0,
                    width: 280,
                    maxHeight: 340,
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.04)',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  {/* Search Bar */}
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Search
                        size={13}
                        color="#94a3b8"
                        style={{ position: 'absolute', left: 8, pointerEvents: 'none' }}
                      />
                      <input
                        type="text"
                        value={empSearch}
                        onChange={(e) => setEmpSearch(e.target.value)}
                        placeholder="Search employee..."
                        autoFocus
                        style={{
                          width: '100%',
                          padding: '6px 24px 6px 26px',
                          borderRadius: 6,
                          border: '1px solid #e2e8f0',
                          fontSize: '0.78rem',
                          outline: 'none',
                          background: '#f8fafc',
                          boxSizing: 'border-box',
                        }}
                      />
                      {empSearch && (
                        <button
                          type="button"
                          onClick={() => setEmpSearch('')}
                          style={{
                            position: 'absolute',
                            right: 6,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            padding: 2,
                            display: 'flex',
                          }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Options List */}
                  <div style={{ overflowY: 'auto', flex: 1, padding: '4px' }}>
                    {/* Pinned "My Calendar" */}
                    {!empSearch.trim() && (
                      <>
                        <div
                          onClick={() => {
                            setSelectedEmpId(myEmpId);
                            setEmpDropdownOpen(false);
                            setEmpSearch('');
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '7px 10px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            background: isViewingSelf ? 'var(--primary-light, #edf7f8)' : 'transparent',
                            fontSize: '0.82rem',
                            color: isViewingSelf ? 'var(--primary, #3f929a)' : '#0f172a',
                            fontWeight: isViewingSelf ? 600 : 500,
                          }}
                          onMouseEnter={(e) => {
                            if (!isViewingSelf) e.currentTarget.style.background = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            if (!isViewingSelf) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <User size={13} color={isViewingSelf ? 'var(--primary)' : '#64748b'} />
                            <span>My Calendar ({user?.name || 'Self'})</span>
                          </div>
                          {isViewingSelf && <Check size={14} color="var(--primary)" />}
                        </div>

                        <div
                          style={{
                            height: 1,
                            background: '#f1f5f9',
                            margin: '4px 6px',
                          }}
                        />
                      </>
                    )}

                    {filteredStaffList.length === 0 ? (
                      <div style={{ padding: '16px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>
                        No employee found
                      </div>
                    ) : (
                      filteredStaffList.map((emp) => {
                        const info = getEmployeeInfo(emp);
                        const isSelected = String(selectedEmpId) === String(emp._id || emp.id);

                        return (
                          <div
                            key={emp._id || emp.id}
                            onClick={() => {
                              setSelectedEmpId(emp._id || emp.id);
                              setEmpDropdownOpen(false);
                              setEmpSearch('');
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '7px 10px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              background: isSelected ? 'var(--primary-light, #edf7f8)' : 'transparent',
                              transition: 'background 0.12s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1, paddingRight: 6 }}>
                              <div
                                style={{
                                  fontSize: '0.8rem',
                                  fontWeight: isSelected ? 600 : 500,
                                  color: isSelected ? 'var(--primary, #3f929a)' : '#0f172a',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {info.name}
                              </div>
                              {(info.code || info.designation) && (
                                <div
                                  style={{
                                    fontSize: '0.68rem',
                                    color: '#64748b',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    marginTop: 1,
                                  }}
                                >
                                  {[info.code, info.designation].filter(Boolean).join(' • ')}
                                </div>
                              )}
                            </div>
                            {isSelected && <Check size={14} color="var(--primary)" style={{ flexShrink: 0 }} />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── 2. Metric Summary Cards (8 Cards Matching User Reference Image) ────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 12,
        }}
      >
        {/* Card 1: TOTAL DAYS */}
        <div
          style={{
            background: '#fff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
            TOTAL DAYS
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '4px 0 2px' }}>
            {summaryMetrics.totalDays}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Calendar Month</div>
        </div>

        {/* Card 2: WORKING DAYS */}
        <div
          style={{
            background: '#fff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
            WORKING DAYS
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '4px 0 2px' }}>
            {summaryMetrics.workingDays}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
            Excl. {summaryMetrics.weeklyOffCount} Sundays
          </div>
        </div>

        {/* Card 3: WEEKLY OFFS */}
        <div
          style={{
            background: '#fff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
            WEEKLY OFFS
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#2563eb', margin: '4px 0 2px' }}>
            {summaryMetrics.weeklyOffCount}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Sundays</div>
        </div>

        {/* Card 4: OFFICIAL HOLIDAYS */}
        <div
          style={{
            background: '#fff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
            OFFICIAL HOLIDAYS
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#7c3aed', margin: '4px 0 2px' }}>
            {summaryMetrics.holidayCount}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Master Holidays</div>
        </div>

        {/* Card 5: PRESENT DAYS */}
        <div
          style={{
            background: '#fff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
            PRESENT DAYS
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#16a34a', margin: '4px 0 2px' }}>
            {summaryMetrics.presentCount}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Biometric Punches</div>
        </div>

        {/* Card 6: LEAVES TAKEN */}
        <div
          style={{
            background: '#fff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
            LEAVES TAKEN
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0284c7', margin: '4px 0 2px' }}>
            {summaryMetrics.leaveCount}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Approved Leaves</div>
        </div>

        {/* Card 7: LATE MARKS */}
        <div
          style={{
            background: '#fff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
            LATE MARKS
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#d97706', margin: '4px 0 2px' }}>
            {summaryMetrics.lateCount}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Shift Deviations</div>
        </div>

        {/* Card 8: ABSENT / LOP */}
        <div
          style={{
            background: '#fff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
            ABSENT / LOP
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#dc2626', margin: '4px 0 2px' }}>
            {summaryMetrics.absentCount}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Loss of Pay</div>
        </div>
      </div>

      {/* ─── 3. Calendar Grid (Exact Match to User Reference Image) ─────────────── */}
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          overflowX: 'auto',
        }}
      >
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={28} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: 12, fontSize: '0.88rem', fontWeight: 500 }}>
              Synchronizing attendance, holiday and shift records...
            </p>
          </div>
        ) : (
          <div style={{ minWidth: 840 }}>
            {/* Weekday Header Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 10,
                marginBottom: 10,
                textAlign: 'center',
              }}
            >
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((w, idx) => (
                <div
                  key={w}
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: idx === 0 ? '#2563eb' : '#475569',
                    letterSpacing: '0.05em',
                    padding: '6px 0',
                  }}
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Calendar Days Matrix */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 10,
              }}
            >
              {/* Previous Month Filler Days */}
              {Array.from({ length: firstDayIndex }).map((_, i) => {
                const prevNum = prevMonthDays - firstDayIndex + i + 1;
                return (
                  <div
                    key={`prev-${i}`}
                    style={{
                      minHeight: 100,
                      borderRadius: 10,
                      border: '1px solid #f1f5f9',
                      background: '#fafafa',
                      padding: '8px 10px',
                      opacity: 0.35,
                    }}
                  >
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8' }}>
                      {prevNum}
                    </span>
                  </div>
                );
              })}

              {/* Current Month Days (1..daysInMonth) */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const data = daysData[dayNum];
                if (!data) return null;

                const {
                  status,
                  holiday,
                  leave,
                  firstIn,
                  lastOut,
                  durationHours,
                  isToday,
                  specialEvents,
                } = data;

                // Visual styling based on cell status matching user screenshot
                let bg = '#fff';
                let border = '#e2e8f0';

                if (status === 'WEEKLY_OFF') {
                  bg = '#f8fafc';
                  border = '#e2e8f0';
                } else if (status === 'HOLIDAY') {
                  bg = '#faf5ff';
                  border = '#d8b4fe';
                } else if (status === 'PRESENT') {
                  bg = '#f0fdf4';
                  border = '#86efac';
                } else if (status === 'HALF_DAY') {
                  bg = '#fffbeb';
                  border = '#fde68a';
                } else if (status === 'LEAVE') {
                  bg = '#f0f9ff';
                  border = '#bae6fd';
                } else if (status === 'ABSENT') {
                  bg = '#fff1f2';
                  border = '#fecdd3';
                }

                if (isToday) {
                  border = '2px solid var(--primary, #3F929A)';
                }

                return (
                  <div
                    key={`day-${dayNum}`}
                    onClick={() => {
                      setSelectedDayData(data);
                      setDayModalOpen(true);
                    }}
                    style={{
                      minHeight: 108,
                      borderRadius: 10,
                      border,
                      background: bg,
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* Top Row: Day Number + Special Badges */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: isToday ? 'var(--primary)' : '#1e293b',
                        }}
                      >
                        {dayNum}
                      </span>

                      {isToday && (
                        <span
                          style={{
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            background: 'var(--primary)',
                            color: '#fff',
                            padding: '1px 5px',
                            borderRadius: 4,
                          }}
                        >
                          TODAY
                        </span>
                      )}
                    </div>

                    {/* Middle: Content Badge matching Screenshot */}
                    <div style={{ margin: '4px 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {/* Weekly Off */}
                      {status === 'WEEKLY_OFF' && (
                        <div
                          style={{
                            background: '#e2e8f0',
                            color: '#475569',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '4px 8px',
                            borderRadius: 6,
                            textAlign: 'center',
                            marginTop: 14,
                          }}
                        >
                          Weekly Off
                        </div>
                      )}

                      {/* Official Holiday: Lavender Pill with Sparkles */}
                      {status === 'HOLIDAY' && (
                        <div
                          style={{
                            background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                            color: '#fff',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '4px 8px',
                            borderRadius: 6,
                            textAlign: 'center',
                            marginTop: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            boxShadow: '0 2px 4px rgba(124, 58, 237, 0.25)',
                          }}
                        >
                          <Sparkles size={11} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {holiday.name || holiday.title || 'Holiday'}
                          </span>
                        </div>
                      )}

                      {/* Present Status Pill */}
                      {status === 'PRESENT' && (
                        <div
                          style={{
                            background: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #bbf7d0',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 5,
                            textAlign: 'center',
                            letterSpacing: '0.05em',
                            width: '100%',
                            boxSizing: 'border-box',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            boxShadow: '0 1px 2px rgba(22, 163, 74, 0.08)',
                          }}
                        >
                          <CheckCircle2 size={11} color="#15803d" />
                          <span>PRESENT</span>
                        </div>
                      )}

                      {/* Half Day Status Pill */}
                      {status === 'HALF_DAY' && (
                        <div
                          style={{
                            background: '#fef3c7',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 5,
                            textAlign: 'center',
                            letterSpacing: '0.04em',
                            width: '100%',
                            boxSizing: 'border-box',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                          }}
                        >
                          <Clock size={11} color="#b45309" />
                          <span>HALF DAY</span>
                        </div>
                      )}

                      {/* Approved Leave Status Pill */}
                      {status === 'LEAVE' && (
                        <div
                          style={{
                            background: '#e0f2fe',
                            color: '#0369a1',
                            border: '1px solid #bae6fd',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '3px 6px',
                            borderRadius: 5,
                            textAlign: 'center',
                            marginTop: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            width: '100%',
                            boxSizing: 'border-box',
                          }}
                        >
                          <CalendarOff size={11} color="#0369a1" />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {leave?.leaveType?.name || 'Leave'}
                          </span>
                        </div>
                      )}

                      {/* Absent Status Pill */}
                      {status === 'ABSENT' && (
                        <div
                          style={{
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fecdd3',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '3px 6px',
                            borderRadius: 5,
                            textAlign: 'center',
                            marginTop: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            width: '100%',
                            boxSizing: 'border-box',
                          }}
                        >
                          <XCircle size={11} color="#b91c1c" />
                          <span>ABSENT</span>
                        </div>
                      )}

                      {/* Birthdays or Anniversaries */}
                      {specialEvents?.length > 0 && (
                        <div
                          style={{
                            fontSize: '0.65rem',
                            color: '#c026d3',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Gift size={11} color="#c026d3" />
                          <span>{specialEvents[0].title ? specialEvents[0].title.replace(/^[^\w\s]+\s*/, '') : 'Event'}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom: Punch Timings & Working Duration for Present / Half Day */}
                    {(status === 'PRESENT' || status === 'HALF_DAY') && (
                      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {/* Clock In - Clock Out */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '0.68rem',
                            color: '#334155',
                            fontWeight: 500,
                          }}
                        >
                          <Clock size={10} color="#64748b" />
                          <span>
                            {formatTime12(firstIn)} - {formatTime12(lastOut)}
                          </span>
                        </div>

                        {/* Working Duration */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '0.66rem',
                            color: '#64748b',
                            fontWeight: 500,
                          }}
                        >
                          <Timer size={10} color="#64748b" />
                          <span>{formatDuration(durationHours)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── 4. Day Details Modal ──────────────────────────────────────────────── */}
      {selectedDayData && (
        <Modal
          isOpen={dayModalOpen}
          onClose={() => setDayModalOpen(false)}
          title={`Day Details — ${selectedDayData.dateStr}`}
          maxWidth="560px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header Status & Employee Info */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                  {activeEmployee?.name || `${activeEmployee?.firstName || ''} ${activeEmployee?.lastName || ''}`}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  {activeEmployee?.employeeCode ? `Code: ${activeEmployee.employeeCode} • ` : ''}
                  {activeEmployee?.designation?.name || 'Staff Member'}
                </div>
              </div>

              <div>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background:
                      selectedDayData.status === 'PRESENT'
                        ? '#dcfce7'
                        : selectedDayData.status === 'HOLIDAY'
                        ? '#f3e8ff'
                        : selectedDayData.status === 'WEEKLY_OFF'
                        ? '#e2e8f0'
                        : selectedDayData.status === 'LEAVE'
                        ? '#e0f2fe'
                        : '#fee2e2',
                    color:
                      selectedDayData.status === 'PRESENT'
                        ? '#15803d'
                        : selectedDayData.status === 'HOLIDAY'
                        ? '#7c3aed'
                        : selectedDayData.status === 'WEEKLY_OFF'
                        ? '#475569'
                        : selectedDayData.status === 'LEAVE'
                        ? '#0369a1'
                        : '#b91c1c',
                  }}
                >
                  {selectedDayData.status}
                </span>
              </div>
            </div>

            {/* Attendance Punch Timings (if present or punches exist) */}
            {selectedDayData.attRecord ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>
                  Punch Timings &amp; Duration
                </h4>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 10,
                  }}
                >
                  <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>First In Time</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                      {formatTime12(selectedDayData.firstIn)}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Last Out Time</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                      {formatTime12(selectedDayData.lastOut)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Total Working Duration</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                      {formatDuration(selectedDayData.durationHours)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Late Mark Deviation</div>
                    <div
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: selectedDayData.isLate ? '#d97706' : '#16a34a',
                        marginTop: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      {selectedDayData.isLate ? (
                        <>
                          <AlertTriangle size={13} color="#d97706" /> Late Marked
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={13} color="#16a34a" /> On Time
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Individual Sessions Breakdown */}
                {selectedDayData.attRecord.punches?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                      Punch Sessions ({selectedDayData.attRecord.punches.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {selectedDayData.attRecord.punches.map((p, idx) => (
                        <div
                          key={p._id || idx}
                          style={{
                            background: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 6,
                            padding: '8px 12px',
                            fontSize: '0.78rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>Session #{idx + 1}:</span>{' '}
                            <span>{formatTime12(p.checkInTime)}</span> →{' '}
                            <span>{p.checkOutTime ? formatTime12(p.checkOutTime) : 'Open'}</span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <MapPin size={11} color="#64748b" />
                            {p.checkInAddress ? 'Office GPS' : 'Verified'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Holiday Information */}
            {selectedDayData.holiday && (
              <div
                style={{
                  background: '#faf5ff',
                  border: '1px solid #e9d5ff',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#7c3aed', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Sparkles size={16} /> {selectedDayData.holiday.name || selectedDayData.holiday.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b21a8', marginTop: 4 }}>
                  Type: {selectedDayData.holiday.type || 'FESTIVAL'} • Scope: {selectedDayData.holiday.scope || 'COMPANY'}
                </div>
                {selectedDayData.holiday.description && (
                  <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#7e22ce' }}>
                    {selectedDayData.holiday.description}
                  </p>
                )}
              </div>
            )}

            {/* Leave Information */}
            {selectedDayData.leave && (
              <div
                style={{
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CalendarOff size={14} color="#0284c7" />
                  {selectedDayData.leave.leaveType?.name || 'Leave Application'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#0369a1', marginTop: 4 }}>
                  Status: Approved • Duration: {selectedDayData.leave.daysCount || 1} Day(s)
                </div>
                {selectedDayData.leave.reason && (
                  <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#075985' }}>
                    Reason: "{selectedDayData.leave.reason}"
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons: Regularization / Apply Leave */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              {selectedDayData.status === 'ABSENT' && (
                <Button
                  variant="primary"
                  icon={ArrowRight}
                  onClick={() => {
                    setDayModalOpen(false);
                    navigate('/attendance/regularization');
                  }}
                  style={{ fontSize: '0.82rem' }}
                >
                  Apply Regularization
                </Button>
              )}

              <Button
                variant="secondary"
                onClick={() => setDayModalOpen(false)}
                style={{ fontSize: '0.82rem' }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AttendanceCalendar;
