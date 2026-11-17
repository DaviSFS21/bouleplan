package br.com.davisoares.bouleplan.adapter.in.rest;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

/** RFC 9457 problem details, served as {@code application/problem+json}. */
@Schema(
    name = "Problem",
    requiredProperties = {"type", "title", "status", "detail", "code"})
public record Problem(
    @Schema(examples = "/problems/rule-violation") String type,
    @Schema(examples = "Rule violation") String title,
    @Schema(examples = "400") int status,
    String detail,
    @Schema(
            description =
                "Stable code clients map to their own text: a domain code such as"
                    + " initiative.name.blank, http.<status> or internal",
            examples = "initiative.name.blank")
        String code) {

  /** Media type of every error response. */
  public static final String MEDIA_TYPE = "application/problem+json";
}
