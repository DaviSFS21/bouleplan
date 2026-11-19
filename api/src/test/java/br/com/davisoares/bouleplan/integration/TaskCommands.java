package br.com.davisoares.bouleplan.integration;

import br.com.davisoares.bouleplan.application.port.in.CreateTaskCommand;
import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand.Change;
import br.com.davisoares.bouleplan.application.port.in.UpdateTaskCommand;
import java.util.UUID;

/** Builds task commands for the integration tests. */
final class TaskCommands {

  private TaskCommands() {}

  static CreateTaskCommand create(String title, UUID epicId) {
    return new CreateTaskCommand(title, epicId, null);
  }

  static UpdateTaskCommand renameTo(String title) {
    return new UpdateTaskCommand(
        Change.of(title),
        Change.absent(),
        Change.absent(),
        Change.absent(),
        Change.absent(),
        Change.absent(),
        Change.absent(),
        Change.absent(),
        Change.absent());
  }

  static UpdateTaskCommand moveTo(UUID epicId) {
    return new UpdateTaskCommand(
        Change.absent(),
        Change.absent(),
        Change.absent(),
        Change.absent(),
        Change.absent(),
        Change.absent(),
        Change.absent(),
        Change.of(epicId),
        Change.absent());
  }
}
