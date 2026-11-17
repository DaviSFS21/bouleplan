package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.quarkus.narayana.jta.QuarkusTransaction;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/** Holds locks in an open transaction while another transaction tries to write. */
// Real threads are the point: the writer must block while the holder transaction is open.
@SuppressWarnings("PMD.DoNotUseThreads")
final class HeldLock {

  private static final long WAIT_MILLIS = 500;

  private HeldLock() {}

  /**
   * Runs {@code holder} in a transaction that stays open, starts {@code writer}, checks that it
   * blocks, then commits the holder and returns the writer's outcome.
   */
  static boolean writeWhileHeld(Runnable holder, Callable<Boolean> writer)
      throws InterruptedException, ExecutionException {
    CountDownLatch locked = new CountDownLatch(1);
    CountDownLatch release = new CountDownLatch(1);
    ExecutorService executor = Executors.newFixedThreadPool(2);
    try {
      final Future<?> holding =
          executor.submit(() -> {
            QuarkusTransaction.requiringNew()
                .run(() -> {
                  holder.run();
                  locked.countDown();
                  awaitQuietly(release);
                });
            return null;
          });
      locked.await();
      Future<Boolean> write = executor.submit(writer);

      assertThatThrownBy(() -> write.get(WAIT_MILLIS, TimeUnit.MILLISECONDS))
          .isInstanceOf(TimeoutException.class);
      release.countDown();
      holding.get();
      return write.get();
    } finally {
      release.countDown();
      executor.shutdownNow();
    }
  }

  private static void awaitQuietly(CountDownLatch latch) {
    try {
      latch.await();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
