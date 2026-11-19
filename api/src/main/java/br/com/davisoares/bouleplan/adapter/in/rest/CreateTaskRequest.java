package br.com.davisoares.bouleplan.adapter.in.rest;

import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.enums.SchemaType;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/**
 * Body of {@code POST /initiatives/{id}/tasks}. Documentation only: {@link CreateTaskParser} reads
 * the raw JSON, to reject unknown fields.
 */
@Schema(name = "CreateTaskRequest")
public record CreateTaskRequest(
    @Schema(required = true, maxLength = 300) String title,
    @Schema(
            implementation = String.class,
            format = "uuid",
            description =
                "An active named epic of the initiative; absent or null means the implicit epic",
            nullable = true)
        UUID epicId,
    @Schema(
            type = SchemaType.STRING,
            enumeration = {"to_do", "in_progress", "done"},
            defaultValue = "to_do")
        String status) {}
