import type { CSSProperties, ReactNode } from 'react';
import { Badge, Center, Group, Text, Title } from '@mantine/core';
import { IconFileAnalytics, IconLock } from '@tabler/icons-react';

const PARTICLES = [
  { x: 7, y: 13, size: 4, delay: -2, duration: 13, driftX: 34, driftY: -44 },
  { x: 16, y: 76, size: 3, delay: -8, duration: 17, driftX: -22, driftY: -52 },
  { x: 25, y: 34, size: 6, delay: -5, duration: 15, driftX: 44, driftY: 38 },
  { x: 34, y: 88, size: 4, delay: -11, duration: 19, driftX: 31, driftY: -57 },
  { x: 43, y: 19, size: 3, delay: -3, duration: 16, driftX: -36, driftY: 48 },
  { x: 52, y: 68, size: 5, delay: -9, duration: 14, driftX: 28, driftY: -46 },
  { x: 61, y: 42, size: 3, delay: -13, duration: 20, driftX: -42, driftY: 36 },
  { x: 70, y: 9, size: 5, delay: -6, duration: 18, driftX: 26, driftY: 52 },
  { x: 79, y: 83, size: 4, delay: -1, duration: 14, driftX: -28, driftY: -45 },
  { x: 89, y: 28, size: 3, delay: -12, duration: 17, driftX: 38, driftY: 41 },
  { x: 95, y: 61, size: 6, delay: -4, duration: 21, driftX: -35, driftY: -50 },
  { x: 12, y: 48, size: 2, delay: -10, duration: 16, driftX: 48, driftY: 30 },
  { x: 29, y: 7, size: 3, delay: -7, duration: 19, driftX: -24, driftY: 55 },
  { x: 47, y: 92, size: 2, delay: -15, duration: 18, driftX: 40, driftY: -38 },
  { x: 67, y: 72, size: 3, delay: -2, duration: 15, driftX: -38, driftY: -34 },
  { x: 84, y: 51, size: 2, delay: -9, duration: 20, driftX: 32, driftY: 49 },
] as const;

function ParticleField() {
  return (
    <div className="auth-particle-field" aria-hidden="true">
      {PARTICLES.map((particle, index) => (
        <span
          key={index}
          className="auth-particle"
          style={{
            '--particle-x': `${particle.x}%`,
            '--particle-y': `${particle.y}%`,
            '--particle-size': `${particle.size}px`,
            '--particle-delay': `${particle.delay}s`,
            '--particle-duration': `${particle.duration}s`,
            '--particle-drift-x': `${particle.driftX}px`,
            '--particle-drift-y': `${particle.driftY}px`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

export function AuthBrandHeader() {
  return (
    <Group justify="space-between" align="center" wrap="nowrap" className="auth-login-brand">
      <Group gap="sm" wrap="nowrap">
        <div className="auth-login-logo" aria-hidden="true">
          <IconFileAnalytics size={24} stroke={1.8} />
        </div>
        <div>
          <Title order={1} className="auth-login-wordmark">
            MWL Timesheet <span>— Worklog</span>
          </Title>
          <Text className="auth-login-brandline">Meter operations workspace</Text>
        </div>
      </Group>
      <Badge variant="light" color="cyan" leftSection={<IconLock size={12} />} className="auth-secure-badge">
        Secure
      </Badge>
    </Group>
  );
}

export function AuthLayout({ children, size = 'default' }: { children: ReactNode; size?: 'default' | 'wide' }) {
  return (
    <Center className="auth-page auth-page--enterprise">
      <ParticleField />
      <main className="auth-enterprise-layout" data-size={size}>{children}</main>
      <Text className="auth-enterprise-footer" aria-hidden="true">MWL / SECURE WORKSPACE / 2.0</Text>
    </Center>
  );
}
