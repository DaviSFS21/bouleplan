package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.in.CreateEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateEpicCommand;
import br.com.davisoares.bouleplan.application.port.in.UpdateEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand.Change;
import br.com.davisoares.bouleplan.domain.Epic;
import br.com.davisoares.bouleplan.domain.Initiative;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

// Real threads are the point: the test holds one transaction open while another one runs.
@SuppressWarnings("PMD.DoNotUseThreads")
@QuarkusTest
class EpicInitiativeLockTest {

  private static final long WAIT_MILLIS = 500;
  private static final String ORIGINAL = "Original";

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject CreateEpicUseCase createEpic;
  @Inject UpdateEpicUseCase updateEpic;
  @Inject EntityManager entityManager;

  @BeforeEach
  void cleanDatabase() {
    TestData.deleteAllInitiatives();
  }

  private void archiveHoldingLock(
      UUID initiativeId, CountDownLatch locked, CountDownLatch release) {
    QuarkusTransaction.requiringNew()
        .run(() -> {
          Initiative initiative =
              entityManager.find(Initiative.class, initiativeId, LockModeType.PESSIMISTIC_WRITE);
          initiative.archive();
          locked.countDown();
          awaitQuietly(release);
        });
  }

  private static void awaitQuietly(CountDownLatch latch) {
    try {
      latch.await();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }

  @Test
  @DisplayName("an epic write waits for a concurrent initiative archive and is then refused")
  void epicWriteWaitsForInitiativeLock() throws Exception {
    UUID initiativeId = createInitiative.create("Study").getId();
    UUID id = createEpic.create(initiativeId, ORIGINAL).orElseThrow().getId();
    CountDownLatch locked = new CountDownLatch(1);
    CountDownLatch release = new CountDownLatch(1);
    ExecutorService executor = Executors.newFixedThreadPool(2);
    try {
      final Future<?> archiver =
          executor.submit(() -> {
            archiveHoldingLock(initiativeId, locked, release);
            return null;
          });
      locked.await();
      Future<Boolean> rename =
          executor.submit(
              () -> updateEpic.update(id, new UpdateEpicCommand(Change.of("Renamed"))).isPresent());

      assertThatThrownBy(() -> rename.get(WAIT_MILLIS, TimeUnit.MILLISECONDS))
          .isInstanceOf(TimeoutException.class);
      release.countDown();
      archiver.get();

      assertThat(rename.get()).isFalse();
      Epic epic = QuarkusTransaction.requiringNew().call(() -> entityManager.find(Epic.class, id));
      assertThat(epic.getName()).isEqualTo(ORIGINAL);
    } finally {
      release.countDown();
      executor.shutdownNow();
    }
  }
}
