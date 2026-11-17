package br.com.davisoares.bouleplan.integration;

import br.com.davisoares.bouleplan.domain.Task;
import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.persistence.EntityManager;
import java.util.UUID;

/** Reads and clears blocker state in committed transactions, for the concurrency tests. */
record BlockerDb(EntityManager entityManager) {

  void clearBlockers() {
    QuarkusTransaction.requiringNew()
        .run(() -> entityManager.createNativeQuery("delete from task_blocker").executeUpdate());
  }

  UUID phaseOf(UUID taskId) {
    return QuarkusTransaction.requiringNew()
        .call(() -> entityManager.find(Task.class, taskId).getPhase().getId());
  }

  long storedLinks() {
    return QuarkusTransaction.requiringNew()
        .call(() ->
            ((Number)
                    entityManager
                        .createNativeQuery("select count(*) from task_blocker")
                        .getSingleResult())
                .longValue());
  }
}
