import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Alert, Button, Group, Loader, Modal, ScrollArea, Stack, Text, Tooltip } from '@mantine/core';
import { IconAlertTriangle, IconDownload, IconLock } from '@tabler/icons-react';

import { filesApi } from '../../api/files';
import type { StoredFile } from '../../types/api';
import { documentKind, isImageMime, loadDocxVendor, loadPptxVendor, loadXlsxVendor } from '../../utils/filePreview';

declare global {
  interface Window {
    docx?: { renderAsync: (buf: ArrayBuffer, container: HTMLElement, styleContainer: HTMLElement, options: { inWrapper: boolean }) => Promise<unknown> };
    XLSX?: {
      read: (data: ArrayBuffer, opts: { type: string }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
      utils: { sheet_to_html: (sheet: unknown) => string };
    };
    PPTXViewer?: { PPTXViewer: new (el: HTMLElement, opts: { showControls: boolean; keyboardNavigation: boolean }) => { load: (buf: ArrayBuffer) => Promise<void>; destroy: () => void } };
  }
}

type PptxInstance = { destroy: () => void };

interface FilePreviewModalProps {
  file: StoredFile | null;
  onClose: () => void;
}

export function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [sheets, setSheets] = useState<{ name: string; html: string }[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [textContent, setTextContent] = useState<string | null>(null);
  const docxRef = useRef<HTMLDivElement>(null);
  const pptxRef = useRef<HTMLDivElement>(null);
  const pptxInstanceRef = useRef<PptxInstance | null>(null);
  const kind = file ? documentKind(file.mime_type, file.original_name) : null;
  const isImage = file ? isImageMime(file.mime_type) : false;

  useEffect(() => {
    setZoomed(false);
    setError(null);
    setSheets([]);
    setActiveSheet(0);
    setTextContent(null);
    if (docxRef.current) docxRef.current.innerHTML = '';
    if (pptxInstanceRef.current) {
      try { pptxInstanceRef.current.destroy(); } catch { /* already gone */ }
      pptxInstanceRef.current = null;
    }
    if (!file || isImage || !kind) return;

    let cancelled = false;
    setLoading(true);
    const url = filesApi.downloadUrl(file.id, true);

    (async () => {
      if (kind === 'pdf') {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        if (kind === 'docx') {
          await loadDocxVendor();
          if (cancelled || !docxRef.current || !window.docx) return;
          docxRef.current.innerHTML = '';
          await window.docx.renderAsync(buf, docxRef.current, docxRef.current, { inWrapper: true });
        } else if (kind === 'xlsx') {
          await loadXlsxVendor();
          if (cancelled || !window.XLSX) return;
          const wb = window.XLSX.read(buf, { type: 'array' });
          const parsed = (wb.SheetNames || []).map((name) => ({
            name,
            html: window.XLSX!.utils.sheet_to_html(wb.Sheets[name]),
          }));
          setSheets(parsed);
        } else if (kind === 'pptx') {
          await loadPptxVendor();
          if (cancelled || !pptxRef.current || !window.PPTXViewer) return;
          pptxRef.current.innerHTML = '';
          const instance = new window.PPTXViewer.PPTXViewer(pptxRef.current, { showControls: true, keyboardNavigation: true });
          pptxInstanceRef.current = instance;
          await instance.load(buf);
        } else if (kind === 'text') {
          setTextContent(new TextDecoder('utf-8').decode(buf));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Preview failed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id]);

  useEffect(() => () => {
    if (pptxInstanceRef.current) {
      try { pptxInstanceRef.current.destroy(); } catch { /* already gone */ }
      pptxInstanceRef.current = null;
    }
  }, []);

  return (
    <Modal
      opened={!!file}
      onClose={onClose}
      size="xl"
      centered
      title={
        <Group gap={6} wrap="nowrap">
          <Text fw={700} lineClamp={1}>{file?.original_name}</Text>
          {file?.is_classified && <Tooltip label="Classified"><IconLock size={15} color="var(--mantine-color-orange-6)" /></Tooltip>}
        </Group>
      }
    >
      <Stack gap="sm">
        {file && (
          <div className={`file-preview-body${isImage ? '' : ' doc-mode'}`}>
            {isImage ? (
              <div className={`file-preview-image-wrap${zoomed ? ' zoomed' : ''}`}>
                <img
                  src={filesApi.downloadUrl(file.id, true)}
                  alt={file.original_name}
                  className="file-preview-img"
                  onClick={() => setZoomed((current) => !current)}
                />
              </div>
            ) : loading ? (
              <Group justify="center" py={60}><Loader size="sm" /><Text size="sm" c="dimmed">Loading preview…</Text></Group>
            ) : error ? (
              <Alert color="red" icon={<IconAlertTriangle size={18} />}>{`Preview failed: ${error}`}</Alert>
            ) : !kind ? (
              <Alert color="gray" icon={<IconAlertTriangle size={18} />}>Preview not available for this file type.</Alert>
            ) : kind === 'pdf' ? (
              <iframe title={file.original_name} src={filesApi.downloadUrl(file.id, true)} className="file-preview-pdf" />
            ) : kind === 'docx' ? (
              <ScrollArea h={520}><div ref={docxRef} className="file-preview-docx" /></ScrollArea>
            ) : kind === 'xlsx' ? (
              sheets.length === 0 ? (
                <Text size="sm" c="dimmed" p="md">Workbook has no sheets.</Text>
              ) : (
                <Stack gap={0}>
                  <Group gap={4} className="xlsx-tabs">
                    {sheets.map((sheet, index) => (
                      <Button key={sheet.name} size="xs" variant={index === activeSheet ? 'filled' : 'default'} onClick={() => setActiveSheet(index)}>
                        {sheet.name}
                      </Button>
                    ))}
                  </Group>
                  <ScrollArea h={460}>
                    <div className="xlsx-sheet-panel" dangerouslySetInnerHTML={{ __html: sheets[activeSheet]?.html ?? '' }} />
                  </ScrollArea>
                </Stack>
              )
            ) : kind === 'pptx' ? (
              <div ref={pptxRef} className="file-preview-pptx" />
            ) : kind === 'text' ? (
              <ScrollArea h={460}><Text component="pre" size="sm" className="file-preview-text">{textContent}</Text></ScrollArea>
            ) : null}
          </div>
        )}
        <Group justify="flex-end">
          <ActionIcon
            component="a"
            href={file ? filesApi.downloadUrl(file.id) : undefined}
            variant="light"
            color="indigo"
            size="lg"
            aria-label="Download"
          >
            <IconDownload size={17} />
          </ActionIcon>
        </Group>
      </Stack>
    </Modal>
  );
}
