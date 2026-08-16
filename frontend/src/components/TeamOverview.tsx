import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, SegmentedControl, Skeleton, Stack, Text, TextInput } from '@mantine/core';
import { IconInfoCircle, IconSearch } from '@tabler/icons-react';

import { employeesApi } from '../api/employees';
import { projectsApi } from '../api/projects';
import { skillsApi } from '../api/skills';
import { worklogsApi } from '../api/worklogs';
import type { Employee, Project, Skill } from '../types/api';
import { formatHours, workingDaysInMonth } from '../utils/dates';
import { MemberCard, coverageState, type MemberOverview } from './MemberCard';

type SortMode = 'attention' | 'name' | 'hours';

const STATE_ORDER = { critical: 0, partial: 1, none: 2, complete: 3 } as const;

const LEGEND = [
  { label: 'Fully logged', token: 'var(--coverage-complete)' },
  { label: 'Some gaps', token: 'var(--coverage-partial)' },
  { label: 'Needs attention', token: 'var(--coverage-critical)' },
];

/**
 * `main_members` / `support_members` arrive as a JSON string of EmployeeID
 * *integers* (see the module docstring in app/projects.py), while every
 * EmployeeID elsewhere in the frontend is a string. Normalise to strings here
 * so the lookup below cannot silently miss.
 */
function memberIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function projectLabel(project: Project): string {
  return project.name || project.Description || `Project ${project.id}`;
}

export function TeamOverview({
  year,
  month,
  selectedMemberId,
  onSelectMember,
}: {
  year: number;
  month: number;
  selectedMemberId: string | null;
  onSelectMember: (member: Employee) => void;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('attention');

  // Same key as WorkspaceContext, so this shares one fetch rather than adding a second.
  const membersQuery = useQuery({ queryKey: ['employees'], queryFn: employeesApi.list });
  const holidaysQuery = useQuery({ queryKey: ['holidays', year, month], queryFn: () => worklogsApi.holidays(year, month) });
  const missingQuery = useQuery({ queryKey: ['missing-days', year, month], queryFn: () => worklogsApi.missingDays(year, month) });
  const summaryQuery = useQuery({ queryKey: ['projects-summary', year, month], queryFn: () => worklogsApi.projectsSummary(year, month) });
  const skillsQuery = useQuery({ queryKey: ['skills'], queryFn: skillsApi.all });
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });

  const expectedDays = useMemo(() => {
    const holidays = new Set((holidaysQuery.data ?? []).map((item) => item.date));
    return workingDaysInMonth(year, month, holidays).length;
  }, [holidaysQuery.data, year, month]);

  /** EmployeeID -> summed project hours for the month. */
  const hoursByMember = useMemo(() => {
    const totals = new Map<string, number>();
    for (const project of summaryQuery.data?.projects ?? []) {
      for (const employee of project.employees) {
        const id = String(employee.employee_id);
        totals.set(id, (totals.get(id) ?? 0) + employee.hours);
      }
    }
    return totals;
  }, [summaryQuery.data]);

  /** EmployeeID -> { main, support } project labels, from one /api/projects call. */
  const rolesByMember = useMemo(() => {
    const roles = new Map<string, { main: string[]; support: string[] }>();
    const bucket = (id: string) => {
      const existing = roles.get(id);
      if (existing) return existing;
      const created = { main: [] as string[], support: [] as string[] };
      roles.set(id, created);
      return created;
    };
    for (const project of projectsQuery.data ?? []) {
      const label = projectLabel(project);
      for (const id of memberIds(project.main_members)) bucket(id).main.push(label);
      for (const id of memberIds(project.support_members)) bucket(id).support.push(label);
    }
    return roles;
  }, [projectsQuery.data]);

  const overviews = useMemo<MemberOverview[]>(() => {
    const members: Employee[] = membersQuery.data ?? [];
    const skills: Record<string, Skill[]> = skillsQuery.data ?? {};
    return members.map((member) => {
      const missingDays = Math.min(expectedDays, missingQuery.data?.[member.id] ?? 0);
      const roles = rolesByMember.get(member.id);
      return {
        member,
        expectedDays,
        loggedDays: Math.max(0, expectedDays - missingDays),
        missingDays,
        hours: hoursByMember.get(member.id) ?? 0,
        mainProjects: roles?.main ?? [],
        supportProjects: roles?.support ?? [],
        skills: skills[member.id] ?? [],
      };
    });
  }, [membersQuery.data, skillsQuery.data, missingQuery.data, expectedDays, hoursByMember, rolesByMember]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? overviews.filter((item) =>
          [item.member.name, item.member.id, item.member.position, item.member.department]
            .some((field) => field?.toLowerCase().includes(term)),
        )
      : overviews;
    return [...filtered].sort((a, b) => {
      if (sort === 'name') return (a.member.name ?? '').localeCompare(b.member.name ?? '');
      if (sort === 'hours') return b.hours - a.hours;
      const byState = STATE_ORDER[coverageState(a)] - STATE_ORDER[coverageState(b)];
      return byState !== 0 ? byState : b.missingDays - a.missingDays;
    });
  }, [overviews, search, sort]);

  const isLoading = membersQuery.isLoading || missingQuery.isLoading || holidaysQuery.isLoading;
  const fullyLogged = overviews.filter((item) => item.missingDays === 0 && item.expectedDays > 0).length;
  const totalMissing = overviews.reduce((sum, item) => sum + item.missingDays, 0);
  const totalHours = overviews.reduce((sum, item) => sum + item.hours, 0);

  return (
    <Stack gap="md">
      <div className="toolbar">
        <div className="toolbar-group">
          <TextInput
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Find a member, ID, or position"
            leftSection={<IconSearch size={16} />}
            w={260}
            aria-label="Find a member"
          />
          <SegmentedControl
            value={sort}
            onChange={(value) => setSort(value as SortMode)}
            data={[
              { value: 'attention', label: 'Needs attention' },
              { value: 'name', label: 'Name' },
              { value: 'hours', label: 'Hours' },
            ]}
            size="sm"
          />
        </div>
        <div className="team-legend toolbar-actions">
          {LEGEND.map((item) => (
            <span key={item.label} className="legend-item">
              <span className="legend-swatch" style={{ '--swatch': item.token } as React.CSSProperties} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <Text size="sm" c="dimmed">
        {overviews.length} members · {fullyLogged} fully logged · {totalMissing} missing days ·{' '}
        {formatHours(totalHours)} across projects
      </Text>

      {summaryQuery.isError && (
        <Alert color="orange" icon={<IconInfoCircle size={18} />}>
          Project hours are unavailable, so cards show coverage only. Everything else on this page is current.
        </Alert>
      )}

      {isLoading ? (
        <div className="team-grid">
          {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} height={252} radius="lg" />)}
        </div>
      ) : visible.length === 0 ? (
        <Stack align="center" py={60} gap={4}>
          <Text fw={700}>No members match “{search}”</Text>
          <Text size="sm" c="dimmed">Clear the search to see the full team.</Text>
        </Stack>
      ) : (
        <div className="team-grid">
          {visible.map((overview, index) => (
            <MemberCard
              key={overview.member.id}
              overview={overview}
              index={index}
              selected={overview.member.id === selectedMemberId}
              onSelect={onSelectMember}
            />
          ))}
        </div>
      )}
    </Stack>
  );
}
