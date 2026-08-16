// Response shapes as the Flask API actually emits them.
//
// Casing is load-bearing. db.py returns dict keys exactly as the driver reports
// them, and Postgres folds any UNQUOTED SQL identifier to lowercase. The
// backend therefore double-quotes aliases (`AS "Description"`) wherever it wants
// to preserve capitals. The mixed casing below mirrors that, key for key — do
// not "tidy" it or the fields silently become undefined at runtime.

/** EmployeeID: an HR business key that is a *string* of digits, e.g. "33546". */
export type EmployeeId = string & { readonly __brand: 'EmployeeId' };
/** users.id: a surrogate integer primary key. A different key space entirely. */
export type UserId = number & { readonly __brand: 'UserId' };

export const asEmployeeId = (v: string | number): EmployeeId => String(v) as EmployeeId;

export const ROLE_SUPER_ADMIN = 'Super_Ultimate_ADMIN';
export const ROLE_ADMIN = 'Admin';
export const ROLE_LEADER = 'Leader';
export const ROLE_STAFF = 'Staff';

export type Role =
  | typeof ROLE_SUPER_ADMIN
  | typeof ROLE_ADMIN
  | typeof ROLE_LEADER
  | typeof ROLE_STAFF;

/** Mirrors ELEVATED_ROLES in app/constants.py. */
export const ELEVATED_ROLES: readonly Role[] = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_LEADER];
export const ASSIGNABLE_ROLES: readonly Role[] = [ROLE_ADMIN, ROLE_LEADER, ROLE_STAFF];

export const isElevated = (role: Role | undefined | null): boolean =>
  !!role && ELEVATED_ROLES.includes(role);
export const isSuperAdmin = (role: Role | undefined | null): boolean =>
  role === ROLE_SUPER_ADMIN;

// ── /api/me ──────────────────────────────────────────────────────────────────
export interface Me {
  id: UserId;
  username: string;
  role: Role;
  /** Historic key name; the value is an EmployeeID, not users.id. */
  member_id: EmployeeId;
}

// ── /api/login ───────────────────────────────────────────────────────────────
export interface LoginResponse {
  ok: true;
  role: Role;
  member_id: EmployeeId;
}

/** 429 body from api_login. `locked_for_seconds` drives the countdown. */
export interface LockoutBody {
  error: string;
  locked_for_seconds: number;
}

/** 403 body when the account exists but is not approved. */
export interface AccountStatusBody {
  error: 'pending_approval' | 'declined';
  message: string;
}

// ── /api/worklogs ────────────────────────────────────────────────────────────
export const WORKLOG_STATUSES = [
  'Done',
  'In Progress',
  'Pending',
  'Man day',
  'Leave',
] as const;
export type WorklogStatus = (typeof WORKLOG_STATUSES)[number];

export interface Worklog {
  id: number;
  /** EmployeeID, aliased to `member_id` for frontend compatibility. */
  member_id: EmployeeId;
  log_date: string; // YYYY-MM-DD
  /** The ProjectCode stored on the row — NOT the description the user picked. */
  project: string | null;
  task: string | null;
  start_time: string | null; // HH:mm
  end_time: string | null; // HH:mm
  hours: number | null;
  regular_hours: number | null;
  OT1: number | null;
  OT1_5: number | null;
  OT3: number | null;
  status: WorklogStatus;
  note: string | null;
  IsEditRow: number; // 0 | 1
  is_allowance: number; // 0 | 1
  /** Resolved from ProjectAndBudget via the LEFT JOIN; null for unmapped codes. */
  project_description: string | null;
}

/**
 * Write payload. `project` carries the project *Description*, not the code:
 * the server resolves Description -> ProjectCode itself and rejects unknown
 * values with 400. `member_id` is required on PUT because the update is a full
 * replace and the overlap check keys off it.
 */
export interface WorklogWrite {
  member_id: EmployeeId;
  log_date: string;
  project: string;
  task?: string;
  note?: string;
  start_time: string;
  end_time: string;
  status: WorklogStatus;
  is_allowance?: boolean;
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  description: string | null;
}

// ── /api/dashboard ───────────────────────────────────────────────────────────
export interface DashboardMember {
  name: string | null;
  department: string | null;
  position: string | null;
  level: string | null;
  staff_id: EmployeeId;
  avatar_url: string | null;
}

export interface DashboardMonth {
  month: number; // 1-12
  name: string; // "January"
  total_hours: number;
  overtime_hours: number;
  OT1: number;
  OT1_5: number;
  OT3: number;
  done: number;
  in_progress: number;
  missing: number;
  man_day: number;
}

export interface Dashboard {
  member: DashboardMember;
  year: number;
  total_hours: number;
  total_overtime: number;
  total_OT1: number;
  total_OT1_5: number;
  total_OT3: number;
  avg_monthly_hours: number;
  total_done: number;
  total_in_progress: number;
  total_man_day: number;
  months: DashboardMonth[];
}

