package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class IntrospectionSchemaTest {

  @Inject CurrentUser currentUser;
  @Inject EntityManager entityManager;

  private IntrospectionRows rows;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    rows = new IntrospectionRows(entityManager, currentUser.id());
  }

  @Test
  @DisplayName("a sheet needs an existing user")
  void userReference() {
    assertThatThrownBy(() -> rows.insertOf(UUID.randomUUID()))
        .isInstanceOf(PersistenceException.class);
    assertThatThrownBy(() -> rows.insertOf(null)).isInstanceOf(PersistenceException.class);
  }

  @Test
  @DisplayName("the week start must be a Monday")
  void weekIsMonday() {
    assertThatThrownBy(() -> rows.insertWeek(IntrospectionRows.MONDAY.plusDays(1)))
        .isInstanceOf(PersistenceException.class)
        .hasMessageContaining("introspection_week_is_monday");
    assertThatThrownBy(() -> rows.insertWeek(IntrospectionRows.MONDAY.plusDays(6)))
        .isInstanceOf(PersistenceException.class);
    assertThatCode(() -> rows.insertWeek(IntrospectionRows.MONDAY)).doesNotThrowAnyException();
    assertThatThrownBy(() -> rows.insertWeek(null)).isInstanceOf(PersistenceException.class);
  }

  @Test
  @DisplayName("a user has one sheet per week")
  void uniquePerWeek() {
    rows.insertWeek(IntrospectionRows.MONDAY);

    assertThatThrownBy(() -> rows.insertWeek(IntrospectionRows.MONDAY))
        .isInstanceOf(PersistenceException.class)
        .hasMessageContaining("introspection_user_week_key");
    assertThatCode(() -> rows.insertWeek(LocalDate.of(2026, 11, 23))).doesNotThrowAnyException();
    assertThat(rows.count()).isEqualTo(2);
  }

  @Test
  @DisplayName("the answers are a JSON array and default to an empty one")
  void answersAreAnArray() {
    assertThatThrownBy(() -> rows.insertAnswers("{}"))
        .isInstanceOf(PersistenceException.class)
        .hasMessageContaining("introspection_answers_is_array");
    assertThatThrownBy(() -> rows.insertAnswers("\"text\""))
        .isInstanceOf(PersistenceException.class);
    assertThatThrownBy(() -> rows.insertAnswers("null")).isInstanceOf(PersistenceException.class);

    rows.insertWithoutAnswers();

    assertThat(rows.storedAnswers()).isEqualTo("[]");
  }

  @Test
  @DisplayName("the answers keep their order and the question text")
  void answersKeepShape() {
    String json = "[{\"key\": \"b\", \"prompt\": \"B?\", \"answer\": \"x\"}, {\"key\": \"a\"}]";

    rows.insertAnswers(json);

    assertThat(rows.storedAnswers()).startsWith("[{\"key\": \"b\"").contains("{\"key\": \"a\"}");
  }
}
