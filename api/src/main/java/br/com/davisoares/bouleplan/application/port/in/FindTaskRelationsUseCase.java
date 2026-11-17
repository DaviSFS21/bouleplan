package br.com.davisoares.bouleplan.application.port.in;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;

/** Reads the blocker links of tasks of the current user. */
public interface FindTaskRelationsUseCase {

  /**
   * The relations of each given task, which may itself be hidden. Links to hidden tasks are left
   * out but stay stored.
   */
  Map<UUID, TaskRelations> findFor(Collection<UUID> taskIds);

  /** The relations of every visible task of the user, in a number of queries that is constant. */
  Map<UUID, TaskRelations> findForAllVisible();
}
