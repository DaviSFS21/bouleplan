package br.com.davisoares.bouleplan.application.service;

import br.com.davisoares.bouleplan.application.port.in.ArchiveTaskUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateTaskCommand;
import br.com.davisoares.bouleplan.application.port.in.CreateTaskUseCase;
import br.com.davisoares.bouleplan.application.port.in.DeleteTaskUseCase;
import br.com.davisoares.bouleplan.application.port.in.GetTaskUseCase;
import br.com.davisoares.bouleplan.application.port.in.ListTasksUseCase;
import br.com.davisoares.bouleplan.application.port.in.RestoreTaskUseCase;
import br.com.davisoares.bouleplan.application.port.in.UnarchiveTaskUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateTaskCommand;
import br.com.davisoares.bouleplan.application.port.in.UpdateTaskUseCase;
import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import br.com.davisoares.bouleplan.application.port.out.EpicRepository;
import br.com.davisoares.bouleplan.application.port.out.InitiativeRepository;
import br.com.davisoares.bouleplan.application.port.out.TaskRepository;
import br.com.davisoares.bouleplan.domain.Epic;
import br.com.davisoares.bouleplan.domain.Initiative;
import br.com.davisoares.bouleplan.domain.Task;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Use cases for tasks. */
@SuppressWarnings("PMD.TooManyMethods") // one method per use case plus the lock helpers
@ApplicationScoped
public class TaskService
    implements ListTasksUseCase,
        CreateTaskUseCase,
        GetTaskUseCase,
        UpdateTaskUseCase,
        ArchiveTaskUseCase,
        UnarchiveTaskUseCase,
        DeleteTaskUseCase,
        RestoreTaskUseCase {

  private final TaskRepository tasks;
  private final EpicRepository epics;
  private final InitiativeRepository initiatives;
  private final CurrentUser currentUser;
  private final TaskLocker locker;

  /** Wires the outbound ports. */
  public TaskService(
      TaskRepository tasks,
      EpicRepository epics,
      InitiativeRepository initiatives,
      CurrentUser currentUser,
      TaskLocker locker) {
    this.tasks = tasks;
    this.epics = epics;
    this.initiatives = initiatives;
    this.currentUser = currentUser;
    this.locker = locker;
  }

  @Override
  public List<Task> listActive() {
    return tasks.findVisibleByUser(currentUser.id());
  }

  // Locking the initiative serializes the creation of the implicit epic.
  @Override
  @Transactional
  public Optional<Task> create(UUID initiativeId, CreateTaskCommand command) {
    return initiatives
        .findByIdAndUserForUpdate(initiativeId, currentUser.id())
        .filter(Initiative::isActive)
        .flatMap(initiative -> epicFor(initiative, command.epicId()))
        .map(epic -> {
          Task task = Task.create(epic, command.title(), command.status());
          tasks.save(task);
          return task;
        });
  }

  @Override
  public Optional<Task> find(UUID id) {
    return tasks.findVisibleByIdAndUser(id, currentUser.id());
  }

  @Override
  @Transactional
  public Optional<Task> update(UUID id, UpdateTaskCommand command) {
    Optional<Task> updated;
    if (command.epicId().present()) {
      updated =
          locker
              .lockForMove(id, command.epicId().value())
              .filter(move -> move.task().isActive())
              .map(move -> {
                move.task().moveToEpic(move.target());
                return move.task();
              });
    } else {
      updated = findActiveForUpdate(id);
    }
    return updated.map(task -> applyChanges(task, command));
  }

  private static Task applyChanges(Task task, UpdateTaskCommand command) {
    if (command.title().present()) {
      task.rename(command.title().value());
    }
    if (command.description().present()) {
      task.describe(command.description().value());
    }
    if (command.deadline().present()) {
      task.scheduleDeadline(command.deadline().value());
    }
    if (command.estimatedEffort().present()) {
      task.estimate(command.estimatedEffort().value());
    }
    return applyState(task, command);
  }

  private static Task applyState(Task task, UpdateTaskCommand command) {
    if (command.priority().present()) {
      task.prioritize(command.priority().value());
    }
    if (command.status().present()) {
      task.moveTo(command.status().value());
    }
    if (command.blocked().present()) {
      task.markBlocked(command.blocked().value());
    }
    if (command.plannedWeekStart().present()) {
      task.planWeek(command.plannedWeekStart().value());
    }
    return task;
  }

  @Override
  @Transactional
  public Optional<Task> archive(UUID id) {
    return findActiveForUpdate(id)
        .map(task -> {
          task.archive();
          return task;
        });
  }

  @Override
  @Transactional
  public Optional<Task> unarchive(UUID id) {
    return lockForWrite(id)
        .filter(task -> !task.isDeleted())
        .map(task -> {
          task.unarchive();
          return task;
        });
  }

  @Override
  @Transactional
  public Optional<Task> delete(UUID id) {
    return findActiveForUpdate(id)
        .map(task -> {
          task.softDelete();
          return task;
        });
  }

  @Override
  @Transactional
  public Optional<Task> restore(UUID id) {
    return lockForWrite(id)
        .map(task -> {
          task.restore();
          return task;
        });
  }

  private Optional<Epic> epicFor(Initiative initiative, UUID epicId) {
    return epicId == null
        ? Optional.of(implicitEpicOf(initiative.getId()))
        : epics
            .findByIdAndInitiativeForUpdate(epicId, initiative.getId())
            .filter(epic -> !epic.isImplicit() && epic.isActive());
  }

  private Epic implicitEpicOf(UUID initiativeId) {
    return epics
        .findImplicitByInitiativeForUpdate(initiativeId)
        .orElseGet(() -> {
          Epic epic = Epic.createImplicit(initiativeId);
          epics.save(epic);
          return epic;
        });
  }

  private Optional<Task> findActiveForUpdate(UUID id) {
    return lockForWrite(id).filter(Task::isActive);
  }

  private Optional<Task> lockForWrite(UUID id) {
    return locker.lock(id);
  }
}
