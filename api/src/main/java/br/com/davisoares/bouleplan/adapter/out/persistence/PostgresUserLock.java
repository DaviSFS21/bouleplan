package br.com.davisoares.bouleplan.adapter.out.persistence;

import br.com.davisoares.bouleplan.application.port.out.UserLock;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import java.util.UUID;

/** Locks the user's {@code app_user} row with {@code select ... for update}. */
@ApplicationScoped
public class PostgresUserLock implements UserLock {

  private final EntityManager entityManager;

  /** Wires the entity manager. */
  public PostgresUserLock(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  @Override
  public void lock(UUID userId) {
    entityManager
        .createNativeQuery("select id from app_user where id = ?1 for update")
        .setParameter(1, userId)
        .getResultList();
  }
}
