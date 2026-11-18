package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.in.CreateEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateScheduledItemCommand;
import br.com.davisoares.bouleplan.application.port.in.CreateTaskUseCase;
import br.com.davisoares.bouleplan.application.port.in.ManageScheduledItemsUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand.Change;
import br.com.davisoares.bouleplan.application.port.in.UpdateScheduledItemCommand;
import br.com.davisoares.bouleplan.application.port.in.UpdateTaskUseCase;
import br.com.davisoares.bouleplan.domain.DomainRuleViolation;
import br.com.davisoares.bouleplan.domain.ScheduledItem;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutionException;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
@SuppressWarnings({
  "PMD.TooManyMethods",
  "PMD.AvoidInstantiatingObjectsInLoops"
}) // one test per race; each round builds its own commands
class ScheduledItemConcurrencyTest {

  private static final int ROUNDS = 25;
  private static final String CREATED = "created";
  private static final String ROUND_MESSAGE = "round %d";
  private static final LocalDate DAY = LocalDate.of(2026, 11, 17);

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject CreateEpicUseCase createEpic;
  @Inject UpdateTaskUseCase updateTask;
  @Inject CreateTaskUseCase createTask;
  @Inject ManageScheduledItemsUseCase manageItems;
  @Inject EntityManager entityManager;

  private UUID initiativeId;
  private UUID first;
  private UUID second;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = createInitiative.create("Study").getId();
    first = createTask.create(initiativeId, TaskCommands.create("A", null)).orElseThrow().getId();
    // Its own initiative, so that the two tasks share no initiative, epic or task lock.
    UUID otherInitiativeId = createInitiative.create("Work").getId();
    second =
        createTask.create(otherInitiativeId, TaskCommands.create("B", null)).orElseThrow().getId();
  }

  private ScheduleDb db() {
    return new ScheduleDb(entityManager);
  }

  private static LocalTime at(int hour, int minute) {
    return LocalTime.of(hour, minute);
  }

  // Conflicts are refused by a rule exception; any other failure (a unique violation, say) must
  // surface and fail the test.
  private static Runnable outcome(List<String> outcomes, Supplier<Object> action) {
    return () -> {
      try {
        outcomes.add(action.get() == null ? "missing" : CREATED);
      } catch (DomainRuleViolation e) {
        outcomes.add(e.code());
      }
    };
  }

  private Object create(UUID task, LocalTime start, LocalTime end) {
    return manageItems.create(new CreateScheduledItemCommand(task, DAY, start, end)).orElse(null);
  }

  private Object move(UUID id, LocalTime start, LocalTime end) {
    return manageItems
        .update(
            id,
            new UpdateScheduledItemCommand(
                Change.absent(), Change.of(start), Change.of(end), Change.absent()))
        .orElse(null);
  }

  @Test
  @DisplayName("two concurrent overlapping blocks never both commit")
  void overlappingCreates() throws ExecutionException, InterruptedException {
    for (int round = 0; round < ROUNDS; round++) {
      db().clearItems();
      List<String> outcomes = new CopyOnWriteArrayList<>();

      Races.race(
          outcome(outcomes, () -> create(first, at(9, 0), at(10, 0))),
          outcome(outcomes, () -> create(second, at(9, 30), at(10, 30))));

      assertThat(outcomes)
          .as(ROUND_MESSAGE, round)
          .containsExactlyInAnyOrder(CREATED, "scheduled-item.overlap");
      assertThat(db().storedItems()).as(ROUND_MESSAGE, round).isEqualTo(1);
    }
  }

  @Test
  @DisplayName("two concurrent moves into the same time never both commit")
  void overlappingMoves() throws ExecutionException, InterruptedException {
    for (int round = 0; round < ROUNDS; round++) {
      db().clearItems();
      UUID a = ((ScheduledItem) create(first, at(8, 0), at(9, 0))).getId();
      UUID b = ((ScheduledItem) create(second, at(12, 0), at(13, 0))).getId();
      List<String> outcomes = new CopyOnWriteArrayList<>();

      Races.race(
          outcome(outcomes, () -> move(a, at(10, 0), at(11, 0))),
          outcome(outcomes, () -> move(b, at(10, 30), at(11, 30))));

      assertThat(outcomes)
          .as(ROUND_MESSAGE, round)
          .containsExactlyInAnyOrder(CREATED, "scheduled-item.overlap");
    }
  }

  @Test
  @DisplayName("two concurrent adds of a task to the same day list keep one and refuse the other")
  void duplicateDayListEntries() throws ExecutionException, InterruptedException {
    for (int round = 0; round < ROUNDS; round++) {
      db().clearItems();
      List<String> outcomes = new CopyOnWriteArrayList<>();

      Races.race(
          outcome(outcomes, () -> create(first, null, null)),
          outcome(outcomes, () -> create(first, null, null)));

      assertThat(outcomes)
          .as(ROUND_MESSAGE, round)
          .containsExactlyInAnyOrder(CREATED, "scheduled-item.duplicate");
      assertThat(db().storedItems()).as(ROUND_MESSAGE, round).isEqualTo(1);
    }
  }

  @Test
  @DisplayName("concurrent day-list appends of different tasks get different orders")
  void differentOrders() throws ExecutionException, InterruptedException {
    for (int round = 0; round < ROUNDS; round++) {
      db().clearItems();

      Races.race(() -> create(first, null, null), () -> create(second, null, null));

      assertThat(((Number) distinctOrders()).longValue()).as(ROUND_MESSAGE, round).isEqualTo(2);
    }
  }

  private Object distinctOrders() {
    return QuarkusTransaction.requiringNew()
        .call(() ->
            entityManager
                .createNativeQuery("select count(distinct sort_order) from scheduled_item")
                .getSingleResult());
  }

  @Test
  @DisplayName("item writes racing opposite epic moves of their tasks neither deadlock nor overlap")
  void itemWritesAndEpicMovesDoNotDeadlock() throws ExecutionException, InterruptedException {
    UUID design = createEpic.create(initiativeId, "Design").orElseThrow().getId();
    UUID build = createEpic.create(initiativeId, "Build").orElseThrow().getId();
    UUID inDesign =
        createTask.create(initiativeId, TaskCommands.create("C", design)).orElseThrow().getId();
    UUID inBuild =
        createTask.create(initiativeId, TaskCommands.create("D", build)).orElseThrow().getId();
    for (int round = 0; round < ROUNDS; round++) {
      db().clearItems();
      List<String> outcomes = new CopyOnWriteArrayList<>();
      UUID designTarget = round % 2 == 0 ? build : design;
      UUID buildTarget = round % 2 == 0 ? design : build;

      Races.raceAll(
          outcome(outcomes, () -> create(inDesign, at(9, 0), at(10, 0))),
          outcome(outcomes, () -> create(inBuild, at(9, 30), at(10, 30))),
          () -> updateTask.update(inDesign, TaskCommands.moveTo(designTarget)),
          () -> updateTask.update(inBuild, TaskCommands.moveTo(buildTarget)));

      assertThat(outcomes)
          .as(ROUND_MESSAGE, round)
          .containsExactlyInAnyOrder(CREATED, "scheduled-item.overlap");
      assertThat(db().storedItems()).as(ROUND_MESSAGE, round).isEqualTo(1);
    }
  }
}
