package br.com.davisoares.bouleplan.application.port.out;

import br.com.davisoares.bouleplan.domain.Task;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Persistence port for tasks. */
public interface TaskRepository {

  /** Persists a new task. */
  void save(Task task);

  /**
   * Active tasks of the user whose phase and initiative are active, by priority (P1 first),
   * deadline (none last), creation and id.
   */
  List<Task> findVisibleByUser(UUID userId);

  /** An active task by id, if its phase and initiative are active and the user's. */
  Optional<Task> findVisibleByIdAndUser(UUID id, UUID userId);

  /** The phase and initiative of a task in any state, read without loading the task. */
  Optional<TaskLocation> findLocation(UUID id);

  /** A task in any state by id, locked for update until the transaction ends. */
  Optional<Task> findByIdForUpdate(UUID id);
}
