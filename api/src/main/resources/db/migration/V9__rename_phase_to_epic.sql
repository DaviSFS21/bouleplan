alter table phase rename to epic;
alter table task rename column phase_id to epic_id;

alter table epic rename constraint phase_pkey to epic_pkey;
alter table epic rename constraint phase_initiative_id_fkey to epic_initiative_id_fkey;
alter table epic rename constraint phase_origin_valid to epic_origin_valid;
alter table epic rename constraint phase_name_matches_kind to epic_name_matches_kind;
alter table task rename constraint task_phase_id_fkey to task_epic_id_fkey;

alter index phase_initiative_id_idx rename to epic_initiative_id_idx;
alter index phase_one_implicit_per_initiative_idx rename to epic_one_implicit_per_initiative_idx;
alter index task_phase_id_idx rename to task_epic_id_idx;