// ── /api/allowance ───────────────────────────────────────────────────────────
export interface Allowance {
  ID: number;
  log_date: string;
  EmployeeID: EmployeeId;
  ProjectCode: string | null;
  Description: string | null;
  /** 'S' on holidays/weekends, 'N' otherwise. Derived server-side; read-only. */
  type: 'N' | 'S' | null;
  CreateAt: string | null;
  UpdateAt: string | null;
  IsEditRow: number;
}

export interface AllowanceWrite {
  member_id: EmployeeId;
  log_date: string;
  /** Project Description, resolved to ProjectCode server-side. */
  project: string;
}

// ── /api/projects and /api/description ───────────────────────────────────────
export interface Project {
  id: number;
  name: string;
  Description: string | null;
  main_members: string | null;
  support_members: string | null;
}

/** From ProjectAndBudget. Note `Projectcode` — lowercase 'c', as aliased. */
export interface ProjectDescription {
  Projectcode: string;
  Description: string;
  ProjectDepartment: string | null;
  Status: string | null;
}

// ── /api/employees and /api/members ──────────────────────────────────────────
export interface Employee {
  /** `/api/employees` is intentionally shaped like the legacy `/api/members` DTO. */
  id: EmployeeId;
  name: string | null;
  department: string | null;
  staff_id: EmployeeId;
  position: string | null;
  level: string | null;
  jg: string | null;
  avatar_url: string | null;
  [key: string]: unknown;
}

// ── /api/users ───────────────────────────────────────────────────────────────
export interface User {
  id: UserId;
  username: string;
  role: Role;
  member_id: EmployeeId | null;
  status: 'Active' | 'Pending' | 'Declined' | null;
  email: string | null;
  member_name: string | null;
  Department: string | null;
  Position: string | null;
}

/** Pending registrations. `department`/`position` are lowercase here but
 *  capitalised on User above — the two queries alias them differently. */
export interface PendingUser {
  id: UserId;
  username: string;
  created_at: string | null;
  member_id: EmployeeId | null;
  member_name: string | null;
  department: string | null;
  staff_id: EmployeeId | null;
  position: string | null;
}

// ── /api/files ───────────────────────────────────────────────────────────────
export interface FileFolder {
  id: number;
  name: string;
  parent_id: number | null;
  is_classified: boolean;
}

/** /api/files/tree returns roots with `children` nested recursively. */
export interface FolderNode extends FileFolder {
  children: FolderNode[];
}

export interface StoredFile {
  id: number;
  original_name: string;
  size_bytes: number;
  mime_type: string | null;
  uploaded_at: string | null;
  uploaded_by: UserId | null;
  uploaded_by_name: string | null;
  is_classified: boolean;
}

/** /api/files/recent adds the two fields a flat list needs for context. */
export interface RecentFile extends StoredFile {
  folder_id: number | null;
  folder_name: string | null;
}

export interface Breadcrumb {
  id: number;
  name: string;
}

export interface FolderListing {
  folder_id: number | null;
  breadcrumbs: Breadcrumb[];
  folders: FileFolder[];
  files: StoredFile[];
}

export interface FolderStats {
  folder_id: number | null;
  file_count: number;
  total_bytes: number;
  subfolder_count: number;
}

export interface StorageStats {
  file_count: number;
  folder_count: number;
  used_bytes: number;
  cap_bytes: number;
  free_disk_bytes: number;
  min_free_bytes: number;
  /** Back-compat duplicate of used_bytes. */
  total_bytes: number;
}

export interface BulkDeleteResult {
  deleted: number[];
  failed: { id: number; reason: string }[];
}

// ── /api/projects-summary ────────────────────────────────────────────────────
export interface ProjectSummaryEmployee {
  employee_id: EmployeeId;
  name: string;
  hours: number;
}

export interface ProjectSummaryRow {
  project_department: string;
  /** Comma-joined list of every Description rolled into this department. */
  project_description: string;
  total_hours: number;
  employees_count: number;
  employees: ProjectSummaryEmployee[];
}

export interface ProjectsSummary {
  year: number;
  month: number;
  projects: ProjectSummaryRow[];
}

/** /api/dashboard/missing → { EmployeeID: missingDayCount }. */
export type MissingDaysMap = Record<string, number>;

// ── /api/skills ──────────────────────────────────────────────────────────────
export interface Skill {
  id: number;
  name: string;
  level: number;
}

// ── /api/settings ────────────────────────────────────────────────────────────
export interface Settings {
  worklog_open: boolean;
}

export interface TimePreset {
  label: string;
  value: string; // HH:MM — validated server-side against ^\d{2}:\d{2}$
}

export interface TimePresets {
  start: TimePreset[];
  end: TimePreset[];
}
