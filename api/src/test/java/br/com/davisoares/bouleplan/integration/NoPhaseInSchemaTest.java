package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class NoPhaseInSchemaTest {

  @Inject EntityManager entityManager;

  private List<?> names(String sql) {
    return entityManager.createNativeQuery(sql).getResultList();
  }

  @Test
  @DisplayName("no table or column name mentions phase")
  void tablesAndColumns() {
    assertThat(
            names(
                "select table_name || '.' || column_name from information_schema.columns"
                    + " where table_schema = 'public'"
                    + " and (table_name ilike '%phase%' or column_name ilike '%phase%')"))
        .isEmpty();
  }

  @Test
  @DisplayName("no constraint or index name mentions phase")
  void constraintsAndIndexes() {
    assertThat(names("select conname from pg_constraint where conname ilike '%phase%'")).isEmpty();
    assertThat(names("select indexname from pg_indexes where indexname ilike '%phase%'")).isEmpty();
  }

  @Test
  @DisplayName("the epic table and its renamed constraints exist")
  void epicObjectsExist() {
    assertThat(
            names(
                "select conname from pg_constraint where conname in ('epic_pkey',"
                    + " 'epic_origin_valid', 'epic_name_matches_kind', 'epic_initiative_id_fkey',"
                    + " 'task_epic_id_fkey')"))
        .hasSize(5);
    assertThat(
            names(
                "select indexname from pg_indexes where indexname in ('epic_initiative_id_idx',"
                    + " 'epic_one_implicit_per_initiative_idx', 'task_epic_id_idx')"))
        .hasSize(3);
  }
}
