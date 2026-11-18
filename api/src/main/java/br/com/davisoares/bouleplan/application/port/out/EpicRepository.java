package br.com.davisoares.bouleplan.application.port.out;

import br.com.davisoares.bouleplan.domain.Epic;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Persistence port for epics. Only the task use cases reach implicit epics. */
public interface EpicRepository {

  /** Persists a new epic. */
  void save(Epic epic);

  /** Active named epics of an initiative, oldest first. */
  List<Epic> findActiveNamedByInitiative(UUID initiativeId);

  /** An active named epic by id, if its initiative is active and the user's. */
  Optional<Epic> findActiveNamedByIdAndUser(UUID id, UUID userId);

  /** The owning initiative of a named epic in any state, read without loading the epic. */
  Optional<UUID> findInitiativeIdOfNamed(UUID id);

  /**
   * A named epic in any state by id, if its initiative is active and the user's, locked for update
   * until the transaction ends.
   */
  Optional<Epic> findNamedByIdAndUserForUpdate(UUID id, UUID userId);

  /**
   * An epic of any kind and state of the given initiative, locked for update until the transaction
   * ends.
   */
  Optional<Epic> findByIdAndInitiativeForUpdate(UUID id, UUID initiativeId);

  /** The id of the implicit epic of an initiative, if it exists, read without locking it. */
  Optional<UUID> findImplicitIdByInitiative(UUID initiativeId);

  /** The implicit epic of an initiative, if it exists, locked for update. */
  Optional<Epic> findImplicitByInitiativeForUpdate(UUID initiativeId);
}
