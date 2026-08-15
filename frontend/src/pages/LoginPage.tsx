import { useEffect, useState } from 'react';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconClock, IconInfoCircle } from '@tabler/icons-react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { authApi } from '../api/auth';
import { ApiError } from '../api/http';
import { useAuth } from '../auth/AuthContext';
import { safeNextPath } from '../utils/nextUrl';
import { notifySuccess } from '../utils/notify';
import type { AccountStatusBody, LockoutBody } from '../types/api';

type Outcome =
  | { kind: 'none' }
  | { kind: 'invalid'; message: string }
  | { kind: 'blocked'; message: string }
  | { kind: 'locked'; seconds: number };

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));

  const [outcome, setOutcome] = useState<Outcome>({ kind: 'none' });
  const [submitting, setSubmitting] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const form = useForm({
    initialValues: { username: '', password: '' },
    validate: {
      username: (v) => (v.trim() ? null : 'Username is required'),
      password: (v) => (v ? null : 'Password is required'),
    },
  });

  // Lockout countdown. The server returns the remaining window in seconds; we
  // tick it down locally so the button re-enables without a page reload.
  useEffect(() => {
    if (outcome.kind !== 'locked') return;
    if (outcome.seconds <= 0) {
      setOutcome({ kind: 'none' });
      return;
    }
    const timer = setTimeout(
      () => setOutcome({ kind: 'locked', seconds: outcome.seconds - 1 }),
      1000,
    );
    return () => clearTimeout(timer);
  }, [outcome]);

  if (!loading && user) return <Navigate to={next} replace />;

  const locked = outcome.kind === 'locked';

  const handleSubmit = form.onSubmit(async ({ username, password }) => {
    setSubmitting(true);
    setOutcome({ kind: 'none' });
    try {
      await login(username.trim(), password);
      navigate(next, { replace: true });
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setOutcome({ kind: 'invalid', message: 'Could not reach the server.' });
        return;
      }
      if (err.status === 429) {
        const body = err.payload as Partial<LockoutBody> | undefined;
        setOutcome({ kind: 'locked', seconds: Math.max(1, Number(body?.locked_for_seconds ?? 60)) });
      } else if (err.status === 403) {
        const body = err.payload as Partial<AccountStatusBody> | undefined;
        setOutcome({
          kind: 'blocked',
          message:
            body?.message ??
            (body?.error === 'declined'
              ? 'This account was declined. Contact an administrator.'
              : 'Your account is awaiting approval by an administrator.'),
        });
      } else {
        setOutcome({ kind: 'invalid', message: err.message });
      }
      form.setFieldValue('password', '');
    } finally {
      setSubmitting(false);
    }
  });

  const handleForgot = async () => {
    const username = form.values.username.trim();
    if (!username) {
      form.setFieldError('username', 'Enter your username first');
      return;
    }
    // Always resolves to a generic 200 — the server never reveals whether the
    // account exists, so the confirmation copy must stay non-committal too.
    try {
      await authApi.forgotPassword(username);
    } catch {
      // Swallowed on purpose: distinguishing failures here would leak account
      // existence, which is exactly what the endpoint is designed to prevent.
    }
    setForgotSent(true);
    notifySuccess('If that account has an email on file, a reset link is on its way.');
  };

  return (
    <Center mih="100vh" p="md">
      <Box w={400} maw="100%">
        <Stack gap="lg">
          <Stack gap={4} align="center">
            <Title order={2}>Monthly Worklog</Title>
            <Text c="dimmed" size="sm">
              Sign in to continue
            </Text>
          </Stack>

          <Card padding="lg">
            <form onSubmit={handleSubmit}>
              <Stack>
                {outcome.kind === 'invalid' && (
                  <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
                    {outcome.message}
                  </Alert>
                )}
                {outcome.kind === 'blocked' && (
                  <Alert color="yellow" icon={<IconInfoCircle size={16} />} variant="light">
                    {outcome.message}
                  </Alert>
                )}
                {locked && (
                  <Alert color="orange" icon={<IconClock size={16} />} variant="light">
                    Too many failed attempts. Try again in {outcome.seconds}s.
                  </Alert>
                )}

                <TextInput
                  label="Username"
                  autoComplete="username"
                  autoFocus
                  disabled={locked}
                  {...form.getInputProps('username')}
                />
                <PasswordInput
                  label="Password"
                  autoComplete="current-password"
                  disabled={locked}
                  {...form.getInputProps('password')}
                />

                <Button type="submit" loading={submitting} disabled={locked} fullWidth mt="xs">
                  Sign in
                </Button>

                <Divider />

                <Group justify="space-between">
                  <Anchor component="button" type="button" size="xs" onClick={handleForgot}>
                    {forgotSent ? 'Resend reset link' : 'Forgot password?'}
                  </Anchor>
                  <Anchor size="xs" href="/register">
                    Request an account
                  </Anchor>
                </Group>
              </Stack>
            </form>
          </Card>
        </Stack>
      </Box>
    </Center>
  );
}
