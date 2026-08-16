import type { DragEvent } from 'react';
import { ActionIcon, Group, Menu, Text } from '@mantine/core';
import {
  IconChevronRight,
  IconDots,
  IconEdit,
  IconFolder,
  IconFolderOpen,
  IconLock,
  IconTrash,
  IconArrowsMove,
} from '@tabler/icons-react';

import type { FolderNode } from '../../types/api';

export interface FolderTreeCallbacks {
  onSelect: (id: number | null) => void;
  onToggleCollapse: (id: number) => void;
  canDrop: (folderId: number | null) => boolean;
  onDragEnterTarget: (folderId: number | null) => void;
  onDragLeaveTarget: (folderId: number | null) => void;
  onDropTarget: (folderId: number | null) => void;
  onDragStartFolder: (event: DragEvent, folderId: number) => void;
  onDragEndFolder: () => void;
  onOpenFolder: (id: number) => void;
  onMoveFolder: (id: number) => void;
  onEditFolder: (id: number) => void;
  onDeleteFolder: (id: number) => void;
}

interface FolderTreeProps extends FolderTreeCallbacks {
  tree: FolderNode[];
  selectedId: number | null;
  collapsed: Set<number>;
  canManage: boolean;
  dropTargetId: number | null | undefined;
}

interface RowProps extends FolderTreeCallbacks {
  id: number | null;
  name: string;
  depth: number;
  active: boolean;
  isClassified?: boolean;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  canManage: boolean;
  isDropTarget: boolean;
}

function TreeRow({
  id,
  name,
  depth,
  active,
  isClassified,
  hasChildren,
  isCollapsed,
  canManage,
  isDropTarget,
  onSelect,
  onToggleCollapse,
  canDrop,
  onDragEnterTarget,
  onDragLeaveTarget,
  onDropTarget,
  onDragStartFolder,
  onDragEndFolder,
  onOpenFolder,
  onMoveFolder,
  onEditFolder,
  onDeleteFolder,
}: RowProps) {
  const draggable = canManage && id != null;
  return (
    <div
      className={`folder-tree-item${isDropTarget ? ' drop-target' : ''}`}
      data-active={active ? 'true' : undefined}
      style={{ paddingLeft: 8 + depth * 14 }}
      draggable={draggable}
      onDragStart={draggable ? (event) => onDragStartFolder(event, id as number) : undefined}
      onDragEnd={draggable ? onDragEndFolder : undefined}
      onDragOver={(event) => {
        if (!canDrop(id)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDragEnter={(event) => {
        if (!canDrop(id)) return;
        event.preventDefault();
        onDragEnterTarget(id);
      }}
      onDragLeave={() => onDragLeaveTarget(id)}
      onDrop={(event) => {
        if (!canDrop(id)) return;
        event.preventDefault();
        event.stopPropagation();
        onDropTarget(id);
      }}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(id); }
      }}
    >
      {hasChildren ? (
        <ActionIcon
          size="xs"
          variant="subtle"
          color="gray"
          className="folder-tree-toggle"
          data-collapsed={isCollapsed ? 'true' : 'false'}
          onClick={(event) => { event.stopPropagation(); if (id != null) onToggleCollapse(id); }}
          aria-label={isCollapsed ? 'Expand' : 'Collapse'}
        >
          <IconChevronRight size={13} />
        </ActionIcon>
      ) : (
        <span className="folder-tree-toggle-spacer" />
      )}
      <IconFolder size={16} className="folder-tree-icon" />
      <Text size="sm" fw={active ? 700 : 500} className="folder-tree-label" lineClamp={1}>{name}</Text>
      {isClassified && <IconLock size={13} color="var(--mantine-color-orange-6)" />}
      {canManage && id != null && (
        <Menu withinPortal position="right-start" shadow="md" width={170}>
          <Menu.Target>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              className="folder-tree-menu-btn"
              onClick={(event) => event.stopPropagation()}
              aria-label="More actions"
            >
              <IconDots size={15} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
            <Menu.Item leftSection={<IconFolderOpen size={15} />} onClick={() => onOpenFolder(id)}>Open</Menu.Item>
            <Menu.Item leftSection={<IconArrowsMove size={15} />} onClick={() => onMoveFolder(id)}>Move to…</Menu.Item>
            <Menu.Item leftSection={<IconEdit size={15} />} onClick={() => onEditFolder(id)}>Edit</Menu.Item>
            <Menu.Divider />
            <Menu.Item color="red" leftSection={<IconTrash size={15} />} onClick={() => onDeleteFolder(id)}>Delete</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
    </div>
  );
}

function renderNodes(nodes: FolderNode[], depth: number, ctx: {
  selectedId: number | null;
  collapsed: Set<number>;
  canManage: boolean;
  dropTargetId: number | null | undefined;
  callbacks: FolderTreeCallbacks;
}) {
  return nodes.flatMap((node) => {
    const hasChildren = node.children.length > 0;
    const isCollapsed = hasChildren && ctx.collapsed.has(node.id);
    const rows = [
      <TreeRow
        key={node.id}
        id={node.id}
        name={node.name}
        depth={depth}
        active={ctx.selectedId === node.id}
        isClassified={node.is_classified}
        hasChildren={hasChildren}
        isCollapsed={isCollapsed}
        canManage={ctx.canManage}
        isDropTarget={ctx.dropTargetId === node.id}
        {...ctx.callbacks}
      />,
    ];
    if (!isCollapsed) rows.push(...renderNodes(node.children, depth + 1, ctx));
    return rows;
  });
}

export function FolderTree({ tree, selectedId, collapsed, canManage, dropTargetId, ...callbacks }: FolderTreeProps) {
  return (
    <Group gap={2} className="folder-tree-list" wrap="nowrap" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <TreeRow
        id={null}
        name="All files"
        depth={0}
        active={selectedId === null}
        canManage={canManage}
        isDropTarget={dropTargetId === null}
        {...callbacks}
      />
      {renderNodes(tree, 1, { selectedId, collapsed, canManage, dropTargetId, callbacks })}
    </Group>
  );
}
