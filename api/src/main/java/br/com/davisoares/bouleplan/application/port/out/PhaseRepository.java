package br.com.davisoares.bouleplan.application.port.out;

import br.com.davisoares.bouleplan.domain.Phase;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Persistence port for phases. Implicit phases are never returned. */
public interface PhaseRepository {

  /** Persists a new phase. */
  void save(Phase phase);

  /** Active named phases of an initiative, oldest first. */
  List<Phase> findActiveNamedByInitiative(UUID initiativeId);

  /** An active named phase by id, if its initiative is active and the user's. */
  Optional<Phase> findActiveNamedByIdAndUser(UUID id, UUID userId);

  /** The owning initiative of a named phase in any state, read without loading the phase. */
  Optional<UUID> findInitiativeIdOfNamed(UUID id);

  /**
   * A named phase in any state by id, if its initiative is active and the user's, locked for update
   * until the transaction ends.
   */
  Optional<Phase> findNamedByIdAndUserForUpdate(UUID id, UUID userId);
}
