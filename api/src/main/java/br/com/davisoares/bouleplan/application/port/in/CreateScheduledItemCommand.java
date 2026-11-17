package br.com.davisoares.bouleplan.application.port.in;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/** A new item: without times an entry of the day list, with both times a dedicated block. */
public record CreateScheduledItemCommand(
    UUID taskId, LocalDate date, LocalTime startTime, LocalTime endTime) {}
