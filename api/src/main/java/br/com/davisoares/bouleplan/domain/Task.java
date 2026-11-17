package br.com.davisoares.bouleplan.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

/** A unit of work in a phase of an initiative. */
@SuppressWarnings({
  "PMD.TooManyMethods", // the entity carries the business rules and a getter per column
  "PMD.ShortClassName" // the name of the task table in the ERD
})
@Entity
@Table(name = "task")
public class Task extends PanacheEntityBase {

  public static final int MAX_TITLE_LENGTH = 300;
  public static final int MAX_DESCRIPTION_LENGTH = EntityText.MAX_DESCRIPTION_LENGTH;
  public static final BigDecimal MAX_EFFORT = BigDecimal.valueOf(999);
  private static final int EFFORT_DECIMALS = 2;

  @Id @GeneratedValue @UuidGenerator private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "phase_id", nullable = false, updatable = false)
  private Phase phase;

  @Column(nullable = false, length = MAX_TITLE_LENGTH)
  private String title;

  private String description;

  private LocalDate deadline;

  @Column(name = "estimated_effort", precision = 6, scale = EFFORT_DECIMALS)
  private BigDecimal estimatedEffort;

  @Column(nullable = false, length = 2)
  private TaskPriority priority;

  @Column(nullable = false, length = 16)
  private TaskStatus status;

  @Column(name = "is_blocked", nullable = false)
  private boolean blocked;

  @Column(name = "planned_week_start")
  private LocalDate plannedWeekStart;

  @Column(nullable = false, updatable = false, length = 16)
  private InitiativeOrigin origin;

  @Column(name = "archived_at")
  private OffsetDateTime archivedAt;

  @Column(name = "deleted_at")
  private OffsetDateTime deletedAt;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  /** For JPA. */
  protected Task() {
    super();
  }

  /**
   * Creates a native, active, unblocked P2 task; the title is trimmed and validated, and a missing
   * status means {@code to_do}.
   */
  public static Task create(Phase phase, String title, TaskStatus status) {
    Task task = new Task();
    task.phase = phase;
    task.title = validTitle(title);
    task.priority = TaskPriority.P2;
    task.status = status == null ? TaskStatus.TO_DO : status;
    task.origin = InitiativeOrigin.NATIVE;
    return task;
  }

  private static String validTitle(String title) {
    return EntityText.validText(
        title, "Task title", "task.title", MAX_TITLE_LENGTH, InvalidTaskException::new);
  }

  /** Renames with the same rules as creation. */
  public void rename(String newTitle) {
    title = validTitle(newTitle);
  }

  /** Sets the description; blank clears it. */
  public void describe(String newDescription) {
    description =
        EntityText.validDescription(
            newDescription, "Task", "task.description", InvalidTaskException::new);
  }

  /** Sets or clears ({@code null}) the deadline. */
  public void scheduleDeadline(LocalDate newDeadline) {
    if (newDeadline != null && !EntityText.hasValidYear(newDeadline)) {
      throw new InvalidTaskException(
          "task.deadline.invalid",
          "Deadline year must be between "
              + EntityText.MIN_DEADLINE_YEAR
              + " and "
              + EntityText.MAX_DEADLINE_YEAR);
    }
    deadline = newDeadline;
  }

  /** Sets or clears ({@code null}) the estimated effort in hours. */
  @SuppressWarnings("PMD.NullAssignment") // null is how a cleared effort is stored
  public void estimate(BigDecimal hours) {
    if (hours != null && !isValidEffort(hours)) {
      throw new InvalidTaskException(
          "task.effort.invalid",
          "Effort must be above 0 and at most "
              + MAX_EFFORT
              + " hours, with at most "
              + EFFORT_DECIMALS
              + " decimals");
    }
    estimatedEffort = hours == null ? null : hours.setScale(EFFORT_DECIMALS);
  }

  private static boolean isValidEffort(BigDecimal hours) {
    return hours.signum() > 0
        && hours.compareTo(MAX_EFFORT) <= 0
        && hours.stripTrailingZeros().scale() <= EFFORT_DECIMALS;
  }

  /** Changes the priority. */
  public void prioritize(TaskPriority newPriority) {
    priority = newPriority;
  }

  /** Changes the status; the blocked flag is untouched. */
  public void moveTo(TaskStatus newStatus) {
    status = newStatus;
  }

  /** Sets or clears the blocked flag, which is independent of the status. */
  public void markBlocked(boolean isBlocked) {
    blocked = isBlocked;
  }

  /** Stamps {@code archivedAt}. */
  public void archive() {
    if (archivedAt == null) {
      archivedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }
  }

  /** Clears {@code archivedAt}. */
  @SuppressWarnings("PMD.NullAssignment") // null is how a cleared timestamp is stored
  public void unarchive() {
    archivedAt = null;
  }

  /** Soft delete: stamps {@code deletedAt}; not named {@code delete} to avoid Panache's one. */
  public void softDelete() {
    if (deletedAt == null) {
      deletedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }
  }

  /** Clears {@code deletedAt}. */
  @SuppressWarnings("PMD.NullAssignment") // null is how a cleared timestamp is stored
  public void restore() {
    deletedAt = null;
  }

  public boolean isActive() {
    return archivedAt == null && deletedAt == null;
  }

  public boolean isArchived() {
    return archivedAt != null;
  }

  public boolean isDeleted() {
    return deletedAt != null;
  }

  public boolean isBlocked() {
    return blocked;
  }

  public UUID getId() {
    return id;
  }

  public Phase getPhase() {
    return phase;
  }

  public String getTitle() {
    return title;
  }

  public String getDescription() {
    return description;
  }

  public LocalDate getDeadline() {
    return deadline;
  }

  public BigDecimal getEstimatedEffort() {
    return estimatedEffort;
  }

  public TaskPriority getPriority() {
    return priority;
  }

  public TaskStatus getStatus() {
    return status;
  }

  public LocalDate getPlannedWeekStart() {
    return plannedWeekStart;
  }

  public InitiativeOrigin getOrigin() {
    return origin;
  }

  public OffsetDateTime getArchivedAt() {
    return archivedAt;
  }

  public OffsetDateTime getDeletedAt() {
    return deletedAt;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public OffsetDateTime getUpdatedAt() {
    return updatedAt;
  }
}
