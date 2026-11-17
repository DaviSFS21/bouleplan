-- Fixed commitments; google_event_id stays null until the calendar sync exists.
create table calendar_event (
    id              uuid         primary key,
    user_id         uuid         not null references app_user (id),
    google_event_id varchar(255),
    title           varchar(300) not null
        constraint calendar_event_title_not_blank check (btrim(title) <> ''),
    date            date         not null,
    start_time      time         not null,
    end_time        time         not null,
    created_at      timestamptz  not null default now(),
    updated_at      timestamptz  not null default now(),
    constraint calendar_event_time_order check (start_time < end_time),
    constraint calendar_event_quarter_hours check (
        extract(minute from start_time) in (0, 15, 30, 45)
        and extract(second from start_time) = 0
        and extract(minute from end_time) in (0, 15, 30, 45)
        and extract(second from end_time) = 0
        and end_time <= time '23:45')
);

create unique index calendar_event_google_event_id_idx
    on calendar_event (google_event_id) where google_event_id is not null;

create index calendar_event_user_id_date_idx on calendar_event (user_id, date);
