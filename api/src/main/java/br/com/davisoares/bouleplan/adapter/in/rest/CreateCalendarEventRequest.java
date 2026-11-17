package br.com.davisoares.bouleplan.adapter.in.rest;

import java.time.LocalDate;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/**
 * Body of {@code POST /calendar-events}. Documentation only: {@link CalendarEventParser} reads the
 * raw JSON, to reject unknown fields.
 */
@Schema(name = "CreateCalendarEventRequest")
public record CreateCalendarEventRequest(
    @Schema(required = true, maxLength = 300) String title,
    @Schema(required = true, implementation = String.class, format = "date") LocalDate date,
    @Schema(
            required = true,
            implementation = String.class,
            pattern = ScheduledItemResponse.CLOCK_PATTERN,
            description = "Quarter hour, before endTime")
        String startTime,
    @Schema(
            required = true,
            implementation = String.class,
            pattern = ScheduledItemResponse.CLOCK_PATTERN,
            description = "Quarter hour, up to 23:45")
        String endTime) {}
