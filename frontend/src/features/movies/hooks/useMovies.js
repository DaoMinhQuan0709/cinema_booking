import { useQuery } from '@tanstack/react-query';
import { movieService } from '../../../services/movieService';

/**
 * Query keys tap trung, tranh viet tay rai rac gay sai lech cache.
 */
export const movieKeys = {
    all: ['movies'],
    list: (params) => [...movieKeys.all, 'list', params],
    detail: (id) => [...movieKeys.all, 'detail', String(id)],
};

function useMovieList(queryParams) {
    return useQuery({
        queryKey: movieKeys.list(queryParams),
        queryFn: () => movieService.getMovies(queryParams),
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Danh sach phim DANG CHIEU (Trang chu - Tab "Phim Dang Chieu").
 * Mac dinh sap xep theo ngay khoi chieu moi nhat truoc.
 * @param {Object} [params] co the ghi de size/sort/genre/keyword...
 */
export function useNowShowingMovies(params = {}) {
    const queryParams = { status: 'NOW_SHOWING', size: 12, sort: 'releaseDate,desc', ...params };

    return useMovieList(queryParams);
}

/**
 * Danh sach phim SAP CHIEU (Trang chu - Tab "Phim Sap Chieu").
 * Mac dinh sap xep theo ngay khoi chieu gan nhat truoc.
 * @param {Object} [params]
 */
export function useComingSoonMovies(params = {}) {
    const queryParams = { status: 'COMING_SOON', size: 12, sort: 'releaseDate,asc', ...params };

    return useMovieList(queryParams);
}

/**
 * Chi tiet 1 phim theo ID (Trang chi tiet phim /movies/:id).
 * Tu dong khong goi API neu id rong/null (vd dang cho router resolve param).
 * @param {number|string} id
 */
export function useMovieDetail(id) {
    return useQuery({
        queryKey: movieKeys.detail(id),
        queryFn: () => movieService.getMovieById(id),
        enabled: Boolean(id),
    });
}
