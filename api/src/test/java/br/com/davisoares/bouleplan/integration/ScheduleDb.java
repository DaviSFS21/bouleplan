package br.com.davisoares.bouleplan.integration;

import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.persistence.EntityManager;

/** Reads and clears scheduled items in committed transactions, for the concurrency tests. */
record ScheduleDb(EntityManager entityManager) {

  void clearItems() {
    QuarkusTransaction.requiringNew()
        .run(() -> entityManager.createNativeQuery("delete from scheduled_item").executeUpdate());
  }

  long storedItems() {
    return count("select count(*) from scheduled_item");
  }

  long storedEvents() {
    return count("select count(*) from calendar_event");
  }

  private long count(String sql) {
    return QuarkusTransaction.requiringNew()
        .call(() -> ((Number) entityManager.createNativeQuery(sql).getSingleResult()).longValue());
  }
}
