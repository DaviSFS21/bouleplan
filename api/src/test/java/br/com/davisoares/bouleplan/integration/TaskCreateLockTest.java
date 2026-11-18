package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.in.CreateEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateTaskUseCase;
import br.com.davisoares.bouleplan.domain.Epic;
import br.com.davisoares.bouleplan.domain.Initiative;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskCreateLockTest {

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject CreateEpicUseCase createEpic;
  @Inject CreateTaskUseCase createTask;
  @Inject EntityManager entityManager;

  private UUID initiativeId;
  private UUID epicId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = createInitiative.create("Study").getId();
    epicId = createEpic.create(initiativeId, "Design").orElseThrow().getId();
  }

  @Test
  @DisplayName("a task create waits for a concurrent initiative archive and is then refused")
  void createWaitsForInitiativeLock() throws InterruptedException, ExecutionException {
    boolean created =
        HeldLock.writeWhileHeld(
            () ->
                entityManager
                    .find(Initiative.class, initiativeId, LockModeType.PESSIMISTIC_WRITE)
                    .archive(),
            () -> createTask.create(initiativeId, TaskCommands.create("New", null)).isPresent());

    assertThat(created).isFalse();
    assertThat(TestData.countImplicitEpics(entityManager, initiativeId.toString())).isZero();
  }

  @Test
  @DisplayName("a task create in an epic waits for a concurrent epic archive and is then refused")
  void createWaitsForEpicLock() throws InterruptedException, ExecutionException {
    boolean created =
        HeldLock.writeWhileHeld(
            () -> entityManager.find(Epic.class, epicId, LockModeType.PESSIMISTIC_WRITE).archive(),
            () -> createTask.create(initiativeId, TaskCommands.create("New", epicId)).isPresent());

    assertThat(created).isFalse();
  }
}
