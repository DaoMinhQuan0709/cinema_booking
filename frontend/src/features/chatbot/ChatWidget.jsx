import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, MessageCircle, X } from 'lucide-react';

/**
 * Widget tro ly ao CineBot noi o goc duoi ben phai.
 * Phan nay moi gom: nut noi + cua so hoi thoai (mo/dong). Cac phan tiep theo:
 * cau hoi goi y, gui/nhan tin nhan (POST /api/v1/chat/ask), trang thai dang tra loi, xu ly loi.
 *
 * - Cua so luon duoc giu trong DOM (an bang visibility) de sau nay lich su hoi thoai
 *   khong bi mat moi lan dong/mo.
 * - Dong bang nut X, nut tren header hoac phim Escape; focus tra ve nut noi.
 * - Trang /checkout co thanh thanh toan co dinh o day man hinh dien thoai,
 *   nen nut noi duoc nang len de khong de len nut "Thanh toan".
 */
export const ChatWidget = () => {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const launcherRef = useRef(null);
  const panelRef = useRef(null);

  const hasBottomBar = pathname.startsWith('/checkout/');
  const bottomClass = hasBottomBar
    ? 'bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:bottom-6'
    : 'bottom-[calc(1.25rem+env(safe-area-inset-bottom))] sm:bottom-6';

  // Mo cua so -> chuyen focus vao cua so de nguoi dung ban phim/doc man hinh biet vi tri
  useEffect(() => {
    if (isOpen) panelRef.current?.focus();
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    launcherRef.current?.focus();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  };

  return (
    <div className={`pointer-events-none fixed right-3 z-40 flex flex-col items-end gap-3 sm:right-6 ${bottomClass}`}>
      {/* Cua so hoi thoai */}
      <section
        id="cinebot-panel"
        ref={panelRef}
        role="dialog"
        aria-label="Trợ lý CineBot"
        aria-hidden={!isOpen}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`flex h-[min(560px,calc(100dvh-10rem))] w-[calc(100vw-1.5rem)] max-w-[380px] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-surfaceBorder bg-surface shadow-2xl shadow-black/60 outline-none transition duration-200 motion-reduce:transition-none ${
          isOpen ? 'pointer-events-auto visible translate-y-0 scale-100 opacity-100' : 'invisible translate-y-3 scale-95 opacity-0'
        }`}
      >
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-surfaceBorder bg-background/60 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
            <Bot aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold leading-tight text-white">CineBot</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Trợ lý phim, lịch chiếu và giá vé
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Đóng cửa sổ CineBot"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>

        {/* Noi dung hoi thoai */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot aria-hidden="true" className="h-4 w-4" />
            </div>
            <p className="max-w-[85%] rounded-2xl rounded-tl-sm border border-surfaceBorder bg-background px-3.5 py-2.5 text-sm leading-relaxed text-neutral-200">
              Xin chào! Mình là CineBot. Mình có thể giúp bạn tìm phim, xem lịch chiếu và hỏi giá vé.
            </p>
          </div>
        </div>
      </section>

      {/* Nut noi */}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        aria-label={isOpen ? 'Đóng trợ lý CineBot' : 'Mở trợ lý CineBot'}
        aria-expanded={isOpen}
        aria-controls="cinebot-panel"
        className="pointer-events-auto flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 transition hover:bg-primaryHover hover:shadow-primary/60 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none"
      >
        {isOpen ? <X aria-hidden="true" className="h-6 w-6" /> : <MessageCircle aria-hidden="true" className="h-6 w-6" />}
      </button>
    </div>
  );
};

export default ChatWidget;
