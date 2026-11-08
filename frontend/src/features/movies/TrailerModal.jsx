import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { getYouTubeVideoId } from './trailerUtils';

export const TrailerModal = ({ isOpen, onClose, trailerUrl, title }) => {
  const dialogRef = useRef(null);
  const titleId = useId();
  const videoId = getYouTubeVideoId(trailerUrl);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none items-center justify-center bg-black/85 px-4 py-16 text-white backdrop:bg-black/40 open:flex sm:px-6"
    >
      <div className="relative w-full max-w-4xl">
        <h2 id={titleId} className="sr-only">{title ? `Trailer - ${title}` : 'Trailer phim'}</h2>
        <button type="button" onClick={onClose} aria-label="Đóng trailer" autoFocus className="absolute -top-12 right-0 rounded-lg p-2 text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <X aria-hidden="true" className="h-6 w-6" />
        </button>
        <div className="aspect-video overflow-hidden rounded-xl border border-surfaceBorder bg-black shadow-2xl">
          {videoId ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
              title={title ? `Trailer - ${title}` : 'Trailer phim'}
              allow="autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="h-full w-full"
            />
          ) : <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">Trailer hiện chưa khả dụng cho phim này.</div>}
        </div>
      </div>
    </dialog>
  );
};

export default TrailerModal;
