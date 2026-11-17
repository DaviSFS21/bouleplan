package br.com.davisoares.bouleplan.adapter.in.rest;

import java.util.List;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/**
 * Body of {@code PUT /introspections/{weekStart}}. Documentation only: {@link IntrospectionParser}
 * reads the raw JSON, to reject unknown fields and keys.
 */
@Schema(name = "SaveIntrospectionRequest", requiredProperties = "answers")
public record SaveIntrospectionRequest(
    @Schema(description = "Each key at most once; keys not sent keep their answer")
        List<Answer> answers) {

  /** The new text of one question. */
  @Schema(
      name = "SaveIntrospectionAnswer",
      requiredProperties = {"key", "answer"})
  public record Answer(
      @Schema(enumeration = {"went_well", "went_badly", "to_improve"}) String key,
      @Schema(maxLength = 10_000) String answer) {}
}
