package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.ScheduledItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Reads the dedicated blocks of one task. */
public interface ListTaskScheduledItemsUseCase {

  /** The blocks of the task on any date, by date and start; empty if the task is not visible. */
  Optional<List<ScheduledItem>> findBlocksOf(UUID taskId);
}
