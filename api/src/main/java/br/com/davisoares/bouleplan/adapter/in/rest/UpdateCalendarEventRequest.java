package br.com.davisoares.bouleplan.adapter.in.rest;

import java.time.LocalDate;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/**
 * Body of {@code PATCH /calendar-events/{id}}. Documentation only: {@link CalendarEventParser}
 * reads the raw JSON, to reject unknown fields. Absent keeps; none of the fields is nullable.
 */
@Schema(name = "UpdateCalendarEventRequest")
public record UpdateCalendarEventRequest(
    @Schema(maxLength = 300) String title,
    @Schema(implementation = String.class, format = "date") LocalDate date,
    @Schema(implementation = String.class, pattern = ScheduledItemResponse.CLOCK_PATTERN)
        String startTime,
    @Schema(implementation = String.class, pattern = ScheduledItemResponse.CLOCK_PATTERN)
        String endTime) {}
