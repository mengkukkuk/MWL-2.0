import { useMemo, useState } from 'react';
import { Avatar, Combobox, Group, ScrollArea, Text, TextInput, UnstyledButton, useCombobox } from '@mantine/core';
import { IconSearch, IconSelector, IconUsers } from '@tabler/icons-react';

import type { Employee, EmployeeId } from '../types/api';

/** Name, position and staff id are all searchable — people look up whichever they know. */
function matches(member: Employee, query: string) {
  const haystack = `${member.name ?? ''} ${member.position ?? ''} ${member.staff_id ?? member.id}`;
  return haystack.toLowerCase().includes(query.trim().toLowerCase());
}

function Identity({ member, fallback, hint }: { member: Employee | null; fallback: string; hint: string }) {
  const name = member?.name ?? member?.id ?? fallback;
  return (
    <>
      <Avatar src={member?.avatar_url} radius="xl" size={30} color="indigo">
        {member ? name.slice(0, 1) : <IconUsers size={16} />}
      </Avatar>
      <span className="member-picker-copy">
        <span className="member-picker-name">{name}</span>
        <span className="member-picker-role">{member ? member.position ?? 'No position on record' : hint}</span>
      </span>
    </>
  );
}

export function MemberPicker({
  members,
  value,
  onChange,
  canSwitch,
  loading,
}: {
  members: Employee[];
  value: EmployeeId | null;
  onChange: (memberId: EmployeeId | null) => void;
  /** Only elevated roles may look at someone else's record. */
  canSwitch: boolean;
  loading: boolean;
}) {
  const [query, setQuery] = useState('');
  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      setQuery('');
    },
  });

  const selected = members.find((member) => member.id === value) ?? null;
  const results = useMemo(
    () => (query ? members.filter((member) => matches(member, query)) : members),
    [members, query],
  );

  // A disabled dropdown reads as broken. Someone who cannot switch members just
  // sees who they are.
  if (!canSwitch) {
    return (
      <div className="member-picker" data-static="true">
        <Identity member={selected} fallback={loading ? 'Loading…' : 'No member'} hint="Your record" />
      </div>
    );
  }

  return (
    <Combobox store={combobox} width={310} position="bottom-end" shadow="md" withinPortal>
      <Combobox.Target>
        <UnstyledButton
          className="member-picker"
          onClick={() => combobox.toggleDropdown()}
          disabled={loading}
          aria-label={selected ? `Viewing ${selected.name ?? selected.id}. Change member.` : 'Select a member'}
        >
          <Identity
            member={selected}
            fallback={loading ? 'Loading…' : 'Select member'}
            hint={loading ? 'Fetching the roster' : 'Whose record to open'}
          />
          <IconSelector size={15} className="member-picker-caret" />
        </UnstyledButton>
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Search
          component={TextInput}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search name, position or ID"
          leftSection={<IconSearch size={15} />}
        />
        <Combobox.Options>
          <ScrollArea.Autosize mah={280} type="scroll">
            {results.length === 0 ? (
              <Combobox.Empty>No one matches “{query}”</Combobox.Empty>
            ) : (
              results.map((member) => (
                <Combobox.Option
                  key={member.id}
                  value={member.id}
                  active={member.id === value}
                  onClick={() => {
                    onChange(member.id);
                    combobox.closeDropdown();
                  }}
                >
                  <Group gap="sm" wrap="nowrap">
                    <Avatar src={member.avatar_url} radius="xl" size={28} color="indigo">
                      {(member.name ?? member.id).slice(0, 1)}
                    </Avatar>
                    <div className="member-option-copy">
                      <Text size="sm" fw={650} lineClamp={1}>{member.name ?? member.id}</Text>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {member.position ?? 'No position'} · {member.staff_id ?? member.id}
                      </Text>
                    </div>
                  </Group>
                </Combobox.Option>
              ))
            )}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
