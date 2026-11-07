-- varchar + check instead of PostgreSQL enums: altering an enum type is harder in later migrations.
create table initiative (
    id               uuid         primary key,
    user_id          uuid         not null references app_user (id),
    name             varchar(200) not null
        constraint initiative_name_not_blank check (btrim(name) <> ''),
    description      text,
    overall_deadline date,
    color            varchar(16)  not null constraint initiative_color_valid check (
        color in ('amarelo', 'lima', 'verde', 'turquesa', 'azul', 'roxo', 'rosa', 'marrom')),
    origin           varchar(16)  not null default 'native'
        constraint initiative_origin_valid check (origin in ('native')),
    archived_at      timestamptz,
    deleted_at       timestamptz,
    created_at       timestamptz  not null default now(),
    updated_at       timestamptz  not null default now()
);

create index initiative_user_id_idx on initiative (user_id);
