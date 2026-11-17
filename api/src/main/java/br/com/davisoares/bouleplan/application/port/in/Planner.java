package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.CalendarEvent;
import br.com.davisoares.bouleplan.domain.ScheduledItem;
import java.time.LocalDate;
import java.util.List;

/** What the planner shows for one week. */
public record Planner(LocalDate weekStart, List<CalendarEvent> events, List<ScheduledItem> items) {}
