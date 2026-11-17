package br.com.davisoares.bouleplan.adapter.in.rest;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

/** RFC 9457 problem details, served as {@code application/problem+json}. */
@Schema(
    name = "Problem",
    requiredProperties = {"type", "title", "status", "detail"})
public record Problem(
    @Schema(examples = "/problems/invalid-initiative") String type,
    @Schema(examples = "Invalid initiative") String title,
    @Schema(examples = "400") int status,
    String detail) {

  /** Media type of every error response. */
  public static final String MEDIA_TYPE = "application/problem+json";
}
