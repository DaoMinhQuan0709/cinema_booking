package com.cinema.booking.repository;

import com.cinema.booking.entity.Movie;
import com.cinema.booking.enums.MovieStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MovieRepository extends JpaRepository<Movie, Long>, JpaSpecificationExecutor<Movie> {

    List<Movie> findByStatus(MovieStatus status);

    java.util.Optional<Movie> findByTitle(String title);

    java.util.Optional<Movie> findByGalaxyMovieId(String galaxyMovieId);

    List<Movie> findByGalaxyMovieIdIsNotNull();
}
