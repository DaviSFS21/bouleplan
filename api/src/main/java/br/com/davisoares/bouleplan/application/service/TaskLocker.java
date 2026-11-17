package br.com.davisoares.bouleplan.application.service;

import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import br.com.davisoares.bouleplan.application.port.out.InitiativeRepository;
import br.com.davisoares.bouleplan.application.port.out.PhaseRepository;
import br.com.davisoares.bouleplan.application.port.out.TaskLocation;
import br.com.davisoares.bouleplan.application.port.out.TaskRepository;
import br.com.davisoares.bouleplan.domain.Initiative;
import br.com.davisoares.bouleplan.domain.Phase;
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
 * Takes the row locks of a task write in the fixed order initiative, phase, task. Nothing is loaded
 * before its parent is locked. The phase of a task only changes under its initiative's lock, so it
 * is read again once that lock is held.
 */
@ApplicationScoped
class TaskLocker {

  private final TaskRepository tasks;
  private final PhaseRepository phases;
  private final InitiativeRepository initiatives;
  private final CurrentUser currentUser;

  TaskLocker(
      TaskRepository tasks,
      PhaseRepository phases,
      InitiativeRepository initiatives,
      CurrentUser currentUser) {
    this.tasks = tasks;
    this.phases = phases;
    this.initiatives = initiatives;
    this.currentUser = currentUser;
  }

  /** A task of the user in any state, whose phase and initiative are active, locked. */
  Optional<Task> lock(UUID id) {
    return lockInitiativeOf(id)
        .flatMap(initiative -> currentLocation(id))
        .flatMap(location ->
            phases.findByIdAndInitiativeForUpdate(location.phaseId(), location.initiativeId()))
        .filter(Phase::isActive)
        .flatMap(phase -> tasks.findByIdForUpdate(id));
  }

  /**
   * Like {@link #lock} for a task that is about to change phase. The current and the target phase
   * are locked by id order, so that opposite moves cannot deadlock. A {@code null} target is the
   * implicit phase, created if the initiative has none.
   */
  Optional<TaskMove> lockForMove(UUID id, UUID targetPhaseId) {
    return lockInitiativeOf(id)
        .flatMap(initiative -> currentLocation(id))
        .flatMap(location -> lockPhasesForMove(location, targetPhaseId))
        .flatMap(target ->
            tasks
                .findByIdForUpdate(id)
                .filter(Task::isActive)
                .map(task -> new TaskMove(task, target.get())));
  }

  // The target is a supplier so that an implicit phase is only created for a task that moves.
  private Optional<Supplier<Phase>> lockPhasesForMove(TaskLocation location, UUID targetPhaseId) {
    UUID initiativeId = location.initiativeId();
    UUID targetId =
        targetPhaseId == null
            ? phases.findImplicitIdByInitiative(initiativeId).orElse(null)
            : targetPhaseId;
    Map<UUID, Phase> locked =
        Stream.of(location.phaseId(), targetId)
            .filter(Objects::nonNull)
            .distinct()
            .sorted()
            .map(phaseId -> phases.findByIdAndInitiativeForUpdate(phaseId, initiativeId))
            .flatMap(Optional::stream)
            .collect(Collectors.toMap(Phase::getId, Function.identity()));
    return Optional.ofNullable(locked.get(location.phaseId()))
        .filter(Phase::isActive)
        .flatMap(current -> targetOf(locked, targetPhaseId, targetId, initiativeId));
  }

  private Optional<Supplier<Phase>> targetOf(
      Map<UUID, Phase> locked, UUID targetPhaseId, UUID targetId, UUID initiativeId) {
    Optional<Supplier<Phase>> target;
    if (targetPhaseId == null) {
      target =
          Optional.of(
              targetId == null ? () -> newImplicitPhase(initiativeId) : () -> locked.get(targetId));
    } else {
      target =
          Optional.ofNullable(locked.get(targetPhaseId))
              .filter(phase -> !phase.isImplicit() && phase.isActive())
              .map(phase -> () -> phase);
    }
    return target;
  }

  private Phase newImplicitPhase(UUID initiativeId) {
    Phase phase = Phase.createImplicit(initiativeId);
    phases.save(phase);
    return phase;
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

  /** A locked task and the locked phase it is going to. */
  record TaskMove(Task task, Phase target) {}
}
