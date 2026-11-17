package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Initiative;

/** Creates an initiative for the current user. */
public interface CreateInitiativeUseCase {

  /** Creates an initiative with an automatically suggested color. */
  Initiative create(String name);
}
