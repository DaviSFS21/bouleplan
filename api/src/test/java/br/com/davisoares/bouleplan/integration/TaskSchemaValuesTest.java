package br.com.davisoares.bouleplan.integration;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskSchemaValuesTest {

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject EntityManager entityManager;

  private TaskRows rows;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    UUID initiativeId = createInitiative.create("Study").getId();
    rows =
        new TaskRows(
            entityManager, UUID.fromString(TestData.insertImplicitEpic(initiativeId.toString())));
  }

  @Test
  @DisplayName("the estimated effort is above 0 and at most 999")
  void effort() {
    rows.assertRejected(TaskRows.EFFORT, 0);
    rows.assertRejected(TaskRows.EFFORT, -1);
    rows.assertRejected(TaskRows.EFFORT, new BigDecimal("0.00"));
    rows.assertRejected(TaskRows.EFFORT, new BigDecimal("999.01"));
    rows.assertRejected(TaskRows.EFFORT, 1000);
    rows.assertAccepted(TaskRows.EFFORT, new BigDecimal("0.01"));
    rows.assertAccepted(TaskRows.EFFORT, 999);
    rows.assertAccepted(TaskRows.EFFORT, null);
  }

  @Test
  @DisplayName("the priority is P1, P2 or P3")
  void priority() {
    rows.assertRejected(TaskRows.PRIORITY, "P0");
    rows.assertRejected(TaskRows.PRIORITY, "P4");
    rows.assertRejected(TaskRows.PRIORITY, "p1");
    rows.assertRejected(TaskRows.PRIORITY, "");
    rows.assertRejected(TaskRows.PRIORITY, null);
    rows.assertAccepted(TaskRows.PRIORITY, "P1");
    rows.assertAccepted(TaskRows.PRIORITY, "P3");
  }

  @Test
  @DisplayName("the status is to_do, in_progress or done")
  void status() {
    rows.assertRejected(TaskRows.STATUS, "todo");
    rows.assertRejected(TaskRows.STATUS, "DONE");
    rows.assertRejected(TaskRows.STATUS, "blocked");
    rows.assertRejected(TaskRows.STATUS, null);
    rows.assertAccepted(TaskRows.STATUS, "in_progress");
    rows.assertAccepted(TaskRows.STATUS, "done");
  }

  @Test
  @DisplayName("the planned week starts on a Monday")
  void plannedWeek() {
    rows.assertRejected(TaskRows.PLANNED_WEEK, LocalDate.of(2026, 11, 17));
    rows.assertRejected(TaskRows.PLANNED_WEEK, LocalDate.of(2026, 11, 22));
    rows.assertAccepted(TaskRows.PLANNED_WEEK, LocalDate.of(2026, 11, 16));
    rows.assertAccepted(TaskRows.PLANNED_WEEK, null);
  }
}
