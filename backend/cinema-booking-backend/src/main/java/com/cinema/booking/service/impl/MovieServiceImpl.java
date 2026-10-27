package com.cinema.booking.service.impl;

import com.cinema.booking.dto.request.MovieCreateRequest;
import com.cinema.booking.dto.response.MovieResponse;
import com.cinema.booking.dto.response.PageResponse;
import com.cinema.booking.entity.Movie;
import com.cinema.booking.enums.MovieStatus;
import com.cinema.booking.exception.ResourceNotFoundException;
import com.cinema.booking.repository.MovieRepository;
import com.cinema.booking.service.MovieService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class MovieServiceImpl implements MovieService {

    private final MovieRepository movieRepository;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<MovieResponse> getMovies(MovieStatus status, String genre, String keyword, Pageable pageable) {
        Specification<Movie> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (StringUtils.hasText(genre)) {
                predicates.add(cb.like(cb.lower(root.get("genre")), "%" + genre.toLowerCase() + "%"));
            }
            if (StringUtils.hasText(keyword)) {
                predicates.add(cb.like(cb.lower(root.get("title")), "%" + keyword.toLowerCase() + "%"));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Movie> moviePage = movieRepository.findAll(spec, pageable);
        return PageResponse.from(moviePage.map(this::mapToMovieResponse));
    }

    @Override
    @Transactional(readOnly = true)
    public MovieResponse getMovieById(Long id) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phim với ID: " + id));
        return mapToMovieResponse(movie);
    }

    @Override
    @Transactional
    public MovieResponse createMovie(MovieCreateRequest request) {
        Movie movie = Movie.builder()
                .title(request.getTitle().trim())
                .description(request.getDescription())
                .durationMinutes(request.getDurationMinutes())
                .releaseDate(request.getReleaseDate())
                .posterUrl(request.getPosterUrl())
                .trailerUrl(request.getTrailerUrl())
                .genre(request.getGenre())
                .ageRating(request.getAgeRating())
                .status(request.getStatus())
                .build();

        Movie savedMovie = movieRepository.save(movie);
        log.info("Created new movie with ID: {}", savedMovie.getId());
        return mapToMovieResponse(savedMovie);
    }

    private MovieResponse mapToMovieResponse(Movie movie) {
        return MovieResponse.builder()
                .id(movie.getId())
                .title(movie.getTitle())
                .description(movie.getDescription())
                .durationMinutes(movie.getDurationMinutes())
                .releaseDate(movie.getReleaseDate())
                .posterUrl(movie.getPosterUrl())
                .trailerUrl(movie.getTrailerUrl())
                .genre(movie.getGenre())
                .ageRating(movie.getAgeRating())
                .status(movie.getStatus())
                .createdAt(movie.getCreatedAt())
                .build();
    }
}