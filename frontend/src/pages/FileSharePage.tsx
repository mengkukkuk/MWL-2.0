import { useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { modals } from '@mantine/modals';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Menu,
  Modal,
  Progress,
  ScrollArea,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconArrowsMove,
  IconChevronDown,
  IconChevronUp,
  IconCloudUpload,
  IconDots,
  IconDownload,
  IconEdit,
  IconEye,
  IconFile,
  IconFolder,
  IconFolderPlus,
  IconLock,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react';

import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/http';
import { filesApi, MAX_UPLOAD_MB } from '../api/files';
import { PageHeader } from '../components/PageHeader';
import { FolderTree } from '../components/files/FolderTree';
import { FilePreviewModal } from '../components/files/FilePreviewModal';
import { MoveToModal } from '../components/files/MoveToModal';
import { FolderEditModal } from '../components/files/FolderEditModal';
import { FileEditModal } from '../components/files/FileEditModal';
import type { FileFolder, FolderNode, StoredFile } from '../types/api';
import { formatBytes } from '../utils/dates';
import { notifyError, notifySuccess } from '../utils/notify';

type SortKey = 'name' | 'size' | 'uploader';

interface UploadRow {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'active' | 'done' | 'error' | 'cancelled';
  message?: string;
  abort: () => void;
}

type DragPayload = { type: 'folder'; id: number; blocked: Set<number> } | { type: 'files'; ids: number[] };
type MoveTarget = { kind: 'folder'; id: number } | { kind: 'files'; ids: number[] };

const COLLAPSED_KEY = 'mwl_files_collapsed';

function findFolderNode(nodes: FolderNode[], id: number): FolderNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findFolderNode(node.children, id);
    if (found) return found;
  }
  return null;
}

function folderSubtreeIds(nodes: FolderNode[], id: number): Set<number> {
  const ids = new Set<number>();
  const walk = (node: FolderNode) => {
    ids.add(node.id);
    node.children.forEach(walk);
  };
  const node = findFolderNode(nodes, id);
  if (node) walk(node);
  return ids;
}

function findFolderParentId(nodes: FolderNode[], id: number, parent: number | null = null): number | null | undefined {
  for (const node of nodes) {
    if (node.id === id) return parent;
    const found = findFolderParentId(node.children, id, node.id);
    if (found !== undefined) return found;
  }
  return undefined;
}

function ancestorChain(nodes: FolderNode[], id: number, chain: number[] = []): number[] | null {
  for (const node of nodes) {
    if (node.id === id) return chain;
    const found = ancestorChain(node.children, id, [...chain, node.id]);
    if (found) return found;
  }
  return null;
}

function persistCollapsed(set: Set<number>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...set]));
  } catch {
    // Storage unavailable (private browsing, quota) — collapse state just won't persist.
  }
}

