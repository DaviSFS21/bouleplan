package br.com.davisoares.bouleplan.adapter.in.rest;

import java.time.LocalDate;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/**
 * Body of {@code POST /scheduled-items}. Documentation only: {@link ScheduledItemParser} reads the
 * raw JSON, to reject unknown fields. Without times it adds the task to the day list.
 */
@Schema(name = "CreateScheduledItemRequest")
public record CreateScheduledItemRequest(
    @Schema(required = true, implementation = String.class, format = "uuid") UUID taskId,
    @Schema(required = true, implementation = String.class, format = "date") LocalDate date,
    @Schema(
            implementation = String.class,
            pattern = ScheduledItemResponse.CLOCK_PATTERN,
            description = "Quarter hour; send both times for a block, none for the day list")
        String startTime,
    @Schema(implementation = String.class, pattern = ScheduledItemResponse.CLOCK_PATTERN)
        String endTime) {}
