package br.com.davisoares.bouleplan.application.port.in;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;

/** Reads the reserved time of tasks of the current user. */
public interface FindTaskReservationsUseCase {

  /** The reserved time of each given task, in a number of queries that is constant. */
  Map<UUID, TaskReservation> findFor(Collection<UUID> taskIds);
}
