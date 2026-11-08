import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Trich xuat YouTube video ID tu cac dang URL pho bien:
 * watch?v=, youtu.be/, embed/, shorts/
 */
function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

/**
 * Modal phat Trailer YouTube dang embed (autoplay). Khoa cuon trang khi mo,
 * dong bang phim ESC hoac click ra ngoai. Neu trailerUrl khong phai link
 * YouTube hop le, hien thong bao thay vi man hinh trang / iframe loi.
 *
 * @param {{ isOpen: boolean, onClose: () => void, trailerUrl?: string, title?: string }} props
 */
export const TrailerModal = ({ isOpen, onClose, trailerUrl, title }) => {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const videoId = extractYouTubeId(trailerUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
      {/* Lop nen bat su kien click outside */}
      <div className="fixed inset-0 cursor-pointer" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-4xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-11 right-0 p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="aspect-video w-full overflow-hidden rounded-xl border border-surfaceBorder bg-black shadow-2xl shadow-black/80">
          {videoId ? (
            <iframe
              key={videoId}
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              title={title ? `Trailer - ${title}` : 'Trailer phim'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-muted">
              Trailer hiện chưa khả dụng cho phim này.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrailerModal;
