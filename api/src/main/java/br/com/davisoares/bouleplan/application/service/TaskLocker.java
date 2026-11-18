package br.com.davisoares.bouleplan.application.service;

import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import br.com.davisoares.bouleplan.application.port.out.EpicRepository;
import br.com.davisoares.bouleplan.application.port.out.InitiativeRepository;
import br.com.davisoares.bouleplan.application.port.out.TaskLocation;
import br.com.davisoares.bouleplan.application.port.out.TaskRepository;
import br.com.davisoares.bouleplan.domain.Epic;
import br.com.davisoares.bouleplan.domain.Initiative;
import br.com.davisoares.bouleplan.domain.Task;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Takes the row locks of a task write in the fixed order initiative, epic, task. Nothing is loaded
 * before its parent is locked. The epic of a task only changes under its initiative's lock, so it
 * is read again once that lock is held.
 */
@ApplicationScoped
class TaskLocker {

  private final TaskRepository tasks;
  private final EpicRepository epics;
  private final InitiativeRepository initiatives;
  private final CurrentUser currentUser;

  TaskLocker(
      TaskRepository tasks,
      EpicRepository epics,
      InitiativeRepository initiatives,
      CurrentUser currentUser) {
    this.tasks = tasks;
    this.epics = epics;
    this.initiatives = initiatives;
    this.currentUser = currentUser;
  }

  /** A task of the user in any state, whose epic and initiative are active, locked. */
  Optional<Task> lock(UUID id) {
    return lockInitiativeOf(id)
        .flatMap(initiative -> currentLocation(id))
        .flatMap(location ->
            epics.findByIdAndInitiativeForUpdate(location.epicId(), location.initiativeId()))
        .filter(Epic::isActive)
        .flatMap(epic -> tasks.findByIdForUpdate(id));
  }

  /**
   * Like {@link #lock} for a task that is about to change epic. The current and the target epic are
   * locked by id order, so that opposite moves cannot deadlock. A {@code null} target is the
   * implicit epic, created if the initiative has none.
   */
  Optional<TaskMove> lockForMove(UUID id, UUID targetEpicId) {
    return lockInitiativeOf(id)
        .flatMap(initiative -> currentLocation(id))
        .flatMap(location -> lockEpicsForMove(location, targetEpicId))
        .flatMap(target ->
            tasks
                .findByIdForUpdate(id)
                .filter(Task::isActive)
                .map(task -> new TaskMove(task, target.get())));
  }

  // The target is a supplier so that an implicit epic is only created for a task that moves.
  private Optional<Supplier<Epic>> lockEpicsForMove(TaskLocation location, UUID targetEpicId) {
    UUID initiativeId = location.initiativeId();
    UUID targetId =
        targetEpicId == null
            ? epics.findImplicitIdByInitiative(initiativeId).orElse(null)
            : targetEpicId;
    Map<UUID, Epic> locked =
        Stream.of(location.epicId(), targetId)
            .filter(Objects::nonNull)
            .distinct()
            .sorted()
            .map(epicId -> epics.findByIdAndInitiativeForUpdate(epicId, initiativeId))
            .flatMap(Optional::stream)
            .collect(Collectors.toMap(Epic::getId, Function.identity()));
    return Optional.ofNullable(locked.get(location.epicId()))
        .filter(Epic::isActive)
        .flatMap(current -> targetOf(locked, targetEpicId, targetId, initiativeId));
  }

  private Optional<Supplier<Epic>> targetOf(
      Map<UUID, Epic> locked, UUID targetEpicId, UUID targetId, UUID initiativeId) {
    Optional<Supplier<Epic>> target;
    if (targetEpicId == null) {
      target =
          Optional.of(
              targetId == null ? () -> newImplicitEpic(initiativeId) : () -> locked.get(targetId));
    } else {
      target =
          Optional.ofNullable(locked.get(targetEpicId))
              .filter(epic -> !epic.isImplicit() && epic.isActive())
              .map(epic -> () -> epic);
    }
    return target;
  }

  private Epic newImplicitEpic(UUID initiativeId) {
    Epic epic = Epic.createImplicit(initiativeId);
    epics.save(epic);
    return epic;
  }

  private Optional<Initiative> lockInitiativeOf(UUID taskId) {
    return tasks
        .findLocation(taskId)
        .flatMap(location ->
            initiatives.findByIdAndUserForUpdate(location.initiativeId(), currentUser.id()))
        .filter(Initiative::isActive);
  }

  private Optional<TaskLocation> currentLocation(UUID taskId) {
    return tasks.findLocation(taskId);
  }

  /** A locked task and the locked epic it is going to. */
  record TaskMove(Task task, Epic target) {}
}
