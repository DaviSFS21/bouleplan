package br.com.davisoares.bouleplan.adapter.out.identity;

import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/** The single seeded user, until authentication exists. */
@ApplicationScoped
public class LocalCurrentUser implements CurrentUser {

  private final UUID userId;

  /** Reads the user id from configuration. */
  public LocalCurrentUser(@ConfigProperty(name = "bouleplan.local-user-id") UUID userId) {
    this.userId = userId;
  }

  @Override
  public UUID id() {
    return userId;
  }
}
