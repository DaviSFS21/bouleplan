package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.domain.Introspection;
import br.com.davisoares.bouleplan.domain.IntrospectionAnswer;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/** JSON representation of a weekly review sheet. */
@Schema(
    name = "Introspection",
    requiredProperties = {"weekStart", "answers", "closedAt", "updatedAt"})
public record IntrospectionResponse(
    @Schema(implementation = String.class, format = "date") LocalDate weekStart,
    @Schema(description = "One entry per question, in display order") List<Answer> answers,
    @Schema(nullable = true, description = "Null while the sheet is a draft")
        OffsetDateTime closedAt,
    @Schema(nullable = true, description = "Null until the sheet is first saved")
        OffsetDateTime updatedAt) {

  /** One question with its answer. */
  @Schema(
      name = "IntrospectionAnswer",
      requiredProperties = {"key", "prompt", "answer"})
  public record Answer(
      @Schema(examples = "went_well") String key,
      @Schema(description = "The question text the sheet was created with") String prompt,
      @Schema(maxLength = 10_000) String answer) {

    static Answer from(IntrospectionAnswer stored) {
      return new Answer(stored.key(), stored.prompt(), stored.answer());
    }
  }

  /** Maps the entity at the REST boundary. */
  public static IntrospectionResponse from(Introspection sheet) {
    return new IntrospectionResponse(
        sheet.getWeekStart(),
        sheet.getAnswers().stream().map(Answer::from).toList(),
        sheet.getClosedAt(),
        sheet.getUpdatedAt());
  }
}
