import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Anchor,
  Badge,
  Card,
  Group,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconCalendarStats,
  IconCircleCheck,
  IconClockHour4,
  IconInfoCircle,
  IconTrendingUp,
} from '@tabler/icons-react';
import dayjs from 'dayjs';

import { useAuth } from '../auth/AuthContext';
import { worklogsApi } from '../api/worklogs';
import { PageHeader } from '../components/PageHeader';
import { MetricCard } from '../components/MetricCard';
import { formatHours, recentMonths } from '../utils/dates';
import { useNavigate } from 'react-router';
import { useWorkspace } from '../workspace/WorkspaceContext';

export function DashboardPage() {
  const { user } = useAuth();
  const { selectedMemberId } = useWorkspace();
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [year, month] = selectedMonth.split('-').map(Number);
  const months = recentMonths(12);

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', selectedMemberId, year],
    queryFn: () => worklogsApi.dashboard(selectedMemberId!, year),
    enabled: !!selectedMemberId,
  });
  const worklogQuery = useQuery({
    queryKey: ['worklogs', selectedMemberId, selectedMonth],
    queryFn: () => worklogsApi.list(selectedMemberId!, year, month),
    enabled: !!selectedMemberId,
  });

  const dashboard = dashboardQuery.data;
  const currentMonth = dashboard?.months.find((item) => item.month === month);
  const recentWorklogs = useMemo(
    () => [...(worklogQuery.data ?? [])].sort((a, b) => b.log_date.localeCompare(a.log_date)).slice(0, 6),
    [worklogQuery.data],
  );
  const completedTotal = (dashboard?.total_done ?? 0) + (dashboard?.total_in_progress ?? 0) + (currentMonth?.missing ?? 0);
  const completion = completedTotal ? Math.round(((dashboard?.total_done ?? 0) / completedTotal) * 100) : 0;
  const isLoading = dashboardQuery.isLoading || worklogQuery.isLoading;

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Operations overview"
        title={`Good to see you, ${dashboard?.member.name?.split(' ')[0] ?? user?.username ?? 'there'}.`}
        description="A focused view of your time, delivery progress, and the work that needs attention next."
        actions={(
          <Group>
            <UnstyledButton className="month-chip" onClick={() => setSelectedMonth(months[0]?.value ?? selectedMonth)}>
              <IconCalendarStats size={17} />
              <Text size="sm" fw={700}>{dayjs(selectedMonth).format('MMMM YYYY')}</Text>
            </UnstyledButton>
            <Anchor component="button" onClick={() => navigate('/worklog')} fw={700} size="sm">
              Open worklog <IconArrowUpRight size={14} style={{ verticalAlign: 'middle' }} />
            </Anchor>
          </Group>
        )}
      />

      <Group justify="space-between" align="center" className="section-toolbar">
        <div>
          <Title order={3}>Performance snapshot</Title>
          <Text size="sm" c="dimmed">Year-to-date signals for {year}</Text>
        </div>
        <Group gap={6} className="month-tabs">
          {months.slice(0, 4).map((item) => (
            <UnstyledButton key={item.value} className={item.value === selectedMonth ? 'month-tab active' : 'month-tab'} onClick={() => setSelectedMonth(item.value)}>
              {dayjs(item.value).format('MMM')}
            </UnstyledButton>
          ))}
        </Group>
      </Group>

      {dashboardQuery.isError && <Alert color="red" icon={<IconInfoCircle size={18} />}>We couldn&apos;t load your dashboard yet. Refresh the page or check your session.</Alert>}

      <SimpleGrid cols={{ base: 1, xs: 2, xl: 4 }}>
        {isLoading ? Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height={150} radius="md" />) : (
          <>
            <MetricCard label="Hours logged" value={formatHours(dashboard?.total_hours)} helper={`${formatHours(currentMonth?.total_hours)} this month`} icon={<IconClockHour4 size={18} />} />
            <MetricCard label="Overtime" value={formatHours(dashboard?.total_overtime)} helper={`${formatHours(currentMonth?.overtime_hours)} this month`} icon={<IconTrendingUp size={18} />} accent="cyan" />
            <MetricCard label="Completed" value={`${dashboard?.total_done ?? 0}`} helper={`${currentMonth?.done ?? 0} completed this month`} icon={<IconCircleCheck size={18} />} accent="teal" progress={completion} />
            <MetricCard label="Missing days" value={`${currentMonth?.missing ?? 0}`} helper="Requires review this month" icon={<IconAlertTriangle size={18} />} accent="orange" />
          </>
        )}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Card padding="xl" className="surface-card">
          <Group justify="space-between" mb="xl">
            <div><Title order={3}>Monthly rhythm</Title><Text size="sm" c="dimmed">Hours recorded across the year</Text></div>
            <ThemeIcon variant="light" color="indigo" size={38} radius="md"><IconTrendingUp size={20} /></ThemeIcon>
          </Group>
          <Stack gap="md">
            {isLoading ? Array.from({ length: 6 }, (_, index) => <Skeleton key={index} height={18} />) : (dashboard?.months ?? []).slice(0, 6).map((item) => {
              const width = dashboard?.total_hours ? Math.min(100, Math.round((item.total_hours / dashboard.total_hours) * 100 * 2.2)) : 0;
              return (
                <div key={item.month}>
                  <Group justify="space-between" mb={5}>
                    <Text size="sm" fw={600}>{item.name}</Text>
                    <Text size="sm" fw={700}>{formatHours(item.total_hours)}</Text>
                  </Group>
                  <Progress value={width} color={item.month === month ? 'indigo' : 'gray'} size="sm" radius="xl" />
                </div>
              );
            })}
          </Stack>
        </Card>

        <Card padding="xl" className="surface-card">
          <Group justify="space-between" mb="xl">
            <div><Title order={3}>Recent activity</Title><Text size="sm" c="dimmed">Your latest worklog entries</Text></div>
            <Anchor component="button" onClick={() => navigate('/worklog')} size="sm" fw={700}>View all</Anchor>
          </Group>
          {isLoading ? <Stack gap="sm">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height={42} />)}</Stack> : recentWorklogs.length === 0 ? (
            <Stack align="center" py="xl" gap="xs"><ThemeIcon variant="light" color="gray" size={44} radius="xl"><IconCalendarStats size={22} /></ThemeIcon><Text fw={700}>No work logged yet</Text><Text size="sm" c="dimmed">Add your first entry to start the month.</Text></Stack>
          ) : (
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead><Table.Tr><Table.Th>Date</Table.Th><Table.Th>Project</Table.Th><Table.Th>Status</Table.Th><Table.Th ta="right">Hours</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>{recentWorklogs.map((row) => <Table.Tr key={row.id}><Table.Td><Text size="sm" fw={600}>{dayjs(row.log_date).format('DD MMM')}</Text></Table.Td><Table.Td><Text size="sm" lineClamp={1}>{row.project_description ?? row.project ?? 'Unassigned'}</Text></Table.Td><Table.Td><Badge size="sm" variant="light" color={row.status === 'Done' ? 'teal' : row.status === 'In Progress' ? 'indigo' : 'gray'}>{row.status}</Badge></Table.Td><Table.Td ta="right"><Text size="sm" fw={700}>{formatHours(row.hours)}</Text></Table.Td></Table.Tr>)}</Table.Tbody>
            </Table>
          )}
        </Card>
      </SimpleGrid>

      <Card padding="lg" className="insight-banner">
        <Group align="flex-start" wrap="nowrap"><ThemeIcon color="cyan" variant="light" size={38} radius="md"><IconInfoCircle size={20} /></ThemeIcon><div><Text fw={800}>Keep the record complete</Text><Text size="sm" c="dimmed" mt={3}>Consistent daily entries make team capacity, overtime, and delivery reporting more reliable.</Text></div></Group>
      </Card>
    </Stack>
  );
}
