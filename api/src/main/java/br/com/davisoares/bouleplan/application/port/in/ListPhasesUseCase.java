package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Phase;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Lists the phases of an initiative of the current user. */
public interface ListPhasesUseCase {

  /**
   * Active named phases in creation order, or empty if the initiative is not active and the user's.
   */
  Optional<List<Phase>> listActive(UUID initiativeId);
}
