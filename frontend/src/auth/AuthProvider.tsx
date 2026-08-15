import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { authApi } from '../api/auth';
import { ApiError, setUnauthorizedHandler } from '../api/http';
import { ELEVATED_ROLES, ROLE_ADMIN, ROLE_SUPER_ADMIN } from '../types/api';
import type { Me } from '../types/api';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Kept in a ref so the 401 handler below never closes over a stale value.
  const userRef = useRef<Me | null>(null);
  userRef.current = user;

  // Bootstrap: the session lives in an HttpOnly cookie, so the only way to know
  // whether we are signed in is to ask. A 401 here is the expected answer for a
  // signed-out visitor, not an error worth surfacing.
  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Any 401 from any request means the cookie expired server-side. Drop the
  // user so <RequireAuth> takes over; it redirects with the correct `next`.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (userRef.current !== null) {
        setUser(null);
        queryClient.clear();
      }
    });
    return () => setUnauthorizedHandler(() => {});
  }, [queryClient]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await authApi.login(username, password);
      // The login response carries role and member_id but not users.id, and
      // some pages need it — so re-read /api/me rather than synthesising a Me.
      let me: Me;
      try {
        me = await authApi.me();
      } catch {
        me = { id: 0 as Me['id'], username, role: res.role, member_id: res.member_id };
      }
      // Clear before setting: any cache from a previous account must not leak
      // into the new session.
      queryClient.clear();
      setUser(me);
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // A 401 here just means the session was already gone. Either way the
      // local state must be cleared, so this is deliberately non-fatal.
      if (!(err instanceof ApiError)) throw err;
    }
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(
    () => ({
      user,
      loading,
      role: user?.role ?? null,
      isElevated: !!user && ELEVATED_ROLES.includes(user.role),
      isAdmin: !!user && (user.role === ROLE_ADMIN || user.role === ROLE_SUPER_ADMIN),
      login,
      logout,
    }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
