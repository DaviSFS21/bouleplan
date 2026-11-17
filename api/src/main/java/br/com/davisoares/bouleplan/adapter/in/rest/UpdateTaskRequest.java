package br.com.davisoares.bouleplan.adapter.in.rest;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.enums.SchemaType;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/**
 * Body of {@code PATCH /tasks/{id}}. Documentation only: {@link UpdateTaskParser} reads the raw
 * JSON, to reject unknown fields. Absent keeps, {@code null} clears (only where nullable).
 */
@Schema(name = "UpdateTaskRequest")
public record UpdateTaskRequest(
    @Schema(maxLength = 300) String title,
    @Schema(maxLength = 10_000, nullable = true) String description,
    @Schema(implementation = String.class, format = "date", nullable = true) LocalDate deadline,
    @Schema(
            description = "Hours: above 0, at most 999, at most 2 decimals",
            nullable = true,
            minimum = "0",
            exclusiveMinimum = true,
            maximum = "999")
        BigDecimal estimatedEffort,
    @Schema(
            type = SchemaType.STRING,
            enumeration = {"P1", "P2", "P3"})
        String priority,
    @Schema(
            type = SchemaType.STRING,
            enumeration = {"to_do", "in_progress", "done"})
        String status,
    @JsonProperty("isBlocked") @Schema(name = "isBlocked") Boolean isBlocked,
    @Schema(
            implementation = String.class,
            format = "uuid",
            description =
                "An active named phase of the same initiative; null is the implicit phase",
            nullable = true)
        UUID phaseId,
    @Schema(
            implementation = String.class,
            format = "date",
            description = "A Monday",
            nullable = true)
        LocalDate plannedWeekStart) {}
