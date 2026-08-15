import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCalendarEvent, IconEdit, IconPlus, IconSparkles, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { useAuth } from '../auth/AuthContext';
import { allowanceApi } from '../api/allowance';
import { projectsApi } from '../api/projects';
import { PageHeader } from '../components/PageHeader';
import type { Allowance, AllowanceWrite } from '../types/api';
import { recentMonths } from '../utils/dates';
import { notifyError, notifySuccess } from '../utils/notify';
import { useWorkspace } from '../workspace/WorkspaceContext';

const blankForm = (memberId: string): AllowanceWrite => ({ member_id: memberId as AllowanceWrite['member_id'], log_date: dayjs().format('YYYY-MM-DD'), project: '' });

export function AllowancePage() {
  const { user } = useAuth();
  const { selectedMemberId } = useWorkspace();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [year, month] = selectedMonth.split('-').map(Number);
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<Allowance | null>(null);
  const [form, setForm] = useState<AllowanceWrite>(() => blankForm(user?.member_id ?? ''));
  const descriptionsQuery = useQuery({ queryKey: ['project-descriptions'], queryFn: projectsApi.descriptions });
  const allowanceQuery = useQuery({ queryKey: ['allowance', selectedMemberId, selectedMonth], queryFn: () => allowanceApi.list(selectedMemberId!, year, month), enabled: !!selectedMemberId });
  const months = recentMonths(24);

  const saveMutation = useMutation({
    mutationFn: () => editing ? allowanceApi.update(editing.ID, form) : allowanceApi.create(form),
    onSuccess: () => { notifySuccess(editing ? 'Allowance updated' : 'Allowance added'); close(); void queryClient.invalidateQueries({ queryKey: ['allowance', selectedMemberId, selectedMonth] }); },
    onError: (error) => notifyError(error, 'Unable to save this allowance.'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => allowanceApi.remove(id),
    onSuccess: () => { notifySuccess('Allowance removed'); void queryClient.invalidateQueries({ queryKey: ['allowance', selectedMemberId, selectedMonth] }); },
    onError: (error) => notifyError(error, 'Unable to remove this allowance.'),
  });

  const startCreate = () => { if (!selectedMemberId) return; setEditing(null); setForm(blankForm(selectedMemberId)); open(); };
  const startEdit = (row: Allowance) => { setEditing(row); setForm({ member_id: row.EmployeeID, log_date: row.log_date, project: row.Description ?? row.ProjectCode ?? '' }); open(); };

  return (
    <Stack gap="xl">
      <PageHeader eyebrow="Special days" title="Allowance" description="Record allowance-eligible days with the same clear audit trail as your worklog." breadcrumb="Allowance" actions={<Button leftSection={<IconPlus size={17} />} onClick={startCreate} disabled={!selectedMemberId}>Add allowance</Button>} />
      <Card padding="lg" className="filter-bar"><Group justify="space-between" wrap="wrap"><Group gap="sm"><Text fw={800}>Month</Text><Select value={selectedMonth} onChange={(value) => value && setSelectedMonth(value)} data={months.map((item) => ({ value: item.value, label: item.label }))} w={190} allowDeselect={false} /></Group><Badge variant="light" color="cyan">{allowanceQuery.data?.length ?? 0} allowance days</Badge></Group></Card>
      <Card padding={0} className="surface-card table-card"><div className="table-scroll"><Table verticalSpacing="md" highlightOnHover miw={700}><Table.Thead><Table.Tr><Table.Th>Date</Table.Th><Table.Th>Project / activity</Table.Th><Table.Th>Day type</Table.Th><Table.Th>Last updated</Table.Th><Table.Th ta="right">Actions</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{allowanceQuery.isLoading ? Array.from({ length: 5 }, (_, index) => <Table.Tr key={index}>{Array.from({ length: 5 }, (_, cell) => <Table.Td key={cell}><Skeleton height={28} /></Table.Td>)}</Table.Tr>) : (allowanceQuery.data ?? []).length === 0 ? <Table.Tr><Table.Td colSpan={5}><Stack align="center" py={65} gap="xs"><IconSparkles size={30} color="var(--mantine-color-cyan-6)" /><Text fw={700}>No allowance days recorded</Text><Text size="sm" c="dimmed">Add a day to keep payroll and operations aligned.</Text></Stack></Table.Td></Table.Tr> : allowanceQuery.data?.map((row) => <Table.Tr key={row.ID}><Table.Td><Group gap="sm" wrap="nowrap"><ActionIcon variant="light" color="cyan" radius="md"><IconCalendarEvent size={17} /></ActionIcon><div><Text size="sm" fw={700}>{dayjs(row.log_date).format('DD MMM YYYY')}</Text><Text size="xs" c="dimmed">{dayjs(row.log_date).format('dddd')}</Text></div></Group></Table.Td><Table.Td><Text size="sm" fw={600}>{row.Description ?? row.ProjectCode ?? 'Unassigned'}</Text></Table.Td><Table.Td><Badge color={row.type === 'S' ? 'orange' : 'cyan'} variant="light">{row.type === 'S' ? 'Special day' : 'Normal day'}</Badge></Table.Td><Table.Td><Text size="sm" c="dimmed">{row.UpdateAt ? dayjs(row.UpdateAt).format('DD MMM, HH:mm') : '—'}</Text></Table.Td><Table.Td><Group justify="flex-end" gap={4}><Tooltip label="Edit"><ActionIcon variant="subtle" onClick={() => startEdit(row)} aria-label="Edit allowance"><IconEdit size={17} /></ActionIcon></Tooltip><Tooltip label="Remove"><ActionIcon color="red" variant="subtle" onClick={() => { if (window.confirm('Remove this allowance?')) deleteMutation.mutate(row.ID); }} aria-label="Remove allowance"><IconTrash size={17} /></ActionIcon></Tooltip></Group></Table.Td></Table.Tr>)}</Table.Tbody></Table></div></Card>

      <Modal opened={opened} onClose={close} title={<Group gap="sm"><IconSparkles size={19} /><Title order={3}>{editing ? 'Edit allowance' : 'Add allowance'}</Title></Group>} centered>
        <Stack gap="md"><Text size="sm" c="dimmed">The day type is derived automatically from the calendar. Choose the project description used by the backend.</Text><TextInput label="Date" type="date" value={form.log_date} onChange={(event) => setForm((current) => ({ ...current, log_date: event.currentTarget.value }))} required /><Select label="Project / activity" placeholder="Select a project" searchable data={(descriptionsQuery.data ?? []).map((item) => ({ value: item.Description, label: item.Description }))} value={form.project || null} onChange={(value) => setForm((current) => ({ ...current, project: value ?? '' }))} required /><Group justify="flex-end" mt="sm"><Button variant="default" onClick={close}>Cancel</Button><Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()} disabled={!form.log_date || !form.project}>Save allowance</Button></Group></Stack>
      </Modal>
    </Stack>
  );
}
