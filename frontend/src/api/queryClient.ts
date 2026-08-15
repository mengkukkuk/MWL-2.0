import { QueryClient } from '@tanstack/react-query';
import { ApiError, isTerminalStatus } from './http';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The server memoises several list endpoints in a 300 s TTLCache, so
      // refetching sooner than that just re-reads the same snapshot.
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && isTerminalStatus(error.status)) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});
