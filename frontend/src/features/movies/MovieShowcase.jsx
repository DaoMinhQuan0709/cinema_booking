import { useState } from 'react';
import { useNowShowingMovies, useComingSoonMovies } from './hooks/useMovies';
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

  const nowShowing = useNowShowingMovies();
  const comingSoon = useComingSoonMovies();

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
              className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <MovieList
        movies={current.data?.content ?? []}
        isLoading={current.isLoading}
        emptyMessage={
          isNowShowing
            ? 'Hiện chưa có phim đang chiếu nào được cập nhật.'
            : 'Hiện chưa có phim sắp chiếu nào được cập nhật.'
        }
      />
    </section>
  );
};

export default MovieShowcase;
