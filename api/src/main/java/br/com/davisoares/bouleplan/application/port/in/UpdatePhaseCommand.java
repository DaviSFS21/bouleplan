package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand.Change;

/** Partial update of a phase: an absent change leaves the field alone. */
public record UpdatePhaseCommand(Change<String> name) {}
