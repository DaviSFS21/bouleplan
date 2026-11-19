package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Epic;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Lists the epics of an initiative of the current user. */
public interface ListEpicsUseCase {

  /**
   * Active named epics in creation order, or empty if the initiative is not active and the user's.
   */
  Optional<List<Epic>> listActive(UUID initiativeId);
}
