import { useEffect, useState } from 'react';
import { Button, Checkbox, Group, Modal, Stack, TextInput } from '@mantine/core';

import type { FileFolder } from '../../types/api';

interface FolderEditModalProps {
  folder: FileFolder | null;
  onClose: () => void;
  onSave: (name: string, isClassified: boolean) => void;
  saving?: boolean;
}

export function FolderEditModal({ folder, onClose, onSave, saving }: FolderEditModalProps) {
  const [name, setName] = useState('');
  const [isClassified, setIsClassified] = useState(false);

  useEffect(() => {
    if (folder) {
      setName(folder.name);
      setIsClassified(folder.is_classified);
    }
  }, [folder]);

  return (
    <Modal opened={!!folder} onClose={onClose} title="Edit folder" centered>
      <Stack gap="md">
        <TextInput label="Folder name" value={name} onChange={(event) => setName(event.currentTarget.value)} autoFocus required />
        <Checkbox label="Classified" description="Marks this folder as restricted" checked={isClassified} onChange={(event) => setIsClassified(event.currentTarget.checked)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!name.trim()} onClick={() => onSave(name.trim(), isClassified)}>Save</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
