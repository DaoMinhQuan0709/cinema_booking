-- Apply once before deploying with ddl-auto=validate (production).
-- Development ddl-auto=update adds these columns automatically.
ALTER TABLE movies ADD COLUMN IF NOT EXISTS galaxy_movie_id varchar(100);
ALTER TABLE movies ADD COLUMN IF NOT EXISTS galaxy_slug varchar(255);
ALTER TABLE movies ADD COLUMN IF NOT EXISTS landscape_url varchar(500);
ALTER TABLE movies ADD COLUMN IF NOT EXISTS country varchar(255);
ALTER TABLE movies ADD COLUMN IF NOT EXISTS directors jsonb;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS actors jsonb;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS galaxy_details_synced_at timestamptz;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS galaxy_details_attempt_at timestamptz;
ALTER TABLE movies ALTER COLUMN genre TYPE varchar(500);
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS galaxy_cinema_id varchar(100);
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS site_id varchar(100);
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS slug varchar(255);
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS galaxy_city_id varchar(100);
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS latitude numeric(20,17);
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS longitude numeric(20,17);
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS phone varchar(50);
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS image_landscape varchar(1000);
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS image_portrait varchar(1000);
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS image_urls jsonb;
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS cinema_type varchar(50);
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS display_order integer;
ALTER TABLE showtimes ADD COLUMN IF NOT EXISTS galaxy_session_id varchar(100);
ALTER TABLE showtimes ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS uq_movies_galaxy_movie_id ON movies (galaxy_movie_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cinemas_galaxy_cinema_id ON cinemas (galaxy_cinema_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_showtimes_galaxy_session_id ON showtimes (galaxy_session_id);
