package br.com.davisoares.bouleplan.application.port.in;

import java.util.UUID;

/** Ends the blocking of one task by another. */
public interface RemoveTaskBlockerUseCase {

  /**
   * Unlinks the tasks, doing nothing if there is no link.
   *
   * @return {@code false} if either task is not an active, reachable task of the user
   */
  boolean remove(UUID blockingId, UUID blockedId);
}
