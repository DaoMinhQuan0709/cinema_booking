import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, MapPin, Phone, RefreshCw } from 'lucide-react';
import { useCinemaDetail } from './hooks/useCinemaDetail';
import CinemaGallery from './CinemaGallery';
import { getCinemaCity, getCinemaDetailHref, getCinemaPhoneHref } from './cinemaUtils';

const FOCUS_CLASS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';

const RetryButton = ({ query }) => (
  <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-50 ${FOCUS_CLASS}`}>
    <RefreshCw aria-hidden="true" className={`h-4 w-4 ${query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} />
    Thử lại
  </button>
);

const CinemaDetailSkeleton = () => (
  <div role="status" className="space-y-6 border-l-4 border-primary pl-5 motion-safe:animate-pulse sm:pl-7">
    <h1 className="sr-only">Đang tải thông tin rạp…</h1>
    <div aria-hidden="true" className="h-4 w-32 rounded bg-surface" />
    <div aria-hidden="true" className="h-12 w-3/4 rounded bg-surface" />
    <div aria-hidden="true" className="h-6 w-full max-w-xl rounded bg-surface" />
    <div aria-hidden="true" className="h-6 w-40 rounded bg-surface" />
  </div>
);

const CinemaDetailPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const query = useCinemaDetail(id);
  const validId = Boolean(getCinemaDetailHref(id));
  const notFound = !validId || query.error?.response?.status === 404;
  const cinema = validId && String(query.data?.id) === id ? query.data : null;
  const phoneHref = cinema ? getCinemaPhoneHref(cinema.phone) : null;
  // Router state preserves the list's filters without making a shared detail URL depend on them.
  const listHref = { pathname: '/cinemas', search: typeof location.state?.cinemasSearch === 'string' ? location.state.cinemasSearch : '' };

  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-8 sm:px-10 sm:pb-24 lg:px-14">
      <nav aria-label="Đường dẫn" className="mb-10 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs leading-relaxed text-muted">
        <Link to="/" className={`rounded hover:text-white ${FOCUS_CLASS}`}>Trang chủ</Link>
        <ArrowRight aria-hidden="true" className="h-3 w-3 shrink-0" />
        <Link to={listHref} className={`rounded hover:text-white ${FOCUS_CLASS}`}>Rạp chiếu phim</Link>
        <ArrowRight aria-hidden="true" className="h-3 w-3 shrink-0" />
        <span aria-current="page" className="min-w-0 break-words text-white">{notFound ? 'Không tìm thấy rạp' : cinema?.name || 'Thông tin rạp'}</span>
      </nav>

      {notFound ? (
        <section aria-labelledby="cinema-detail-error" className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-surfaceBorder px-5 py-16 text-center">
          <Building2 aria-hidden="true" strokeWidth={1.5} className="h-10 w-10 text-muted" />
          <h1 id="cinema-detail-error" className="text-2xl font-bold text-white">Không tìm thấy rạp</h1>
          <p className="max-w-md text-sm leading-relaxed text-muted">Rạp không tồn tại hoặc không còn khả dụng. Bạn hãy chọn rạp khác trong danh sách.</p>
        </section>
      ) : query.isPending ? <CinemaDetailSkeleton /> : !cinema ? (
        <section role="alert" className="flex flex-col items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-16 text-center">
          <Building2 aria-hidden="true" strokeWidth={1.5} className="h-10 w-10 text-muted" />
          <h1 className="text-2xl font-bold text-white">Không tải được thông tin rạp</h1>
          <p className="max-w-md text-sm leading-relaxed text-muted">Thông tin rạp tạm thời chưa tải được. Vui lòng thử lại.</p>
          <RetryButton query={query} />
        </section>
      ) : (
        <>
          {query.isError && (
            <div role="alert" className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5">
              <p className="max-w-2xl text-sm leading-relaxed text-white">Chưa thể làm mới thông tin rạp. Đang hiển thị dữ liệu đã tải trước đó.</p>
              <RetryButton query={query} />
            </div>
          )}
          <CinemaGallery cinema={cinema} />
          <header className="border-b border-surfaceBorder pb-10 sm:pb-12">
            <div className="border-l-4 border-primary pl-5 sm:pl-7">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">{getCinemaCity(cinema)}</p>
              <h1 className="break-words font-display text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">{cinema.name?.trim() || 'Thông tin rạp'}</h1>
              <div className="mt-6 flex max-w-3xl items-start gap-3 text-sm leading-relaxed text-muted sm:text-base">
                <MapPin aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <p className="min-w-0 break-words">{cinema.address?.trim() || 'Địa chỉ đang cập nhật'}</p>
              </div>
              <div className="mt-4 flex items-start gap-3 text-sm leading-relaxed text-muted sm:text-base">
                <Phone aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <p className="min-w-0 break-words">{phoneHref ? <>Hotline: <a href={phoneHref} className={`rounded text-white hover:text-primary ${FOCUS_CLASS}`}>{cinema.phone}</a></> : 'Điện thoại đang cập nhật'}</p>
              </div>
            </div>
          </header>
        </>
      )}

      <Link to={listHref} className={`mt-8 inline-flex min-h-11 items-center gap-2 rounded text-sm font-semibold text-muted hover:text-white ${FOCUS_CLASS}`}>
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />Về danh sách rạp
      </Link>
    </div>
  );
};

export default CinemaDetailPage;
