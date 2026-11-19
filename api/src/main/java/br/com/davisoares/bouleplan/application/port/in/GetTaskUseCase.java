package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Task;
import java.util.Optional;
import java.util.UUID;

/** Reads one task of the current user. */
public interface GetTaskUseCase {

  /** The task if it is active and its epic and initiative are active and the user's. */
  Optional<Task> find(UUID id);
}
