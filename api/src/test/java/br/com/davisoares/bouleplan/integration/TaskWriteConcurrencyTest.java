package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.in.ArchivePhaseUseCase;
import br.com.davisoares.bouleplan.application.port.in.ArchiveTaskUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreatePhaseUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateTaskUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateTaskUseCase;
import br.com.davisoares.bouleplan.domain.Phase;
import br.com.davisoares.bouleplan.domain.Task;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskWriteConcurrencyTest {

  private static final int ROUNDS = 25;
  private static final String ORIGINAL = "Original";
  private static final String RENAMED = "Renamed";
  private static final String ROUND_MESSAGE = "round %d";

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject CreatePhaseUseCase createPhase;
  @Inject ArchivePhaseUseCase archivePhase;
  @Inject CreateTaskUseCase createTask;
  @Inject UpdateTaskUseCase updateTask;
  @Inject ArchiveTaskUseCase archiveTask;
  @Inject EntityManager entityManager;

  @BeforeEach
  void cleanDatabase() {
    TestData.deleteAllInitiatives();
  }

  private UUID newTask(UUID initiativeId, UUID phaseId) {
    return createTask
        .create(initiativeId, TaskCommands.create(ORIGINAL, phaseId))
        .orElseThrow()
        .getId();
  }

  private Task reload(UUID id) {
    return QuarkusTransaction.requiringNew().call(() -> entityManager.find(Task.class, id));
  }

  private Phase reloadPhase(UUID id) {
    return QuarkusTransaction.requiringNew().call(() -> entityManager.find(Phase.class, id));
  }

  @Test
  @DisplayName("a task rename racing a phase archive is either applied first or refused")
  void renameAndArchivePhase() throws ExecutionException, InterruptedException {
    UUID initiativeId = createInitiative.create("Study").getId();
    for (int round = 0; round < ROUNDS; round++) {
      UUID phaseId = createPhase.create(initiativeId, "Design " + round).orElseThrow().getId();
      UUID id = newTask(initiativeId, phaseId);
      List<Boolean> applied = Races.newOutcomes();

      Races.race(
          () -> applied.add(updateTask.update(id, TaskCommands.renameTo(RENAMED)).isPresent()),
          () -> archivePhase.archive(phaseId));

      assertThat(reloadPhase(phaseId).isArchived()).as(ROUND_MESSAGE, round).isTrue();
      assertThat(reload(id).getTitle())
          .as(ROUND_MESSAGE, round)
          .isEqualTo(applied.get(0) ? RENAMED : ORIGINAL);
    }
  }

  @Test
  @DisplayName("a task created while its phase is archived is either stored or refused")
  void createAndArchivePhase() throws ExecutionException, InterruptedException {
    UUID initiativeId = createInitiative.create("Study").getId();
    for (int round = 0; round < ROUNDS; round++) {
      UUID phaseId = createPhase.create(initiativeId, "Design " + round).orElseThrow().getId();
      List<Boolean> created = Races.newOutcomes();

      Races.race(
          () ->
              created.add(
                  createTask.create(initiativeId, TaskCommands.create("A", phaseId)).isPresent()),
          () -> archivePhase.archive(phaseId));

      long stored =
          QuarkusTransaction.requiringNew()
              .call(() ->
                  (Long)
                      entityManager
                          .createQuery("select count(t) from Task t where t.phase.id = ?1")
                          .setParameter(1, phaseId)
                          .getSingleResult());
      assertThat(stored).as(ROUND_MESSAGE, round).isEqualTo(created.get(0) ? 1L : 0L);
    }
  }

  @Test
  @DisplayName("two archives of the same task have exactly one winner")
  void parallelArchives() throws ExecutionException, InterruptedException {
    UUID initiativeId = createInitiative.create("Study").getId();
    for (int round = 0; round < ROUNDS; round++) {
      UUID id = newTask(initiativeId, null);
      List<Boolean> outcomes = Races.newOutcomes();

      Races.race(
          () -> outcomes.add(archiveTask.archive(id).isPresent()),
          () -> outcomes.add(archiveTask.archive(id).isPresent()));

      assertThat(outcomes).as(ROUND_MESSAGE, round).containsExactlyInAnyOrder(true, false);
      assertThat(reload(id).isArchived()).isTrue();
    }
  }
}
