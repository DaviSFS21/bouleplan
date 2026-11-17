package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.domain.Initiative;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.enums.SchemaType;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/** JSON representation of an initiative. */
@Schema(
    name = "Initiative",
    requiredProperties = {
      "id",
      "name",
      "description",
      "overallDeadline",
      "color",
      "origin",
      "createdAt",
      "updatedAt"
    })
public record InitiativeResponse(
    UUID id,
    String name,
    @Schema(nullable = true) String description,
    @Schema(implementation = String.class, format = "date", nullable = true)
        LocalDate overallDeadline,
    @Schema(
            type = SchemaType.STRING,
            enumeration = {
              "amarelo",
              "lima",
              "verde",
              "turquesa",
              "azul",
              "roxo",
              "rosa",
              "marrom"
            })
        String color,
    @Schema(
            type = SchemaType.STRING,
            enumeration = {"native"})
        String origin,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  /** Maps the entity at the REST boundary, exposing token strings instead of enum constants. */
  public static InitiativeResponse from(Initiative initiative) {
    return new InitiativeResponse(
        initiative.getId(),
        initiative.getName(),
        initiative.getDescription(),
        initiative.getOverallDeadline(),
        initiative.getColor().getToken(),
        initiative.getOrigin().getToken(),
        initiative.getCreatedAt(),
        initiative.getUpdatedAt());
  }
}
