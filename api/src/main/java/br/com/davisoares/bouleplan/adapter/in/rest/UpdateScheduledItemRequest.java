package br.com.davisoares.bouleplan.adapter.in.rest;

import java.time.LocalDate;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/**
 * Body of {@code PATCH /scheduled-items/{id}}. Documentation only: {@link ScheduledItemParser}
 * reads the raw JSON, to reject unknown fields. Absent keeps. Both times null make a day-list
 * entry, both set make a block.
 */
@Schema(name = "UpdateScheduledItemRequest")
public record UpdateScheduledItemRequest(
    @Schema(implementation = String.class, format = "date") LocalDate date,
    @Schema(
            implementation = String.class,
            pattern = ScheduledItemResponse.CLOCK_PATTERN,
            nullable = true)
        String startTime,
    @Schema(
            implementation = String.class,
            pattern = ScheduledItemResponse.CLOCK_PATTERN,
            nullable = true)
        String endTime,
    @Schema(
            description =
                "Day-list order, 0 or more; null appends, absent keeps it on the same day",
            nullable = true,
            minimum = "0")
        Integer sortOrder) {}
