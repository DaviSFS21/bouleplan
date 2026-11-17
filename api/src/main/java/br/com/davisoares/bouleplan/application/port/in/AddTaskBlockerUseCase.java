package br.com.davisoares.bouleplan.application.port.in;

import java.util.UUID;

/** Makes one task block another. */
public interface AddTaskBlockerUseCase {

  /**
   * Links the tasks, doing nothing if the link exists.
   *
   * @return {@code false} if either task is not an active, reachable task of the user
   * @throws br.com.davisoares.bouleplan.domain.TaskBlockerException if the link is a self link or
   *     would close a cycle
   */
  boolean add(UUID blockingId, UUID blockedId);
}
