import { useMemo } from 'react';
import { Menu, ScrollArea, UnstyledButton } from '@mantine/core';
import { IconCalendarMonth, IconChevronDown, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { recentMonths } from '../utils/dates';

/**
 * The single period control for a page: step a month at a time with the arrows,
 * or jump to any recent month from the label. Replaces the previous split of a
 * month chip plus a four-month tab row, which gave two answers to one question.
 */
export function PeriodSelect({
  value,
  onChange,
  monthCount = 18,
}: {
  /** `YYYY-MM`. */
  value: string;
  onChange: (month: string) => void;
  monthCount?: number;
}) {
  const months = useMemo(() => recentMonths(monthCount), [monthCount]);
  const thisMonth = dayjs().format('YYYY-MM');
  const current = dayjs(`${value}-01`);
  const oldest = months[months.length - 1]?.value ?? value;

  const step = (delta: number) => onChange(current.add(delta, 'month').format('YYYY-MM'));

  // The record only runs to today, and no further back than the menu offers.
  const atNewest = value >= thisMonth;
  const atOldest = value <= oldest;

  const byYear = useMemo(() => {
    const groups = new Map<string, { value: string; label: string }[]>();
    for (const item of months) {
      const year = item.value.slice(0, 4);
      const bucket = groups.get(year);
      if (bucket) bucket.push(item);
      else groups.set(year, [item]);
    }
    return [...groups.entries()];
  }, [months]);

  return (
    <div className="period-select">
      <UnstyledButton
        className="period-step"
        onClick={() => step(-1)}
        disabled={atOldest}
        aria-label={`Previous month, ${current.subtract(1, 'month').format('MMMM YYYY')}`}
      >
        <IconChevronLeft size={16} />
      </UnstyledButton>

      <Menu shadow="md" position="bottom" width={252} withinPortal>
        <Menu.Target>
          <UnstyledButton className="period-label" aria-label={`${current.format('MMMM YYYY')}. Choose a different month.`}>
            <IconCalendarMonth size={16} />
            <span className="period-label-text">{current.format('MMMM YYYY')}</span>
            <IconChevronDown size={13} className="period-caret" />
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          <ScrollArea.Autosize mah={300} type="scroll">
            {byYear.map(([year, items]) => (
              <div key={year}>
                <Menu.Label>{year}</Menu.Label>
                {items.map((item) => (
                  <Menu.Item
                    key={item.value}
                    onClick={() => onChange(item.value)}
                    data-selected={item.value === value}
                    className="period-option"
                  >
                    {dayjs(`${item.value}-01`).format('MMMM')}
                    {item.value === thisMonth && <span className="period-option-tag">This month</span>}
                  </Menu.Item>
                ))}
              </div>
            ))}
          </ScrollArea.Autosize>
        </Menu.Dropdown>
      </Menu>

      <UnstyledButton
        className="period-step"
        onClick={() => step(1)}
        disabled={atNewest}
        aria-label={`Next month, ${current.add(1, 'month').format('MMMM YYYY')}`}
      >
        <IconChevronRight size={16} />
      </UnstyledButton>
    </div>
  );
}
