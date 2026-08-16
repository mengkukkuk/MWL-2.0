import { Card, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import type { CSSProperties, ReactNode } from 'react';

export function MetricCard({
  label,
  value,
  helper,
  icon,
  accent = 'indigo',
  progress,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  accent?: string;
  progress?: number;
}) {
  const boundedProgress = progress === undefined ? undefined : Math.max(0, Math.min(100, progress));

  return (
    <Card className="metric-card" padding="lg" data-has-orbit={boundedProgress !== undefined || undefined}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={7}>
          <Group gap="xs">
            <ThemeIcon color={accent} variant="light" radius="md" size={34}>{icon}</ThemeIcon>
            <Text size="sm" c="dimmed" fw={700}>{label}</Text>
          </Group>
          <Text fz={30} fw={800} lh={1.05} className="metric-value">{value}</Text>
          <Text size="xs" c="dimmed">{helper}</Text>
        </Stack>
        {boundedProgress !== undefined && (
          <div
            className="metric-orbit"
            role="img"
            aria-label={`${boundedProgress}% complete`}
            style={{
              '--orbit-progress': `${boundedProgress}%`,
              '--orbit-color': `var(--mantine-color-${accent}-6)`,
            } as CSSProperties}
          >
            <span className="metric-orbit-track" aria-hidden="true" />
            <span className="metric-orbit-ring" aria-hidden="true">
              <span className="metric-orbit-dot" />
            </span>
            <span className="metric-orbit-label" aria-hidden="true">
              <strong>{boundedProgress}%</strong>
              <small>done</small>
            </span>
          </div>
        )}
      </Group>
    </Card>
  );
}
