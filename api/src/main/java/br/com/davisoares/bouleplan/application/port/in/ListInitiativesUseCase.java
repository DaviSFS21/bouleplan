package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Initiative;
import java.util.List;

/** Lists the current user's active initiatives. */
public interface ListInitiativesUseCase {

  /** Active initiatives, oldest first. */
  List<Initiative> listActive();
}
