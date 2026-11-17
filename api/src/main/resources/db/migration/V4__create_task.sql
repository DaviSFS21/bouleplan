-- description is capped at 10000 characters by the domain.
create table task (
    id                 uuid          primary key,
    phase_id           uuid          not null references phase (id),
    title              varchar(300)  not null
        constraint task_title_not_blank check (btrim(title) <> ''),
    description        text,
    deadline           date,
    estimated_effort   numeric(6, 2)
        constraint task_effort_valid check (estimated_effort > 0 and estimated_effort <= 999),
    priority           varchar(2)    not null default 'P2'
        constraint task_priority_valid check (priority in ('P1', 'P2', 'P3')),
    status             varchar(16)   not null default 'to_do'
        constraint task_status_valid check (status in ('to_do', 'in_progress', 'done')),
    is_blocked         boolean       not null default false,
    planned_week_start date
        constraint task_planned_week_is_monday check (extract(isodow from planned_week_start) = 1),
    origin             varchar(16)   not null default 'native'
        constraint task_origin_valid check (origin in ('native')),
    archived_at        timestamptz,
    deleted_at         timestamptz,
    created_at         timestamptz   not null default now(),
    updated_at         timestamptz   not null default now()
);

create index task_phase_id_idx on task (phase_id);
