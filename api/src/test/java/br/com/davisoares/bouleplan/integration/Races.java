package br.com.davisoares.bouleplan.integration;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/** Starts two actions at the same moment in separate threads. */
// Real threads are the point: the tests race separate transactions.
@SuppressWarnings("PMD.DoNotUseThreads")
final class Races {

  private Races() {}

  static List<Boolean> newOutcomes() {
    return new CopyOnWriteArrayList<>();
  }

  /** Runs both actions together and rethrows the first failure of either. */
  static void race(Runnable first, Runnable second)
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
}
