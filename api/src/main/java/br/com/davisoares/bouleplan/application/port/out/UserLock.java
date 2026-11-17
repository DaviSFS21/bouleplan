package br.com.davisoares.bouleplan.application.port.out;

import java.util.UUID;

/** Serializes work per user for the duration of the current transaction. */
public interface UserLock {

  /** Blocks until the user's lock is held; released when the transaction ends. */
  void lock(UUID userId);
}
