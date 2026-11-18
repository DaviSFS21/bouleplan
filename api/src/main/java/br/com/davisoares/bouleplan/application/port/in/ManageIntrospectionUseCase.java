package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Introspection;
import java.time.LocalDate;
import java.util.List;

/** Reads, fills in and closes the weekly review sheet of the current user. */
public interface ManageIntrospectionUseCase {

  /** The stored sheet of the week, or an unsaved empty one when there is none. */
  Introspection get(LocalDate weekStart);

  /** Saves the answers into the week's open sheet, creating it if needed. */
  Introspection save(LocalDate weekStart, List<AnswerChange> changes);

  /** Closes the week's sheet, creating an empty one if needed. */
  Introspection close(LocalDate weekStart);
}
