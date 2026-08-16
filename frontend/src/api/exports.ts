import { ApiError, qs } from './http';
import { filenameFromDisposition, saveBlob } from '../utils/download';
import type { EmployeeId } from '../types/api';

/**
 * Both endpoints stream a file. They are fetched as blobs rather than opened in
 * a new tab so an error status surfaces as a notification instead of replacing
 * the page with a raw JSON body.
 *
 */
async function downloadViaGet(path: string, fallbackName: string) {
  const res = await fetch(path, { credentials: 'same-origin' });
  if (!res.ok) {
    let message = `Export failed (${res.status}).`;
    try {
      const parsed = JSON.parse(await res.text());
      if (typeof parsed?.error === 'string') message = parsed.error;
    } catch {
      message = res.status >= 500 ? 'Export failed on the server.' : message;
    }
    throw new ApiError(res.status, message);
  }
  const disposition = res.headers.get('content-disposition');
  saveBlob(await res.blob(), filenameFromDisposition(disposition, fallbackName));
}

export const exportsApi = {
  /** `months` is a comma-separated list of month numbers; omit for the whole year. */
  excel: (memberId: EmployeeId, year: number, months?: number[]) =>
    downloadViaGet(
      `/api/export/excel${qs({ member_id: memberId, year, months: months?.join(',') })}`,
      `Worklog_${year}.xlsx`,
    ),

  /** Elevated only. Streams a zip of one workbook per member. */
  excelBulk: (memberIds: EmployeeId[], year: number, months?: number[]) =>
    downloadViaGet(
      `/api/export/excel/bulk${qs({
        member_ids: memberIds.join(','),
        year,
        months: months?.join(','),
      })}`,
      `Team_Worklog_${year}.zip`,
    ),
};
