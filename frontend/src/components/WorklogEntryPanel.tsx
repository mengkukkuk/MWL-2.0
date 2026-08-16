import { useEffect, useState } from 'react';
import { Button, Checkbox, Divider, Drawer, Group, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { DateInput, TimeInput } from '@mantine/dates';
import { IconCalendarEvent, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';

import type { Worklog, WorklogStatus } from '../types/api';
import { formatHours } from '../utils/dates';

const STATUS_OPTIONS = ['Done', 'In Progress', 'Pending', 'Man day', 'Leave'].map((value) => ({ value, label: value }));

export interface WorklogDraft {
  log_date: string;
  project: string;
  task: string;
  note: string;
  start_time: string;
  end_time: string;
  status: WorklogStatus;
  is_allowance: boolean;
}

interface WorklogEntryPanelProps {
  opened: boolean;
  onClose: () => void;
  /** Present when editing an existing entry; absent for a brand-new one. */
  entry: Worklog | null;
  /** Date to default a brand-new entry to (e.g. the calendar cell clicked). Ignored when editing. */
  initialDate?: string | null;
  descriptions: { Projectcode: string; Description: string }[];
  saving?: boolean;
  deleting?: boolean;
  onSave: (draft: WorklogDraft) => void;
  onDelete?: () => void;
}

function blankDraft(logDate: string, firstProject: string): WorklogDraft {
  return {
    log_date: logDate,
    project: firstProject,
    task: '',
    note: '',
    start_time: '09:00',
    end_time: '17:30',
    status: 'In Progress',
    is_allowance: false,
  };
}

export function WorklogEntryPanel({ opened, onClose, entry, initialDate, descriptions, saving, deleting, onSave, onDelete }: WorklogEntryPanelProps) {
  const [draft, setDraft] = useState<WorklogDraft>(() => blankDraft(dayjs().format('YYYY-MM-DD'), descriptions[0]?.Description ?? ''));

  useEffect(() => {
    if (!opened) return;
    if (entry) {
      setDraft({
        log_date: entry.log_date,
        project: entry.project_description ?? entry.project ?? '',
        task: entry.task ?? '',
        note: entry.note ?? '',
        start_time: entry.start_time ?? '09:00',
        end_time: entry.end_time ?? '17:30',
        status: entry.status,
        is_allowance: entry.is_allowance === 1,
      });
    } else {
      setDraft(blankDraft(initialDate ?? dayjs().format('YYYY-MM-DD'), descriptions[0]?.Description ?? ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, entry, initialDate]);

  const patch = (fields: Partial<WorklogDraft>) => setDraft((current) => ({ ...current, ...fields }));
  const valid = draft.project.trim() && draft.log_date && draft.start_time && draft.end_time;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="md"
      title={<Text fw={800} fz="lg">{entry ? 'Edit entry' : 'New entry'}</Text>}
      overlayProps={{ backgroundOpacity: 0.35, blur: 2 }}
    >
      <Stack gap="md" pb="lg">
        <DateInput
          label="Date"
          leftSection={<IconCalendarEvent size={16} />}
          value={draft.log_date}
          onChange={(value) => value && patch({ log_date: value })}
          valueFormat="ddd, D MMM YYYY"
          required
        />

        <Select
          label="Project"
          placeholder="Select project"
          data={descriptions.map((item) => ({ value: item.Description, label: item.Description }))}
          value={draft.project || null}
          onChange={(value) => patch({ project: value ?? '' })}
          searchable
          required
        />

        <TextInput
          label="Task / outcome"
          placeholder="What moved forward?"
          value={draft.task}
          onChange={(event) => patch({ task: event.currentTarget.value })}
        />

        <Group grow>
          <TimeInput label="Start" value={draft.start_time} onChange={(event) => patch({ start_time: event.currentTarget.value })} required />
          <TimeInput label="End" value={draft.end_time} onChange={(event) => patch({ end_time: event.currentTarget.value })} required />
        </Group>

        <Select
          label="Status"
          data={STATUS_OPTIONS}
          value={draft.status}
          onChange={(value) => patch({ status: (value ?? 'In Progress') as WorklogStatus })}
          required
        />

        <Textarea
          label="Notes"
          placeholder="Optional context for this entry"
          value={draft.note}
          onChange={(event) => patch({ note: event.currentTarget.value })}
          minRows={2}
          autosize
        />

        <Checkbox
          label="Counts toward allowance"
          checked={draft.is_allowance}
          onChange={(event) => patch({ is_allowance: event.currentTarget.checked })}
        />

        {entry && (
          <Text size="xs" c="dimmed">Recorded hours: {formatHours(entry.hours)} (calculated by the server on save)</Text>
        )}

        <Divider />

        <Group justify="space-between">
          {entry && onDelete ? (
            <Button color="red" variant="subtle" leftSection={<IconTrash size={16} />} loading={deleting} onClick={onDelete}>
              Delete entry
            </Button>
          ) : <span />}
          <Group>
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button loading={saving} disabled={!valid} onClick={() => onSave(draft)}>{entry ? 'Save changes' : 'Add entry'}</Button>
          </Group>
        </Group>
      </Stack>
    </Drawer>
  );
}
