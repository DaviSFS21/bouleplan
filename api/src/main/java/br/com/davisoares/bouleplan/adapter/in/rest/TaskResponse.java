package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.TaskRelations;
import br.com.davisoares.bouleplan.application.port.in.TaskReservation;
import br.com.davisoares.bouleplan.domain.Phase;
import br.com.davisoares.bouleplan.domain.Task;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.enums.SchemaType;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/** JSON representation of a task. */
@Schema(
    name = "Task",
    requiredProperties = {
      "id",
      "initiativeId",
      "phaseId",
      "title",
      "description",
      "deadline",
      "estimatedEffort",
      "priority",
      "status",
      "isBlocked",
      "plannedWeekStart",
      "blocks",
      "blockedBy",
      "reservedMinutes",
      "reservedByDeadlineMinutes",
      "createdAt",
      "updatedAt"
    })
public record TaskResponse(
    UUID id,
    UUID initiativeId,
    @Schema(
            implementation = String.class,
            format = "uuid",
            description = "Null when the task is in the implicit phase",
            nullable = true)
        UUID phaseId,
    String title,
    @Schema(nullable = true) String description,
    @Schema(implementation = String.class, format = "date", nullable = true) LocalDate deadline,
    @Schema(description = "Hours", nullable = true) Double estimatedEffort,
    @Schema(
            type = SchemaType.STRING,
            enumeration = {"P1", "P2", "P3"})
        String priority,
    @Schema(
            type = SchemaType.STRING,
            enumeration = {"to_do", "in_progress", "done"})
        String status,
    @JsonProperty("isBlocked") @Schema(name = "isBlocked") boolean isBlocked,
    @Schema(implementation = String.class, format = "date", nullable = true)
        LocalDate plannedWeekStart,
    @Schema(description = "Visible tasks this one blocks, in task list order") List<UUID> blocks,
    @Schema(description = "Visible tasks that block this one, in task list order")
        List<UUID> blockedBy,
    @Schema(description = "Minutes of the visible dedicated blocks of the task")
        long reservedMinutes,
    @Schema(
            description =
                "Minutes of the blocks dated on or before the deadline; all of them without one")
        long reservedByDeadlineMinutes,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  /** Maps the entity at the REST boundary, hiding the implicit phase. */
  public static TaskResponse from(Task task, TaskRelations relations, TaskReservation reservation) {
    Phase phase = task.getPhase();
    return new TaskResponse(
        task.getId(),
        phase.getInitiativeId(),
        phase.isImplicit() ? null : phase.getId(),
        task.getTitle(),
        task.getDescription(),
        task.getDeadline(),
        task.getEstimatedEffort() == null ? null : task.getEstimatedEffort().doubleValue(),
        task.getPriority().getToken(),
        task.getStatus().getToken(),
        task.isBlocked(),
        task.getPlannedWeekStart(),
        relations.blocks(),
        relations.blockedBy(),
        reservation.reservedMinutes(),
        reservation.reservedByDeadlineMinutes(),
        task.getCreatedAt(),
        task.getUpdatedAt());
  }
}
