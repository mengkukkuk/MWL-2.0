import { useEffect, useState } from 'react';
import { Button, Checkbox, Group, Modal, Stack, Text } from '@mantine/core';

import type { StoredFile } from '../../types/api';

interface FileEditModalProps {
  file: StoredFile | null;
  onClose: () => void;
  onSave: (isClassified: boolean) => void;
  saving?: boolean;
}

export function FileEditModal({ file, onClose, onSave, saving }: FileEditModalProps) {
  const [isClassified, setIsClassified] = useState(false);

  useEffect(() => {
    if (file) setIsClassified(file.is_classified);
  }, [file]);

  return (
    <Modal opened={!!file} onClose={onClose} title="Edit file" centered>
      <Stack gap="md">
        <Text size="sm" fw={700}>{file?.original_name}</Text>
        <Checkbox label="Classified" description="Marks this file as restricted" checked={isClassified} onChange={(event) => setIsClassified(event.currentTarget.checked)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={() => onSave(isClassified)}>Save</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
