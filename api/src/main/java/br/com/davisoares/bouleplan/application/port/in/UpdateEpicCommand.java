package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand.Change;

/** Partial update of an epic: an absent change leaves the field alone. */
public record UpdateEpicCommand(Change<String> name) {}
