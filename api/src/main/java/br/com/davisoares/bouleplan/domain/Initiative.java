package br.com.davisoares.bouleplan.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

/** A goal or project that groups phases and tasks. */
@SuppressWarnings(
    "PMD.TooManyMethods") // the entity carries the business rules and a getter per column
@Entity
@Table(name = "initiative")
public class Initiative extends PanacheEntityBase {

  public static final int MAX_NAME_LENGTH = 200;
  public static final int MAX_DESCRIPTION_LENGTH = 10_000;
  public static final int MIN_DEADLINE_YEAR = 1;
  public static final int MAX_DEADLINE_YEAR = 9999;

  @Id @GeneratedValue @UuidGenerator private UUID id;

  @Column(name = "user_id", nullable = false, updatable = false)
  private UUID userId;

  @Column(nullable = false, length = MAX_NAME_LENGTH)
  private String name;

  private String description;

  @Column(name = "overall_deadline")
  private LocalDate overallDeadline;

  @Column(nullable = false, length = 16)
  private InitiativeColor color;

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
  protected Initiative() {
    super();
  }

  /** Creates a native, active initiative; the name is trimmed and validated. */
  public static Initiative create(UUID userId, String name, InitiativeColor color) {
    Initiative initiative = new Initiative();
    initiative.userId = userId;
    initiative.name = validName(name);
    initiative.color = color;
    initiative.origin = InitiativeOrigin.NATIVE;
    return initiative;
  }

  private static String validName(String name) {
    String trimmed = name == null ? "" : stripInvisible(name);
    if (trimmed.isEmpty()) {
      throw new InvalidInitiativeException(
          "initiative.name.blank", "Initiative name must not be blank");
    }
    if (trimmed.codePoints().anyMatch(Initiative::isInvalidCodePoint)) {
      throw new InvalidInitiativeException(
          "initiative.name.invalid-characters",
          "Initiative name must not contain control or invalid characters");
    }
    if (trimmed.length() > MAX_NAME_LENGTH) {
      throw new InvalidInitiativeException(
          "initiative.name.too-long",
          "Initiative name must have at most " + MAX_NAME_LENGTH + " characters");
    }
    return trimmed;
  }

  private static String validDescription(String description) {
    String trimmed =
        description == null
            ? ""
            : stripInvisible(description.replace("\r\n", "\n").replace('\r', '\n'));
    if (trimmed.codePoints().anyMatch(Initiative::isInvalidDescriptionCodePoint)) {
      throw new InvalidInitiativeException(
          "initiative.description.invalid-characters",
          "Initiative description must not contain control or invalid characters");
    }
    if (trimmed.length() > MAX_DESCRIPTION_LENGTH) {
      throw new InvalidInitiativeException(
          "initiative.description.too-long",
          "Initiative description must have at most " + MAX_DESCRIPTION_LENGTH + " characters");
    }
    return trimmed.isEmpty() ? null : trimmed;
  }

  private static boolean isInvalidDescriptionCodePoint(int codePoint) {
    return codePoint != '\n' && codePoint != '\t' && isInvalidCodePoint(codePoint);
  }

  private static boolean isInvalidCodePoint(int codePoint) {
    return Character.isISOControl(codePoint) || Character.getType(codePoint) == Character.SURROGATE;
  }

  private static boolean isInvisible(char c) {
    return Character.isWhitespace(c)
        || Character.isSpaceChar(c)
        || Character.getType(c) == Character.FORMAT
        || c == 0x2800
        || c == 0x3164
        || c == 0x115F
        || c == 0x1160
        || c == 0xFFA0;
  }

  private static String stripInvisible(String value) {
    int start = 0;
    int end = value.length();
    while (start < end && isInvisible(value.charAt(start))) {
      start++;
    }
    while (end > start && isInvisible(value.charAt(end - 1))) {
      end--;
    }
    return value.substring(start, end);
  }

  /** Renames with the same rules as creation. */
  public void rename(String newName) {
    name = validName(newName);
  }

  /** Sets the description; blank clears it. */
  public void describe(String newDescription) {
    description = validDescription(newDescription);
  }

  /** Sets or clears ({@code null}) the overall deadline. */
  public void scheduleDeadline(LocalDate deadline) {
    if (deadline != null
        && (deadline.getYear() < MIN_DEADLINE_YEAR || deadline.getYear() > MAX_DEADLINE_YEAR)) {
      throw new InvalidInitiativeException(
          "initiative.deadline.invalid",
          "Deadline year must be between " + MIN_DEADLINE_YEAR + " and " + MAX_DEADLINE_YEAR);
    }
    overallDeadline = deadline;
  }

  /** Changes the color. */
  public void recolor(InitiativeColor newColor) {
    if (newColor == null) {
      throw new InvalidInitiativeException("initiative.color.required", "Color is required");
    }
    color = newColor;
  }

  /** Stamps {@code archivedAt}, which frees the color and hides it from active lists. */
  public void archive() {
    if (archivedAt == null) {
      archivedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }
  }

  /** Clears {@code archivedAt}; the color is kept, even if it now repeats. */
  @SuppressWarnings("PMD.NullAssignment") // null is how a cleared timestamp is stored
  public void unarchive() {
    archivedAt = null;
  }

  /**
   * Soft delete: stamps {@code deletedAt}; not named {@code delete} to avoid Panache's hard one.
   */
  public void softDelete() {
    if (deletedAt == null) {
      deletedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }
  }

  /** Clears {@code deletedAt}; the color is kept, even if it now repeats. */
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

  public UUID getId() {
    return id;
  }

  public UUID getUserId() {
    return userId;
  }

  public String getName() {
    return name;
  }

  public String getDescription() {
    return description;
  }

  public LocalDate getOverallDeadline() {
    return overallDeadline;
  }

  public InitiativeColor getColor() {
    return color;
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
