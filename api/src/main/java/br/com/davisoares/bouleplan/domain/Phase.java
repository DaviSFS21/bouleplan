package br.com.davisoares.bouleplan.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

/** A named stage of an initiative; an initiative without named phases has one implicit phase. */
@Entity
@Table(name = "phase")
public class Phase extends PanacheEntityBase {

  public static final int MAX_NAME_LENGTH = EntityText.MAX_NAME_LENGTH;

  @Id @GeneratedValue @UuidGenerator private UUID id;

  @Column(name = "initiative_id", nullable = false, updatable = false)
  private UUID initiativeId;

  @Column(length = MAX_NAME_LENGTH)
  private String name;

  @Column(name = "is_implicit", nullable = false, updatable = false)
  private boolean implicit;

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
  protected Phase() {
    super();
  }

  /** Creates a native, active, named phase; the name is trimmed and validated. */
  public static Phase create(UUID initiativeId, String name) {
    Phase phase = new Phase();
    phase.initiativeId = initiativeId;
    phase.name = validName(name);
    phase.origin = InitiativeOrigin.NATIVE;
    return phase;
  }

  /** Creates the nameless phase that holds the tasks of an initiative without named phases. */
  public static Phase createImplicit(UUID initiativeId) {
    Phase phase = new Phase();
    phase.initiativeId = initiativeId;
    phase.implicit = true;
    phase.origin = InitiativeOrigin.NATIVE;
    return phase;
  }

  private static String validName(String name) {
    return EntityText.validName(name, "Phase", "phase.name", InvalidPhaseException::new);
  }

  /** Renames with the same rules as creation. */
  public void rename(String newName) {
    name = validName(newName);
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

  public boolean isImplicit() {
    return implicit;
  }

  public UUID getId() {
    return id;
  }

  public UUID getInitiativeId() {
    return initiativeId;
  }

  public String getName() {
    return name;
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
