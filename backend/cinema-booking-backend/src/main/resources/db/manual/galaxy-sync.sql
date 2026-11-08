-- Apply once before deploying with ddl-auto=validate (production).
-- Development ddl-auto=update adds these columns automatically.
ALTER TABLE movies ADD COLUMN IF NOT EXISTS galaxy_movie_id varchar(100);
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS galaxy_cinema_id varchar(100);
ALTER TABLE showtimes ADD COLUMN IF NOT EXISTS galaxy_session_id varchar(100);
ALTER TABLE showtimes ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS uq_movies_galaxy_movie_id ON movies (galaxy_movie_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cinemas_galaxy_cinema_id ON cinemas (galaxy_cinema_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_showtimes_galaxy_session_id ON showtimes (galaxy_session_id);
