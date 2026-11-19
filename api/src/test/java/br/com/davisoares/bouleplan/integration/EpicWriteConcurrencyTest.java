package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.in.ArchiveEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.ArchiveInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateEpicCommand;
import br.com.davisoares.bouleplan.application.port.in.UpdateEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand.Change;
import br.com.davisoares.bouleplan.domain.Epic;
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
class EpicWriteConcurrencyTest {

  private static final int ROUNDS = 25;
  private static final String STUDY = "Study";
  private static final String RENAMED = "Renamed";
  private static final String ORIGINAL = "Original";
  private static final String ROUND_MESSAGE = "round %d";

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject ArchiveInitiativeUseCase archiveInitiative;
  @Inject CreateEpicUseCase createEpic;
  @Inject UpdateEpicUseCase updateEpic;
  @Inject ArchiveEpicUseCase archiveEpic;
  @Inject EntityManager entityManager;

  @BeforeEach
  void cleanDatabase() {
    TestData.deleteAllInitiatives();
  }

  private static UpdateEpicCommand renameTo(String name) {
    return new UpdateEpicCommand(Change.of(name));
  }

  private static List<Boolean> newOutcomes() {
    return new CopyOnWriteArrayList<>();
  }

  private Epic reload(UUID id) {
    return QuarkusTransaction.requiringNew().call(() -> entityManager.find(Epic.class, id));
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
  @DisplayName("a rename racing an archive of the same epic ends archived, never active")
  void renameAndArchive() throws ExecutionException, InterruptedException {
    UUID initiativeId = createInitiative.create(STUDY).getId();
    for (int round = 0; round < ROUNDS; round++) {
      UUID id = createEpic.create(initiativeId, ORIGINAL).orElseThrow().getId();

      race(() -> updateEpic.update(id, renameTo(RENAMED)), () -> archiveEpic.archive(id));

      Epic result = reload(id);
      assertThat(result.isArchived()).as(ROUND_MESSAGE, round).isTrue();
      // Archive first: the rename then finds it archived and is not applied.
      assertThat(result.getName()).as(ROUND_MESSAGE, round).isIn(ORIGINAL, RENAMED);
    }
  }

  @Test
  @DisplayName("two archives of the same epic have exactly one winner")
  void parallelArchives() throws ExecutionException, InterruptedException {
    UUID initiativeId = createInitiative.create(STUDY).getId();
    for (int round = 0; round < ROUNDS; round++) {
      UUID id = createEpic.create(initiativeId, ORIGINAL).orElseThrow().getId();
      List<Boolean> outcomes = newOutcomes();

      race(
          () -> outcomes.add(archiveEpic.archive(id).isPresent()),
          () -> outcomes.add(archiveEpic.archive(id).isPresent()));

      assertThat(outcomes).as(ROUND_MESSAGE, round).containsExactlyInAnyOrder(true, false);
      assertThat(reload(id).isArchived()).isTrue();
    }
  }

  @Test
  @DisplayName("a rename racing an initiative archive is either applied first or refused")
  void renameAndArchiveInitiative() throws ExecutionException, InterruptedException {
    UUID initiativeId = createInitiative.create(STUDY).getId();
    for (int round = 0; round < ROUNDS; round++) {
      UUID id = createEpic.create(initiativeId, ORIGINAL + round).orElseThrow().getId();

      race(
          () -> updateEpic.update(id, renameTo(RENAMED)),
          () -> archiveInitiative.archive(initiativeId));

      assertThat(reload(id).getName()).as(ROUND_MESSAGE, round).isIn(ORIGINAL + round, RENAMED);
      TestData.unarchiveInitiative(entityManager, initiativeId);
    }
  }

  @Test
  @DisplayName("an epic created while its initiative is archived is either stored or refused")
  void createAndArchiveInitiative() throws ExecutionException, InterruptedException {
    for (int round = 0; round < ROUNDS; round++) {
      UUID initiativeId = createInitiative.create(STUDY + round).getId();
      List<Boolean> created = newOutcomes();

      race(
          () -> created.add(createEpic.create(initiativeId, ORIGINAL).isPresent()),
          () -> archiveInitiative.archive(initiativeId));

      long stored =
          QuarkusTransaction.requiringNew()
              .call(() ->
                  (Long)
                      entityManager
                          .createQuery("select count(p) from Epic p where p.initiativeId = ?1")
                          .setParameter(1, initiativeId)
                          .getSingleResult());
      assertThat(stored).as(ROUND_MESSAGE, round).isEqualTo(created.get(0) ? 1L : 0L);
    }
  }
}
