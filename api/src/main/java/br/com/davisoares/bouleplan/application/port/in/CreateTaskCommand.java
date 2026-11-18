package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.TaskStatus;
import java.util.UUID;

/** A new task: {@code epicId} null means the implicit epic, {@code status} null means to do. */
public record CreateTaskCommand(String title, UUID epicId, TaskStatus status) {}
