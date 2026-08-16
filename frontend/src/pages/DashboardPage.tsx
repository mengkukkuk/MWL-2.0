import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Progress,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconCalendarStats,
  IconCircleCheck,
  IconClockHour4,
  IconInfoCircle,
  IconProgress,
  IconTrendingUp,
} from '@tabler/icons-react';
import dayjs from 'dayjs';

import { useAuth } from '../auth/AuthContext';
import { worklogsApi } from '../api/worklogs';
import { PageHeader } from '../components/PageHeader';
import { MetricCard } from '../components/MetricCard';
import { PeriodSelect } from '../components/PeriodSelect';
import { TeamOverview } from '../components/TeamOverview';
import { formatHours } from '../utils/dates';
import { useNavigate } from 'react-router';
import { useWorkspace } from '../workspace/WorkspaceContext';

export function DashboardPage() {
  const { isElevated } = useAuth();
  const { selectedMemberId, setSelectedMemberId } = useWorkspace();
  const navigate = useNavigate();
  const [view, setView] = useState<'me' | 'team'>('me');
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [year, month] = selectedMonth.split('-').map(Number);

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
        eyebrow={view === 'team' ? 'Team coverage' : 'Overview'}
        title={view === 'team'
          ? `Who still has gaps in ${dayjs(selectedMonth).format('MMMM')}?`
          : `Overview of ${dayjs(selectedMonth).format('MMMM')} ${year}`}
        description={view === 'team'
          ? 'Every member’s month at a glance. Cards are ordered by who needs attention first — open one to see their full record.'
          : 'A focused view of your time, delivery progress, and the work that needs attention next.'}
        actions={(
          <Group gap="sm" align="center" wrap="wrap" className="dashboard-actions">
            {isElevated && (
              <SegmentedControl
                value={view}
                onChange={(value) => setView(value as 'me' | 'team')}
                data={[{ value: 'me', label: 'My view' }, { value: 'team', label: 'Team' }]}
                size="sm"
              />
            )}
            <PeriodSelect value={selectedMonth} onChange={setSelectedMonth} />
            <Button
              rightSection={<IconArrowUpRight size={15} />}
              onClick={() => navigate('/worklog')}
              className="dashboard-primary-action"
            >
              Open work log
            </Button>
          </Group>
        )}
      />

      {view === 'team' ? (
        <TeamOverview
          year={year}
          month={month}
          selectedMemberId={selectedMemberId}
          onSelectMember={(member) => {
            setSelectedMemberId(member.id);
            setView('me');
          }}
        />
      ) : (
      <>
      <div className="section-toolbar">
        <Title order={3}>Performance snapshot</Title>
        <Text size="sm" c="dimmed">
          Year-to-date signals for {year}, with monthly figures from {dayjs(selectedMonth).format('MMMM')}.
        </Text>
      </div>

      {dashboardQuery.isError && <Alert color="red" icon={<IconInfoCircle size={18} />}>We couldn&apos;t load your dashboard yet. Refresh the page or check your session.</Alert>}

      <div className="dashboard-metrics-grid">
        {isLoading ? Array.from({ length: 5 }, (_, index) => <Skeleton key={index} height={150} radius="md" />) : (
          <>
            <MetricCard label="Hours logged" value={formatHours(dashboard?.total_hours)} helper={`${formatHours(currentMonth?.total_hours)} this month`} icon={<IconClockHour4 size={18} />} />
            <MetricCard label="Overtime" value={formatHours(dashboard?.total_overtime)} helper={`${formatHours(currentMonth?.overtime_hours)} this month`} icon={<IconTrendingUp size={18} />} accent="cyan" />
            <MetricCard label="Completed" value={`${dashboard?.total_done ?? 0}`} helper={`${currentMonth?.done ?? 0} completed this month`} icon={<IconCircleCheck size={18} />} accent="teal" progress={completion} />
            <MetricCard label="In progress" value={`${dashboard?.total_in_progress ?? 0}`} helper={`${currentMonth?.in_progress ?? 0} this month`} icon={<IconProgress size={18} />} accent="grape" />
            <MetricCard label="Missing days" value={`${currentMonth?.missing ?? 0}`} helper="Requires review this month" icon={<IconAlertTriangle size={18} />} accent="orange" />
          </>
        )}
      </div>

      <div className="dashboard-detail-grid">
        <Card padding="xl" className="surface-card dashboard-panel">
          <Group justify="space-between" mb="xl">
            <div><Title order={3}>Monthly rhythm</Title><Text size="sm" c="dimmed">Hours recorded across the year</Text></div>
            <ThemeIcon variant="light" color="indigo" size={38} radius="md"><IconTrendingUp size={20} /></ThemeIcon>
          </Group>
          <Stack gap="md">
            {isLoading ? Array.from({ length: 6 }, (_, index) => <Skeleton key={index} height={18} />) : (dashboard?.months ?? []).length === 0 ? (
              <Stack align="center" justify="center" mih={150} gap={4} ta="center">
                <Text fw={700}>No monthly totals yet</Text>
                <Text size="sm" c="dimmed">{selectedMemberId ? 'Add a work-log entry to start the year view.' : 'Select a member to see the year at a glance.'}</Text>
              </Stack>
            ) : (dashboard?.months ?? []).slice(0, 6).map((item) => {
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

        <Card padding="xl" className="surface-card dashboard-panel">
          <Group justify="space-between" mb="xl">
            <div><Title order={3}>Recent activity</Title><Text size="sm" c="dimmed">Your latest worklog entries</Text></div>
            <Anchor component="button" onClick={() => navigate('/worklog')} size="sm" fw={700}>View all</Anchor>
          </Group>
          {isLoading ? <Stack gap="sm">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height={42} />)}</Stack> : recentWorklogs.length === 0 ? (
            <Stack align="center" py="xl" gap="xs"><ThemeIcon variant="light" color="gray" size={44} radius="xl"><IconCalendarStats size={22} /></ThemeIcon><Text fw={700}>No work logged yet</Text><Text size="sm" c="dimmed">Add your first entry to start the month.</Text></Stack>
          ) : (
            <div className="table-scroll dashboard-recent-table">
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead><Table.Tr><Table.Th>Date</Table.Th><Table.Th>Project</Table.Th><Table.Th>Status</Table.Th><Table.Th ta="right">Hours</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>{recentWorklogs.map((row) => <Table.Tr key={row.id}><Table.Td><Text size="sm" fw={600}>{dayjs(row.log_date).format('DD MMM')}</Text></Table.Td><Table.Td><Text size="sm" lineClamp={1}>{row.project_description ?? row.project ?? 'Unassigned'}</Text></Table.Td><Table.Td><Badge size="sm" variant="light" color={row.status === 'Done' ? 'teal' : row.status === 'In Progress' ? 'indigo' : 'gray'}>{row.status}</Badge></Table.Td><Table.Td ta="right"><Text size="sm" fw={700}>{formatHours(row.hours)}</Text></Table.Td></Table.Tr>)}</Table.Tbody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <Card padding="xl" className="surface-card dashboard-panel dashboard-breakdown">
        <Group justify="space-between" align="flex-start" wrap="nowrap" mb="xl">
          <div><Title order={3}>Monthly breakdown</Title><Text size="sm" c="dimmed">Done, in-progress, missing, and man-day counts per month — open a month to review its work log</Text></div>
          <ThemeIcon variant="light" color="indigo" size={38} radius="md"><IconCalendarStats size={20} /></ThemeIcon>
        </Group>
        {isLoading ? (
          <Stack gap="sm">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} height={32} />)}</Stack>
        ) : (dashboard?.months ?? []).length === 0 ? (
          <Stack align="center" py="xl" gap={4} ta="center">
            <Text fw={700}>No monthly records to show</Text>
            <Text size="sm" c="dimmed">{selectedMemberId ? 'Completed months will appear here.' : 'Choose a member to open their monthly breakdown.'}</Text>
          </Stack>
        ) : (
          <div className="table-scroll dashboard-breakdown-table">
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Month</Table.Th>
                  <Table.Th ta="right">Hours</Table.Th>
                  <Table.Th ta="right">Done</Table.Th>
                  <Table.Th ta="right">In progress</Table.Th>
                  <Table.Th ta="right">Missing</Table.Th>
                  <Table.Th ta="right">Man day</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(dashboard?.months ?? []).map((item) => {
                  const monthValue = dayjs(`${dashboard?.year}-${item.month}-01`).format('YYYY-MM');
                  return (
                    <Table.Tr
                      key={item.month}
                      className="dashboard-breakdown-row"
                      tabIndex={0}
                      role="link"
                      aria-label={`Open ${item.name} work log`}
                      onClick={() => {
                        setSelectedMonth(monthValue);
                        navigate('/worklog', { state: { month: monthValue } });
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedMonth(monthValue);
                          navigate('/worklog', { state: { month: monthValue } });
                        }
                      }}
                    >
                      <Table.Td><Text size="sm" fw={item.month === month ? 800 : 600}>{item.name}</Text></Table.Td>
                      <Table.Td ta="right"><Text size="sm" fw={700}>{formatHours(item.total_hours)}</Text></Table.Td>
                      <Table.Td ta="right"><Badge color="teal" variant="light">{item.done}</Badge></Table.Td>
                      <Table.Td ta="right"><Badge color="grape" variant="light">{item.in_progress}</Badge></Table.Td>
                      <Table.Td ta="right">
                        {item.missing > 0
                          ? <Badge color="red" variant="light">{item.missing}</Badge>
                          : <Text size="xs" c="dimmed">0</Text>}
                      </Table.Td>
                      <Table.Td ta="right"><Badge color="cyan" variant="light">{item.man_day}</Badge></Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </div>
        )}
      </Card>

      <Card padding="lg" className="insight-banner">
        <Group align="flex-start" wrap="nowrap"><ThemeIcon color="cyan" variant="light" size={38} radius="md"><IconInfoCircle size={20} /></ThemeIcon><div><Text fw={800}>Keep the record complete</Text><Text size="sm" c="dimmed" mt={3}>Consistent daily entries make team capacity, overtime, and delivery reporting more reliable.</Text></div></Group>
      </Card>
      </>
      )}
    </Stack>
  );
}
