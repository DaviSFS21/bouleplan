package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.in.ArchiveInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.ArchivePhaseUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreatePhaseUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand.Change;
import br.com.davisoares.bouleplan.application.port.in.UpdatePhaseCommand;
import br.com.davisoares.bouleplan.application.port.in.UpdatePhaseUseCase;
import br.com.davisoares.bouleplan.domain.Phase;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

// Real threads are the point: the test races separate transactions.
@SuppressWarnings("PMD.DoNotUseThreads")
@QuarkusTest
class PhaseWriteConcurrencyTest {

  private static final int ROUNDS = 25;
  private static final String RENAMED = "Renamed";
  private static final String ORIGINAL = "Original";
  private static final String ROUND_MESSAGE = "round %d";

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject ArchiveInitiativeUseCase archiveInitiative;
  @Inject CreatePhaseUseCase createPhase;
  @Inject UpdatePhaseUseCase updatePhase;
  @Inject ArchivePhaseUseCase archivePhase;
  @Inject EntityManager entityManager;

  @BeforeEach
  void cleanDatabase() {
    TestData.deleteAllInitiatives();
  }

  private static UpdatePhaseCommand renameTo(String name) {
    return new UpdatePhaseCommand(Change.of(name));
  }

  private static List<Boolean> newOutcomes() {
    return new CopyOnWriteArrayList<>();
  }

  private Phase reload(UUID id) {
    return QuarkusTransaction.requiringNew().call(() -> entityManager.find(Phase.class, id));
  }

  private static void race(Runnable first, Runnable second)
      throws ExecutionException, InterruptedException {
    ExecutorService executor = Executors.newFixedThreadPool(2);
    try {
      CountDownLatch start = new CountDownLatch(1);
      Future<?> a =
          executor.submit(() -> {
            start.await();
            first.run();
            return null;
          });
      Future<?> b =
          executor.submit(() -> {
            start.await();
            second.run();
            return null;
          });
      start.countDown();
      a.get();
      b.get();
    } finally {
      executor.shutdownNow();
    }
  }

  @Test
  @DisplayName("a rename racing an archive of the same phase ends archived, never active")
  void renameAndArchive() throws ExecutionException, InterruptedException {
    UUID initiativeId = createInitiative.create("Study").getId();
    for (int round = 0; round < ROUNDS; round++) {
      UUID id = createPhase.create(initiativeId, ORIGINAL).orElseThrow().getId();

      race(() -> updatePhase.update(id, renameTo(RENAMED)), () -> archivePhase.archive(id));

      Phase result = reload(id);
      assertThat(result.isArchived()).as(ROUND_MESSAGE, round).isTrue();
      // Archive first: the rename then finds it archived and is not applied.
      assertThat(result.getName()).as(ROUND_MESSAGE, round).isIn(ORIGINAL, RENAMED);
    }
  }

  @Test
  @DisplayName("two archives of the same phase have exactly one winner")
  void parallelArchives() throws ExecutionException, InterruptedException {
    UUID initiativeId = createInitiative.create("Study").getId();
    for (int round = 0; round < ROUNDS; round++) {
      UUID id = createPhase.create(initiativeId, ORIGINAL).orElseThrow().getId();
      List<Boolean> outcomes = newOutcomes();

      race(
          () -> outcomes.add(archivePhase.archive(id).isPresent()),
          () -> outcomes.add(archivePhase.archive(id).isPresent()));

      assertThat(outcomes).as(ROUND_MESSAGE, round).containsExactlyInAnyOrder(true, false);
      assertThat(reload(id).isArchived()).isTrue();
    }
  }

  @Test
  @DisplayName("a phase created while its initiative is archived is either stored or refused")
  void createAndArchiveInitiative() throws ExecutionException, InterruptedException {
    for (int round = 0; round < ROUNDS; round++) {
      UUID initiativeId = createInitiative.create("Study " + round).getId();
      List<Boolean> created = newOutcomes();

      race(
          () -> created.add(createPhase.create(initiativeId, ORIGINAL).isPresent()),
          () -> archiveInitiative.archive(initiativeId));

      long stored =
          QuarkusTransaction.requiringNew()
              .call(() ->
                  (Long)
                      entityManager
                          .createQuery("select count(p) from Phase p where p.initiativeId = ?1")
                          .setParameter(1, initiativeId)
                          .getSingleResult());
      assertThat(stored).as(ROUND_MESSAGE, round).isEqualTo(created.get(0) ? 1L : 0L);
    }
  }
}
