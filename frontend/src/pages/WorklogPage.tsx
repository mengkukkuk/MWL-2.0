import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconClock, IconInfoCircle, IconPlus, IconRefresh, IconTrash, IconX } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { worklogsApi } from '../api/worklogs';
import { projectsApi } from '../api/projects';
import { PageHeader } from '../components/PageHeader';
import type { Worklog, WorklogStatus, WorklogWrite } from '../types/api';
import { formatHours, recentMonths } from '../utils/dates';
import { notifyError, notifySuccess } from '../utils/notify';
import { useWorkspace } from '../workspace/WorkspaceContext';

type EditableWorklog = Worklog & { dirty?: boolean; isNew?: boolean };

const statusOptions = ['Done', 'In Progress', 'Pending', 'Man day', 'Leave'].map((value) => ({ value, label: value }));

function projectValue(row: Worklog, descriptions: { Projectcode: string; Description: string }[]) {
  return descriptions.find((item) => item.Projectcode === row.project)?.Description ?? row.project_description ?? row.project ?? '';
}

function toPayload(row: EditableWorklog, descriptions: { Projectcode: string; Description: string }[]): WorklogWrite {
  return {
    member_id: row.member_id,
    log_date: row.log_date,
    project: projectValue(row, descriptions),
    task: row.task ?? '',
    note: row.note ?? '',
    start_time: row.start_time ?? '09:00',
    end_time: row.end_time ?? '17:30',
    status: row.status,
    is_allowance: row.is_allowance === 1,
  };
}

