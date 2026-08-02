import { useCallback, useState } from 'react';

export type ConfirmState =
  | { isOpen: false }
  | {
      isOpen: true;
      title: string;
      description?: string;
      danger?: boolean;
      confirmLabel?: string;
      cancelLabel?: string;
      onConfirm: () => void;
      onCancel?: () => void;
    };

/**
 * useConfirmModal manages the state of the confirmation modal.
 */
export function useConfirmModal(): {
  confirmState: ConfirmState;
  openConfirm: (
    title: string,
    onConfirm: () => void,
    opts?: {
      description?: string;
      danger?: boolean;
      confirmLabel?: string;
      cancelLabel?: string;
      onCancel?: () => void;
    },
  ) => void;
  closeConfirm: () => void;
} {
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
  });

  const openConfirm = useCallback(
    (
      title: string,
      onConfirm: () => void,
      opts?: {
        description?: string;
        danger?: boolean;
        confirmLabel?: string;
        cancelLabel?: string;
        onCancel?: () => void;
      },
    ) => {
      setConfirmState({ isOpen: true, title, onConfirm, ...opts });
    },
    [],
  );

  const closeConfirm = useCallback(() => {
    setConfirmState({ isOpen: false });
  }, []);

  return {
    confirmState,
    openConfirm,
    closeConfirm,
  };
}
