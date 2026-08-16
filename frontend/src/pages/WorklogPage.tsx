import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { modals } from '@mantine/modals';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconClock, IconEdit, IconInfoCircle, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useLocation } from 'react-router';

import { worklogsApi } from '../api/worklogs';
import { projectsApi } from '../api/projects';
import { PageHeader } from '../components/PageHeader';
import { PeriodSelect } from '../components/PeriodSelect';
import { WorklogCalendar } from '../components/WorklogCalendar';
import { WorklogEntryPanel, type WorklogDraft } from '../components/WorklogEntryPanel';
import type { EmployeeId, Worklog, WorklogWrite } from '../types/api';
import { formatHours } from '../utils/dates';
import { notifyError, notifySuccess } from '../utils/notify';
import { useWorkspace } from '../workspace/WorkspaceContext';

function projectValue(row: Worklog, descriptions: { Projectcode: string; Description: string }[]) {
  return descriptions.find((item) => item.Projectcode === row.project)?.Description ?? row.project_description ?? row.project ?? '';
}

function toPayload(memberId: EmployeeId, draft: WorklogDraft): WorklogWrite {
  return {
    member_id: memberId,
    log_date: draft.log_date,
    project: draft.project,
    task: draft.task,
    note: draft.note,
    start_time: draft.start_time,
    end_time: draft.end_time,
    status: draft.status,
    is_allowance: draft.is_allowance,
  };
}

