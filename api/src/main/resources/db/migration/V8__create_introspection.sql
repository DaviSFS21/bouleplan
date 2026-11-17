-- One weekly review sheet per user; answers keep the question text next to each answer.
create table introspection (
    id         uuid        primary key,
    user_id    uuid        not null references app_user (id),
    week_start date        not null,
    answers    jsonb       not null default '[]',
    closed_at  timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint introspection_user_week_key unique (user_id, week_start),
    constraint introspection_week_is_monday check (extract(isodow from week_start) = 1),
    constraint introspection_answers_is_array check (jsonb_typeof(answers) = 'array')
);
