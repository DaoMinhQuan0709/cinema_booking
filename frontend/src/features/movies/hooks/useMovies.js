import { useQuery } from '@tanstack/react-query';
import { movieService } from '../../../services/movieService';

/**
 * Query keys tap trung, tranh viet tay rai rac gay sai lech cache.
 */
export const movieKeys = {
    all: ['movies'],
    list: (params) => [...movieKeys.all, 'list', params],
    preview: (params) => [...movieKeys.all, 'preview', params],
    detail: (id) => [...movieKeys.all, 'detail', String(id)],
};

function useMovieList(queryParams) {
    return useQuery({
        queryKey: movieKeys.list(queryParams),
        queryFn: () => movieService.getAllMovies(queryParams),
        staleTime: 5 * 60 * 1000,
        refetchInterval: 5 * 60 * 1000,
    });
}

/** Fetch only one page for home previews and related movies. */
export function useMoviePreview(status, size = 15) {
    const params = {
        status,
        page: 0,
        size,
        sort: status === 'COMING_SOON' ? 'releaseDate,asc' : 'releaseDate,desc',
    };
    return useQuery({
        queryKey: movieKeys.preview(params),
        queryFn: () => movieService.getMovies(params),
        staleTime: 5 * 60 * 1000,
        refetchInterval: 5 * 60 * 1000,
    });
}

/**
 * Danh sach phim DANG CHIEU (Trang chu - Tab "Phim Dang Chieu").
 * Mac dinh sap xep theo ngay khoi chieu moi nhat truoc.
 * @param {Object} [params] co the ghi de size/sort/genre/keyword...
 */
export function useNowShowingMovies(params = {}) {
    const queryParams = { status: 'NOW_SHOWING', size: 100, sort: 'releaseDate,desc', ...params };

    return useMovieList(queryParams);
}

/**
 * Danh sach phim SAP CHIEU (Trang chu - Tab "Phim Sap Chieu").
 * Mac dinh sap xep theo ngay khoi chieu gan nhat truoc.
 * @param {Object} [params]
 */
export function useComingSoonMovies(params = {}) {
    const queryParams = { status: 'COMING_SOON', size: 100, sort: 'releaseDate,asc', ...params };

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
        staleTime: 60 * 1000,
        refetchInterval: 60 * 1000,
    });
}
