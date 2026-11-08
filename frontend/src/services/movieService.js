import axiosInstance from '../config/axiosInstance';

/**
 * Service goi API lien quan Catalog - Phim (Movie).
 * Khop MovieController.java: GET /movies (loc status/genre/keyword, phan trang),
 * GET /movies/{id}. Tat ca request di qua axiosInstance, da tu dong unwrap
 * ApiResponse<T> nen ham o day chi can tra thang ve phan "data".
 */
export const movieService = {
    /**
     * Lay danh sach phim co phan trang va loc.
     * @param {Object} [params]
     * @param {'NOW_SHOWING'|'COMING_SOON'|'ENDED'} [params.status]
     * @param {string} [params.genre]
     * @param {string} [params.keyword]
     * @param {number} [params.page=0]
     * @param {number} [params.size=10]
     * @param {string} [params.sort] vd: 'releaseDate,desc'
     * @returns {Promise<{content: object[], pageNo: number, pageSize: number, totalElements: number, totalPages: number, last: boolean}>}
     */
    getMovies: async (params = {}) => {
        const { data } = await axiosInstance.get('/movies', { params });
        return data;
    },

    // Collect every API page so the showcase has no display limit.
    getAllMovies: async (params = {}) => {
        const first = await movieService.getMovies({ ...params, page: 0 });
        const content = [...first.content];
        for (let page = 1; page < first.totalPages; page += 1) {
            const next = await movieService.getMovies({ ...params, page });
            content.push(...next.content);
        }
        return { ...first, content };
    },

    /**
     * Lay chi tiet 1 phim theo ID (kem trailer, mo ta day du).
     * @param {number|string} id
     */
    getMovieById: async (id) => {
        const { data } = await axiosInstance.get(`/movies/${id}`);
        return data;
    },
};

export default movieService;