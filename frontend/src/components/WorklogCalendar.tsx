import { useMemo } from 'react';
import { Text, UnstyledButton } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import dayjs from 'dayjs';

import type { Holiday, Worklog, WorklogStatus } from '../types/api';
import { DATE_FMT, formatHours, isWeekend, monthMatrix } from '../utils/dates';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Entry accent per status, so a cell reads before it is parsed. */
const STATUS_ACCENT: Record<WorklogStatus, string> = {
  'Done': 'var(--coverage-complete)',
  'In Progress': 'var(--workspace-indigo)',
  'Pending': 'var(--coverage-partial)',
  'Man day': 'var(--workspace-cyan)',
  'Leave': 'var(--coverage-none)',
};

const MAX_VISIBLE_ENTRIES = 2;

function entryLabel(entry: Worklog): string {
  return entry.project ?? entry.project_description ?? entry.task ?? 'Untitled';
}

export function WorklogCalendar({
  year,
  month,
  worklogs,
  holidays,
  onAddEntry,
  onSelectEntry,
}: {
  year: number;
  month: number;
  worklogs: Worklog[];
  holidays: Holiday[];
  onAddEntry: (isoDate: string) => void;
  onSelectEntry: (entry: Worklog) => void;
}) {
  const weeks = useMemo(() => monthMatrix(year, month), [year, month]);
  const today = dayjs().format(DATE_FMT);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, Worklog[]>();
    for (const entry of worklogs) {
      const existing = map.get(entry.log_date);
      if (existing) existing.push(entry);
      else map.set(entry.log_date, [entry]);
    }
    return map;
  }, [worklogs]);

  const holidayByDate = useMemo(
    () => new Map(holidays.map((item) => [item.date, item.description])),
    [holidays],
  );

  return (
    <div>
      <div className="calendar-scroll">
        <div className="calendar-head" aria-hidden="true">
          {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="calendar-grid" role="grid" aria-label={`Work log for ${dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMMM YYYY')}`}>
          {weeks.flat().map(({ date, inMonth }) => {
            const entries = entriesByDate.get(date) ?? [];
            const weekend = isWeekend(date);
            const holidayName = holidayByDate.get(date);
            const isHoliday = holidayByDate.has(date);
            // A gap only counts on a day an entry was expected.
            const missing = inMonth && !weekend && !isHoliday && entries.length === 0;
            const totalHours = entries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0);
            const dayNumber = dayjs(date).date();

            const cellProps = {
              className: 'calendar-cell',
              'data-outside': !inMonth,
              'data-weekend': weekend,
              'data-holiday': isHoliday,
              'data-missing': missing,
              'data-today': date === today,
            };

            const head = (
              <div className="calendar-cell-head">
                <span className="calendar-day-number">{dayNumber}</span>
                {totalHours > 0 && <span className="calendar-cell-hours">{formatHours(totalHours)}</span>}
              </div>
            );

            // No entries: the whole cell is the add target, so there is nothing
            // interactive nested inside it.
            if (entries.length === 0) {
              if (!inMonth) {
                return <div key={date} {...cellProps}>{head}</div>;
              }
              return (
                <UnstyledButton
                  key={date}
                  {...cellProps}
                  onClick={() => onAddEntry(date)}
                  aria-label={`Add an entry for ${dayjs(date).format('dddd D MMMM')}`}
                >
                  {head}
                  {holidayName && <span className="calendar-holiday-name" title={holidayName}>{holidayName}</span>}
                  <span className="calendar-add"><IconPlus size={13} /> Add entry</span>
                </UnstyledButton>
              );
            }

            const overflow = entries.length - MAX_VISIBLE_ENTRIES;
            return (
              <div key={date} {...cellProps}>
                {head}
                {holidayName && <span className="calendar-holiday-name" title={holidayName}>{holidayName}</span>}
                {entries.slice(0, MAX_VISIBLE_ENTRIES).map((entry) => (
                  <UnstyledButton
                    key={entry.id}
                    className="calendar-entry"
                    style={{ '--entry-accent': STATUS_ACCENT[entry.status] } as React.CSSProperties}
                    onClick={() => onSelectEntry(entry)}
                    aria-label={`${entryLabel(entry)}, ${entry.status}, ${formatHours(entry.hours)}`}
                  >
                    <span className="calendar-entry-code" title={entry.task ?? entryLabel(entry)}>{entryLabel(entry)}</span>
                    <span className="calendar-entry-hours">{formatHours(entry.hours)}</span>
                  </UnstyledButton>
                ))}
                {overflow > 0 && <Text size="xs" c="dimmed" fw={650}>+{overflow} more</Text>}
                {inMonth && (
                  <UnstyledButton
                    className="calendar-add"
                    onClick={() => onAddEntry(date)}
                    aria-label={`Add another entry for ${dayjs(date).format('dddd D MMMM')}`}
                  >
                    <IconPlus size={13} /> Add entry
                  </UnstyledButton>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
