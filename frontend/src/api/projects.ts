import { http } from './http';
import type { Project, ProjectDescription } from '../types/api';

export const projectsApi = {
  list: () => http.get<Project[]>('/api/projects'),

  /**
   * ProjectAndBudget rows. This is the list to bind a worklog/allowance project
   * picker to: writes send `Description`, and free text is rejected with 400.
   * Note the `Projectcode` key — lowercase 'c'.
   */
  descriptions: () => http.get<ProjectDescription[]>('/api/description'),

  /** Elevated only. */
  create: (name: string) => http.post<{ id: number; name: string }>('/api/projects', { name }),

  remove: (id: number) => http.del<{ ok: true }>(`/api/projects/${id}`),

  assign: (projectId: number, body: Record<string, unknown>) =>
    http.post<{ ok: true }>(`/api/projects/${projectId}/assign`, body),

  unassign: (projectId: number, body: Record<string, unknown>) =>
    http.post<{ ok: true }>(`/api/projects/${projectId}/unassign`, body),
};
