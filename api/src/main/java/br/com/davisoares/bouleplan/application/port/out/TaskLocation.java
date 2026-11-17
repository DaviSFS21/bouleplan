package br.com.davisoares.bouleplan.application.port.out;

import java.util.UUID;

/** The phase and initiative of a task, read without loading the task. */
public record TaskLocation(UUID phaseId, UUID initiativeId) {}
