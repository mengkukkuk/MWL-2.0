import { useDisclosure } from '@mantine/hooks';
import {
  ActionIcon,
  AppShell,
  Avatar,
  Burger,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconCalendarEvent,
  IconChartBar,
  IconChevronRight,
  IconCloudLock,
  IconDashboard,
  IconFileAnalytics,
  IconFolder,
  IconLogout,
  IconSettings,
  IconSparkles,
} from '@tabler/icons-react';
import { Outlet, useLocation, useNavigate } from 'react-router';

import { useAuth } from '../auth/AuthContext';
import { MemberPicker } from './MemberPicker';
import { useWorkspace } from '../workspace/WorkspaceContext';

const navItems = [
  { label: 'Dashboard', description: 'Your operating view', path: '/', icon: IconDashboard },
  { label: 'Worklog', description: 'Daily time capture', path: '/worklog', icon: IconCalendarEvent },
  { label: 'Allowance', description: 'Track special days', path: '/allowance', icon: IconSparkles },
  { label: 'Summary', description: 'Team-level reporting', path: '/summary', icon: IconChartBar },
  { label: 'File share', description: 'Shared team files', path: '/files', icon: IconFolder },
];

function initials(value: string) {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function AppShellLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isElevated } = useAuth();
  const { members, selectedMemberId, setSelectedMemberId, isLoadingMembers } = useWorkspace();

  const go = (path: string) => {
    navigate(path);
    close();
  };

  return (
    // No `padding` prop: styles.css sets main's padding longhands directly so it
    // can keep Mantine's navbar/header offsets and add the page gutter on top.
    <AppShell
      header={{ height: 74 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      className="app-shell"
    >
      <AppShell.Header className="app-header">
        <Group h="100%" px="lg" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon size={40} radius="xl" variant="gradient" gradient={{ from: 'indigo', to: 'cyan', deg: 135 }} className="brand-mark">
                <IconFileAnalytics size={21} />
              </ThemeIcon>
              <div>
                <Text fw={800} size="lg" lh={1.1} className="brand-wordmark">Meter Worklog</Text>
                <Group gap={5} mt={3}>
                  <span className="status-dot" aria-hidden="true" />
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase" lts="0.08em">Operations workspace</Text>
                </Group>
              </div>
            </Group>
          </Group>
          <Group gap="sm">
            <MemberPicker
              members={members}
              value={selectedMemberId}
              onChange={setSelectedMemberId}
              canSwitch={isElevated}
              loading={isLoadingMembers}
            />
            <Tooltip label="Security and settings">
              <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => navigate(isElevated ? '/settings' : '/')} aria-label="Settings">
                <IconSettings size={19} />
              </ActionIcon>
            </Tooltip>
            <Group gap="xs" wrap="nowrap" className="user-chip">
              <Avatar color="indigo" radius="xl" size={34}>{initials(user?.username ?? 'User')}</Avatar>
              <div className="user-chip-copy">
                <Text size="sm" fw={700}>{user?.username}</Text>
                <Text size="xs" c="dimmed">{user?.role}</Text>
              </div>
              <Tooltip label="Sign out">
                <ActionIcon variant="subtle" color="gray" onClick={() => void logout()} aria-label="Sign out">
                  <IconLogout size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" className="app-navbar">
        <AppShell.Section grow component={ScrollArea} scrollbarSize={5}>
          <Stack gap={7}>
            <Text size="xs" fw={800} c="dimmed" tt="uppercase" lts="0.1em" px="sm" mb={4}>Workspace</Text>
            {navItems.filter((item) => item.path !== '/summary' || isElevated).map((item) => {
              const Icon = item.icon;
              const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
              return (
                <NavLink
                  key={item.path}
                  label={item.label}
                  description={item.description}
                  leftSection={<Icon size={19} stroke={1.8} />}
                  rightSection={active ? <IconChevronRight size={15} /> : null}
                  active={active}
                  onClick={() => go(item.path)}
                  className="nav-item"
                />
              );
            })}
            {isElevated && (
              <>
                <Text size="xs" fw={800} c="dimmed" tt="uppercase" lts="0.1em" px="sm" mt="lg" mb={4}>Administration</Text>
                <NavLink
                  label="Settings"
                  description="Access and defaults"
                  leftSection={<IconSettings size={19} stroke={1.8} />}
                  rightSection={location.pathname.startsWith('/settings') ? <IconChevronRight size={15} /> : null}
                  active={location.pathname.startsWith('/settings')}
                  onClick={() => go('/settings')}
                  className="nav-item"
                />
              </>
            )}
          </Stack>
        </AppShell.Section>
        <AppShell.Section>
          <div className="sidebar-footer">
            <IconCloudLock size={18} />
            <div>
              <Text size="xs" fw={700}>Protected workspace</Text>
              <Text size="xs" c="dimmed">Same-origin session active</Text>
            </div>
          </div>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <div className="page-shell">
          <Outlet />
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
