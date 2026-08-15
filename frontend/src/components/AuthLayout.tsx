import type { ReactNode } from 'react';
import { Center, Group, Text, ThemeIcon, Title } from '@mantine/core';
import { IconChartBar, IconCircleCheck, IconClock, IconFileAnalytics } from '@tabler/icons-react';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Center className="auth-page">
      <div className="auth-layout">
        <section className="auth-brand-panel">
          <div className="auth-brand-content">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon size={42} radius="xl" variant="white" color="indigo">
                <IconFileAnalytics size={22} />
              </ThemeIcon>
              <div>
                <Text fw={800} size="lg" lh={1.05}>Meter Worklog</Text>
                <Text size="xs" fw={700} tt="uppercase" lts="0.1em" c="rgba(255,255,255,.7)">Operations workspace</Text>
              </div>
            </Group>
            <Title order={1} className="auth-brand-title">Make every workday visible.</Title>
            <Text className="auth-brand-copy">
              One calm place to capture time, keep delivery moving, and give teams a shared view of what matters.
            </Text>
            <div className="auth-feature-list">
              <div className="auth-feature"><IconCircleCheck size={17} /> Clear daily worklogs</div>
              <div className="auth-feature"><IconChartBar size={17} /> Focused team reporting</div>
              <div className="auth-feature"><IconClock size={17} /> Less admin, more momentum</div>
            </div>
          </div>
          <Text className="auth-brand-footer" size="xs" c="rgba(255,255,255,.62)">Built for teams that want the signal, not the noise.</Text>
        </section>
        <section className="auth-form-panel">{children}</section>
      </div>
    </Center>
  );
}
