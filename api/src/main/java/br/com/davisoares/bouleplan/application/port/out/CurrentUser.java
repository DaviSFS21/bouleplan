package br.com.davisoares.bouleplan.application.port.out;

import java.util.UUID;

/** Identifies who is acting. */
public interface CurrentUser {

  /** Id of the acting user. */
  UUID id();
}
