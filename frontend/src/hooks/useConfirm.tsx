import React, { useCallback, useState } from 'react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

type Tone = 'info' | 'warning' | 'danger';

interface ConfirmOptions {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/**
 * Promise-based replacement for window.confirm.
 * Renders a styled ConfirmDialog and resolves true/false based on user choice.
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (!(await confirm({ title: 'Delete?', message: '...', tone: 'danger' }))) return;
 *   ...do destructive action...
 *
 *   return <>... {confirmDialog} </>;
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (!pending) return;
    setBusy(true);
    pending.resolve(true);
    setPending(null);
    setBusy(false);
  }, [pending]);

  const handleCancel = useCallback(() => {
    if (!pending || busy) return;
    pending.resolve(false);
    setPending(null);
  }, [pending, busy]);

  const confirmDialog = (
    <ConfirmDialog
      isOpen={!!pending}
      title={pending?.title || ''}
      message={pending?.message || ''}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      tone={pending?.tone || 'warning'}
      isConfirming={busy}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, confirmDialog };
}
