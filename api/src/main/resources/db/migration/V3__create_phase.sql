-- name is null only for the implicit phase of an initiative without named phases.
create table phase (
    id            uuid         primary key,
    initiative_id uuid         not null references initiative (id),
    name          varchar(200),
    is_implicit   boolean      not null default false,
    origin        varchar(16)  not null default 'native'
        constraint phase_origin_valid check (origin in ('native')),
    archived_at   timestamptz,
    deleted_at    timestamptz,
    created_at    timestamptz  not null default now(),
    updated_at    timestamptz  not null default now(),
    constraint phase_named_has_name check (is_implicit or btrim(name) <> '')
);

create index phase_initiative_id_idx on phase (initiative_id);

create unique index phase_one_implicit_per_initiative_idx on phase (initiative_id) where is_implicit;
