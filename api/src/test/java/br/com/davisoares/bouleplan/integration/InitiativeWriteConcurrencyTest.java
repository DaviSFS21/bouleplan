package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.in.ArchiveInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand;
import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand.Change;
import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeUseCase;
import br.com.davisoares.bouleplan.domain.Initiative;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

// Real threads and per-round objects are the point: the test races separate transactions.
@SuppressWarnings("PMD.DoNotUseThreads")
@QuarkusTest
class InitiativeWriteConcurrencyTest {

  private static final int ROUNDS = 25;
  private static final String RENAMED = "Renamed";
  private static final String ROUND_MESSAGE = "round %d";

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject UpdateInitiativeUseCase updateInitiative;
  @Inject ArchiveInitiativeUseCase archiveInitiative;
  @Inject EntityManager entityManager;

  @BeforeEach
  void cleanDatabase() {
    TestData.deleteAllInitiatives();
  }

  private static UpdateInitiativeCommand rename(String name) {
    return new UpdateInitiativeCommand(
        Change.of(name), Change.absent(), Change.absent(), Change.absent());
  }

  private static UpdateInitiativeCommand recolor(String color) {
    return new UpdateInitiativeCommand(
        Change.absent(), Change.absent(), Change.absent(), Change.of(color));
  }

  private Initiative reload(UUID id) {
    return QuarkusTransaction.requiringNew().call(() -> entityManager.find(Initiative.class, id));
  }

  private void race(Runnable first, Runnable second)
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
  @DisplayName("parallel updates of different fields both persist")
  void parallelUpdatesBothPersist() throws ExecutionException, InterruptedException {
    for (int round = 0; round < ROUNDS; round++) {
      UUID id = createInitiative.create("Original").getId();

      race(
          () -> updateInitiative.update(id, rename(RENAMED)),
          () -> updateInitiative.update(id, recolor("roxo")));

      Initiative result = reload(id);
      assertThat(result.getName()).as(ROUND_MESSAGE, round).isEqualTo(RENAMED);
      assertThat(result.getColor().getToken()).as(ROUND_MESSAGE, round).isEqualTo("roxo");
    }
  }

  @Test
  @DisplayName("an update racing an archive never leaves the initiative active")
  void updateAndArchiveBothPersist() throws ExecutionException, InterruptedException {
    for (int round = 0; round < ROUNDS; round++) {
      UUID id = createInitiative.create("Original").getId();

      race(() -> updateInitiative.update(id, rename(RENAMED)), () -> archiveInitiative.archive(id));

      Initiative result = reload(id);
      assertThat(result.isArchived()).as(ROUND_MESSAGE, round).isTrue();
      // Archive first: the update then finds it archived and is not applied.
      assertThat(result.getName()).as(ROUND_MESSAGE, round).isIn("Original", RENAMED);
    }
  }
}
