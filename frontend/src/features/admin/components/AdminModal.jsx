import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { trapDialogFocus } from '../dialogFocus';

export default function AdminModal({ open, title, description, onClose, busy = false, children, footer }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const returnFocusTarget = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (returnFocusTarget?.isConnected) returnFocusTarget.focus();
    };
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    // Disabling the focused close/submit button can move focus to the document body.
    if (open && busy && dialog) dialog.focus();
  }, [open, busy]);

  if (!open) return null;
  const close = () => { if (!busy) onClose(); };
  return (
    <dialog ref={dialogRef} tabIndex={-1} closedby={busy ? 'none' : 'closerequest'} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} aria-busy={busy}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
        } else trapDialogFocus(event);
      }}
      onCancel={event => { event.preventDefault(); close(); }}
      onClick={event => { if (event.target === event.currentTarget) {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      } }}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-surfaceBorder bg-surface p-0 text-white shadow-2xl backdrop:bg-black/75">
      <header className="flex items-start justify-between gap-4 border-b border-surfaceBorder px-5 py-5 sm:px-7">
        <div>
          <h2 id={titleId} className="font-display text-xl font-bold">{title}</h2>
          {description && <p id={descriptionId} className="mt-2 text-sm text-muted">{description}</p>}
        </div>
        <button type="button" aria-label="Đóng hộp thoại" disabled={busy} onClick={close}
          className="shrink-0 rounded-lg p-2 text-muted hover:bg-white/5 hover:text-white disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </header>
      <div className="px-5 py-6 sm:px-7">{children}</div>
      {footer && <footer className="flex flex-wrap justify-end gap-3 border-t border-surfaceBorder px-5 py-4 sm:px-7">{footer}</footer>}
    </dialog>
  );
}
