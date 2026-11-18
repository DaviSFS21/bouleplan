package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Task;
import java.util.Optional;
import java.util.UUID;

/** Applies to a task of the current user whose epic and initiative are active. */
public interface DeleteTaskUseCase {

  /** The deleted task, or empty if the rules do not allow it. */
  Optional<Task> delete(UUID id);
}