export function WorklogPage() {
  const { selectedMemberId } = useWorkspace();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [year, month] = selectedMonth.split('-').map(Number);
  const [rows, setRows] = useState<EditableWorklog[]>([]);
  const months = recentMonths(24);
  const worklogsQuery = useQuery({ queryKey: ['worklogs', selectedMemberId, selectedMonth], queryFn: () => worklogsApi.list(selectedMemberId!, year, month), enabled: !!selectedMemberId });
  const holidaysQuery = useQuery({ queryKey: ['holidays', year, month], queryFn: () => worklogsApi.holidays(year, month) });
  const descriptionsQuery = useQuery({ queryKey: ['project-descriptions'], queryFn: projectsApi.descriptions });
  const descriptions = descriptionsQuery.data ?? [];

  useEffect(() => setRows(worklogsQuery.data ?? []), [worklogsQuery.data]);

  const holidaySet = useMemo(() => new Set((holidaysQuery.data ?? []).map((item) => item.date)), [holidaysQuery.data]);
  const saveMutation = useMutation({
    mutationFn: async (row: EditableWorklog) => {
      if (row.isNew) await worklogsApi.create(toPayload(row, descriptions));
      else {
        await worklogsApi.update(row.id, toPayload(row, descriptions));
      }
      return undefined;
    },
    onSuccess: () => {
      notifySuccess('Worklog saved');
      void queryClient.invalidateQueries({ queryKey: ['worklogs', selectedMemberId, selectedMonth] });
    },
    onError: (error) => notifyError(error, 'Unable to save this worklog.'),
  });
  const deleteMutation = useMutation({
    mutationFn: async (row: EditableWorklog) => {
      if (!row.isNew) await worklogsApi.remove(row.id);
      return undefined;
    },
    onSuccess: () => { notifySuccess('Worklog removed'); void queryClient.invalidateQueries({ queryKey: ['worklogs', selectedMemberId, selectedMonth] }); },
    onError: (error) => notifyError(error, 'Unable to remove this worklog.'),
  });

  const updateRow = (id: number, patch: Partial<EditableWorklog>) => setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch, dirty: true } : row));
  const addRow = () => {
    if (!selectedMemberId) return;
    const firstProject = descriptions[0]?.Description ?? '';
    const date = `${selectedMonth}-01`;
    setRows((current) => [{ id: -Date.now(), member_id: selectedMemberId, log_date: date, project: firstProject, task: '', start_time: '09:00', end_time: '17:30', hours: null, regular_hours: null, OT1: null, OT1_5: null, OT3: null, status: 'In Progress', note: '', IsEditRow: 1, is_allowance: 0, project_description: firstProject, isNew: true, dirty: true }, ...current]);
  };
  const removeRow = (row: EditableWorklog) => {
    if (row.isNew) setRows((current) => current.filter((item) => item.id !== row.id));
    else if (window.confirm('Remove this worklog entry?')) deleteMutation.mutate(row);
  };

  return (
    <Stack gap="xl">
      <PageHeader eyebrow="Daily capture" title="Worklog" description="Keep the operational record current with clear, lightweight daily entries." breadcrumb="Worklog" actions={<Button leftSection={<IconPlus size={17} />} onClick={addRow}>Add entry</Button>} />
      <Card padding="lg" className="filter-bar">
        <Group justify="space-between" wrap="wrap" gap="md">
          <Group gap="sm"><Text fw={800}>Month</Text><Select value={selectedMonth} onChange={(value) => value && setSelectedMonth(value)} data={months.map((item) => ({ value: item.value, label: item.label }))} w={190} allowDeselect={false} /></Group>
          <Group gap="xs"><Badge variant="light" color="indigo">{rows.length} entries</Badge><Button variant="subtle" leftSection={<IconRefresh size={16} />} onClick={() => void worklogsQuery.refetch()}>Refresh</Button></Group>
        </Group>
      </Card>
      {descriptions.length === 0 && !descriptionsQuery.isLoading && <Alert color="orange" icon={<IconInfoCircle size={18} />}>No project descriptions are available. Ask an administrator to review project configuration before recording time.</Alert>}
      {worklogsQuery.isError && <Alert color="red" icon={<IconInfoCircle size={18} />}>Worklogs could not be loaded for this month.</Alert>}
      <Card padding={0} className="surface-card table-card">
        <div className="table-scroll">
          <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover className="worklog-table" miw={1060}>
            <Table.Thead><Table.Tr><Table.Th>Date</Table.Th><Table.Th>Project</Table.Th><Table.Th>Task / outcome</Table.Th><Table.Th>Start</Table.Th><Table.Th>End</Table.Th><Table.Th>Status</Table.Th><Table.Th>Hours</Table.Th><Table.Th ta="right">Actions</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {worklogsQuery.isLoading ? Array.from({ length: 6 }, (_, index) => <Table.Tr key={index}>{Array.from({ length: 8 }, (_, cell) => <Table.Td key={cell}><Skeleton height={30} /></Table.Td>)}</Table.Tr>) : rows.length === 0 ? <Table.Tr><Table.Td colSpan={8}><Stack align="center" py={60} gap="xs"><IconClock size={30} color="var(--mantine-color-gray-5)" /><Text fw={700}>This month is clear</Text><Text size="sm" c="dimmed">Add an entry when you have time to record.</Text></Stack></Table.Td></Table.Tr> : rows.map((row) => {
                const date = dayjs(row.log_date);
                const weekend = date.day() === 0 || date.day() === 6;
                const holiday = holidaySet.has(row.log_date);
                const className = `${weekend ? 'row-weekend ' : ''}${holiday ? 'row-holiday ' : ''}${row.dirty ? 'row-dirty' : ''}`;
                const rowEditable = row.isNew || row.IsEditRow === 1;
                return <Table.Tr key={row.id} className={className}>
                  <Table.Td><Text size="sm" fw={700}>{date.format('DD MMM')}</Text><Text size="xs" c="dimmed">{date.format('ddd')}</Text></Table.Td>
                  <Table.Td><Select size="xs" value={projectValue(row, descriptions) || null} onChange={(value) => updateRow(row.id, { project: value ?? '' })} data={descriptions.map((item) => ({ value: item.Description, label: item.Description }))} placeholder="Select project" searchable w={190} disabled={!rowEditable} /></Table.Td>
                  <Table.Td><TextInput size="xs" value={row.task ?? ''} onChange={(event) => updateRow(row.id, { task: event.currentTarget.value })} placeholder="What moved forward?" w={210} disabled={!rowEditable} /></Table.Td>
                  <Table.Td><TextInput size="xs" type="time" value={row.start_time ?? ''} onChange={(event) => updateRow(row.id, { start_time: event.currentTarget.value })} w={100} disabled={!rowEditable} /></Table.Td>
                  <Table.Td><TextInput size="xs" type="time" value={row.end_time ?? ''} onChange={(event) => updateRow(row.id, { end_time: event.currentTarget.value })} w={100} disabled={!rowEditable} /></Table.Td>
                  <Table.Td><Select size="xs" value={row.status} onChange={(value) => updateRow(row.id, { status: (value ?? 'In Progress') as WorklogStatus })} data={statusOptions} w={130} disabled={!rowEditable} /></Table.Td>
                  <Table.Td><Badge variant="light" color={row.hours ? 'indigo' : 'gray'}>{formatHours(row.hours)}</Badge></Table.Td>
                  <Table.Td><Group justify="flex-end" gap={4}><Tooltip label={rowEditable ? 'Save entry' : 'Locked entry'}><ActionIcon size="sm" color="teal" variant={row.dirty ? 'filled' : 'subtle'} disabled={!rowEditable || !row.dirty || !projectValue(row, descriptions) || saveMutation.isPending} onClick={() => saveMutation.mutate(row)} aria-label="Save entry"><IconCheck size={15} /></ActionIcon></Tooltip><Tooltip label={rowEditable ? 'Remove entry' : 'Locked entry'}><ActionIcon size="sm" color="red" variant="subtle" disabled={!rowEditable} onClick={() => removeRow(row)} aria-label="Remove entry"><IconTrash size={15} /></ActionIcon></Tooltip>{row.dirty && rowEditable && <Tooltip label="Discard changes"><ActionIcon size="sm" color="gray" variant="subtle" onClick={() => row.isNew ? removeRow(row) : setRows((current) => current.map((item) => item.id === row.id ? { ...row, ...(worklogsQuery.data?.find((source) => source.id === row.id) ?? {}), dirty: false } : item))} aria-label="Discard changes"><IconX size={15} /></ActionIcon></Tooltip>}</Group></Table.Td>
                </Table.Tr>;
              })}
            </Table.Tbody>
          </Table>
        </div>
      </Card>
      <Group gap="xs"><IconInfoCircle size={16} color="var(--mantine-color-dimmed)" /><Text size="xs" c="dimmed">Hours and overtime are calculated by the server. Weekend and holiday rows are highlighted for review.</Text></Group>
    </Stack>
  );
}
