package br.com.davisoares.bouleplan.application.port.in;

import java.util.List;
import java.util.UUID;

/** The visible tasks on the other side of a task's blocker links, in task list order. */
public record TaskRelations(List<UUID> blocks, List<UUID> blockedBy) {

  /** A task without visible links. */
  public static final TaskRelations NONE = new TaskRelations(List.of(), List.of());
}
