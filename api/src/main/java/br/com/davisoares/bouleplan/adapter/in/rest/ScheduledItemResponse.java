package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.domain.ScheduledItem;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/** JSON representation of a scheduled item: a day-list entry or a dedicated block. */
@Schema(
    name = "ScheduledItem",
    requiredProperties = {
      "id",
      "taskId",
      "date",
      "startTime",
      "endTime",
      "sortOrder",
      "createdAt",
      "updatedAt"
    })
public record ScheduledItemResponse(
    UUID id,
    UUID taskId,
    @Schema(implementation = String.class, format = "date") LocalDate date,
    @JsonFormat(pattern = CLOCK)
        @Schema(
            implementation = String.class,
            pattern = CLOCK_PATTERN,
            description = "Null for a day-list entry",
            nullable = true)
        LocalTime startTime,
    @JsonFormat(pattern = CLOCK)
        @Schema(
            implementation = String.class,
            pattern = CLOCK_PATTERN,
            description = "Null for a day-list entry",
            nullable = true)
        LocalTime endTime,
    @Schema(description = "Null for a dedicated block", nullable = true) Integer sortOrder,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  static final String CLOCK = "HH:mm";
  static final String CLOCK_PATTERN = "^([01][0-9]|2[0-3]):[0-5][0-9]$";

  /** Maps the entity at the REST boundary. */
  public static ScheduledItemResponse from(ScheduledItem item) {
    return new ScheduledItemResponse(
        item.getId(),
        item.getTaskId(),
        item.getDate(),
        item.getStartTime(),
        item.getEndTime(),
        item.getSortOrder(),
        item.getCreatedAt(),
        item.getUpdatedAt());
  }
}
