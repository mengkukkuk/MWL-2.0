import { useEffect, useState } from 'react';
import {
  Alert,
  Anchor,
  Button,
  Card,
  Center,
  Loader,
  PasswordInput,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconCircleCheck } from '@tabler/icons-react';
import { Link, useSearchParams } from 'react-router';

import { authApi } from '../api/auth';
import { ApiError } from '../api/http';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [state, setState] = useState<'checking' | 'valid' | 'invalid' | 'done'>('checking');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: { password: '', confirm: '' },
    validate: {
      password: (v) => (v.length >= 8 ? null : 'At least 8 characters'),
      confirm: (v, values) => (v === values.password ? null : 'Passwords do not match'),
    },
  });

  // Verify before rendering the form so an expired link says so immediately
  // rather than after the user has typed a new password twice.
  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }
    let cancelled = false;
    authApi
      .verifyResetToken(token)
      .then((res) => {
        if (!cancelled) setState(res.valid ? 'valid' : 'invalid');
      })
      .catch(() => {
        if (!cancelled) setState('invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = form.onSubmit(async ({ password }) => {
    setSubmitting(true);
    setError(null);
    try {
      await authApi.confirmReset(token, password);
      setState('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset the password.');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Center mih="100vh" p="md">
      <Card padding="lg" w={400} maw="100%">
        <Stack>
          <Title order={3} ta="center">
            Reset password
          </Title>

          {state === 'checking' && (
            <Center py="lg">
              <Loader size="sm" />
            </Center>
          )}

          {state === 'invalid' && (
            <>
              <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
                This reset link is invalid or has expired. Reset links can only be used once.
              </Alert>
              <Anchor component={Link} to="/login" size="sm" ta="center">
                Back to sign in
              </Anchor>
            </>
          )}

          {state === 'done' && (
            <>
              <Stack align="center" gap="xs">
                <IconCircleCheck size={44} color="var(--mantine-color-teal-6)" />
                <Text size="sm" c="dimmed" ta="center">
                  Your password has been changed. Any login lockout has been cleared.
                </Text>
              </Stack>
              <Anchor component={Link} to="/login" size="sm" ta="center">
                Sign in
              </Anchor>
            </>
          )}

          {state === 'valid' && (
            <form onSubmit={handleSubmit}>
              <Stack>
                {error && (
                  <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
                    {error}
                  </Alert>
                )}
                <PasswordInput label="New password" autoFocus {...form.getInputProps('password')} />
                <PasswordInput label="Confirm password" {...form.getInputProps('confirm')} />
                <Button type="submit" loading={submitting} fullWidth>
                  Set new password
                </Button>
              </Stack>
            </form>
          )}
        </Stack>
      </Card>
    </Center>
  );
}
