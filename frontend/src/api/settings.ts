import { http } from './http';
import type { Settings, TimePresets } from '../types/api';

export const settingsApi = {
  get: () => http.get<Settings>('/api/settings'),

  /** Admin only. Controls whether non-elevated users can see others' logs. */
  setWorklogVisibility: (open: boolean) =>
    http.put<{ ok: true; worklog_open: boolean }>('/api/settings/worklog-visibility', { open }),

  getTimePresets: () => http.get<TimePresets>('/api/settings/time-presets'),

  /** Elevated only. Values must match /^\d{2}:\d{2}$/ or the server 400s. */
  setTimePresets: (presets: TimePresets) =>
    http.put<{ ok: true }>('/api/settings/time-presets', { ...presets }),
};