export function FileSharePage() {
  const queryClient = useQueryClient();
  const { isElevated, user } = useAuth();

  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [collapsed, setCollapsed] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY);
      return raw ? new Set(JSON.parse(raw) as number[]) : new Set();
    } catch {
      return new Set();
    }
  });
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [folderName, setFolderName] = useState('');
  const [folderModalOpen, { open: openFolderModal, close: closeFolderModal }] = useDisclosure(false);
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [editFolder, setEditFolder] = useState<FileFolder | null>(null);
  const [editFile, setEditFile] = useState<StoredFile | null>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null | undefined>(undefined);
  const [externalDragActive, setExternalDragActive] = useState(false);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const statsQuery = useQuery({ queryKey: ['file-stats'], queryFn: filesApi.stats });
  const treeQuery = useQuery({ queryKey: ['file-tree'], queryFn: filesApi.tree });
  const listingQuery = useQuery({ queryKey: ['file-listing', selectedFolderId], queryFn: () => filesApi.listFolder(selectedFolderId), placeholderData: (previous) => previous });
  const recentQuery = useQuery({ queryKey: ['recent-files'], queryFn: () => filesApi.recent(8) });
  const folderStatsQuery = useQuery({ queryKey: ['folder-stats', selectedFolderId], queryFn: () => filesApi.folderStats(selectedFolderId) });

  const tree = treeQuery.data ?? [];
  const currentFiles = listingQuery.data?.files ?? [];

  const refreshFiles = () => {
    void queryClient.invalidateQueries({ queryKey: ['file-stats'] });
    void queryClient.invalidateQueries({ queryKey: ['file-tree'] });
    void queryClient.invalidateQueries({ queryKey: ['file-listing'] });
    void queryClient.invalidateQueries({ queryKey: ['recent-files'] });
    void queryClient.invalidateQueries({ queryKey: ['folder-stats'] });
  };

  function findFolderName(id: number): string | undefined {
    return findFolderNode(tree, id)?.name;
  }

  function expandAncestors(id: number) {
    const chain = ancestorChain(tree, id);
    if (!chain || chain.length === 0) return;
    setCollapsed((current) => {
      const next = new Set(current);
      chain.forEach((ancestorId) => next.delete(ancestorId));
      persistCollapsed(next);
      return next;
    });
  }

  function toggleCollapse(id: number) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      persistCollapsed(next);
      return next;
    });
  }

  function selectFolder(id: number | null) {
    setSelectedFolderId(id);
    setSelectedFiles([]);
    setSearch('');
    if (id !== null) expandAncestors(id);
  }

  function canMoveFile(file: StoredFile): boolean {
    return isElevated || (!!user && user.id === file.uploaded_by);
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  const createFolderMutation = useMutation({
    mutationFn: () => filesApi.createFolder(folderName.trim(), selectedFolderId),
    onSuccess: () => { notifySuccess('Folder created'); setFolderName(''); closeFolderModal(); refreshFiles(); },
    onError: (error) => notifyError(error, 'Unable to create the folder.'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: () => filesApi.bulkDelete(selectedFiles),
    onSuccess: (result) => { notifySuccess(`${result.deleted.length} file${result.deleted.length === 1 ? '' : 's'} removed`); setSelectedFiles([]); refreshFiles(); },
    onError: (error) => notifyError(error, 'Unable to remove the selected files.'),
  });

  const deleteFileMutation = useMutation({
    mutationFn: (id: number) => filesApi.remove(id),
    onSuccess: () => { notifySuccess('File removed'); refreshFiles(); },
    onError: (error) => notifyError(error, 'Unable to remove the file.'),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: number) => filesApi.deleteFolder(id),
    onSuccess: (_result, id) => {
      notifySuccess('Folder removed');
      if (selectedFolderId === id) selectFolder(null);
      refreshFiles();
    },
    onError: (error) => notifyError(error, 'Unable to remove the folder. Make sure it is empty.'),
  });

  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name, isClassified }: { id: number; name: string; isClassified: boolean }) => filesApi.renameFolder(id, name, isClassified),
    onSuccess: () => { notifySuccess('Folder updated'); setEditFolder(null); refreshFiles(); },
    onError: (error) => notifyError(error, 'Unable to update the folder.'),
  });

  const setFileClassifiedMutation = useMutation({
    mutationFn: ({ id, isClassified }: { id: number; isClassified: boolean }) => filesApi.setClassified(id, isClassified),
    onSuccess: () => { notifySuccess('File updated'); setEditFile(null); refreshFiles(); },
    onError: (error) => notifyError(error, 'Unable to update the file.'),
  });

  const moveFolderMutation = useMutation({
    mutationFn: ({ id, parentId }: { id: number; parentId: number | null }) => filesApi.moveFolder(id, parentId),
    onSuccess: () => { notifySuccess('Folder moved'); setMoveTarget(null); refreshFiles(); },
    onError: (error) => notifyError(error, 'Unable to move the folder.'),
  });

  // Sequential, not Promise.all: the backend caches one DB connection per thread
  // behind a small pool, so parallel POSTs would just contend for threads.
  const moveFilesMutation = useMutation({
    mutationFn: async ({ ids, target }: { ids: number[]; target: number | null }) => {
      let ok = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          await filesApi.move(id, target);
          ok += 1;
        } catch {
          failed += 1;
        }
      }
      return { ok, failed };
    },
    onSuccess: ({ ok, failed }) => {
      if (ok) notifySuccess(`${ok} file${ok === 1 ? '' : 's'} moved`);
      if (failed) notifyError(new Error('partial failure'), `${failed} file${failed === 1 ? '' : 's'} could not be moved.`);
      setSelectedFiles([]);
      setMoveTarget(null);
      refreshFiles();
    },
    onError: (error) => notifyError(error, 'Unable to move the selected files.'),
  });

  function confirmDeleteFile(file: StoredFile) {
    modals.openConfirmModal({
      title: 'Delete file',
      children: <Text size="sm">Delete “{file.original_name}”? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteFileMutation.mutate(file.id),
    });
  }

  function confirmDeleteFolder(id: number, name: string) {
    modals.openConfirmModal({
      title: 'Delete folder',
      children: <Text size="sm">Delete “{name}”? The folder must be empty first.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteFolderMutation.mutate(id),
    });
  }

  function confirmBulkDelete() {
    modals.openConfirmModal({
      title: 'Delete files',
      children: <Text size="sm">Remove {selectedFiles.length} selected file{selectedFiles.length === 1 ? '' : 's'}? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => bulkDeleteMutation.mutate(),
    });
  }

  function openEditFolder(id: number) {
    const node = findFolderNode(tree, id);
    if (node) setEditFolder(node);
  }

  function openMoveForFolder(id: number) {
    setMoveTarget({ kind: 'folder', id });
  }

  function openMoveForFile(file: StoredFile) {
    setMoveTarget({ kind: 'files', ids: [file.id] });
  }

  function openMoveForSelected() {
    if (selectedFiles.length > 0) setMoveTarget({ kind: 'files', ids: selectedFiles });
  }

  function handleFolderEditSave(name: string, isClassified: boolean) {
    if (!editFolder) return;
    renameFolderMutation.mutate({ id: editFolder.id, name, isClassified });
  }

  function handleFileEditSave(isClassified: boolean) {
    if (!editFile) return;
    setFileClassifiedMutation.mutate({ id: editFile.id, isClassified });
  }

  function handleMoveConfirm(target: number | null) {
    if (!moveTarget) return;
    if (moveTarget.kind === 'folder') moveFolderMutation.mutate({ id: moveTarget.id, parentId: target });
    else moveFilesMutation.mutate({ ids: moveTarget.ids, target });
  }

  const moveModalProps = useMemo(() => {
    if (!moveTarget) return null;
    if (moveTarget.kind === 'folder') {
      return {
        subtitle: `Move “${findFolderName(moveTarget.id) ?? 'this folder'}” to…`,
        blockedIds: folderSubtreeIds(tree, moveTarget.id),
        currentParentId: findFolderParentId(tree, moveTarget.id) ?? null,
      };
    }
    const count = moveTarget.ids.length;
    const subtitle = count === 1
      ? `Move “${currentFiles.find((f) => f.id === moveTarget.ids[0])?.original_name ?? 'this file'}” to…`
      : `Move ${count} files to…`;
    return { subtitle, blockedIds: new Set<number>(), currentParentId: selectedFolderId };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveTarget, tree, selectedFolderId]);

  // ── Drag and drop (internal move) ───────────────────────────────────────

  function canDropOnFolder(folderId: number | null): boolean {
    if (!dragPayload) return false;
    if (dragPayload.type === 'folder') {
      if (folderId === dragPayload.id) return false;
      if (folderId !== null && dragPayload.blocked.has(folderId)) return false;
      return true;
    }
    return folderId !== selectedFolderId;
  }

  function handleDragEnterTarget(folderId: number | null) {
    setDropTargetId(folderId);
  }

  function handleDragLeaveTarget(folderId: number | null) {
    setDropTargetId((current) => (current === folderId ? undefined : current));
  }

  function handleDropTarget(folderId: number | null) {
    if (!dragPayload) return;
    if (dragPayload.type === 'folder') moveFolderMutation.mutate({ id: dragPayload.id, parentId: folderId });
    else moveFilesMutation.mutate({ ids: dragPayload.ids, target: folderId });
    setDragPayload(null);
    setDropTargetId(undefined);
  }

  function handleDragStartFolder(event: DragEvent, folderId: number) {
    event.dataTransfer.setData('text/plain', 'folder');
    event.dataTransfer.effectAllowed = 'move';
    setDragPayload({ type: 'folder', id: folderId, blocked: folderSubtreeIds(tree, folderId) });
  }

  function handleDragEndFolder() {
    setDragPayload(null);
    setDropTargetId(undefined);
  }

  function startFileDrag(event: DragEvent, file: StoredFile) {
    const ids = selectedFiles.includes(file.id) && selectedFiles.length > 1 ? selectedFiles : [file.id];
    const movable = ids.filter((fid) => {
      const found = currentFiles.find((f) => f.id === fid);
      return found && canMoveFile(found);
    });
    if (movable.length === 0) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('text/plain', 'files');
    event.dataTransfer.effectAllowed = 'move';
    setDragPayload({ type: 'files', ids: movable });
  }

  function endFileDrag() {
    setDragPayload(null);
    setDropTargetId(undefined);
  }

  // ── External OS drag (upload) ───────────────────────────────────────────
  // Internal drags only ever carry the 'text/plain' type, so an external OS
  // file drag (which carries 'Files') never gets intercepted by the folder
  // drop-target handlers above — no manual precedence juggling needed.

  function isExternalFileDrag(event: DragEvent): boolean {
    if (dragPayload) return false;
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
  }

  function handlePaneDragEnter(event: DragEvent) {
    if (!isExternalFileDrag(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setExternalDragActive(true);
  }

  function handlePaneDragOver(event: DragEvent) {
    if (!isExternalFileDrag(event)) return;
    event.preventDefault();
  }

  function handlePaneDragLeave(event: DragEvent) {
    if (!isExternalFileDrag(event)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setExternalDragActive(false);
  }

  function handlePaneDrop(event: DragEvent) {
    if (!isExternalFileDrag(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setExternalDragActive(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) startUpload(files);
  }

  // ── Upload ───────────────────────────────────────────────────────────────

  function startUpload(files: File[]) {
    const valid: File[] = [];
    for (const file of files) {
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        notifyError(new Error('too large'), `“${file.name}” exceeds the ${MAX_UPLOAD_MB} MB limit.`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length) void runUploadBatch(valid);
  }

  async function runUploadBatch(files: File[]) {
    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const handle = filesApi.upload(file, selectedFolderId, (percent) => {
        setUploads((current) => current.map((row) => (row.id === id ? { ...row, progress: percent } : row)));
      });
      setUploads((current) => [...current, { id, name: file.name, size: file.size, progress: 0, status: 'active', abort: handle.abort }]);
      try {
        await handle.promise;
        setUploads((current) => current.map((row) => (row.id === id ? { ...row, status: 'done', progress: 100 } : row)));
      } catch (error) {
        const cancelled = error instanceof ApiError && error.status === 0 && error.message === 'Upload cancelled.';
        const message = error instanceof ApiError ? error.message : 'Upload failed.';
        setUploads((current) => current.map((row) => (row.id === id ? { ...row, status: cancelled ? 'cancelled' : 'error', message } : row)));
        if (!cancelled) notifyError(error, `Unable to upload “${file.name}”.`);
      }
    }
    refreshFiles();
  }

  // ── Search / sort ───────────────────────────────────────────────────────

  const visibleFiles = useMemo(() => {
    let list = currentFiles;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((file) => file.original_name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.original_name.localeCompare(b.original_name);
      else if (sortKey === 'size') cmp = a.size_bytes - b.size_bytes;
      else cmp = (a.uploaded_by_name ?? '').localeCompare(b.uploaded_by_name ?? '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [currentFiles, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return null;
    return sortDir === 'asc' ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />;
  }

  const toggleFile = (id: number) => setSelectedFiles((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const visibleIds = useMemo(() => visibleFiles.map((file) => file.id), [visibleFiles]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedFiles.includes(id));
  const toggleAll = () => setSelectedFiles((current) => (allSelected ? current.filter((id) => !visibleIds.includes(id)) : [...new Set([...current, ...visibleIds])]));

  const stats = statsQuery.data;
  const usagePercent = stats && stats.cap_bytes > 0 ? Math.min(100, Math.round((stats.used_bytes / stats.cap_bytes) * 100)) : 0;
  const lowDisk = !!stats && stats.free_disk_bytes < stats.min_free_bytes;

  return (
    <Stack gap="xl">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) startUpload(files);
          event.target.value = '';
        }}
      />
      <PageHeader
        eyebrow="Shared workspace"
        title="File share"
        description="Keep project artefacts discoverable, classified, and available to the right team."
        breadcrumb="File share"
        actions={
          <Group>
            <Button variant="default" leftSection={<IconFolderPlus size={17} />} onClick={openFolderModal}>New folder</Button>
            <Button leftSection={<IconUpload size={17} />} onClick={() => fileInputRef.current?.click()}>Upload files</Button>
          </Group>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card padding="lg" className="metric-card"><Group><ThemeIcon color="indigo" variant="light" size={38}><IconFile size={20} /></ThemeIcon><div><Text size="xs" c="dimmed" fw={700}>Files stored</Text><Text fz={25} fw={800}>{stats?.file_count ?? 0}</Text></div></Group></Card>
        <Card padding="lg" className="metric-card"><Group><ThemeIcon color="cyan" variant="light" size={38}><IconFolder size={20} /></ThemeIcon><div><Text size="xs" c="dimmed" fw={700}>Folders</Text><Text fz={25} fw={800}>{stats?.folder_count ?? 0}</Text></div></Group></Card>
        <Card padding="lg" className="metric-card">
          <Group justify="space-between" mb={6}>
            <Group gap="sm"><ThemeIcon color="teal" variant="light" size={38}><IconCloudUpload size={20} /></ThemeIcon><div><Text size="xs" c="dimmed" fw={700}>Storage used</Text><Text fz={25} fw={800}>{formatBytes(stats?.used_bytes)}</Text></div></Group>
          </Group>
          <Progress value={usagePercent} size="sm" color={usagePercent > 90 ? 'red' : usagePercent > 70 ? 'orange' : 'teal'} />
          <Text size="xs" c="dimmed" mt={4}>{formatBytes(stats?.used_bytes)} of {formatBytes(stats?.cap_bytes)}{lowDisk ? ' · low disk space' : ''}</Text>
        </Card>
      </SimpleGrid>

      <div
        className="file-share-dnd-root"
        onDragEnter={handlePaneDragEnter}
        onDragOver={handlePaneDragOver}
        onDragLeave={handlePaneDragLeave}
        onDrop={handlePaneDrop}
      >
        {externalDragActive && (
          <div className="file-share-drop-overlay">
            <IconCloudUpload size={34} />
            <Text fw={800}>Drop to upload to {selectedFolderId ? findFolderName(selectedFolderId) ?? 'this folder' : 'the root workspace'}</Text>
          </div>
        )}
        <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
          <Card padding="md" className="surface-card folder-panel">
            <Group justify="space-between" mb="md">
              <div><Title order={3}>Folders</Title><Text size="xs" c="dimmed">Organise by delivery stream</Text></div>
              <ActionIcon variant="subtle" onClick={refreshFiles} aria-label="Refresh folders"><IconRefresh size={17} /></ActionIcon>
            </Group>
            <ScrollArea h={360}>
              {treeQuery.isLoading ? (
                <Stack gap={3}>{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} height={32} />)}</Stack>
              ) : (
                <FolderTree
                  tree={tree}
                  selectedId={selectedFolderId}
                  collapsed={collapsed}
                  canManage={isElevated}
                  dropTargetId={dropTargetId}
                  onSelect={selectFolder}
                  onToggleCollapse={toggleCollapse}
                  canDrop={canDropOnFolder}
                  onDragEnterTarget={handleDragEnterTarget}
                  onDragLeaveTarget={handleDragLeaveTarget}
                  onDropTarget={handleDropTarget}
                  onDragStartFolder={handleDragStartFolder}
                  onDragEndFolder={handleDragEndFolder}
                  onOpenFolder={selectFolder}
                  onMoveFolder={openMoveForFolder}
                  onEditFolder={openEditFolder}
                  onDeleteFolder={(id) => confirmDeleteFolder(id, findFolderName(id) ?? 'this folder')}
                />
              )}
            </ScrollArea>
          </Card>

          <Card padding={0} className="surface-card table-card" style={{ gridColumn: 'span 2' }}>
            <Stack gap="sm" p="lg" pb="md">
              <Group justify="space-between" wrap="wrap">
                <div>
                  <Breadcrumbs>
                    <Anchor size="sm" fw={selectedFolderId === null ? 700 : 500} onClick={() => selectFolder(null)}>All files</Anchor>
                    {(listingQuery.data?.breadcrumbs ?? []).map((crumb, index, arr) => (
                      <Anchor key={crumb.id} size="sm" fw={index === arr.length - 1 ? 700 : 500} onClick={() => selectFolder(crumb.id)}>{crumb.name}</Anchor>
                    ))}
                  </Breadcrumbs>
                  <Text size="xs" c="dimmed" mt={4}>
                    {folderStatsQuery.data ? `${folderStatsQuery.data.file_count} files · ${folderStatsQuery.data.subfolder_count} subfolders · ${formatBytes(folderStatsQuery.data.total_bytes)}` : '\u00A0'}
                  </Text>
                </div>
                <TextInput placeholder="Search this folder…" value={search} onChange={(event) => setSearch(event.currentTarget.value)} leftSection={<IconSearch size={15} />} w={230} />
              </Group>

              {selectedFiles.length > 0 && (
                <Group gap="xs">
                  <Badge variant="light" color="indigo">{selectedFiles.length} selected</Badge>
                  <Button size="xs" variant="subtle" leftSection={<IconArrowsMove size={15} />} onClick={openMoveForSelected}>Move to…</Button>
                  <Button size="xs" color="red" variant="subtle" leftSection={<IconTrash size={15} />} loading={bulkDeleteMutation.isPending} onClick={confirmBulkDelete}>Delete</Button>
                  <Button size="xs" variant="subtle" leftSection={<IconDownload size={15} />} onClick={() => void filesApi.bulkDownload(selectedFiles).catch((error) => notifyError(error, 'Unable to download these files.'))}>Download</Button>
                </Group>
              )}

              {(listingQuery.data?.folders ?? []).length > 0 && (
                <div>
                  <Text size="xs" fw={800} c="dimmed" tt="uppercase" lts="0.06em" mb={6}>Subfolders</Text>
                  <SimpleGrid cols={{ base: 2, sm: 3, xl: 4 }} spacing="sm">
                    {(listingQuery.data?.folders ?? []).map((folder) => (
                      <div
                        key={folder.id}
                        className={`subfolder-card${dropTargetId === folder.id ? ' drop-target' : ''}`}
                        draggable={isElevated}
                        role="button"
                        tabIndex={0}
                        onClick={() => selectFolder(folder.id)}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectFolder(folder.id); } }}
                        onDragStart={isElevated ? (event) => handleDragStartFolder(event, folder.id) : undefined}
                        onDragEnd={isElevated ? handleDragEndFolder : undefined}
                        onDragOver={(event) => { if (!canDropOnFolder(folder.id)) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
                        onDragEnter={(event) => { if (!canDropOnFolder(folder.id)) return; event.preventDefault(); handleDragEnterTarget(folder.id); }}
                        onDragLeave={() => handleDragLeaveTarget(folder.id)}
                        onDrop={(event) => { if (!canDropOnFolder(folder.id)) return; event.preventDefault(); event.stopPropagation(); handleDropTarget(folder.id); }}
                      >
                        <IconFolder size={18} className="subfolder-card-icon" />
                        <Text size="sm" fw={700} lineClamp={1} className="subfolder-card-name">{folder.name}</Text>
                        {folder.is_classified && <IconLock size={13} color="var(--mantine-color-orange-6)" />}
                        {isElevated && (
                          <Menu withinPortal position="bottom-end" shadow="md" width={170}>
                            <Menu.Target><ActionIcon size="xs" variant="subtle" color="gray" onClick={(event) => event.stopPropagation()} aria-label="More actions"><IconDots size={15} /></ActionIcon></Menu.Target>
                            <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
                              <Menu.Item leftSection={<IconArrowsMove size={15} />} onClick={() => openMoveForFolder(folder.id)}>Move to…</Menu.Item>
                              <Menu.Item leftSection={<IconEdit size={15} />} onClick={() => openEditFolder(folder.id)}>Edit</Menu.Item>
                              <Menu.Divider />
                              <Menu.Item color="red" leftSection={<IconTrash size={15} />} onClick={() => confirmDeleteFolder(folder.id, folder.name)}>Delete</Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        )}
                      </div>
                    ))}
                  </SimpleGrid>
                </div>
              )}
            </Stack>
            <Divider />
            <div className="table-scroll">
              <Table verticalSpacing="sm" highlightOnHover miw={690}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th><Checkbox checked={allSelected} indeterminate={selectedFiles.length > 0 && !allSelected} onChange={toggleAll} aria-label="Select all files" /></Table.Th>
                    <Table.Th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}><Group gap={4} wrap="nowrap">File{sortIcon('name')}</Group></Table.Th>
                    <Table.Th style={{ cursor: 'pointer' }} onClick={() => toggleSort('uploader')}><Group gap={4} wrap="nowrap">Uploaded by{sortIcon('uploader')}</Group></Table.Th>
                    <Table.Th style={{ cursor: 'pointer' }} onClick={() => toggleSort('size')}><Group gap={4} wrap="nowrap">Size{sortIcon('size')}</Group></Table.Th>
                    <Table.Th ta="right">Access</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {listingQuery.isLoading ? (
                    Array.from({ length: 5 }, (_, index) => <Table.Tr key={index}>{Array.from({ length: 5 }, (_, cell) => <Table.Td key={cell}><Skeleton height={28} /></Table.Td>)}</Table.Tr>)
                  ) : visibleFiles.length === 0 ? (
                    <Table.Tr><Table.Td colSpan={5}><Stack align="center" py={55}><IconFolder size={30} color="var(--mantine-color-gray-5)" /><Text fw={700}>{search ? 'No files match your search' : 'This folder is empty'}</Text><Text size="sm" c="dimmed">{search ? 'Try a different search term.' : 'Upload a file to start sharing.'}</Text></Stack></Table.Td></Table.Tr>
                  ) : (
                    visibleFiles.map((file) => {
                      const movable = canMoveFile(file);
                      return (
                        <Table.Tr
                          key={file.id}
                          className={selectedFiles.includes(file.id) ? 'row-selected' : undefined}
                          draggable={movable}
                          onDragStart={movable ? (event) => startFileDrag(event, file) : undefined}
                          onDragEnd={movable ? endFileDrag : undefined}
                        >
                          <Table.Td><Checkbox checked={selectedFiles.includes(file.id)} onChange={() => toggleFile(file.id)} aria-label={`Select ${file.original_name}`} /></Table.Td>
                          <Table.Td>
                            <Group gap="sm" wrap="nowrap">
                              <ThemeIcon variant="light" color="indigo" size={32}><IconFile size={16} /></ThemeIcon>
                              <div style={{ minWidth: 0 }}>
                                <Text component="button" type="button" size="sm" fw={700} lineClamp={1} className="file-row-name-link" onClick={() => setPreviewFile(file)}>{file.original_name}</Text>
                                <Text size="xs" c="dimmed">{file.mime_type ?? 'File'}</Text>
                              </div>
                            </Group>
                          </Table.Td>
                          <Table.Td><Text size="sm">{file.uploaded_by_name ?? '—'}</Text></Table.Td>
                          <Table.Td><Text size="sm" c="dimmed">{formatBytes(file.size_bytes)}</Text></Table.Td>
                          <Table.Td ta="right">
                            <Group gap={4} justify="flex-end" wrap="nowrap">
                              {file.is_classified && <Tooltip label="Classified"><IconLock size={15} color="var(--mantine-color-orange-6)" /></Tooltip>}
                              <Menu withinPortal position="bottom-end" shadow="md" width={170}>
                                <Menu.Target><ActionIcon size="sm" variant="subtle" color="gray" aria-label="More actions"><IconDots size={16} /></ActionIcon></Menu.Target>
                                <Menu.Dropdown>
                                  <Menu.Item leftSection={<IconEye size={15} />} onClick={() => setPreviewFile(file)}>Preview</Menu.Item>
                                  <Menu.Item component="a" href={filesApi.downloadUrl(file.id)} leftSection={<IconDownload size={15} />}>Download</Menu.Item>
                                  {movable && <Menu.Item leftSection={<IconArrowsMove size={15} />} onClick={() => openMoveForFile(file)}>Move to…</Menu.Item>}
                                  {isElevated && <Menu.Item leftSection={<IconEdit size={15} />} onClick={() => setEditFile(file)}>Edit</Menu.Item>}
                                  {movable && (<><Menu.Divider /><Menu.Item color="red" leftSection={<IconTrash size={15} />} onClick={() => confirmDeleteFile(file)}>Delete</Menu.Item></>)}
                                </Menu.Dropdown>
                              </Menu>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })
                  )}
                </Table.Tbody>
              </Table>
            </div>
          </Card>
        </SimpleGrid>
      </div>

      <Card padding="lg" className="surface-card">
        <Group justify="space-between" mb="md"><div><Title order={3}>Recently added</Title><Text size="sm" c="dimmed">A quick view of the latest workspace activity</Text></div><Badge variant="light" color="gray">Last 8 files</Badge></Group>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          {recentQuery.isLoading ? Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height={60} />) : (recentQuery.data ?? []).map((file) => (
            <Group
              key={file.id}
              gap="sm"
              wrap="nowrap"
              className="recent-file"
              role="button"
              tabIndex={0}
              onClick={() => setPreviewFile(file)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPreviewFile(file); } }}
            >
              <ThemeIcon variant="light" color="indigo" size={34}><IconFile size={17} /></ThemeIcon>
              <div style={{ minWidth: 0 }}>
                <Text size="sm" fw={700} lineClamp={1}>{file.original_name}</Text>
                <Text size="xs" c="dimmed" lineClamp={1}>{file.folder_name ?? 'Root'} · {formatBytes(file.size_bytes)}</Text>
              </div>
            </Group>
          ))}
        </SimpleGrid>
      </Card>

      {uploads.length > 0 && (
        <Card padding="md" className="surface-card upload-panel">
          <Group justify="space-between" mb="sm">
            <Text fw={700} size="sm">Uploads</Text>
            <Button size="xs" variant="subtle" onClick={() => setUploads((current) => current.filter((row) => row.status === 'active'))}>Clear completed</Button>
          </Group>
          <Stack gap="xs">
            {uploads.map((row) => (
              <div key={row.id} className="upload-row">
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text size="xs" fw={600} lineClamp={1} style={{ flex: 1 }}>{row.name}</Text>
                  <Text size="xs" c="dimmed">{row.status === 'error' ? 'Failed' : row.status === 'cancelled' ? 'Cancelled' : row.status === 'done' ? 'Done' : `${row.progress}%`}</Text>
                  {row.status === 'active' ? (
                    <ActionIcon size="sm" variant="subtle" color="red" onClick={row.abort} aria-label={`Cancel upload of ${row.name}`}><IconX size={14} /></ActionIcon>
                  ) : (
                    <ActionIcon size="sm" variant="subtle" onClick={() => setUploads((current) => current.filter((r) => r.id !== row.id))} aria-label={`Dismiss ${row.name}`}><IconX size={14} /></ActionIcon>
                  )}
                </Group>
                <Progress value={row.progress} size="xs" mt={4} color={row.status === 'error' ? 'red' : row.status === 'cancelled' ? 'gray' : 'indigo'} />
                {row.message && <Text size="xs" c="red">{row.message}</Text>}
              </div>
            ))}
          </Stack>
        </Card>
      )}

      <Modal opened={folderModalOpen} onClose={closeFolderModal} title="Create a folder" centered>
        <Stack>
          <TextInput label="Folder name" placeholder="e.g. Q3 planning" value={folderName} onChange={(event) => setFolderName(event.currentTarget.value)} autoFocus />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeFolderModal}>Cancel</Button>
            <Button loading={createFolderMutation.isPending} disabled={!folderName.trim()} onClick={() => createFolderMutation.mutate()}>Create folder</Button>
          </Group>
        </Stack>
      </Modal>

      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />

      <MoveToModal
        opened={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        tree={tree}
        blockedIds={moveModalProps?.blockedIds ?? new Set()}
        currentParentId={moveModalProps?.currentParentId ?? null}
        subtitle={moveModalProps?.subtitle ?? ''}
        loading={moveFolderMutation.isPending || moveFilesMutation.isPending}
        onConfirm={handleMoveConfirm}
      />

      <FolderEditModal folder={editFolder} onClose={() => setEditFolder(null)} onSave={handleFolderEditSave} saving={renameFolderMutation.isPending} />

      <FileEditModal file={editFile} onClose={() => setEditFile(null)} onSave={handleFileEditSave} saving={setFileClassifiedMutation.isPending} />

      {!isElevated && <Alert color="gray" icon={<IconLock size={18} />}>Some classified files and administrative folder actions may be restricted by your role.</Alert>}
    </Stack>
  );
}
