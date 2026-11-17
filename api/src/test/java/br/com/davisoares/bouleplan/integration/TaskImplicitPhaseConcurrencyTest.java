package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateTaskUseCase;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskImplicitPhaseConcurrencyTest {

  private static final int ROUNDS = 25;

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject CreateTaskUseCase createTask;
  @Inject EntityManager entityManager;

  @BeforeEach
  void cleanDatabase() {
    TestData.deleteAllInitiatives();
  }

  private boolean createIn(UUID initiativeId, String title) {
    return createTask.create(initiativeId, TaskCommands.create(title, null)).isPresent();
  }

  private long countTasks(UUID initiativeId) {
    return QuarkusTransaction.requiringNew()
        .call(() ->
            (Long)
                entityManager
                    .createQuery("select count(t) from Task t where t.phase.initiativeId = ?1")
                    .setParameter(1, initiativeId)
                    .getSingleResult());
  }

  @Test
  @DisplayName("two concurrent first tasks create one implicit phase and both are stored")
  void concurrentFirstTasksShareOneImplicitPhase() throws ExecutionException, InterruptedException {
    for (int round = 0; round < ROUNDS; round++) {
      UUID initiativeId = createInitiative.create("Study " + round).getId();
      List<Boolean> created = Races.newOutcomes();

      Races.race(
          () -> created.add(createIn(initiativeId, "A")),
          () -> created.add(createIn(initiativeId, "B")));

      assertThat(created).as("round %d", round).containsExactly(true, true);
      assertThat(TestData.countImplicitPhases(entityManager, initiativeId.toString()))
          .as("round %d", round)
          .isEqualTo(1);
      assertThat(countTasks(initiativeId)).as("round %d", round).isEqualTo(2);
    }
  }
}
