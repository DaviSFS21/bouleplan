package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Task;
import java.util.Optional;
import java.util.UUID;

/** Adds a task to an initiative of the current user. */
public interface CreateTaskUseCase {

  /**
   * The new task, or empty if the initiative is not active and the user's, or the epic is not an
   * active named epic of that initiative.
   */
  Optional<Task> create(UUID initiativeId, CreateTaskCommand command);
}
