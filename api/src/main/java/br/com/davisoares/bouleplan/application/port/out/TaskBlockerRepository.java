package br.com.davisoares.bouleplan.application.port.out;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Persistence port for blocker links, which include links to hidden tasks. */
public interface TaskBlockerRepository {

  /** Stores the link unless it exists. */
  void add(UUID blockingId, UUID blockedId);

  /** Removes the link if it exists. */
  void remove(UUID blockingId, UUID blockedId);

  /** Whether {@code toTaskId} is blocked by {@code fromTaskId}, directly or through other tasks. */
  boolean reaches(UUID fromTaskId, UUID toTaskId);

  /** Every link that has one of the tasks on either side. */
  List<TaskBlockerLink> findTouching(Collection<UUID> taskIds);
}
