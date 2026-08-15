import { ApiError, http, qs } from './http';
import type {
  Dashboard,
  EmployeeId,
  Holiday,
  MissingDaysMap,
  ProjectsSummary,
  Worklog,
  WorklogWrite,
} from '../types/api';

export const worklogsApi = {
  /**
   * The API pages by year+month, not by an arbitrary date range.
   * 403 when worklog visibility is closed and you ask for someone else.
   */
  list: (memberId: EmployeeId, year: number, month: number) =>
    http.get<Worklog[]>(`/api/worklogs${qs({ member_id: memberId, year, month })}`),

  /**
   * A month with no holidays answers 400 {"error":"no holiday"} rather than an
   * empty array, so an empty month is normalised to [] here instead of
   * surfacing as an error to every caller.
   */
  holidays: async (year: number, month: number): Promise<Holiday[]> => {
    try {
      return await http.get<Holiday[]>(`/api/holidays${qs({ year, month })}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) return [];
      throw err;
    }
  },

  /**
   * `project` carries the project *Description*; the server resolves it to a
   * ProjectCode and 400s on an unknown value. A time-range clash also returns
   * 400 ('Time range overlaps with another worklog'), not 409.
   */
  create: (payload: WorklogWrite) => http.post<Worklog>('/api/worklogs', { ...payload }),

  /** Full replace — `member_id` is required because the overlap check keys off it. */
  update: (id: number, payload: WorklogWrite) =>
    http.put<Worklog>(`/api/worklogs/${id}`, { ...payload }),

  remove: (id: number) => http.del<{ ok: true }>(`/api/worklogs/${id}`),

  dashboard: (memberId: EmployeeId, year: number) =>
    http.get<Dashboard>(`/api/dashboard${qs({ member_id: memberId, year })}`),

  /** Non-elevated callers get only their own row. */
  missingDays: (year: number, month: number) =>
    http.get<MissingDaysMap>(`/api/dashboard/missing${qs({ year, month })}`),

  /** Elevated only. */
  projectsSummary: (year: number, month: number) =>
    http.get<ProjectsSummary>(`/api/projects-summary${qs({ year, month })}`),
};
