package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand.Change;
import br.com.davisoares.bouleplan.domain.TaskPriority;
import br.com.davisoares.bouleplan.domain.TaskStatus;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Partial update of a task: an absent change leaves the field alone. */
public record UpdateTaskCommand(
    Change<String> title,
    Change<String> description,
    Change<LocalDate> deadline,
    Change<BigDecimal> estimatedEffort,
    Change<TaskPriority> priority,
    Change<TaskStatus> status,
    Change<Boolean> blocked) {}
