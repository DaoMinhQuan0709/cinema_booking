import { useId, useRef, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCinemaGallerySources } from './cinemaUtils';

const FOCUS_CLASS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const GalleryContent = ({ sources, name }) => {
  const [selectedSource, setSelectedSource] = useState(null);
  const [failedSources, setFailedSources] = useState([]);
  const gesture = useRef(null);
  const instructionId = useId();
  const images = sources.filter(source => !failedSources.includes(source));
  const index = Math.max(0, images.indexOf(selectedSource));
  const multiple = images.length > 1;
  const select = next => setSelectedSource(images[(next + images.length) % images.length]);
  const fail = source => setFailedSources(previous => previous.includes(source) ? previous : [...previous, source]);

  const onKeyDown = event => {
    if (!multiple || event.altKey || event.ctrlKey || event.metaKey) return;
    const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: images.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  };

  const onPointerDown = event => {
    if (!multiple || !event.isPrimary || event.button !== 0 || event.target.closest('button')) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerUp = event => {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    gesture.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (multiple && Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.5) select(index + (dx < 0 ? 1 : -1));
  };

  const slides = images.length ? [
    ...(multiple ? [{ position: 'previous', source: images[(index - 1 + images.length) % images.length] }] : []),
    { position: 'current', source: images[index] },
    ...(multiple ? [{ position: 'next', source: images[(index + 1) % images.length] }] : []),
  ] : [];

  return (
    <section aria-label={`Hình ảnh ${name}`} aria-roledescription="carousel" onKeyDown={onKeyDown} className="mb-10 min-w-0 sm:mb-12">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Không gian rạp</h2>
        <p role="status" aria-live="polite" aria-atomic="true" className="text-xs tabular-nums text-muted">
          {images.length > 0 && <><span className="sr-only">Ảnh </span><span className="font-semibold text-white">{String(index + 1).padStart(2, '0')}</span><span aria-hidden="true"> / </span><span className="sr-only"> trên </span>{String(images.length).padStart(2, '0')}</>}
        </p>
      </div>

      {multiple && <p id={instructionId} className="sr-only">Dùng phím mũi tên trái, phải để chuyển ảnh; Home, End để đến ảnh đầu, cuối. Có thể vuốt ngang trên ảnh.</p>}
      <div
        role="group"
        aria-label="Ảnh rạp"
        aria-describedby={multiple ? instructionId : undefined}
        tabIndex={multiple ? 0 : undefined}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { gesture.current = null; }}
        onLostPointerCapture={() => { gesture.current = null; }}
        style={{ touchAction: 'pan-y pinch-zoom' }}
        className={`relative isolate aspect-video select-none overflow-hidden rounded-xl bg-background lg:aspect-[20/9] ${FOCUS_CLASS}`}
      >
        {slides.length ? slides.map(({ position, source }) => {
          const current = position === 'current';
          const placement = current ? 'left-0' : position === 'previous' ? '-translate-x-[calc(100%+1rem)]' : 'translate-x-[calc(100%+1rem)]';
          return (
            <div
              key={`${position}:${source}`}
              role={current ? 'group' : undefined}
              aria-roledescription={current ? 'slide' : undefined}
              aria-label={current ? `${index + 1} / ${images.length}` : undefined}
              aria-hidden={current ? undefined : true}
              className={`absolute inset-y-0 w-full overflow-hidden rounded-xl border border-surfaceBorder bg-surface ${placement} ${multiple ? 'lg:left-[10%] lg:w-4/5' : ''} ${current ? '' : 'hidden opacity-40 lg:block'}`}
            >
              <img
                src={source}
                alt={current ? `Không gian ${name}, ảnh ${index + 1}` : ''}
                width="1280"
                height="720"
                loading={current ? 'eager' : 'lazy'}
                decoding="async"
                draggable={false}
                onError={() => fail(source)}
                className="h-full w-full object-cover"
              />
            </div>
          );
        }) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-surfaceBorder bg-surface/30 px-5 text-center text-muted">
            <Building2 aria-hidden="true" strokeWidth={1} className="h-12 w-12" />
            <p role="status" className="text-sm">{sources.length ? 'Chưa tải được ảnh rạp' : 'Ảnh rạp đang cập nhật'}</p>
          </div>
        )}

        {multiple && <>
          <button type="button" onClick={() => select(index - 1)} aria-label="Ảnh trước" className={`absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-surfaceBorder bg-background/90 text-white transition-colors hover:border-primary hover:bg-primary sm:left-5 ${FOCUS_CLASS}`}>
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => select(index + 1)} aria-label="Ảnh tiếp theo" className={`absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-surfaceBorder bg-background/90 text-white transition-colors hover:border-primary hover:bg-primary sm:right-5 ${FOCUS_CLASS}`}>
            <ChevronRight aria-hidden="true" className="h-5 w-5" />
          </button>
        </>}
      </div>

      {multiple && (
        <div role="group" aria-label="Chọn ảnh rạp" className="mt-2 flex flex-wrap justify-center">
          {images.map((source, slideIndex) => (
            <button key={source} type="button" onClick={() => select(slideIndex)} aria-label={`Xem ảnh ${slideIndex + 1}`} aria-current={slideIndex === index ? 'true' : undefined} className={`flex h-11 w-11 items-center justify-center rounded-full ${FOCUS_CLASS}`}>
              <span aria-hidden="true" className={`h-1.5 rounded-full transition-colors ${slideIndex === index ? 'w-6 bg-primary' : 'w-1.5 bg-muted'}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

const CinemaGallery = ({ cinema }) => {
  const sources = getCinemaGallerySources(cinema);
  // Remount when the cinema or its images change, clearing selection and failed URLs together.
  return <GalleryContent key={JSON.stringify([cinema.id, sources])} sources={sources} name={cinema.name?.trim() || 'rạp chiếu phim'} />;
};

export default CinemaGallery;
