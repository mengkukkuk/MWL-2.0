import { http } from './http';
import type { PendingUser, Role, User, UserId } from '../types/api';

export const usersApi = {
  list: () => http.get<User[]>('/api/users'),

  /** Note: pending rows use lowercase `department`/`position`, unlike User. */
  pending: () => http.get<PendingUser[]>('/api/users/pending'),

  pendingCount: () => http.get<{ count: number }>('/api/users/pending/count'),

  approve: (id: UserId) =>
    http.post<{ ok: true; status?: string; already_active?: boolean }>(`/api/users/${id}/approve`),

  decline: (id: UserId) =>
    http.post<{ ok: true; status: string }>(`/api/users/${id}/decline`),

  /** Admin only. Must be one of ASSIGNABLE_ROLES; Super admin cannot be changed. */
  setRole: (id: UserId, role: Role) => http.put<{ ok: true }>(`/api/users/${id}/role`, { role }),

  /** Admin only. Minimum 8 characters, enforced server-side too. */
  setPassword: (id: UserId, password: string) =>
    http.put<{ ok: true }>(`/api/users/${id}/password`, { password }),

  /** Empty string clears the address. */
  setEmail: (id: UserId, email: string) =>
    http.put<{ ok: true; email: string | null }>(`/api/users/${id}/email`, { email }),

  remove: (id: UserId) => http.del<{ ok: true }>(`/api/users/${id}`),
};
