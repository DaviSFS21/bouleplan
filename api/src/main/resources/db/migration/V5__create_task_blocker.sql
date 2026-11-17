create table task_blocker (
    blocking_task_id uuid        not null references task (id),
    blocked_task_id  uuid        not null references task (id),
    created_at       timestamptz not null default now(),
    primary key (blocking_task_id, blocked_task_id),
    constraint task_blocker_not_self check (blocking_task_id <> blocked_task_id)
);

create index task_blocker_blocked_task_id_idx on task_blocker (blocked_task_id);
