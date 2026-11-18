package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.in.CreateEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateTaskUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateTaskUseCase;
import br.com.davisoares.bouleplan.domain.Epic;
import br.com.davisoares.bouleplan.domain.Initiative;
import br.com.davisoares.bouleplan.domain.Task;
import br.com.davisoares.bouleplan.domain.TaskPriority;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskLockTest {

  private static final String ORIGINAL = "Original";
  private static final String RENAMED = "Renamed";

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject CreateEpicUseCase createEpic;
  @Inject CreateTaskUseCase createTask;
  @Inject UpdateTaskUseCase updateTask;
  @Inject EntityManager entityManager;

  private UUID initiativeId;
  private UUID epicId;
  private UUID taskId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = createInitiative.create("Study").getId();
    epicId = createEpic.create(initiativeId, "Design").orElseThrow().getId();
    taskId =
        createTask
            .create(initiativeId, TaskCommands.create(ORIGINAL, epicId))
            .orElseThrow()
            .getId();
  }

  private Callable<Boolean> rename() {
    return () -> updateTask.update(taskId, TaskCommands.renameTo(RENAMED)).isPresent();
  }

  private Task reload() {
    return QuarkusTransaction.requiringNew().call(() -> entityManager.find(Task.class, taskId));
  }

  @Test
  @DisplayName("a task write waits for a concurrent initiative archive and is then refused")
  void taskWriteWaitsForInitiativeLock() throws InterruptedException, ExecutionException {
    boolean applied =
        HeldLock.writeWhileHeld(
            () ->
                entityManager
                    .find(Initiative.class, initiativeId, LockModeType.PESSIMISTIC_WRITE)
                    .archive(),
            rename());

    assertThat(applied).isFalse();
    assertThat(reload().getTitle()).isEqualTo(ORIGINAL);
  }

  @Test
  @DisplayName("a task write waits for a concurrent epic archive and is then refused")
  void taskWriteWaitsForEpicLock() throws InterruptedException, ExecutionException {
    boolean applied =
        HeldLock.writeWhileHeld(
            () -> entityManager.find(Epic.class, epicId, LockModeType.PESSIMISTIC_WRITE).archive(),
            rename());

    assertThat(applied).isFalse();
    assertThat(reload().getTitle()).isEqualTo(ORIGINAL);
  }

  @Test
  @DisplayName("a task write waits for a concurrent write to the same task and keeps both")
  void taskWriteWaitsForTaskLock() throws InterruptedException, ExecutionException {
    boolean applied =
        HeldLock.writeWhileHeld(
            () ->
                entityManager
                    .find(Task.class, taskId, LockModeType.PESSIMISTIC_WRITE)
                    .prioritize(TaskPriority.P1),
            rename());

    assertThat(applied).isTrue();
    Task task = reload();
    assertThat(task.getTitle()).isEqualTo(RENAMED);
    assertThat(task.getPriority()).isEqualTo(TaskPriority.P1);
  }
}
