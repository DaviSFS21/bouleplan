package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Task;
import java.util.List;

/** Lists the tasks of the current user. */
public interface ListTasksUseCase {

  /**
   * Active tasks whose epic and initiative are active: priority (P1 first), deadline (none last),
   * creation.
   */
  List<Task> listActive();
}
