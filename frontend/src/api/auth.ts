import { http } from './http';
import type { LoginResponse, Me } from '../types/api';

export interface EmployeeLookup {
  employee_id: string;
  name: string | null;
  department: string;
  position: string;
  /** True when this EmployeeID already has a non-declined user account. */
  taken: boolean;
}

export interface RegisterPayload {
  username: string;
  password: string;
  /** Preferred: the server pulls name/department/position from the HR table. */
  employee_id?: string;
  email?: string;
}

export const authApi = {
  /**
   * 401 → bad credentials. 403 → { error: 'pending_approval' | 'declined' }.
   * 429 → { error, locked_for_seconds } for the lockout countdown.
   */
  login: (username: string, password: string) =>
    http.post<LoginResponse>('/api/login', { username, password }),

  logout: () => http.post<{ ok: true }>('/api/logout'),

  me: () => http.get<Me>('/api/me'),

  register: (payload: RegisterPayload) =>
    http.post<{ ok: true; status: string }>('/api/register', { ...payload }),

  /** Public (no session). 404 when the EmployeeID is not in the HR table. */
  employeeLookup: (employeeId: string) =>
    http.get<EmployeeLookup>(`/api/employee-lookup/${encodeURIComponent(employeeId)}`),

  /** Always 200 with a generic body — never reveals whether the account exists. */
  forgotPassword: (username: string) =>
    http.post<{ ok: true }>('/api/forgot-password', { username }),

  verifyResetToken: (token: string) =>
    http.post<{ valid: boolean }>('/api/reset-password/verify', { token }),

  confirmReset: (token: string, password: string) =>
    http.post<{ ok: true }>('/api/reset-password/confirm', { token, password }),
};
