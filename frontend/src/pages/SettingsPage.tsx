import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  PasswordInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconClock, IconFolder, IconPlus, IconSettings, IconShieldCheck, IconTrash, IconUsers } from '@tabler/icons-react';

import { useAuth } from '../auth/AuthContext';
import { projectsApi } from '../api/projects';
import { settingsApi } from '../api/settings';
import { skillsApi } from '../api/skills';
import { usersApi } from '../api/users';
import { PageHeader } from '../components/PageHeader';
import { ASSIGNABLE_ROLES } from '../types/api';
import type { Role, TimePresets, UserId } from '../types/api';
import { notifyError, notifySuccess } from '../utils/notify';

export function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('controls');
  const [presets, setPresets] = useState<TimePresets>({ start: [], end: [] });
  const [newProject, setNewProject] = useState('');
  const [skillName, setSkillName] = useState('');
  const [skillLevel, setSkillLevel] = useState<number | string>(1);
  const [newPassword, setNewPassword] = useState<Record<number, string>>({});
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const presetsQuery = useQuery({ queryKey: ['time-presets'], queryFn: settingsApi.getTimePresets });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const pendingQuery = useQuery({ queryKey: ['pending-users'], queryFn: usersApi.pending });
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const skillsQuery = useQuery({ queryKey: ['member-skills', user?.member_id], queryFn: () => skillsApi.forMember(user!.member_id), enabled: !!user });

  useEffect(() => { if (presetsQuery.data) setPresets(presetsQuery.data); }, [presetsQuery.data]);

  const visibilityMutation = useMutation({ mutationFn: (open: boolean) => settingsApi.setWorklogVisibility(open), onSuccess: () => { notifySuccess('Visibility setting updated'); void queryClient.invalidateQueries({ queryKey: ['settings'] }); }, onError: (error) => notifyError(error) });
  const presetsMutation = useMutation({ mutationFn: () => settingsApi.setTimePresets(presets), onSuccess: () => notifySuccess('Time presets saved'), onError: (error) => notifyError(error, 'Preset values must use HH:MM format.') });
  const approvalMutation = useMutation({ mutationFn: ({ id, action }: { id: UserId; action: 'approve' | 'decline' }) => action === 'approve' ? usersApi.approve(id) : usersApi.decline(id), onSuccess: () => { notifySuccess('Registration updated'); void queryClient.invalidateQueries({ queryKey: ['pending-users'] }); void queryClient.invalidateQueries({ queryKey: ['users'] }); }, onError: (error) => notifyError(error) });
  const roleMutation = useMutation({ mutationFn: ({ id, role }: { id: UserId; role: Role }) => usersApi.setRole(id, role), onSuccess: () => { notifySuccess('Role updated'); void queryClient.invalidateQueries({ queryKey: ['users'] }); }, onError: (error) => notifyError(error) });
  const passwordMutation = useMutation({ mutationFn: ({ id, password }: { id: UserId; password: string }) => usersApi.setPassword(id, password), onSuccess: (_, variables) => { notifySuccess('Password reset'); setNewPassword((current) => ({ ...current, [variables.id]: '' })); }, onError: (error) => notifyError(error, 'Password must be at least 8 characters.') });
  const projectMutation = useMutation({ mutationFn: () => projectsApi.create(newProject.trim()), onSuccess: () => { notifySuccess('Project created'); setNewProject(''); void queryClient.invalidateQueries({ queryKey: ['projects'] }); void queryClient.invalidateQueries({ queryKey: ['project-descriptions'] }); }, onError: (error) => notifyError(error) });
  const projectDeleteMutation = useMutation({ mutationFn: (id: number) => projectsApi.remove(id), onSuccess: () => { notifySuccess('Project removed'); void queryClient.invalidateQueries({ queryKey: ['projects'] }); void queryClient.invalidateQueries({ queryKey: ['project-descriptions'] }); }, onError: (error) => notifyError(error) });
  const addSkillMutation = useMutation({ mutationFn: () => skillsApi.add(user!.member_id, skillName.trim(), Number(skillLevel)), onSuccess: () => { notifySuccess('Skill added'); setSkillName(''); setSkillLevel(1); void queryClient.invalidateQueries({ queryKey: ['member-skills', user?.member_id] }); }, onError: (error) => notifyError(error) });
  const deleteSkillMutation = useMutation({ mutationFn: (id: number) => skillsApi.remove(id), onSuccess: () => { notifySuccess('Skill removed'); void queryClient.invalidateQueries({ queryKey: ['member-skills', user?.member_id] }); }, onError: (error) => notifyError(error) });

  const updatePreset = (group: 'start' | 'end', index: number, value: string) => setPresets((current) => ({ ...current, [group]: current[group].map((preset, itemIndex) => itemIndex === index ? { ...preset, value } : preset) }));
  const addPreset = (group: 'start' | 'end') => setPresets((current) => ({ ...current, [group]: [...current[group], { label: group === 'start' ? 'New start' : 'New end', value: '09:00' }] }));
  const removePreset = (group: 'start' | 'end', index: number) => setPresets((current) => ({ ...current, [group]: current[group].filter((_, itemIndex) => itemIndex !== index) }));

  return (
    <Stack gap="xl">
      <PageHeader eyebrow="Governance" title="Settings" description="Manage workspace behaviour, people, projects, and the small defaults that keep operations consistent." breadcrumb="Settings" />
      <Tabs value={activeTab} onChange={(value) => value && setActiveTab(value)} variant="pills" className="settings-tabs"><Tabs.List><Tabs.Tab value="controls" leftSection={<IconSettings size={16} />}>Controls</Tabs.Tab><Tabs.Tab value="people" leftSection={<IconUsers size={16} />}>People <Badge size="xs" ml={5} variant="light">{pendingQuery.data?.length ?? 0}</Badge></Tabs.Tab><Tabs.Tab value="projects" leftSection={<IconFolder size={16} />}>Projects</Tabs.Tab><Tabs.Tab value="skills" leftSection={<IconShieldCheck size={16} />}>Skills</Tabs.Tab></Tabs.List>
        <Tabs.Panel value="controls" pt="xl"><SimpleGrid cols={{ base: 1, lg: 2 }}><Card padding="xl" className="surface-card"><Group justify="space-between" mb="lg"><div><Title order={3}>Workspace controls</Title><Text size="sm" c="dimmed">Keep access and capture rules explicit.</Text></div><IconShieldCheck size={22} color="var(--mantine-color-indigo-6)" /></Group><Stack><Group justify="space-between" align="flex-start"><div><Text fw={700}>Worklog visibility</Text><Text size="sm" c="dimmed" maw={420}>Allow non-elevated users to view team worklogs.</Text></div><Switch checked={settingsQuery.data?.worklog_open ?? false} onChange={(event) => visibilityMutation.mutate(event.currentTarget.checked)} onLabel="OPEN" offLabel="PRIVATE" size="md" /></Group><Divider /><Group justify="space-between"><div><Text fw={700}>Session security</Text><Text size="sm" c="dimmed">Same-origin, protected session cookie.</Text></div><Badge color="teal" variant="light">Active</Badge></Group></Stack></Card><Card padding="xl" className="surface-card"><Group justify="space-between" mb="lg"><div><Title order={3}>Time presets</Title><Text size="sm" c="dimmed">Quick values shown to worklog users.</Text></div><IconClock size={22} color="var(--mantine-color-cyan-6)" /></Group><SimpleGrid cols={2}><PresetEditor label="Start times" group="start" presets={presets.start} onAdd={addPreset} onChange={updatePreset} onRemove={removePreset} /><PresetEditor label="End times" group="end" presets={presets.end} onAdd={addPreset} onChange={updatePreset} onRemove={removePreset} /></SimpleGrid><Button mt="lg" leftSection={<IconCheck size={16} />} loading={presetsMutation.isPending} onClick={() => presetsMutation.mutate()}>Save presets</Button></Card></SimpleGrid></Tabs.Panel>
        <Tabs.Panel value="people" pt="xl"><Stack><Card padding="lg" className="surface-card"><Group justify="space-between" mb="md"><div><Title order={3}>Pending registrations</Title><Text size="sm" c="dimmed">Review access requests before they enter the workspace.</Text></div><Badge variant="light" color="orange">{pendingQuery.data?.length ?? 0} pending</Badge></Group><Table verticalSpacing="sm"><Table.Thead><Table.Tr><Table.Th>User</Table.Th><Table.Th>Member</Table.Th><Table.Th>Requested</Table.Th><Table.Th ta="right">Decision</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{(pendingQuery.data ?? []).length === 0 ? <Table.Tr><Table.Td colSpan={4}><Text size="sm" c="dimmed" ta="center" py="md">No pending registrations.</Text></Table.Td></Table.Tr> : pendingQuery.data?.map((item) => <Table.Tr key={item.id}><Table.Td><Text fw={700} size="sm">{item.username}</Text><Text size="xs" c="dimmed">{item.position ?? item.department ?? '—'}</Text></Table.Td><Table.Td><Text size="sm">{item.member_name ?? item.staff_id ?? '—'}</Text></Table.Td><Table.Td><Text size="sm" c="dimmed">{item.created_at ?? '—'}</Text></Table.Td><Table.Td><Group justify="flex-end"><Button size="xs" color="teal" onClick={() => approvalMutation.mutate({ id: item.id, action: 'approve' })}>Approve</Button><Button size="xs" color="red" variant="subtle" onClick={() => approvalMutation.mutate({ id: item.id, action: 'decline' })}>Decline</Button></Group></Table.Td></Table.Tr>)}</Table.Tbody></Table></Card><Card padding="lg" className="surface-card"><Title order={3} mb="md">Active users</Title><Table verticalSpacing="sm" highlightOnHover><Table.Thead><Table.Tr><Table.Th>User</Table.Th><Table.Th>Role</Table.Th><Table.Th>Email</Table.Th><Table.Th>Password reset</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{(usersQuery.data ?? []).map((item) => <Table.Tr key={item.id}><Table.Td><Text fw={700} size="sm">{item.username}</Text><Text size="xs" c="dimmed">{item.member_name ?? item.member_id ?? '—'}</Text></Table.Td><Table.Td><Select size="xs" value={item.role} data={ASSIGNABLE_ROLES.map((role) => ({ value: role, label: role }))} disabled={item.role === 'Super_Ultimate_ADMIN'} onChange={(value) => value && roleMutation.mutate({ id: item.id, role: value as Role })} w={160} /></Table.Td><Table.Td><Text size="sm" c="dimmed">{item.email ?? 'No email'}</Text></Table.Td><Table.Td><Group gap="xs"><PasswordInput size="xs" value={newPassword[item.id] ?? ''} onChange={(event) => setNewPassword((current) => ({ ...current, [item.id]: event.currentTarget.value }))} placeholder="New password" w={170} /><Button size="xs" variant="light" disabled={(newPassword[item.id] ?? '').length < 8} loading={passwordMutation.isPending} onClick={() => passwordMutation.mutate({ id: item.id, password: newPassword[item.id] ?? '' })}>Set</Button></Group></Table.Td></Table.Tr>)}</Table.Tbody></Table></Card></Stack></Tabs.Panel>
        <Tabs.Panel value="projects" pt="xl"><Card padding="lg" className="surface-card"><Group align="flex-end"><TextInput label="Create project" placeholder="Project name" value={newProject} onChange={(event) => setNewProject(event.currentTarget.value)} flex={1} /><Button leftSection={<IconPlus size={16} />} disabled={!newProject.trim()} loading={projectMutation.isPending} onClick={() => projectMutation.mutate()}>Create</Button></Group><Divider my="lg" /><Table verticalSpacing="sm"><Table.Thead><Table.Tr><Table.Th>Project</Table.Th><Table.Th>Assignments</Table.Th><Table.Th ta="right">Action</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{(projectsQuery.data ?? []).map((project) => <Table.Tr key={project.id}><Table.Td><Text fw={700} size="sm">{project.name}</Text><Text size="xs" c="dimmed">{project.Description ?? 'No description'}</Text></Table.Td><Table.Td><Badge variant="light" color="indigo">{project.main_members ? 'Assigned' : 'Unassigned'}</Badge></Table.Td><Table.Td ta="right"><Tooltip label="Remove project"><ActionIcon color="red" variant="subtle" onClick={() => { if (window.confirm(`Remove ${project.name}?`)) projectDeleteMutation.mutate(project.id); }} aria-label={`Remove ${project.name}`}><IconTrash size={17} /></ActionIcon></Tooltip></Table.Td></Table.Tr>)}</Table.Tbody></Table></Card></Tabs.Panel>
        <Tabs.Panel value="skills" pt="xl"><Card padding="lg" className="surface-card"><Group justify="space-between" mb="lg"><div><Title order={3}>My skills</Title><Text size="sm" c="dimmed">Keep your capability profile current for planning.</Text></div><Badge variant="light" color="indigo">{skillsQuery.data?.length ?? 0} skills</Badge></Group><Group align="flex-end"><TextInput label="Skill" placeholder="e.g. Project planning" value={skillName} onChange={(event) => setSkillName(event.currentTarget.value)} flex={1} /><NumberInput label="Level" min={1} max={5} value={skillLevel} onChange={setSkillLevel} w={110} /><Button leftSection={<IconPlus size={16} />} disabled={!skillName.trim()} loading={addSkillMutation.isPending} onClick={() => addSkillMutation.mutate()}>Add skill</Button></Group><Divider my="lg" /><Table verticalSpacing="sm"><Table.Thead><Table.Tr><Table.Th>Skill</Table.Th><Table.Th>Level</Table.Th><Table.Th ta="right">Action</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{(skillsQuery.data ?? []).map((skill) => <Table.Tr key={skill.id}><Table.Td><Text fw={700}>{skill.name}</Text></Table.Td><Table.Td><SegmentedControl size="xs" value={String(skill.level)} data={[1, 2, 3, 4, 5].map((level) => ({ value: String(level), label: String(level) }))} readOnly /></Table.Td><Table.Td ta="right"><ActionIcon color="red" variant="subtle" onClick={() => deleteSkillMutation.mutate(skill.id)} aria-label={`Remove ${skill.name}`}><IconTrash size={17} /></ActionIcon></Table.Td></Table.Tr>)}</Table.Tbody></Table></Card></Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function PresetEditor({ label, group, presets, onAdd, onChange, onRemove }: { label: string; group: 'start' | 'end'; presets: TimePresets['start']; onAdd: (group: 'start' | 'end') => void; onChange: (group: 'start' | 'end', index: number, value: string) => void; onRemove: (group: 'start' | 'end', index: number) => void }) {
  return <Stack gap="xs"><Group justify="space-between"><Text size="sm" fw={700}>{label}</Text><ActionIcon size="sm" variant="subtle" onClick={() => onAdd(group)} aria-label={`Add ${label}`}><IconPlus size={15} /></ActionIcon></Group>{presets.map((preset, index) => <Group key={`${group}-${index}`} gap={5} wrap="nowrap"><TextInput size="xs" value={preset.value} onChange={(event) => onChange(group, index, event.currentTarget.value)} w={76} /><TextInput size="xs" value={preset.label} onChange={(event) => onChange(group, index, event.currentTarget.value)} flex={1} /><ActionIcon size="sm" color="red" variant="subtle" onClick={() => onRemove(group, index)} aria-label={`Remove ${preset.label}`}><IconTrash size={14} /></ActionIcon></Group>)}</Stack>;
}
