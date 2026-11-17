package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.TaskStatus;
import java.util.UUID;

/** A new task: {@code phaseId} null means the implicit phase, {@code status} null means to do. */
public record CreateTaskCommand(String title, UUID phaseId, TaskStatus status) {}
