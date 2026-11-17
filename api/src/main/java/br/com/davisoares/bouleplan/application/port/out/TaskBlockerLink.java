package br.com.davisoares.bouleplan.application.port.out;

import java.util.UUID;

/** One stored blocker row. */
public record TaskBlockerLink(UUID blockingId, UUID blockedId) {}
