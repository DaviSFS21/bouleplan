package br.com.davisoares.bouleplan.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

/** A goal or project that groups phases and tasks. */
@Entity
@Table(name = "initiative")
public class Initiative extends PanacheEntityBase {

  public static final int MAX_NAME_LENGTH = 200;

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
    if (name == null || name.isBlank()) {
      throw new InvalidInitiativeException("Initiative name must not be blank");
    }
    String trimmed = name.strip();
    if (trimmed.length() > MAX_NAME_LENGTH) {
      throw new InvalidInitiativeException(
          "Initiative name must have at most " + MAX_NAME_LENGTH + " characters");
    }
    Initiative initiative = new Initiative();
    initiative.userId = userId;
    initiative.name = trimmed;
    initiative.color = color;
    initiative.origin = InitiativeOrigin.NATIVE;
    return initiative;
  }

  /** Stamps {@code archivedAt}, which frees the color and hides it from active lists. */
  public void archive() {
    archivedAt = OffsetDateTime.now();
  }

  public boolean isActive() {
    return archivedAt == null && deletedAt == null;
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
