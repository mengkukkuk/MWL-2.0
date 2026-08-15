import { Center, Loader } from '@mantine/core';
import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuth } from './AuthContext';

/** Route guard. Renders nothing decisive until the /api/me bootstrap settles,
 *  otherwise a refresh would flash the login page for an authenticated user. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
}

/** Guard for elevated-only routes. Assumes RequireAuth ran first. */
export function RequireElevated() {
  const { isElevated, loading } = useAuth();
  if (loading) return null;
  if (!isElevated) return <Navigate to="/" replace />;
  return <Outlet />;
}
