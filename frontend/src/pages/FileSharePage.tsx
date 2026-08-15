import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dropzone } from '@mantine/dropzone';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Modal,
  NavLink,
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
import { IconCloudUpload, IconDownload, IconFile, IconFolder, IconFolderPlus, IconLock, IconRefresh, IconTrash, IconUpload } from '@tabler/icons-react';

import { useAuth } from '../auth/AuthContext';
import { filesApi, MAX_UPLOAD_MB } from '../api/files';
import { PageHeader } from '../components/PageHeader';
import type { FolderNode, StoredFile } from '../types/api';
import { formatBytes } from '../utils/dates';
import { notifyError, notifySuccess } from '../utils/notify';

function FolderTreeItem({ node, selectedId, onSelect }: { node: FolderNode; selectedId: number | null; onSelect: (id: number) => void }) {
  return <Stack gap={2}><NavLink label={node.name} leftSection={<IconFolder size={16} />} active={selectedId === node.id} onClick={() => onSelect(node.id)} className="folder-tree-item" />{node.children.length > 0 && <Stack gap={2} pl="md">{node.children.map((child) => <FolderTreeItem key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} />)}</Stack>}</Stack>;
}

export function FileSharePage() {
  const queryClient = useQueryClient();
  const { isElevated } = useAuth();
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [folderName, setFolderName] = useState('');
  const openRef = useRef<(() => void) | null>(null);
  const [folderModalOpen, { open: openFolderModal, close: closeFolderModal }] = useDisclosure(false);
  const statsQuery = useQuery({ queryKey: ['file-stats'], queryFn: filesApi.stats });
  const treeQuery = useQuery({ queryKey: ['file-tree'], queryFn: filesApi.tree });
  const listingQuery = useQuery({ queryKey: ['file-listing', selectedFolderId], queryFn: () => filesApi.listFolder(selectedFolderId), placeholderData: (previous) => previous });
  const recentQuery = useQuery({ queryKey: ['recent-files'], queryFn: () => filesApi.recent(8) });
  const currentFiles = listingQuery.data?.files ?? [];
  const currentIds = useMemo(() => currentFiles.map((file) => file.id), [currentFiles]);

  const refreshFiles = () => {
    void queryClient.invalidateQueries({ queryKey: ['file-stats'] });
    void queryClient.invalidateQueries({ queryKey: ['file-tree'] });
    void queryClient.invalidateQueries({ queryKey: ['file-listing'] });
    void queryClient.invalidateQueries({ queryKey: ['recent-files'] });
  };
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      let lastResult: StoredFile | undefined;
      for (const file of files) {
        setUploadProgress(0);
        const handle = filesApi.upload(file, selectedFolderId, setUploadProgress);
        lastResult = await handle.promise;
      }
      return lastResult;
    },
    onSuccess: () => { setUploadProgress(100); notifySuccess('Upload complete'); refreshFiles(); },
    onError: (error) => notifyError(error, 'Unable to upload the selected file.'),
    onSettled: () => window.setTimeout(() => setUploadProgress(0), 800),
  });
  const createFolderMutation = useMutation({
    mutationFn: () => filesApi.createFolder(folderName.trim(), selectedFolderId),
    onSuccess: () => { notifySuccess('Folder created'); setFolderName(''); closeFolderModal(); refreshFiles(); },
    onError: (error) => notifyError(error, 'Unable to create the folder.'),
  });
  const deleteMutation = useMutation({
    mutationFn: () => filesApi.bulkDelete(selectedFiles),
    onSuccess: (result) => { notifySuccess(`${result.deleted.length} file${result.deleted.length === 1 ? '' : 's'} removed`); setSelectedFiles([]); refreshFiles(); },
    onError: (error) => notifyError(error, 'Unable to remove the selected files.'),
  });

  const toggleFile = (id: number) => setSelectedFiles((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const allSelected = currentIds.length > 0 && currentIds.every((id) => selectedFiles.includes(id));
  const toggleAll = () => setSelectedFiles((current) => allSelected ? current.filter((id) => !currentIds.includes(id)) : [...new Set([...current, ...currentIds])]);

  return (
    <Stack gap="xl">
      <PageHeader eyebrow="Shared workspace" title="File share" description="Keep project artefacts discoverable, classified, and available to the right team." breadcrumb="File share" actions={<Group><Button variant="default" leftSection={<IconFolderPlus size={17} />} onClick={openFolderModal}>New folder</Button><Button leftSection={<IconUpload size={17} />} onClick={() => openRef.current?.()}>Upload files</Button></Group>} />
      <SimpleGrid cols={{ base: 1, sm: 3 }}><Card padding="lg" className="metric-card"><Group><ThemeIcon color="indigo" variant="light" size={38}><IconFile size={20} /></ThemeIcon><div><Text size="xs" c="dimmed" fw={700}>Files stored</Text><Text fz={25} fw={800}>{statsQuery.data?.file_count ?? 0}</Text></div></Group></Card><Card padding="lg" className="metric-card"><Group><ThemeIcon color="cyan" variant="light" size={38}><IconFolder size={20} /></ThemeIcon><div><Text size="xs" c="dimmed" fw={700}>Folders</Text><Text fz={25} fw={800}>{statsQuery.data?.folder_count ?? 0}</Text></div></Group></Card><Card padding="lg" className="metric-card"><Group><ThemeIcon color="teal" variant="light" size={38}><IconCloudUpload size={20} /></ThemeIcon><div><Text size="xs" c="dimmed" fw={700}>Storage used</Text><Text fz={25} fw={800}>{formatBytes(statsQuery.data?.used_bytes)}</Text></div></Group></Card></SimpleGrid>

      <Card padding="lg" className="dropzone-card"><Dropzone openRef={openRef} onDrop={(files) => uploadMutation.mutate(files)} onReject={() => notifyError(new Error('The selected file is too large or unsupported.'), `Files must be smaller than ${MAX_UPLOAD_MB} MB.`)} maxSize={MAX_UPLOAD_MB * 1024 * 1024} loading={uploadMutation.isPending} activateOnClick={false} className="dropzone-shell"><Group justify="center" gap="xl" mih={92} wrap="wrap"><ThemeIcon size={48} radius="xl" variant="light" color="indigo"><IconCloudUpload size={25} /></ThemeIcon><div><Text fw={800}>Drop files to upload</Text><Text size="sm" c="dimmed">Up to {MAX_UPLOAD_MB} MB per file · uploaded to {selectedFolderId ? 'the selected folder' : 'the root workspace'}</Text></div><Button variant="light" onClick={() => openRef.current?.()}>Browse files</Button></Group></Dropzone>{uploadMutation.isPending && <Progress value={uploadProgress} mt="md" animated color="indigo" />}</Card>

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
        <Card padding="md" className="surface-card folder-panel"><Group justify="space-between" mb="md"><div><Title order={3}>Folders</Title><Text size="xs" c="dimmed">Organise by delivery stream</Text></div><ActionIcon variant="subtle" onClick={refreshFiles} aria-label="Refresh folders"><IconRefresh size={17} /></ActionIcon></Group><ScrollArea h={360}><Stack gap={3}><NavLink label="All files" leftSection={<IconFolder size={16} />} active={selectedFolderId === null} onClick={() => { setSelectedFolderId(null); setSelectedFiles([]); }} className="folder-tree-item" />{treeQuery.isLoading ? Array.from({ length: 5 }, (_, index) => <Skeleton key={index} height={32} />) : (treeQuery.data ?? []).map((node) => <FolderTreeItem key={node.id} node={node} selectedId={selectedFolderId} onSelect={(id) => { setSelectedFolderId(id); setSelectedFiles([]); }} />)}</Stack></ScrollArea></Card>
        <Card padding={0} className="surface-card table-card" style={{ gridColumn: 'span 2' }}><Group justify="space-between" p="lg" pb="md"><div><Title order={3}>{selectedFolderId ? 'Folder contents' : 'Root workspace'}</Title><Text size="sm" c="dimmed">{currentFiles.length} files in this location</Text></div><Group gap="xs">{selectedFiles.length > 0 && <><Badge variant="light" color="indigo">{selectedFiles.length} selected</Badge><Button color="red" variant="subtle" leftSection={<IconTrash size={16} />} loading={deleteMutation.isPending} onClick={() => { if (window.confirm('Remove the selected files?')) deleteMutation.mutate(); }}>Delete</Button><Button variant="subtle" leftSection={<IconDownload size={16} />} onClick={() => void filesApi.bulkDownload(selectedFiles).catch((error) => notifyError(error, 'Unable to download these files.'))}>Download</Button></>}</Group></Group><Divider /><div className="table-scroll"><Table verticalSpacing="sm" highlightOnHover miw={690}><Table.Thead><Table.Tr><Table.Th><Checkbox checked={allSelected} indeterminate={selectedFiles.length > 0 && !allSelected} onChange={toggleAll} aria-label="Select all files" /></Table.Th><Table.Th>File</Table.Th><Table.Th>Uploaded by</Table.Th><Table.Th>Size</Table.Th><Table.Th ta="right">Access</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{listingQuery.isLoading ? Array.from({ length: 5 }, (_, index) => <Table.Tr key={index}>{Array.from({ length: 5 }, (_, cell) => <Table.Td key={cell}><Skeleton height={28} /></Table.Td>)}</Table.Tr>) : currentFiles.length === 0 ? <Table.Tr><Table.Td colSpan={5}><Stack align="center" py={55}><IconFolder size={30} color="var(--mantine-color-gray-5)" /><Text fw={700}>This folder is empty</Text><Text size="sm" c="dimmed">Upload a file to start sharing.</Text></Stack></Table.Td></Table.Tr> : currentFiles.map((file) => <Table.Tr key={file.id}><Table.Td><Checkbox checked={selectedFiles.includes(file.id)} onChange={() => toggleFile(file.id)} aria-label={`Select ${file.original_name}`} /></Table.Td><Table.Td><Group gap="sm" wrap="nowrap"><ThemeIcon variant="light" color="indigo" size={32}><IconFile size={16} /></ThemeIcon><div><Text size="sm" fw={700} lineClamp={1}>{file.original_name}</Text><Text size="xs" c="dimmed">{file.mime_type ?? 'File'}</Text></div></Group></Table.Td><Table.Td><Text size="sm">{file.uploaded_by_name ?? '—'}</Text></Table.Td><Table.Td><Text size="sm" c="dimmed">{formatBytes(file.size_bytes)}</Text></Table.Td><Table.Td ta="right"><Tooltip label="Download"><ActionIcon component="a" href={filesApi.downloadUrl(file.id)} variant="subtle" aria-label={`Download ${file.original_name}`}><IconDownload size={17} /></ActionIcon></Tooltip>{file.is_classified && <Tooltip label="Classified"><IconLock size={16} color="var(--mantine-color-orange-6)" style={{ verticalAlign: 'middle', marginLeft: 6 }} /></Tooltip>}</Table.Td></Table.Tr>)}</Table.Tbody></Table></div></Card>
      </SimpleGrid>

      <Card padding="lg" className="surface-card"><Group justify="space-between" mb="md"><div><Title order={3}>Recently added</Title><Text size="sm" c="dimmed">A quick view of the latest workspace activity</Text></div><Badge variant="light" color="gray">Last 8 files</Badge></Group><SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>{recentQuery.isLoading ? Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height={60} />) : (recentQuery.data ?? []).map((file) => <Group key={file.id} gap="sm" wrap="nowrap" className="recent-file"><ThemeIcon variant="light" color="indigo" size={34}><IconFile size={17} /></ThemeIcon><div style={{ minWidth: 0 }}><Text size="sm" fw={700} lineClamp={1}>{file.original_name}</Text><Text size="xs" c="dimmed" lineClamp={1}>{file.folder_name ?? 'Root'} · {formatBytes(file.size_bytes)}</Text></div></Group>)}</SimpleGrid></Card>

      <Modal opened={folderModalOpen} onClose={closeFolderModal} title="Create a folder" centered><Stack><TextInput label="Folder name" placeholder="e.g. Q3 planning" value={folderName} onChange={(event) => setFolderName(event.currentTarget.value)} autoFocus /><Group justify="flex-end"><Button variant="default" onClick={closeFolderModal}>Cancel</Button><Button loading={createFolderMutation.isPending} disabled={!folderName.trim()} onClick={() => createFolderMutation.mutate()}>Create folder</Button></Group></Stack></Modal>
      {!isElevated && <Alert color="gray" icon={<IconLock size={18} />}>Some classified files and administrative folder actions may be restricted by your role.</Alert>}
    </Stack>
  );
}
