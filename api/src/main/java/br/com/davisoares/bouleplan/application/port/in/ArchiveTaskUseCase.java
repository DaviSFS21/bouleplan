package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Task;
import java.util.Optional;
import java.util.UUID;

/** Applies to a task of the current user whose epic and initiative are active. */
public interface ArchiveTaskUseCase {

  /** The archived task, or empty if the rules do not allow it. */
  Optional<Task> archive(UUID id);
}
