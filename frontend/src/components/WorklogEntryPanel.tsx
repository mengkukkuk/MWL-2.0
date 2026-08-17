import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Button, Checkbox, Divider, Drawer, Group, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { DateInput, DatePickerInput, TimePicker } from '@mantine/dates';
import { IconCalendarEvent, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { worklogsApi } from '../api/worklogs';
import type { Worklog, WorklogStatus } from '../types/api';
import { datesInRange, formatHours, isWeekend } from '../utils/dates';

const STATUS_OPTIONS = ['Done', 'In Progress', 'Pending', 'Man day', 'Leave'].map((value) => ({ value, label: value }));

/** Cap bulk-range inserts so a fat-fingered range can't queue thousands of rows. */
const MAX_RANGE_DAYS = 62;

export interface WorklogDraft {
  log_date: string;
  project: string;
  task: string;
  note: string;
  start_time: string;
  end_time: string;
  status: WorklogStatus;
  is_allowance: boolean;
  /** Present only for brand-new entries saved across a date range — one row
   * is created per date, all sharing the same project/task/time/status/note. */
  range_dates?: string[];
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
  // Range mode is available for both new and existing entries. For a new entry it
  // creates one row per working day; for an existing entry it's just a quicker way
  // to pick a date — the edit still targets that single row, set to the range's start.
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeValue, setRangeValue] = useState<[string | null, string | null]>([null, null]);

  useEffect(() => {
    if (!opened) return;
    setRangeMode(false);
    setRangeValue([null, null]);
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

  const [rangeStart, rangeEnd] = rangeValue;
  const rangeSpan = rangeMode && rangeStart && rangeEnd ? datesInRange(rangeStart, rangeEnd) : [];
  const rangeTooLong = rangeMode && rangeSpan.length > MAX_RANGE_DAYS;

  // Fetch holidays for every month the selected range touches (shares the
  // ['holidays', year, month] cache key the month view already populates).
  const spannedMonths = useMemo(() => {
    if (entry || !rangeMode || !rangeStart || !rangeEnd || rangeTooLong) return [];
    const keys = new Set<string>();
    let cursor = dayjs(rangeStart).startOf('month');
    const last = dayjs(rangeEnd).startOf('month');
    while (cursor.isBefore(last) || cursor.isSame(last, 'month')) {
      keys.add(cursor.format('YYYY-MM'));
      cursor = cursor.add(1, 'month');
    }
    return Array.from(keys, (key) => {
      const [y, m] = key.split('-').map(Number);
      return { year: y, month: m };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, rangeMode, rangeStart, rangeEnd, rangeTooLong]);

  const holidayQueries = useQueries({
    queries: spannedMonths.map(({ year, month }) => ({
      queryKey: ['holidays', year, month],
      queryFn: () => worklogsApi.holidays(year, month),
    })),
  });

  const holidaySet = useMemo(() => {
    const set = new Set<string>();
    holidayQueries.forEach((q) => (q.data ?? []).forEach((h) => set.add(h.date)));
    return set;
  }, [holidayQueries]);

  // Weekends and holidays are skipped automatically for range inserts.
  const rangeDates = rangeSpan.filter((d) => !isWeekend(d) && !holidaySet.has(d));
  const skippedCount = rangeSpan.length - rangeDates.length;
  const rangeHolidaysLoading = rangeMode && holidayQueries.some((q) => q.isLoading);

  const dateValid = rangeMode
    ? entry
      ? !!rangeStart
      : !!rangeStart && !!rangeEnd && !rangeTooLong && rangeDates.length > 0
    : !!draft.log_date;
  const valid = draft.project.trim() && dateValid && draft.start_time && draft.end_time && !(!entry && rangeHolidaysLoading);

  const handleSave = () => {
    if (rangeMode && entry && rangeStart) {
      onSave({ ...draft, log_date: rangeStart });
    } else if (rangeMode && !entry && rangeDates.length > 0) {
      onSave({ ...draft, log_date: rangeDates[0], range_dates: rangeDates });
    } else {
      onSave(draft);
    }
  };

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
        <Checkbox
          label="Apply to a range of dates"
          description={entry
            ? 'Pick a range to quickly set a new date for this entry — it moves to the first day selected'
            : 'Adds the same entry once for every working day in the range (weekends and holidays are skipped)'}
          checked={rangeMode}
          onChange={(event) => setRangeMode(event.currentTarget.checked)}
        />

        {rangeMode ? (
          <DatePickerInput
            type="range"
            label="Date range"
            leftSection={<IconCalendarEvent size={16} />}
            value={rangeValue}
            onChange={(value) => setRangeValue(value as [string | null, string | null])}
            valueFormat="ddd, D MMM YYYY"
            error={!entry && rangeTooLong ? `Ranges are limited to ${MAX_RANGE_DAYS} days` : undefined}
            required
          />
        ) : (
          <DateInput
            label="Date"
            leftSection={<IconCalendarEvent size={16} />}
            value={draft.log_date}
            onChange={(value) => value && patch({ log_date: value })}
            valueFormat="ddd, D MMM YYYY"
            required
          />
        )}

        {rangeMode && rangeStart && entry && (
          <Text size="xs" c="dimmed">This entry will be set to {dayjs(rangeStart).format('ddd, D MMM YYYY')}.</Text>
        )}

        {rangeMode && !entry && rangeStart && rangeEnd && !rangeTooLong && (
          rangeHolidaysLoading ? (
            <Text size="xs" c="dimmed">Checking holidays…</Text>
          ) : rangeDates.length > 0 ? (
            <Text size="xs" c="dimmed">
              Will create {rangeDates.length} {rangeDates.length === 1 ? 'entry' : 'entries'} ({dayjs(rangeDates[0]).format('D MMM')} – {dayjs(rangeDates[rangeDates.length - 1]).format('D MMM')}){skippedCount > 0 ? `, skipping ${skippedCount} weekend/holiday ${skippedCount === 1 ? 'day' : 'days'}` : ''}.
            </Text>
          ) : (
            <Text size="xs" c="red">No working days in this range — every date is a weekend or holiday.</Text>
          )
        )}

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
          {/* TimePicker renders its own 24h fields (no native <input type="time">), so the
              clock format is fixed regardless of browser/OS locale. */}
          <TimePicker label="Start" format="24h" value={draft.start_time} onChange={(value) => patch({ start_time: value })} required />
          <TimePicker label="End" format="24h" value={draft.end_time} onChange={(value) => patch({ end_time: value })} required />
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
            <Button loading={saving} disabled={!valid} onClick={handleSave}>{entry ? 'Save changes' : rangeMode && rangeDates.length > 1 ? `Add ${rangeDates.length} entries` : 'Add entry'}</Button>
          </Group>
        </Group>
      </Stack>
    </Drawer>
  );
}
