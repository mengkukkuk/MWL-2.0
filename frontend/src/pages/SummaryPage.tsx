import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Progress,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { IconChartBar, IconDownload, IconInfoCircle, IconUsers } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { useAuth } from '../auth/AuthContext';
import { worklogsApi } from '../api/worklogs';
import { PageHeader } from '../components/PageHeader';
import { recentMonths } from '../utils/dates';

export function SummaryPage() {
  const { isElevated } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [year, month] = selectedMonth.split('-').map(Number);
  const months = recentMonths(24);
  const summaryQuery = useQuery({ queryKey: ['projects-summary', year, month], queryFn: () => worklogsApi.projectsSummary(year, month), enabled: isElevated });
  const rows = summaryQuery.data?.projects ?? [];
  const totalHours = useMemo(() => rows.reduce((sum, row) => sum + row.total_hours, 0), [rows]);
  const totalPeople = useMemo(() => new Set(rows.flatMap((row) => row.employees.map((employee) => employee.employee_id))).size, [rows]);

  return (
    <Stack gap="xl">
      <PageHeader eyebrow="Team intelligence" title="Summary" description="See where capacity is moving across projects and teams this month." breadcrumb="Summary" actions={<Button variant="light" color="gray" leftSection={<IconDownload size={17} />} disabled>Export unavailable</Button>} />
      {!isElevated ? <Alert color="blue" icon={<IconInfoCircle size={18} />}>Team summary is available to elevated users. Your personal dashboard remains available from the navigation.</Alert> : <>
        <Card padding="lg" className="filter-bar"><Group justify="space-between" wrap="wrap"><Group gap="sm"><Text fw={800}>Reporting period</Text><Select value={selectedMonth} onChange={(value) => value && setSelectedMonth(value)} data={months.map((item) => ({ value: item.value, label: item.label }))} w={190} allowDeselect={false} /></Group><Group gap="xs"><Badge leftSection={<IconChartBar size={13} />} variant="light" color="indigo">{rows.length} project groups</Badge><Badge leftSection={<IconUsers size={13} />} variant="light" color="cyan">{totalPeople} people</Badge></Group></Group></Card>
        <SimpleSummary totalHours={totalHours} totalPeople={totalPeople} projectCount={rows.length} />
        <Card padding={0} className="surface-card table-card"><div className="table-scroll"><Table verticalSpacing="md" highlightOnHover miw={840}><Table.Thead><Table.Tr><Table.Th>Department</Table.Th><Table.Th>Project descriptions</Table.Th><Table.Th>Contributors</Table.Th><Table.Th>Hours</Table.Th><Table.Th>Share</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{summaryQuery.isLoading ? Array.from({ length: 5 }, (_, index) => <Table.Tr key={index}>{Array.from({ length: 5 }, (_, cell) => <Table.Td key={cell}><Skeleton height={28} /></Table.Td>)}</Table.Tr>) : rows.length === 0 ? <Table.Tr><Table.Td colSpan={5}><Stack align="center" py={65}><Text fw={700}>No team data for this period</Text><Text size="sm" c="dimmed">Try another month or review project mappings.</Text></Stack></Table.Td></Table.Tr> : rows.map((row) => { const share = totalHours ? Math.round((row.total_hours / totalHours) * 100) : 0; return <Table.Tr key={`${row.project_department}-${row.project_description}`}><Table.Td><Text fw={700} size="sm">{row.project_department || 'Unassigned'}</Text></Table.Td><Table.Td><Text size="sm" maw={340} lineClamp={2}>{row.project_description}</Text></Table.Td><Table.Td><Badge variant="light" color="gray">{row.employees_count} people</Badge></Table.Td><Table.Td><Text fw={800}>{row.total_hours.toFixed(1)}h</Text></Table.Td><Table.Td miw={150}><Group gap="xs" wrap="nowrap"><Progress value={share} flex={1} size="sm" color="indigo" /><Text size="xs" fw={700} w={30}>{share}%</Text></Group></Table.Td></Table.Tr>; })}</Table.Tbody></Table></div></Card>
      </>}
    </Stack>
  );
}

function SimpleSummary({ totalHours, totalPeople, projectCount }: { totalHours: number; totalPeople: number; projectCount: number }) {
  return <SimpleGrid cols={{ base: 1, sm: 3 }}><Card padding="lg" className="metric-card"><Group><ThemeIcon color="indigo" variant="light" size={38}><IconChartBar size={20} /></ThemeIcon><div><Text size="xs" c="dimmed" fw={700}>Total hours</Text><Text fz={25} fw={800}>{totalHours.toFixed(1)}h</Text></div></Group></Card><Card padding="lg" className="metric-card"><Group><ThemeIcon color="cyan" variant="light" size={38}><IconUsers size={20} /></ThemeIcon><div><Text size="xs" c="dimmed" fw={700}>Contributors</Text><Text fz={25} fw={800}>{totalPeople}</Text></div></Group></Card><Card padding="lg" className="metric-card"><Group><ThemeIcon color="teal" variant="light" size={38}><IconChartBar size={20} /></ThemeIcon><div><Text size="xs" c="dimmed" fw={700}>Project groups</Text><Text fz={25} fw={800}>{projectCount}</Text></div></Group></Card></SimpleGrid>;
}
