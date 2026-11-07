-- "user" is a reserved word in PostgreSQL, hence app_user.
create table app_user (
    id         uuid         primary key,
    name       varchar(120) not null,
    email      varchar(254) unique,
    created_at timestamptz  not null default now(),
    updated_at timestamptz  not null default now()
);

-- No authentication in the MVP: every initiative belongs to this user.
insert into app_user (id, name) values ('00000000-0000-0000-0000-000000000001', 'Local user');
