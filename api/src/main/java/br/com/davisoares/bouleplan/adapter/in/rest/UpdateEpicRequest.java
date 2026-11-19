package br.com.davisoares.bouleplan.adapter.in.rest;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

/**
 * Body of {@code PATCH /epics/{id}}. Documentation only: {@link UpdateEpicParser} reads the raw
 * JSON, to reject unknown fields.
 */
@Schema(name = "UpdateEpicRequest")
public record UpdateEpicRequest(@Schema(maxLength = 200) String name) {}
