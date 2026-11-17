package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Task;
import java.util.Optional;
import java.util.UUID;

/** Applies to a task of the current user whose phase and initiative are active. */
public interface UnarchiveTaskUseCase {

  /** The unarchived task, or empty if the rules do not allow it. */
  Optional<Task> unarchive(UUID id);
}
