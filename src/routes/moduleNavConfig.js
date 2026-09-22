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
  { label: 'Daily Register', path: '/attendance', icon: CalendarCheck, exact: true },
  { label: 'Field Staff', path: '/attendance/field', icon: Compass },
  { label: 'Geo-Fences', path: '/attendance/geofences', icon: MapPin },
  { label: 'Timing & Grace Rules', path: '/attendance/timing-rules', icon: Clock },
  { label: 'Regularization', path: '/attendance/regularization', icon: FileSpreadsheet },
];

export const operationsNav = [
  { label: 'Projects & Sites', path: '/operations/projects', icon: FolderKanban, exact: true },
  { label: 'Site Activity Logs', path: '/operations/site-logs', icon: FileSpreadsheet },
  { label: 'Tasks Board', path: '/operations/tasks', icon: FolderKanban },
];

export const recruitmentNav = [
  { label: 'Job Openings', path: '/recruitment/jobs', icon: Briefcase, exact: true },
  { label: 'Candidates & Pipeline', path: '/recruitment/candidates', icon: Users },
  { label: 'Letter Templates', path: '/recruitment/templates', icon: FileSpreadsheet },
];

export const mastersNav = [
  { label: 'Companies', path: '/masters/companies', icon: Building2, exact: true },
  { label: 'Branches', path: '/masters/branches', icon: Building2 },
  { label: 'Departments', path: '/masters/departments', icon: Building2 },
  { label: 'Designations', path: '/masters/designations', icon: Award },
  { label: 'Roles & RBAC', path: '/masters/roles', icon: ShieldCheck },
];