export function WorklogPage() {
  const { selectedMemberId } = useWorkspace();
  const queryClient = useQueryClient();
  const location = useLocation();
  // The dashboard's monthly breakdown table links here with a target month
  // (e.g. clicking "March" jumps straight to March's log instead of today's).
  const [selectedMonth, setSelectedMonth] = useState(
    () => (location.state as { month?: string } | null)?.month ?? dayjs().format('YYYY-MM'),
  );
  const [view, setView] = useState<'table' | 'calendar'>('table');
  const [year, month] = selectedMonth.split('-').map(Number);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeEntry, setActiveEntry] = useState<Worklog | null>(null);
  const [panelDate, setPanelDate] = useState<string | null>(null);

  const worklogsQuery = useQuery({ queryKey: ['worklogs', selectedMemberId, selectedMonth], queryFn: () => worklogsApi.list(selectedMemberId!, year, month), enabled: !!selectedMemberId });
  const holidaysQuery = useQuery({ queryKey: ['holidays', year, month], queryFn: () => worklogsApi.holidays(year, month) });
  const descriptionsQuery = useQuery({ queryKey: ['project-descriptions'], queryFn: projectsApi.descriptions });
  const descriptions = descriptionsQuery.data ?? [];
  const rows = worklogsQuery.data ?? [];

  const holidaySet = useMemo(() => new Set((holidaysQuery.data ?? []).map((item) => item.date)), [holidaysQuery.data]);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['worklogs', selectedMemberId, selectedMonth] });

  const saveMutation = useMutation({
    mutationFn: async (draft: WorklogDraft) => {
      if (!selectedMemberId) return;
      const payload = toPayload(selectedMemberId, draft);
      if (activeEntry) await worklogsApi.update(activeEntry.id, payload);
      else await worklogsApi.create(payload);
    },
    onSuccess: () => { notifySuccess('Worklog saved'); setPanelOpen(false); refresh(); },
    onError: (error) => notifyError(error, 'Unable to save this worklog.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: Worklog) => worklogsApi.remove(row.id),
    onSuccess: () => { notifySuccess('Worklog removed'); setPanelOpen(false); refresh(); },
    onError: (error) => notifyError(error, 'Unable to remove this worklog.'),
  });

  const openAdd = (isoDate?: string) => {
    if (!selectedMemberId) return;
    setActiveEntry(null);
    setPanelDate(isoDate ?? `${selectedMonth}-01`);
    setPanelOpen(true);
  };

  const openEdit = (row: Worklog) => {
    setActiveEntry(row);
    setPanelDate(null);
    setPanelOpen(true);
  };

  const confirmDelete = (row: Worklog) => {
    modals.openConfirmModal({
      title: 'Remove entry',
      children: <Text size="sm">Remove this worklog entry for {dayjs(row.log_date).format('D MMM YYYY')}? This cannot be undone.</Text>,
      labels: { confirm: 'Remove', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteMutation.mutate(row),
    });
  };

  return (
    <Stack gap="xl">
      <PageHeader eyebrow="Daily capture" title="Work log" description="Keep the operational record current with clear, lightweight daily entries." breadcrumb="Work log" actions={<Button leftSection={<IconPlus size={17} />} onClick={() => openAdd()}>Add entry</Button>} />
      <Card padding="lg" className="filter-bar">
        <div className="toolbar">
          <div className="toolbar-group">
            <SegmentedControl
              value={view}
              onChange={(value) => setView(value as 'table' | 'calendar')}
              data={[{ value: 'table', label: 'Table' }, { value: 'calendar', label: 'Calendar' }]}
              size="sm"
            />
            <PeriodSelect value={selectedMonth} onChange={setSelectedMonth} />
          </div>
          <div className="toolbar-actions">
            <Badge variant="light" color="indigo">{rows.length} entries</Badge>
            <Button variant="subtle" leftSection={<IconRefresh size={16} />} onClick={() => void worklogsQuery.refetch()}>Refresh</Button>
          </div>
        </div>
      </Card>
      {descriptions.length === 0 && !descriptionsQuery.isLoading && <Alert color="orange" icon={<IconInfoCircle size={18} />}>No project descriptions are available. Ask an administrator to review project configuration before recording time.</Alert>}
      {worklogsQuery.isError && <Alert color="red" icon={<IconInfoCircle size={18} />}>Worklogs could not be loaded for this month.</Alert>}
      {view === 'calendar' ? (
        <Card padding="lg" className="surface-card">
          {worklogsQuery.isLoading ? (
            <Skeleton height={520} radius="md" />
          ) : (
            <WorklogCalendar
              year={year}
              month={month}
              worklogs={rows}
              holidays={holidaysQuery.data ?? []}
              onAddEntry={openAdd}
              onSelectEntry={openEdit}
            />
          )}
        </Card>
      ) : (
      <Card padding={0} className="surface-card table-card">
        <div className="table-scroll">
          <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover className="worklog-table" miw={980}>
            <Table.Thead><Table.Tr><Table.Th>Date</Table.Th><Table.Th>Project</Table.Th><Table.Th>Task / outcome</Table.Th><Table.Th>Start</Table.Th><Table.Th>End</Table.Th><Table.Th>Status</Table.Th><Table.Th>Hours</Table.Th><Table.Th ta="right">Actions</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {worklogsQuery.isLoading ? Array.from({ length: 6 }, (_, index) => <Table.Tr key={index}>{Array.from({ length: 8 }, (_, cell) => <Table.Td key={cell}><Skeleton height={30} /></Table.Td>)}</Table.Tr>) : rows.length === 0 ? <Table.Tr><Table.Td colSpan={8}><Stack align="center" py={60} gap="xs"><IconClock size={30} color="var(--mantine-color-gray-5)" /><Text fw={700}>This month is clear</Text><Text size="sm" c="dimmed">Add an entry when you have time to record.</Text></Stack></Table.Td></Table.Tr> : rows.map((row) => {
                const date = dayjs(row.log_date);
                const weekend = date.day() === 0 || date.day() === 6;
                const holiday = holidaySet.has(row.log_date);
                const className = `worklog-row${weekend ? ' row-weekend' : ''}${holiday ? ' row-holiday' : ''}`;
                const editable = row.IsEditRow === 1;
                return (
                  <Table.Tr key={row.id} className={className} onClick={() => editable && openEdit(row)} data-editable={editable || undefined}>
                    <Table.Td><Text size="sm" fw={700}>{date.format('DD MMM')}</Text><Text size="xs" c="dimmed">{date.format('ddd')}</Text></Table.Td>
                    <Table.Td><Text size="sm" fw={600} lineClamp={1}>{projectValue(row, descriptions) || '—'}</Text></Table.Td>
                    <Table.Td><Text size="sm" c={row.task ? undefined : 'dimmed'} lineClamp={1}>{row.task || 'No note'}</Text></Table.Td>
                    <Table.Td><Text size="sm" className="worklog-time">{row.start_time ?? '—'}</Text></Table.Td>
                    <Table.Td><Text size="sm" className="worklog-time">{row.end_time ?? '—'}</Text></Table.Td>
                    <Table.Td><Badge variant="light" size="sm" className={`status-badge status-${row.status.toLowerCase().replace(/\s+/g, '-')}`}>{row.status}</Badge></Table.Td>
                    <Table.Td><Badge variant="light" color={row.hours ? 'indigo' : 'gray'}>{formatHours(row.hours)}</Badge></Table.Td>
                    <Table.Td>
                      <Group justify="flex-end" gap={4} onClick={(event) => event.stopPropagation()}>
                        <Tooltip label={editable ? 'Edit entry' : 'Locked entry'}><ActionIcon size="sm" variant="subtle" disabled={!editable} onClick={() => openEdit(row)} aria-label="Edit entry"><IconEdit size={15} /></ActionIcon></Tooltip>
                        <Tooltip label={editable ? 'Remove entry' : 'Locked entry'}><ActionIcon size="sm" color="red" variant="subtle" disabled={!editable} onClick={() => confirmDelete(row)} aria-label="Remove entry"><IconTrash size={15} /></ActionIcon></Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </div>
      </Card>
      )}
      <Group gap="xs"><IconInfoCircle size={16} color="var(--mantine-color-dimmed)" /><Text size="xs" c="dimmed">Hours and overtime are calculated by the server. Weekends, holidays, and days with no entry are highlighted for review.</Text></Group>

      <WorklogEntryPanel
        opened={panelOpen}
        onClose={() => setPanelOpen(false)}
        entry={activeEntry}
        initialDate={panelDate}
        descriptions={descriptions}
        saving={saveMutation.isPending}
        deleting={deleteMutation.isPending}
        onSave={(draft) => saveMutation.mutate(draft)}
        onDelete={activeEntry ? () => confirmDelete(activeEntry) : undefined}
      />
    </Stack>
  );
}
