package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.domain.CalendarEvent;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/** JSON representation of a fixed calendar event. */
@Schema(
    name = "CalendarEvent",
    requiredProperties = {"id", "title", "date", "startTime", "endTime", "createdAt", "updatedAt"})
public record CalendarEventResponse(
    UUID id,
    String title,
    @Schema(implementation = String.class, format = "date") LocalDate date,
    @JsonFormat(pattern = ScheduledItemResponse.CLOCK)
        @Schema(implementation = String.class, pattern = ScheduledItemResponse.CLOCK_PATTERN)
        LocalTime startTime,
    @JsonFormat(pattern = ScheduledItemResponse.CLOCK)
        @Schema(implementation = String.class, pattern = ScheduledItemResponse.CLOCK_PATTERN)
        LocalTime endTime,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  /** Maps the entity at the REST boundary. */
  public static CalendarEventResponse from(CalendarEvent event) {
    return new CalendarEventResponse(
        event.getId(),
        event.getTitle(),
        event.getDate(),
        event.getStartTime(),
        event.getEndTime(),
        event.getCreatedAt(),
        event.getUpdatedAt());
  }
}
