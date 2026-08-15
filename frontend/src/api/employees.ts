import { http } from './http';
import type { Employee, EmployeeId } from '../types/api';

export const employeesApi = {
  list: () => http.get<Employee[]>('/api/employees'),

  create: (payload: Record<string, unknown>) => http.post<Employee>('/api/employees', payload),

  update: (id: EmployeeId, payload: Record<string, unknown>) =>
    http.put<Employee>(`/api/employees/${encodeURIComponent(id)}`, payload),

  remove: (id: EmployeeId) =>
    http.del<{ ok: true }>(`/api/employees/${encodeURIComponent(id)}`),
};
