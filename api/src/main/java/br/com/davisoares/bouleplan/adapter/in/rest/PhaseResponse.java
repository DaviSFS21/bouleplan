package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.domain.Phase;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.enums.SchemaType;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/** JSON representation of a named phase. */
@Schema(
    name = "Phase",
    requiredProperties = {"id", "initiativeId", "name", "origin", "createdAt", "updatedAt"})
public record PhaseResponse(
    UUID id,
    UUID initiativeId,
    String name,
    @Schema(
            type = SchemaType.STRING,
            enumeration = {"native"})
        String origin,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  /** Maps a named phase at the REST boundary. */
  public static PhaseResponse from(Phase phase) {
    return new PhaseResponse(
        phase.getId(),
        phase.getInitiativeId(),
        phase.getName(),
        phase.getOrigin().getToken(),
        phase.getCreatedAt(),
        phase.getUpdatedAt());
  }
}
