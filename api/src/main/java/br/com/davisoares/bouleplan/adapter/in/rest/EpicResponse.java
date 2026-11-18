package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.domain.Epic;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.enums.SchemaType;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/** JSON representation of a named epic. */
@Schema(
    name = "Epic",
    requiredProperties = {"id", "initiativeId", "name", "origin", "createdAt", "updatedAt"})
public record EpicResponse(
    UUID id,
    UUID initiativeId,
    String name,
    @Schema(
            type = SchemaType.STRING,
            enumeration = {"native"})
        String origin,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  /** Maps a named epic at the REST boundary. */
  public static EpicResponse from(Epic epic) {
    return new EpicResponse(
        epic.getId(),
        epic.getInitiativeId(),
        epic.getName(),
        epic.getOrigin().getToken(),
        epic.getCreatedAt(),
        epic.getUpdatedAt());
  }
}
