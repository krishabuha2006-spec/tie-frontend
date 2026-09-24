import {
  CalendarCheck,
  MapPin,
  FileSpreadsheet,
  FolderKanban,
  Briefcase,
  Users,
  Building2,
  Award,
  ShieldCheck,
  Clock,
  Compass,
} from 'lucide-react';

export const attendanceNav = [
  { label: 'Daily Register', path: '/attendance', icon: CalendarCheck, exact: true, module: 'attendance' },
  { label: 'Field Staff', path: '/attendance/field', icon: Compass, module: 'attendance' },
  { label: 'Geo-Fences', path: '/attendance/geofences', icon: MapPin, module: 'attendance' },
  { label: 'Timing & Grace Rules', path: '/attendance/timing-rules', icon: Clock, module: 'attendance' },
  { label: 'Regularization', path: '/attendance/regularization', icon: FileSpreadsheet, module: 'attendance' },
];

export const operationsNav = [
  { label: 'Projects & Sites', path: '/operations/projects', icon: FolderKanban, exact: true, module: 'projects' },
  { label: 'Site Activity Logs', path: '/operations/site-logs', icon: FileSpreadsheet, module: 'site-logs' },
  { label: 'Tasks Board', path: '/operations/tasks', icon: FolderKanban, module: 'tasks' },
];

export const recruitmentNav = [
  { label: 'Job Openings', path: '/recruitment/jobs', icon: Briefcase, exact: true, module: 'recruitment' },
  { label: 'Candidates & Pipeline', path: '/recruitment/candidates', icon: Users, module: 'recruitment' },
  { label: 'Letter Templates', path: '/recruitment/templates', icon: FileSpreadsheet, module: 'recruitment' },
];

export const mastersNav = [
  { label: 'Companies', path: '/masters/companies', icon: Building2, exact: true, module: 'companies' },
  { label: 'Branches', path: '/masters/branches', icon: Building2, module: 'branches' },
  { label: 'Departments', path: '/masters/departments', icon: Building2, module: 'departments' },
  { label: 'Designations', path: '/masters/designations', icon: Award, module: 'designations' },
  { label: 'Roles & RBAC', path: '/masters/roles', icon: ShieldCheck, module: 'roles' },
];
