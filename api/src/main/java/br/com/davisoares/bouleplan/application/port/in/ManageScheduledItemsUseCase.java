package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.ScheduledItem;
import java.util.Optional;
import java.util.UUID;

/** Places tasks on days, as day-list entries or dedicated blocks. */
public interface ManageScheduledItemsUseCase {

  /** Adds an item for a task that is active, not done and the user's; empty if it is not. */
  Optional<ScheduledItem> create(CreateScheduledItemCommand command);

  /** Moves, resizes, reorders or changes the kind of an item; empty if its task is not usable. */
  Optional<ScheduledItem> update(UUID id, UpdateScheduledItemCommand command);

  /** Deletes an item whose task is active and the user's; false if there is none. */
  boolean delete(UUID id);
}
