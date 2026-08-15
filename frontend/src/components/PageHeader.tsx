import { Breadcrumbs, Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  breadcrumb,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  breadcrumb?: string;
}) {
  return (
    <Stack gap="xs" mb="xl" className="page-header">
      <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
        <div className="page-header-copy">
          {breadcrumb && <Breadcrumbs mb={6} fz="xs" c="dimmed">{['Workspace', breadcrumb]}</Breadcrumbs>}
          <Group gap={8} mb={4}>
            <span className="eyebrow-dot" aria-hidden="true" />
            <Text size="xs" fw={800} tt="uppercase" lts="0.12em" c="indigo">{eyebrow}</Text>
          </Group>
          <Title order={1} mt={4} className="page-title">{title}</Title>
          <Text c="dimmed" mt={5} maw={660}>{description}</Text>
        </div>
        {actions && <Group className="page-header-actions">{actions}</Group>}
      </Group>
    </Stack>
  );
}
