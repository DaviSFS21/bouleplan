package br.com.davisoares.bouleplan.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

/** A fixed commitment of the user on one day, which may overlap anything. */
@Entity
@Table(name = "calendar_event")
public class CalendarEvent extends PanacheEntityBase {

  public static final int MAX_TITLE_LENGTH = 300;

  @Id @GeneratedValue @UuidGenerator private UUID id;

  @Column(name = "user_id", nullable = false, updatable = false)
  private UUID userId;

  @Column(name = "google_event_id")
  private String googleEventId;

  @Column(nullable = false, length = MAX_TITLE_LENGTH)
  private String title;

  @Column(nullable = false)
  private LocalDate date;

  @Column(name = "start_time", nullable = false)
  private LocalTime startTime;

  @Column(name = "end_time", nullable = false)
  private LocalTime endTime;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  /** For JPA. */
  protected CalendarEvent() {
    super();
  }

  /** Creates an event; the title is trimmed and validated, the times are quarter hours. */
  public static CalendarEvent create(
      UUID userId, String title, LocalDate date, LocalTime start, LocalTime end) {
    CalendarEvent event = new CalendarEvent();
    event.userId = userId;
    event.title = validTitle(title);
    event.reschedule(date, start, end);
    return event;
  }

  private static String validTitle(String title) {
    return EntityText.validText(
        title,
        "Event title",
        "calendar-event.title",
        MAX_TITLE_LENGTH,
        InvalidScheduleException::new);
  }

  /** Renames with the same rules as creation. */
  public void rename(String newTitle) {
    title = validTitle(newTitle);
  }

  /** Moves the event to a day and times with the same rules as creation. */
  public void reschedule(LocalDate newDate, LocalTime start, LocalTime end) {
    if (!TimeSlot.isValid(newDate, start, end)) {
      throw new InvalidScheduleException(
          "calendar-event.time.invalid",
          "Times must be quarter hours on one day, with the start before the end");
    }
    date = newDate;
    startTime = start;
    endTime = end;
  }

  public UUID getId() {
    return id;
  }

  public UUID getUserId() {
    return userId;
  }

  public String getGoogleEventId() {
    return googleEventId;
  }

  public String getTitle() {
    return title;
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

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public OffsetDateTime getUpdatedAt() {
    return updatedAt;
  }
}
