-- A day-list entry has no times and an order; a dedicated block has both times and no order.
create table scheduled_item (
    id         uuid        primary key,
    task_id    uuid        not null references task (id),
    date       date        not null,
    start_time time,
    end_time   time,
    sort_order integer,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint scheduled_item_kind check (
        (start_time is null and end_time is null and sort_order is not null)
        or (start_time is not null and end_time is not null and sort_order is null)),
    constraint scheduled_item_time_order check (start_time < end_time),
    constraint scheduled_item_quarter_hours check (
        extract(minute from start_time) in (0, 15, 30, 45)
        and extract(second from start_time) = 0
        and extract(minute from end_time) in (0, 15, 30, 45)
        and extract(second from end_time) = 0
        and end_time <= time '23:45')
);

create unique index scheduled_item_day_list_idx
    on scheduled_item (task_id, date) where start_time is null;

create index scheduled_item_date_idx on scheduled_item (date);

create index scheduled_item_task_id_idx on scheduled_item (task_id);
