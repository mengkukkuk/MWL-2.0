import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Group, Modal, ScrollArea, Stack, Text } from '@mantine/core';
import { IconFolder } from '@tabler/icons-react';

import type { FolderNode } from '../../types/api';

interface MoveToModalProps {
  opened: boolean;
  onClose: () => void;
  tree: FolderNode[];
  blockedIds: Set<number>;
  currentParentId: number | null;
  subtitle: string;
  loading?: boolean;
  onConfirm: (target: number | null) => void;
}

interface OptionRowProps {
  id: number | null;
  name: string;
  depth: number;
  blockedIds: Set<number>;
  currentParentId: number | null;
  picked: number | null | undefined;
  onPick: (id: number | null) => void;
}

function OptionRow({ id, name, depth, blockedIds, currentParentId, picked, onPick }: OptionRowProps) {
  const blocked = id != null && blockedIds.has(id);
  const isCurrent = id === currentParentId;
  const disabled = blocked || isCurrent;
  const selected = picked !== undefined && picked === id;
  const note = blocked ? "Can't move into itself" : isCurrent ? 'Already here' : '';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(id)}
      className={`move-option${selected ? ' selected' : ''}`}
      style={{ paddingLeft: 10 + depth * 16 }}
    >
      <IconFolder size={16} className="move-option-icon" />
      <span className="move-option-name">{name}</span>
      {note && <span className="move-option-note">{note}</span>}
    </button>
  );
}

function renderNodes(
  nodes: FolderNode[],
  depth: number,
  props: Omit<OptionRowProps, 'id' | 'name' | 'depth'>,
): ReactNode[] {
  return nodes.flatMap((node) => [
    <OptionRow key={node.id} id={node.id} name={node.name} depth={depth} {...props} />,
    ...renderNodes(node.children, depth + 1, props),
  ]);
}

export function MoveToModal({ opened, onClose, tree, blockedIds, currentParentId, subtitle, loading, onConfirm }: MoveToModalProps) {
  const [picked, setPicked] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    if (opened) setPicked(undefined);
  }, [opened]);

  return (
    <Modal opened={opened} onClose={onClose} title="Move to…" centered>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">{subtitle}</Text>
        <ScrollArea.Autosize mah={340} className="move-picker">
          <Stack gap={2}>
            <OptionRow id={null} name="Root" depth={0} blockedIds={blockedIds} currentParentId={currentParentId} picked={picked} onPick={setPicked} />
            {renderNodes(tree, 1, { blockedIds, currentParentId, picked, onPick: setPicked })}
          </Stack>
        </ScrollArea.Autosize>
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button loading={loading} disabled={picked === undefined} onClick={() => picked !== undefined && onConfirm(picked)}>
            Move here
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
