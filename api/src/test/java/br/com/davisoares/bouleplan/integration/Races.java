package br.com.davisoares.bouleplan.integration;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/** Starts actions at the same moment in separate threads. */
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
    raceAll(first, second);
  }

  /** Runs all the actions together and rethrows the first failure of any. */
  static void raceAll(Runnable... actions) throws ExecutionException, InterruptedException {
    ExecutorService executor = Executors.newFixedThreadPool(actions.length);
    try {
      CountDownLatch start = new CountDownLatch(1);
      List<Future<?>> running = new ArrayList<>();
      for (Runnable action : actions) {
        running.add(
            executor.submit(() -> {
              start.await();
              action.run();
              return null;
            }));
      }
      start.countDown();
      for (Future<?> future : running) {
        future.get();
      }
    } finally {
      executor.shutdownNow();
    }
  }
}
