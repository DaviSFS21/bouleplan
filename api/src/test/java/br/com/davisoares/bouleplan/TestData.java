package br.com.davisoares.bouleplan;

import br.com.davisoares.bouleplan.domain.Initiative;
import io.quarkus.narayana.jta.QuarkusTransaction;

/** Database cleanup shared by tests that commit data (HTTP calls run in their own transaction). */
public final class TestData {

  private TestData() {}

  /** Deletes every initiative in a committed transaction. */
  public static void deleteAllInitiatives() {
    // A method reference would call the unenhanced Panache static and fail at runtime.
    QuarkusTransaction.requiringNew()
        .run(() -> {
          Initiative.deleteAll();
        });
  }
}
