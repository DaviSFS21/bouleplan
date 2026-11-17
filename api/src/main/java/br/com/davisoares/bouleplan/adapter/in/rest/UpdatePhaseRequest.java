package br.com.davisoares.bouleplan.adapter.in.rest;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

/**
 * Body of {@code PATCH /phases/{id}}. Documentation only: {@link UpdatePhaseParser} reads the raw
 * JSON, to reject unknown fields.
 */
@Schema(name = "UpdatePhaseRequest")
public record UpdatePhaseRequest(@Schema(maxLength = 200) String name) {}
