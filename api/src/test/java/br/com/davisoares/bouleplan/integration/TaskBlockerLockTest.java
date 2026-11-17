package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.in.AddTaskBlockerUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreatePhaseUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateTaskUseCase;
import br.com.davisoares.bouleplan.application.port.in.RemoveTaskBlockerUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateTaskUseCase;
import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import br.com.davisoares.bouleplan.domain.Initiative;
import br.com.davisoares.bouleplan.domain.Phase;
import br.com.davisoares.bouleplan.domain.Task;
import br.com.davisoares.bouleplan.domain.TaskPriority;
import io.quarkus.narayana.jta.QuarkusTransaction;
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
class TaskBlockerLockTest {

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject CreatePhaseUseCase createPhase;
  @Inject CreateTaskUseCase createTask;
  @Inject UpdateTaskUseCase updateTask;
  @Inject AddTaskBlockerUseCase addBlocker;
  @Inject RemoveTaskBlockerUseCase removeBlocker;
  @Inject CurrentUser currentUser;
  @Inject EntityManager entityManager;

  private UUID initiativeId;
  private UUID design;
  private UUID build;
  private UUID first;
  private UUID second;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = createInitiative.create("Study").getId();
    design = createPhase.create(initiativeId, "Design").orElseThrow().getId();
    build = createPhase.create(initiativeId, "Build").orElseThrow().getId();
    first = createTask.create(initiativeId, TaskCommands.create("A", design)).orElseThrow().getId();
    second = createTask.create(initiativeId, TaskCommands.create("B", build)).orElseThrow().getId();
  }

  private long storedLinks() {
    return QuarkusTransaction.requiringNew()
        .call(() ->
            ((Number)
                    entityManager
                        .createNativeQuery("select count(*) from task_blocker")
                        .getSingleResult())
                .longValue());
  }

  private void holdUser() {
    entityManager
        .createNativeQuery("select id from app_user where id = ?1 for update")
        .setParameter(1, currentUser.id())
        .getResultList();
  }

  @Test
  @DisplayName("a link write waits for the user lock")
  void addWaitsForUserLock() throws InterruptedException, ExecutionException {
    boolean linked = HeldLock.writeWhileHeld(this::holdUser, () -> addBlocker.add(first, second));

    assertThat(linked).isTrue();
    assertThat(storedLinks()).isEqualTo(1);
  }

  @Test
  @DisplayName("an unlink waits for the user lock")
  void removeWaitsForUserLock() throws InterruptedException, ExecutionException {
    addBlocker.add(first, second);

    boolean removed =
        HeldLock.writeWhileHeld(this::holdUser, () -> removeBlocker.remove(first, second));

    assertThat(removed).isTrue();
    assertThat(storedLinks()).isZero();
  }

  @Test
  @DisplayName("a link write waits for a concurrent initiative archive and is then refused")
  void addWaitsForInitiativeLock() throws InterruptedException, ExecutionException {
    boolean linked =
        HeldLock.writeWhileHeld(
            () ->
                entityManager
                    .find(Initiative.class, initiativeId, LockModeType.PESSIMISTIC_WRITE)
                    .archive(),
            () -> addBlocker.add(first, second));

    assertThat(linked).isFalse();
    assertThat(storedLinks()).isZero();
  }

  @Test
  @DisplayName("a link write waits for a concurrent phase archive and is then refused")
  void addWaitsForPhaseLock() throws InterruptedException, ExecutionException {
    boolean linked =
        HeldLock.writeWhileHeld(
            () -> entityManager.find(Phase.class, build, LockModeType.PESSIMISTIC_WRITE).archive(),
            () -> addBlocker.add(first, second));

    assertThat(linked).isFalse();
    assertThat(storedLinks()).isZero();
  }

  @Test
  @DisplayName("a link write waits for a concurrent write to either task and keeps both")
  void addWaitsForTaskLock() throws InterruptedException, ExecutionException {
    boolean linked =
        HeldLock.writeWhileHeld(
            () ->
                entityManager
                    .find(Task.class, second, LockModeType.PESSIMISTIC_WRITE)
                    .prioritize(TaskPriority.P1),
            () -> addBlocker.add(first, second));

    assertThat(linked).isTrue();
    assertThat(storedLinks()).isEqualTo(1);
    assertThat(
            QuarkusTransaction.requiringNew()
                .call(() -> entityManager.find(Task.class, second).getPriority()))
        .isEqualTo(TaskPriority.P1);
  }

  @Test
  @DisplayName("a phase move waits for a concurrent archive of the target phase and is refused")
  void moveWaitsForTargetPhaseLock() throws InterruptedException, ExecutionException {
    boolean moved =
        HeldLock.writeWhileHeld(
            () -> entityManager.find(Phase.class, build, LockModeType.PESSIMISTIC_WRITE).archive(),
            () -> updateTask.update(first, TaskCommands.moveTo(build)).isPresent());

    assertThat(moved).isFalse();
    assertThat(
            QuarkusTransaction.requiringNew()
                .call(() -> entityManager.find(Task.class, first).getPhase().getId()))
        .isEqualTo(design);
  }
}
