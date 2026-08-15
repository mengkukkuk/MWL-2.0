import { http } from './http';
import type { EmployeeId, Skill } from '../types/api';

export const skillsApi = {
  /** Every skill grouped by EmployeeID. */
  all: () => http.get<Record<string, Skill[]>>('/api/skills'),

  forMember: (memberId: EmployeeId) =>
    http.get<Skill[]>(`/api/members/${encodeURIComponent(memberId)}/skills`),

  /**
   * There is no set-replace endpoint: add one skill per call. A duplicate name
   * for the same member returns 409.
   */
  add: (memberId: EmployeeId, name: string, level: number) =>
    http.post<Skill & { member_id: string }>(
      `/api/members/${encodeURIComponent(memberId)}/skills`,
      { name, level },
    ),

  update: (skillId: number, name: string, level: number) =>
    http.put<{ ok: true }>(`/api/skills/${skillId}`, { name, level }),

  remove: (skillId: number) => http.del<{ ok: true }>(`/api/skills/${skillId}`),
};
