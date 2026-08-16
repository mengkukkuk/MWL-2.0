// Document preview helpers — mirrors the classification + lazy vendor-script
// loading logic from the 1.0 app's file-preview.js, adapted to load into the
// current window rather than a specific set of DOM elements.

export type DocumentKind = 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'text' | null;

const TEXT_EXTENSIONS = new Set([
  'txt', 'log', 'md', 'markdown', 'csv', 'json', 'ini', 'conf', 'yaml', 'yml', 'xml',
]);

/** Lightweight, dependency-free check used at row-render time to decide whether
 *  to show the Preview affordance, without pulling in any vendor lib. */
export const PREVIEWABLE_DOC_EXTS = new Set([
  'pdf', 'docx', 'xlsx', 'xls', 'pptx',
  'txt', 'log', 'md', 'markdown', 'csv', 'json', 'ini', 'conf', 'yaml', 'yml', 'xml',
]);

function fileExt(name: string | null | undefined): string {
  const parts = (name ?? '').split('.');
  return parts.length > 1 ? (parts.pop() ?? '').toLowerCase() : '';
}

export function isImageMime(mime: string | null | undefined): boolean {
  return typeof mime === 'string' && mime.startsWith('image/');
}

export function isPreviewableDoc(mime: string | null | undefined, name: string | null | undefined): boolean {
  const ext = fileExt(name);
  if (mime === 'application/pdf' || mime === 'application/vnd.ms-excel') return true;
  if (typeof mime === 'string' && mime.startsWith('text/')) return true;
  return PREVIEWABLE_DOC_EXTS.has(ext);
}

export function isPreviewable(mime: string | null | undefined, name: string | null | undefined): boolean {
  return isImageMime(mime) || isPreviewableDoc(mime, name);
}

/** Decides which vendor lib (if any) renders this file. Kept in sync with the
 *  lightweight `isPreviewableDoc()` above — this one is only consulted once a
 *  preview is actually opened. */
export function documentKind(mime: string | null | undefined, name: string | null | undefined): DocumentKind {
  const ext = fileExt(name);
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'xlsx' || ext === 'xls' || mime === 'application/vnd.ms-excel') return 'xlsx';
  if (ext === 'pptx') return 'pptx';
  if ((mime && mime.startsWith('text/')) || TEXT_EXTENSIONS.has(ext)) return 'text';
  return null;
}

const PREVIEW_VENDORS = {
  jszip: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  docx: 'https://cdn.jsdelivr.net/npm/docx-preview@0.4.0/dist/docx-preview.min.js',
  xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  pptx: 'https://cdn.jsdelivr.net/npm/pptx-viewer@0.2.2/dist/pptx-viewer.umd.js',
} as const;

const vendorScriptPromises: Record<string, Promise<void>> = {};

function loadVendorScript(src: string): Promise<void> {
  if (!vendorScriptPromises[src]) {
    vendorScriptPromises[src] = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }
  return vendorScriptPromises[src];
}

export async function loadDocxVendor(): Promise<void> {
  await loadVendorScript(PREVIEW_VENDORS.jszip);
  await loadVendorScript(PREVIEW_VENDORS.docx);
}

export async function loadXlsxVendor(): Promise<void> {
  await loadVendorScript(PREVIEW_VENDORS.xlsx);
}

export async function loadPptxVendor(): Promise<void> {
  await loadVendorScript(PREVIEW_VENDORS.pptx);
}
