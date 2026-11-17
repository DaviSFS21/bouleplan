package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskListResourceTest {

  private static final String TITLES = "title";
  private static final String IMPLICIT = "implicit";
  private static final String NAMED = "named";
  private static final String OTHER = "other";

  @Inject EntityManager entityManager;

  private String initiativeId;
  private String phaseId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = TaskApi.initiativeId("Study");
    phaseId = PhaseApi.createId(initiativeId, "Design");
  }

  private void patch(String id, String json) {
    TaskApi.patch(id, json).statusCode(200);
  }

  @Test
  @DisplayName("tasks are ordered by priority, deadline (none last), creation and id")
  void order() {
    String p3Early = TaskApi.createId(initiativeId, "p3 early");
    TaskApi.createId(initiativeId, "p2 no deadline");
    String p2Late = TaskApi.createId(initiativeId, "p2 late");
    String p2EarlyFirst = TaskApi.createIdInPhase(initiativeId, "p2 early first", phaseId);
    final String p2EarlySecond = TaskApi.createId(initiativeId, "p2 early second");
    final String p1NoDeadline = TaskApi.createId(initiativeId, "p1 no deadline");
    patch(p3Early, "{\"priority\": \"P3\", \"deadline\": \"2026-01-01\"}");
    patch(p2Late, "{\"deadline\": \"2026-12-31\"}");
    patch(p2EarlyFirst, "{\"deadline\": \"2026-06-01\"}");
    patch(p2EarlySecond, "{\"deadline\": \"2026-06-01\"}");
    patch(p1NoDeadline, "{\"priority\": \"P1\"}");

    TaskApi.list()
        .statusCode(200)
        .body(
            TITLES,
            contains(
                "p1 no deadline",
                "p2 early first",
                "p2 early second",
                "p2 late",
                "p2 no deadline",
                "p3 early"));
  }

  @Test
  @DisplayName("tasks of every initiative and phase, implicit or named, are listed together")
  void everyInitiative() {
    String other = TaskApi.initiativeId("Work");
    TaskApi.createId(initiativeId, IMPLICIT);
    TaskApi.createIdInPhase(initiativeId, NAMED, phaseId);
    TaskApi.createId(other, OTHER);

    TaskApi.list().body(TITLES, contains(IMPLICIT, NAMED, OTHER));
  }

  @Test
  @DisplayName("archived and deleted tasks are not listed")
  void hiddenTasks() {
    String archived = TaskApi.createId(initiativeId, "archived");
    String deleted = TaskApi.createId(initiativeId, "deleted");
    TaskApi.createId(initiativeId, "kept");
    TaskActions.archive(archived).statusCode(200);
    TaskActions.delete(deleted).statusCode(204);

    TaskApi.list().body(TITLES, contains("kept"));
  }

  @Test
  @DisplayName("an archived phase hides its tasks and they return with it")
  void archivedPhase() {
    TaskApi.createIdInPhase(initiativeId, NAMED, phaseId);
    TaskApi.createId(initiativeId, IMPLICIT);
    PhaseActions.archive(phaseId).statusCode(200);

    TaskApi.list().body(TITLES, contains(IMPLICIT));

    PhaseActions.unarchive(phaseId).statusCode(200);
    TaskApi.list().body(TITLES, contains(NAMED, IMPLICIT));
  }

  @Test
  @DisplayName("a deleted phase hides its tasks and they return when it is restored")
  void deletedPhase() {
    TaskApi.createIdInPhase(initiativeId, NAMED, phaseId);
    PhaseActions.delete(phaseId).statusCode(204);

    TaskApi.list().body("", empty());

    PhaseActions.restore(phaseId).statusCode(200);
    TaskApi.list().body(TITLES, contains(NAMED));
  }

  @Test
  @DisplayName("an archived or deleted initiative hides all its tasks and they return with it")
  void hiddenInitiative() {
    TaskApi.createIdInPhase(initiativeId, NAMED, phaseId);
    TaskApi.createId(initiativeId, IMPLICIT);
    String other = TaskApi.initiativeId("Work");
    TaskApi.createId(other, OTHER);

    InitiativeActions.archive(initiativeId).statusCode(200);
    TaskApi.list().body(TITLES, contains(OTHER));
    InitiativeActions.unarchive(initiativeId).statusCode(200);
    TaskApi.list().body(TITLES, contains(NAMED, IMPLICIT, OTHER));

    InitiativeActions.delete(initiativeId).statusCode(204);
    TaskApi.list().body(TITLES, contains(OTHER));
    InitiativeActions.restore(initiativeId).statusCode(200);
    TaskApi.list().body(TITLES, contains(NAMED, IMPLICIT, OTHER));
  }

  @Test
  @DisplayName("tasks of another user are not listed")
  void foreignTask() {
    TestData.insertForeignTask(entityManager);
    TaskApi.createId(initiativeId, "mine");

    TaskApi.list().body(TITLES, contains("mine"));
  }

  @Test
  @DisplayName("archiving a phase or an initiative leaves the task itself untouched")
  void taskKeepsItsState() {
    String id = TaskApi.createIdInPhase(initiativeId, NAMED, phaseId);
    String archived = TaskApi.createIdInPhase(initiativeId, "archived", phaseId);
    TaskActions.archive(archived).statusCode(200);

    PhaseActions.archive(phaseId).statusCode(200);
    PhaseActions.unarchive(phaseId).statusCode(200);

    TaskApi.list().body(TITLES, contains(NAMED));
    TaskApi.get(id).statusCode(200);
    TaskActions.unarchive(archived).statusCode(200);
  }
}
