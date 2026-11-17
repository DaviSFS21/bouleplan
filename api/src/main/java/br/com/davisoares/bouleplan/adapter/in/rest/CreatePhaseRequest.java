package br.com.davisoares.bouleplan.adapter.in.rest;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

/** Body of {@code POST /initiatives/{id}/phases}. */
@Schema(name = "CreatePhaseRequest")
public record CreatePhaseRequest(@Schema(required = true, maxLength = 200) String name) {}
