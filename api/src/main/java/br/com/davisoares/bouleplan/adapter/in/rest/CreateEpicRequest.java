package br.com.davisoares.bouleplan.adapter.in.rest;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

/** Body of {@code POST /initiatives/{id}/epics}. */
@Schema(name = "CreateEpicRequest")
public record CreateEpicRequest(@Schema(required = true, maxLength = 200) String name) {}
