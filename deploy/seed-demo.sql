BEGIN;

-- Serialize repeat runs of this seed while preserving existing bookings and slots.
SELECT pg_advisory_xact_lock(hashtext('cinema-demo-catalog'));

DO $$
DECLARE
    demo_movie bigint;
    demo_cinema bigint;
    demo_room bigint;
    now_in_vietnam timestamp := clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh';
BEGIN
    SELECT id INTO demo_movie FROM movies
    WHERE title = 'Cinema Booking Demo' AND galaxy_movie_id IS NULL AND deleted_at IS NULL
    ORDER BY id LIMIT 1;
    IF demo_movie IS NULL THEN
        INSERT INTO movies (title, description, duration_minutes, release_date, status, created_at, age_rating)
        VALUES ('Cinema Booking Demo', 'Suất chiếu mô phỏng để kiểm thử đặt vé và thanh toán Sandbox.',
                105, now_in_vietnam::date - 1, 'NOW_SHOWING', now_in_vietnam, 'P')
        RETURNING id INTO demo_movie;
    END IF;

    SELECT id INTO demo_cinema FROM cinemas
    WHERE slug = 'cinema-booking-demo' AND galaxy_cinema_id IS NULL ORDER BY id LIMIT 1;
    IF demo_cinema IS NULL THEN
        INSERT INTO cinemas (slug, name, address, city)
        VALUES ('cinema-booking-demo', 'Rạp Cinema Booking Demo', 'Địa chỉ mô phỏng', 'Hồ Chí Minh')
        RETURNING id INTO demo_cinema;
    END IF;

    SELECT id INTO demo_room FROM auditoriums
    WHERE cinema_id = demo_cinema AND name = 'Phòng Demo 01' ORDER BY id LIMIT 1;
    IF demo_room IS NULL THEN
        INSERT INTO auditoriums (cinema_id, name, total_rows, total_cols)
        VALUES (demo_cinema, 'Phòng Demo 01', 8, 10)
        RETURNING id INTO demo_room;
    END IF;

    INSERT INTO showtimes (movie_id, auditorium_id, start_time, end_time, base_price)
    SELECT demo_movie, demo_room, slot.starts_at, slot.starts_at + interval '2 hours', 89000
    FROM generate_series(0, 6) AS day_offset
    CROSS JOIN (VALUES (time '17:30'), (time '20:30')) AS screening(start_time)
    CROSS JOIN LATERAL (SELECT now_in_vietnam::date + day_offset + screening.start_time AS starts_at) AS slot
    WHERE slot.starts_at > now_in_vietnam + interval '30 minutes'
      AND NOT EXISTS (
          SELECT 1 FROM showtimes
          WHERE auditorium_id = demo_room AND start_time = slot.starts_at
      );
END $$;

COMMIT;
