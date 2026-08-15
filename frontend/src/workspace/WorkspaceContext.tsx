import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

import { employeesApi } from '../api/employees';
import { useAuth } from '../auth/AuthContext';
import type { Employee, EmployeeId } from '../types/api';

type WorkspaceContextValue = {
  members: Employee[];
  selectedMemberId: EmployeeId | null;
  setSelectedMemberId: (memberId: EmployeeId | null) => void;
  selectedMember: Employee | null;
  isLoadingMembers: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const STORAGE_KEY = 'mwl.selected-member';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, isElevated } = useAuth();
  const membersQuery = useQuery({ queryKey: ['employees'], queryFn: employeesApi.list });
  const members = membersQuery.data ?? [];
  const [selectedMemberId, setSelectedMemberIdState] = useState<EmployeeId | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? (saved as EmployeeId) : null;
  });

  useEffect(() => {
    if (!user) return;
    if (!isElevated) {
      setSelectedMemberIdState(user.member_id);
      return;
    }
    if (selectedMemberId && members.some((member) => member.id === selectedMemberId)) return;
    setSelectedMemberIdState(user.member_id);
  }, [isElevated, members, selectedMemberId, user]);

  const setSelectedMemberId = (memberId: EmployeeId | null) => {
    const next = !isElevated && user ? user.member_id : memberId;
    setSelectedMemberIdState(next);
    if (typeof window !== 'undefined') {
      if (next) window.localStorage.setItem(STORAGE_KEY, next);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  const value = useMemo<WorkspaceContextValue>(() => ({
    members,
    selectedMemberId: isElevated ? selectedMemberId : user?.member_id ?? null,
    setSelectedMemberId,
    selectedMember: members.find((member) => member.id === (isElevated ? selectedMemberId : user?.member_id)) ?? null,
    isLoadingMembers: membersQuery.isLoading,
  }), [isElevated, members, membersQuery.isLoading, selectedMemberId, user]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return value;
}
