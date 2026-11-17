package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import br.com.davisoares.bouleplan.domain.Initiative;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

// Real threads and per-round objects are the point: the test races two separate transactions.
@SuppressWarnings({"PMD.DoNotUseThreads", "PMD.AvoidInstantiatingObjectsInLoops"})
@QuarkusTest
class InitiativeConcurrencyTest {

  private static final int ROUNDS = 10;

  @Inject CreateInitiativeUseCase createInitiative;

  @BeforeEach
  void cleanDatabase() {
    TestData.deleteAllInitiatives();
  }

  @Test
  @DisplayName("parallel creates in separate transactions never get the same color")
  void parallelCreatesGetDifferentColors() throws Exception {
    ExecutorService executor = Executors.newFixedThreadPool(2);
    try {
      for (int round = 0; round < ROUNDS; round++) {
        TestData.deleteAllInitiatives();
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Initiative>> futures = new ArrayList<>();
        for (int i = 0; i < 2; i++) {
          futures.add(
              executor.submit(
                  () -> {
                    start.await();
                    return createInitiative.create("Parallel");
                  }));
        }
        start.countDown();

        List<Object> colors = new ArrayList<>();
        for (Future<Initiative> future : futures) {
          colors.add(future.get().getColor());
        }
        assertThat(colors).doesNotHaveDuplicates();
      }
    } finally {
      executor.shutdownNow();
    }
  }
}
