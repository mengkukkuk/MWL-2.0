import { http, qs } from './http';
import type { Allowance, AllowanceWrite, EmployeeId } from '../types/api';

export const allowanceApi = {
  list: (memberId: EmployeeId, year: number, month: number) =>
    http.get<Allowance[]>(`/api/allowance${qs({ member_id: memberId, year, month })}`),

  /**
   * `project` is a project Description. `type` ('N' | 'S') is derived server-side
   * from the holiday/weekend calendar, so it is never sent. A second row on the
   * same log_date returns 400.
   */
  create: (payload: AllowanceWrite) => http.post<Allowance>('/api/allowance', { ...payload }),

  update: (id: number, payload: AllowanceWrite) =>
    http.put<Allowance>(`/api/allowance/${id}`, { ...payload }),

  remove: (id: number) => http.del<{ ok: true }>(`/api/allowance/${id}`),
};
