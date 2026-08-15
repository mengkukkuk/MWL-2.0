import { Card, Group, RingProgress, Stack, Text, ThemeIcon } from '@mantine/core';
import type { ReactNode } from 'react';

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
  return (
    <Card className="metric-card" padding="lg">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={7}>
          <Group gap="xs">
            <ThemeIcon color={accent} variant="light" radius="md" size={34}>{icon}</ThemeIcon>
            <Text size="sm" c="dimmed" fw={700}>{label}</Text>
          </Group>
          <Text fz={30} fw={800} lh={1.05} className="metric-value">{value}</Text>
          <Text size="xs" c="dimmed">{helper}</Text>
        </Stack>
        {progress !== undefined && (
          <RingProgress size={64} thickness={6} roundCaps sections={[{ value: progress, color: accent }]} label={<Text ta="center" size="xs" fw={800}>{progress}%</Text>} />
        )}
      </Group>
    </Card>
  );
}
