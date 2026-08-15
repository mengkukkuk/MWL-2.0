import { notifications } from '@mantine/notifications';
import { ApiError } from '../api/http';

export function notifyError(error: unknown, fallback = 'Something went wrong.') {
  const message = error instanceof ApiError ? error.message : fallback;
  notifications.show({ color: 'red', title: 'Error', message, autoClose: 6000 });
}

export function notifySuccess(message: string) {
  notifications.show({ color: 'teal', message, autoClose: 2500 });
}
