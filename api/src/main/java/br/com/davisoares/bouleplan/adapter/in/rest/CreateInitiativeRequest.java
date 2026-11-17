package br.com.davisoares.bouleplan.adapter.in.rest;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

/** Body of {@code POST /initiatives}. */
@Schema(name = "CreateInitiativeRequest")
public record CreateInitiativeRequest(@Schema(required = true, maxLength = 200) String name) {}
