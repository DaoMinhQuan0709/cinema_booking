import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useMoviePreview } from './hooks/useMovies';
import { MovieList } from './MovieList';

const TABS = [
  { key: 'NOW_SHOWING', label: 'Phim Đang Chiếu' },
  { key: 'COMING_SOON', label: 'Phim Sắp Chiếu' },
];

/**
 * Khoi hien thi phim o Trang chu: Tabs chuyen doi "Dang chieu" / "Sap chieu"
 * + luoi MovieList tuong ung. Goi ca 2 hook ngay tu dau (khong theo tab dang
 * active) de chuyen tab khong bi giat loading lai, du lieu da duoc cache boi
 * React Query (staleTime 5 phut) nen khong ton them request khi quay lai tab.
 */
export const MovieShowcase = () => {
  const [activeTab, setActiveTab] = useState('NOW_SHOWING');

  const nowShowing = useMoviePreview('NOW_SHOWING');
  const comingSoon = useMoviePreview('COMING_SOON');

  const current = activeTab === 'NOW_SHOWING' ? nowShowing : comingSoon;
  const isNowShowing = activeTab === 'NOW_SHOWING';

  return (
    <section className="mx-auto w-full max-w-[1440px] px-6 py-14 sm:px-10 lg:px-14">
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            {isNowShowing ? 'Đang Chiếu Tại Rạp' : 'Sắp Ra Mắt'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {isNowShowing
              ? 'Chọn phim yêu thích và đặt vé ngay hôm nay'
              : 'Đặt lịch chờ những bộ phim sắp khởi chiếu'}
          </p>
        </div>

        <div className="flex self-start rounded-xl border border-surfaceBorder bg-surface p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition-all ${activeTab === tab.key
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-neutral-400 hover:text-white'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {current.isError && (
        <button type="button" onClick={() => current.refetch()} className="mb-4 text-primary">
          Không tải được danh sách phim. Thử lại
        </button>
      )}
      <MovieList
        movies={current.data?.content.slice(0, 15) ?? []}
        isLoading={current.isLoading}
        skeletonCount={15}
        emptyMessage={
          isNowShowing
            ? 'Hiện chưa có phim đang chiếu nào được cập nhật.'
            : 'Hiện chưa có phim sắp chiếu nào được cập nhật.'
        }
      />
      {current.data?.content.length >= 15 && (
        <div className="mt-10 flex justify-center">
          <Link
            to={`/movies?status=${activeTab}`}
            className="group inline-flex items-center gap-3 rounded-xl border border-primary px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            Xem thêm
            <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
          </Link>
        </div>
      )}
    </section>
  );
};

export default MovieShowcase;
