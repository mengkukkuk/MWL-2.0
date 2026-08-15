import { ApiError, http, qs, uploadWithProgress } from './http';
import { filenameFromDisposition, saveBlob } from '../utils/download';
import type {
  BulkDeleteResult,
  FolderListing,
  FolderNode,
  FolderStats,
  RecentFile,
  StorageStats,
  StoredFile,
} from '../types/api';

/** Client-side ceiling. Cloudflare rejects bodies over ~100 MB at the edge, and
 *  that rejection arrives as unparseable HTML only after the whole upload has
 *  been sent — so it is far kinder to refuse before starting. */
export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB ?? 95);

/** Shared by the two endpoints that stream binary instead of JSON. */
async function downloadViaPost(path: string, body: unknown, fallbackName: string) {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Download failed (${res.status}).`;
    try {
      const parsed = JSON.parse(await res.text());
      if (typeof parsed?.error === 'string') message = parsed.error;
    } catch {
      // Binary or HTML error page; keep the generic message.
    }
    throw new ApiError(res.status, message);
  }
  const disposition = res.headers.get('content-disposition');
  saveBlob(await res.blob(), filenameFromDisposition(disposition, fallbackName));
}

export const filesApi = {
  stats: () => http.get<StorageStats>('/api/files/stats'),

  /** Roots with `children` nested recursively. */
  tree: () => http.get<FolderNode[]>('/api/files/tree'),

  /** Omit folderId for the root listing. */
  listFolder: (folderId?: number | null) =>
    http.get<FolderListing>(
      folderId === undefined || folderId === null
        ? '/api/files/folder'
        : `/api/files/folder/${folderId}`,
    ),

  folderStats: (folderId?: number | null) =>
    http.get<FolderStats>(
      folderId === undefined || folderId === null
        ? '/api/files/folder/stats'
        : `/api/files/folder/${folderId}/stats`,
    ),

  recent: (limit = 20) => http.get<RecentFile[]>(`/api/files/recent${qs({ limit })}`),

  createFolder: (name: string, parentId: number | null) =>
    http.post<{ id: number; name: string; parent_id: number | null }>('/api/files/folder', {
      name,
      parent_id: parentId,
    }),

  /** Elevated only. */
  renameFolder: (folderId: number, name: string, isClassified?: boolean) =>
    http.put<{ ok: true; id: number; name: string }>(`/api/files/folder/${folderId}`, {
      name,
      ...(isClassified === undefined ? {} : { is_classified: isClassified }),
    }),

  /** Elevated only. Rejects moving a folder into its own subtree. */
  moveFolder: (folderId: number, parentId: number | null) =>
    http.post<{ ok: true; id: number; parent_id: number | null }>(
      `/api/files/folder/${folderId}/move`,
      { parent_id: parentId },
    ),

  /** Elevated only. 409 unless the folder is completely empty. */
  deleteFolder: (folderId: number) =>
    http.del<{ ok: true }>(`/api/files/folder/${folderId}`),

  /** Multipart field name is `file`, singular. Returns an abortable handle. */
  upload: (file: File, folderId: number | null, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    form.append('folder_id', folderId === null ? '' : String(folderId));
    return uploadWithProgress<StoredFile & { folder_id: number | null }>(
      '/api/files/upload',
      form,
      onProgress,
    );
  },

  downloadUrl: (fileId: number, inline = false) =>
    `/api/files/${fileId}/download${inline ? '?inline=1' : ''}`,

  /** Elevated only. */
  setClassified: (fileId: number, isClassified: boolean) =>
    http.patch<{ ok: true; id: number; is_classified: boolean }>(`/api/files/${fileId}`, {
      is_classified: isClassified,
    }),

  remove: (fileId: number) => http.del<{ ok: true }>(`/api/files/${fileId}`),

  move: (fileId: number, folderId: number | null) =>
    http.post<{ ok: true; id: number; folder_id: number | null }>(`/api/files/${fileId}/move`, {
      folder_id: folderId,
    }),

  /** Streams a zip. Max 500 ids; 413 if the selection exceeds 2 GB. */
  bulkDownload: (ids: number[]) => downloadViaPost('/api/files/bulk/download', { ids }, 'files.zip'),

  /** Partial success is normal: inspect `failed` as well as `deleted`. */
  bulkDelete: (ids: number[]) => http.post<BulkDeleteResult>('/api/files/bulk/delete', { ids }),
};
