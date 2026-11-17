package br.com.davisoares.bouleplan.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

/**
 * A task placed on a day: either an entry of the day list (an order, no times) or a dedicated block
 * (two times, no order).
 */
@Entity
@Table(name = "scheduled_item")
public class ScheduledItem extends PanacheEntityBase {

  private static final String INVALID = "scheduled-item.time.invalid";

  @Id @GeneratedValue @UuidGenerator private UUID id;

  @Column(name = "task_id", nullable = false, updatable = false)
  private UUID taskId;

  @Column(nullable = false)
  private LocalDate date;

  @Column(name = "start_time")
  private LocalTime startTime;

  @Column(name = "end_time")
  private LocalTime endTime;

  @Column(name = "sort_order")
  private Integer sortOrder;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  /** For JPA. */
  protected ScheduledItem() {
    super();
  }

  /** Creates an entry of the day list of a task. */
  public static ScheduledItem dayListEntry(UUID taskId, LocalDate date, int sortOrder) {
    ScheduledItem item = new ScheduledItem();
    item.taskId = taskId;
    item.placeInDayList(date, sortOrder);
    return item;
  }

  /** Creates a dedicated block. */
  public static ScheduledItem block(UUID taskId, LocalDate date, LocalTime start, LocalTime end) {
    ScheduledItem item = new ScheduledItem();
    item.taskId = taskId;
    item.placeAsBlock(date, start, end);
    return item;
  }

  /** Fails unless the date and times make a dedicated block. */
  public static void requireBlock(LocalDate date, LocalTime start, LocalTime end) {
    if (!TimeSlot.isValid(date, start, end)) {
      throw new InvalidScheduleException(
          INVALID, "Times must be quarter hours on one day, with the start before the end");
    }
  }

  /** Fails unless the date and order make a day-list entry. */
  public static void requireDayListEntry(LocalDate date, int sortOrder) {
    if (date == null || !EntityText.hasValidYear(date) || sortOrder < 0) {
      throw new InvalidScheduleException(
          INVALID, "A day-list entry needs a valid date and a non-negative order");
    }
  }

  /** Makes this a day-list entry of the date, dropping any times. */
  @SuppressWarnings("PMD.NullAssignment") // null times are how a day-list entry is stored
  public void placeInDayList(LocalDate newDate, int newSortOrder) {
    requireDayListEntry(newDate, newSortOrder);
    date = newDate;
    startTime = null;
    endTime = null;
    sortOrder = newSortOrder;
  }

  /** Makes this a dedicated block, dropping any order. */
  @SuppressWarnings("PMD.NullAssignment") // a null order is how a block is stored
  public void placeAsBlock(LocalDate newDate, LocalTime start, LocalTime end) {
    requireBlock(newDate, start, end);
    date = newDate;
    startTime = start;
    endTime = end;
    sortOrder = null;
  }

  public boolean isBlock() {
    return startTime != null;
  }

  /** The length of a block in minutes. */
  public long durationMinutes() {
    return Duration.between(startTime, endTime).toMinutes();
  }

  public UUID getId() {
    return id;
  }

  public UUID getTaskId() {
    return taskId;
  }

  public LocalDate getDate() {
    return date;
  }

  public LocalTime getStartTime() {
    return startTime;
  }

  public LocalTime getEndTime() {
    return endTime;
  }

  public Integer getSortOrder() {
    return sortOrder;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public OffsetDateTime getUpdatedAt() {
    return updatedAt;
  }
}
