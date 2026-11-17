package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Task;
import java.util.Optional;
import java.util.UUID;

/** Updates an active task of the current user. */
public interface UpdateTaskUseCase {

  /** The updated task, or empty if it is not an active task of the user. */
  Optional<Task> update(UUID id, UpdateTaskCommand command);
}
