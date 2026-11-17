package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.in.CreateCalendarEventCommand;
import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateScheduledItemCommand;
import br.com.davisoares.bouleplan.application.port.in.CreateTaskUseCase;
import br.com.davisoares.bouleplan.application.port.in.ManageCalendarEventsUseCase;
import br.com.davisoares.bouleplan.application.port.in.ManageScheduledItemsUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateCalendarEventCommand;
import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand.Change;
import br.com.davisoares.bouleplan.application.port.in.UpdateScheduledItemCommand;
import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import br.com.davisoares.bouleplan.domain.Initiative;
import br.com.davisoares.bouleplan.domain.Task;
import br.com.davisoares.bouleplan.domain.TaskPriority;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
@SuppressWarnings({"PMD.TooManyMethods"}) // one test per lock
class ScheduleLockTest {

  private static final LocalDate DAY = LocalDate.of(2026, 11, 17);
  private static final LocalTime NINE = LocalTime.of(9, 0);
  private static final LocalTime TEN = LocalTime.of(10, 0);

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject CreateTaskUseCase createTask;
  @Inject ManageScheduledItemsUseCase manageItems;
  @Inject ManageCalendarEventsUseCase manageEvents;
  @Inject CurrentUser currentUser;
  @Inject EntityManager entityManager;

  private UUID initiativeId;
  private UUID taskId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = createInitiative.create("Study").getId();
    taskId = createTask.create(initiativeId, TaskCommands.create("A", null)).orElseThrow().getId();
  }

  private void holdUser() {
    entityManager
        .createNativeQuery("select id from app_user where id = ?1 for update")
        .setParameter(1, currentUser.id())
        .getResultList();
  }

  private UUID newBlock() {
    return manageItems
        .create(new CreateScheduledItemCommand(taskId, DAY, NINE, TEN))
        .orElseThrow()
        .getId();
  }

  private static UpdateScheduledItemCommand resize() {
    return new UpdateScheduledItemCommand(
        Change.absent(), Change.absent(), Change.of(LocalTime.of(11, 0)), Change.absent());
  }

  private ScheduleDb db() {
    return new ScheduleDb(entityManager);
  }

  @Test
  @DisplayName("an item create waits for the user lock")
  void createItemWaitsForUserLock() throws InterruptedException, ExecutionException {
    boolean created =
        HeldLock.writeWhileHeld(
            this::holdUser,
            () ->
                manageItems
                    .create(new CreateScheduledItemCommand(taskId, DAY, NINE, TEN))
                    .isPresent());

    assertThat(created).isTrue();
    assertThat(db().storedItems()).isEqualTo(1);
  }

  @Test
  @DisplayName("an item update waits for the user lock")
  void updateItemWaitsForUserLock() throws InterruptedException, ExecutionException {
    UUID id = newBlock();

    boolean updated =
        HeldLock.writeWhileHeld(this::holdUser, () -> manageItems.update(id, resize()).isPresent());

    assertThat(updated).isTrue();
  }

  @Test
  @DisplayName("an item delete waits for the user lock")
  void deleteItemWaitsForUserLock() throws InterruptedException, ExecutionException {
    UUID id = newBlock();

    boolean deleted = HeldLock.writeWhileHeld(this::holdUser, () -> manageItems.delete(id));

    assertThat(deleted).isTrue();
    assertThat(db().storedItems()).isZero();
  }

  @Test
  @DisplayName("an event create, update and delete wait for the user lock")
  void eventWritesWaitForUserLock() throws InterruptedException, ExecutionException {
    boolean created =
        HeldLock.writeWhileHeld(
            this::holdUser,
            () ->
                manageEvents.create(new CreateCalendarEventCommand("Dentist", DAY, NINE, TEN))
                    != null);
    UUID id = manageEvents.create(new CreateCalendarEventCommand("Doctor", DAY, NINE, TEN)).getId();
    UpdateCalendarEventCommand rename =
        new UpdateCalendarEventCommand(
            Change.of("Renamed"), Change.absent(), Change.absent(), Change.absent());

    boolean updated =
        HeldLock.writeWhileHeld(this::holdUser, () -> manageEvents.update(id, rename).isPresent());
    boolean deleted = HeldLock.writeWhileHeld(this::holdUser, () -> manageEvents.delete(id));

    assertThat(created).isTrue();
    assertThat(updated).isTrue();
    assertThat(deleted).isTrue();
    assertThat(db().storedEvents()).isEqualTo(1);
  }

  @Test
  @DisplayName("an item create waits for a concurrent initiative archive and is then refused")
  void createWaitsForInitiativeLock() throws InterruptedException, ExecutionException {
    boolean created =
        HeldLock.writeWhileHeld(
            () ->
                entityManager
                    .find(Initiative.class, initiativeId, LockModeType.PESSIMISTIC_WRITE)
                    .archive(),
            () ->
                manageItems
                    .create(new CreateScheduledItemCommand(taskId, DAY, NINE, TEN))
                    .isPresent());

    assertThat(created).isFalse();
    assertThat(db().storedItems()).isZero();
  }

  @Test
  @DisplayName("an item update waits for a concurrent write to its task and keeps both")
  void updateWaitsForTaskLock() throws InterruptedException, ExecutionException {
    UUID id = newBlock();

    boolean updated =
        HeldLock.writeWhileHeld(
            () ->
                entityManager
                    .find(Task.class, taskId, LockModeType.PESSIMISTIC_WRITE)
                    .prioritize(TaskPriority.P1),
            () -> manageItems.update(id, resize()).isPresent());

    assertThat(updated).isTrue();
  }
}
