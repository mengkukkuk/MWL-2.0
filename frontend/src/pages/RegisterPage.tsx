import { useState } from 'react';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Card,
  Center,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconCircleCheck, IconSearch } from '@tabler/icons-react';
import { Link } from 'react-router';

import { authApi } from '../api/auth';
import type { EmployeeLookup } from '../api/auth';
import { ApiError } from '../api/http';

export function RegisterPage() {
  const [lookup, setLookup] = useState<EmployeeLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: { employee_id: '', username: '', password: '', confirm: '', email: '' },
    validate: {
      employee_id: (v) => (v.trim() ? null : 'Employee ID is required'),
      username: (v) => {
        if (!v.trim()) return 'Username is required';
        return v.trim().length > 50 ? 'Must be 50 characters or fewer' : null;
      },
      password: (v) => (v.length >= 8 ? null : 'At least 8 characters'),
      confirm: (v, values) => (v === values.password ? null : 'Passwords do not match'),
      email: (v) => (!v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? null : 'Invalid email address'),
    },
  });

  // Previewing the EmployeeID before submit turns two of the register endpoint's
  // failure modes (unknown ID, already claimed) into inline feedback.
  const runLookup = async () => {
    const id = form.values.employee_id.trim();
    if (!id) return;
    setLooking(true);
    setLookup(null);
    setLookupError(null);
    try {
      setLookup(await authApi.employeeLookup(id));
    } catch (err) {
      setLookupError(
        err instanceof ApiError && err.status === 404
          ? 'That Employee ID is not in the HR records.'
          : 'Could not check that Employee ID.',
      );
    } finally {
      setLooking(false);
    }
  };

  const handleSubmit = form.onSubmit(async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      await authApi.register({
        username: values.username.trim(),
        password: values.password,
        employee_id: values.employee_id.trim(),
        email: values.email.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  });

  if (submitted) {
    return (
      <Center mih="100vh" p="md">
        <Card padding="lg" w={420} maw="100%">
          <Stack align="center" gap="sm">
            <IconCircleCheck size={44} color="var(--mantine-color-teal-6)" />
            <Title order={3}>Request submitted</Title>
            <Text c="dimmed" size="sm" ta="center">
              Your account is pending approval by an administrator. You will be able to sign in once
              it has been approved.
            </Text>
            <Anchor component={Link} to="/login" size="sm">
              Back to sign in
            </Anchor>
          </Stack>
        </Card>
      </Center>
    );
  }

  return (
    <Center mih="100vh" p="md">
      <Box w={440} maw="100%">
        <Stack gap="lg">
          <Stack gap={4} align="center">
            <Title order={2}>Request an account</Title>
            <Text c="dimmed" size="sm">
              Your name and department come from the HR record
            </Text>
          </Stack>

          <Card padding="lg">
            <form onSubmit={handleSubmit}>
              <Stack>
                {error && (
                  <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
                    {error}
                  </Alert>
                )}

                <Group align="flex-end" gap="xs" wrap="nowrap">
                  <TextInput
                    label="Employee ID"
                    style={{ flex: 1 }}
                    {...form.getInputProps('employee_id')}
                  />
                  <Button
                    variant="light"
                    onClick={runLookup}
                    loading={looking}
                    leftSection={<IconSearch size={16} />}
                  >
                    Check
                  </Button>
                </Group>

                {lookupError && (
                  <Alert color="red" variant="light" py="xs">
                    {lookupError}
                  </Alert>
                )}
                {lookup && (
                  <Alert color={lookup.taken ? 'yellow' : 'teal'} variant="light" py="xs">
                    <Text size="sm" fw={500}>
                      {lookup.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {[lookup.department, lookup.position].filter(Boolean).join(' / ') || '-'}
                    </Text>
                    {lookup.taken && (
                      <Text size="xs" c="yellow.8" mt={4}>
                        This Employee ID already has an account.
                      </Text>
                    )}
                  </Alert>
                )}

                <TextInput label="Username" {...form.getInputProps('username')} />
                <TextInput
                  label="Email"
                  description="Optional - used only for password resets"
                  {...form.getInputProps('email')}
                />
                <PasswordInput label="Password" {...form.getInputProps('password')} />
                <PasswordInput label="Confirm password" {...form.getInputProps('confirm')} />

                <Button type="submit" loading={submitting} fullWidth mt="xs">
                  Submit request
                </Button>

                <Anchor component={Link} to="/login" size="xs" ta="center">
                  Already have an account? Sign in
                </Anchor>
              </Stack>
            </form>
          </Card>
        </Stack>
      </Box>
    </Center>
  );
}
