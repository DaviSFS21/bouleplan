package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.in.AddTaskBlockerUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreatePhaseUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateTaskUseCase;
import br.com.davisoares.bouleplan.application.port.in.RemoveTaskBlockerUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateTaskUseCase;
import br.com.davisoares.bouleplan.domain.TaskBlockerException;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskBlockerConcurrencyTest {

  private static final int ROUNDS = 25;
  private static final String LINKED = "linked";
  private static final String ROUND_MESSAGE = "round %d";

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject CreatePhaseUseCase createPhase;
  @Inject CreateTaskUseCase createTask;
  @Inject UpdateTaskUseCase updateTask;
  @Inject AddTaskBlockerUseCase addBlocker;
  @Inject RemoveTaskBlockerUseCase removeBlocker;
  @Inject EntityManager entityManager;

  private UUID initiativeId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = createInitiative.create("Study").getId();
  }

  private UUID newTask(UUID phaseId) {
    return createTask.create(initiativeId, TaskCommands.create("T", phaseId)).orElseThrow().getId();
  }

  private UUID newTaskInNewInitiative(String name) {
    UUID other = createInitiative.create(name).getId();
    return createTask.create(other, TaskCommands.create("T", null)).orElseThrow().getId();
  }

  private BlockerDb db() {
    return new BlockerDb(entityManager);
  }

  private static List<String> newOutcomes() {
    return new CopyOnWriteArrayList<>();
  }

  // Cycles are refused by a rule exception; any other failure (a deadlock, say) must surface.
  private Runnable link(List<String> outcomes, UUID blocking, UUID blocked) {
    return () -> {
      try {
        outcomes.add(addBlocker.add(blocking, blocked) ? LINKED : "missing");
      } catch (TaskBlockerException e) {
        outcomes.add(e.code());
      }
    };
  }

  @Test
  @DisplayName("opposite links between the same two tasks never both stay")
  void oppositeLinks() throws ExecutionException, InterruptedException {
    UUID first = newTask(null);
    UUID second = newTask(null);
    for (int round = 0; round < ROUNDS; round++) {
      db().clearBlockers();
      List<String> outcomes = newOutcomes();

      Races.race(link(outcomes, first, second), link(outcomes, second, first));

      assertThat(outcomes)
          .as(ROUND_MESSAGE, round)
          .containsExactlyInAnyOrder(LINKED, "task.blocker.cycle");
      assertThat(db().storedLinks()).as(ROUND_MESSAGE, round).isEqualTo(1);
    }
  }

  @Test
  @DisplayName("links of tasks in four initiatives that would close a ring never both stay")
  void ringOverDisjointPairs() throws ExecutionException, InterruptedException {
    // Each task has its own initiative, so the two writes share no initiative, phase or task lock.
    UUID a = newTaskInNewInitiative("Ring A");
    UUID b = newTaskInNewInitiative("Ring B");
    UUID c = newTaskInNewInitiative("Ring C");
    UUID d = newTaskInNewInitiative("Ring D");
    for (int round = 0; round < ROUNDS; round++) {
      db().clearBlockers();
      addBlocker.add(a, b);
      addBlocker.add(c, d);
      List<String> outcomes = newOutcomes();

      // b -> c closes nothing alone, d -> a closes nothing alone, both together make a ring.
      Races.race(link(outcomes, b, c), link(outcomes, d, a));

      assertThat(outcomes)
          .as(ROUND_MESSAGE, round)
          .containsExactlyInAnyOrder(LINKED, "task.blocker.cycle");
      assertThat(db().storedLinks()).as(ROUND_MESSAGE, round).isEqualTo(3);
    }
  }

  @Test
  @DisplayName("opposite link writes racing opposite phase moves neither deadlock nor lose a rule")
  void blockerWritesAndPhaseMovesDoNotDeadlock() throws ExecutionException, InterruptedException {
    UUID design = createPhase.create(initiativeId, "Design").orElseThrow().getId();
    UUID build = createPhase.create(initiativeId, "Build").orElseThrow().getId();
    UUID first = newTask(design);
    UUID second = newTask(build);
    for (int round = 0; round < ROUNDS; round++) {
      db().clearBlockers();
      List<String> outcomes = newOutcomes();
      UUID firstTarget = round % 2 == 0 ? build : design;
      UUID secondTarget = round % 2 == 0 ? design : build;

      Races.raceAll(
          link(outcomes, first, second),
          link(outcomes, second, first),
          () -> updateTask.update(first, TaskCommands.moveTo(firstTarget)),
          () -> updateTask.update(second, TaskCommands.moveTo(secondTarget)),
          () -> removeBlocker.remove(first, second));

      assertThat(outcomes)
          .as(ROUND_MESSAGE, round)
          .hasSize(2)
          .allMatch(outcome -> LINKED.equals(outcome) || "task.blocker.cycle".equals(outcome));
      assertThat(db().phaseOf(first)).as(ROUND_MESSAGE, round).isEqualTo(firstTarget);
      assertThat(db().phaseOf(second)).as(ROUND_MESSAGE, round).isEqualTo(secondTarget);
      assertThat(db().storedLinks()).as(ROUND_MESSAGE, round).isLessThanOrEqualTo(1);
    }
  }
}
