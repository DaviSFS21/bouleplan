package br.com.davisoares.bouleplan.adapter.in.rest;

import java.time.LocalDate;
import org.eclipse.microprofile.openapi.annotations.enums.SchemaType;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/**
 * Body of {@code PATCH /initiatives/{id}}. Documentation only: {@link UpdateInitiativeParser} reads
 * the raw JSON, because a record cannot tell an absent field from {@code null}.
 */
@Schema(name = "UpdateInitiativeRequest")
public record UpdateInitiativeRequest(
    @Schema(maxLength = 200) String name,
    @Schema(maxLength = 10_000, nullable = true) String description,
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
        String color) {}
