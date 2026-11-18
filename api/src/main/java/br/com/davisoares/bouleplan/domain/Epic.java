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

/** A named stage of an initiative; an initiative without named epics has one implicit epic. */
@SuppressWarnings("PMD.ShortClassName") // the name of the epic table in the ERD
@Entity
@Table(name = "epic")
public class Epic extends PanacheEntityBase {

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
  protected Epic() {
    super();
  }

  /** Creates a native, active, named epic; the name is trimmed and validated. */
  public static Epic create(UUID initiativeId, String name) {
    Epic epic = new Epic();
    epic.initiativeId = initiativeId;
    epic.name = validName(name);
    epic.origin = InitiativeOrigin.NATIVE;
    return epic;
  }

  /** Creates the nameless epic that holds the tasks of an initiative without named epics. */
  public static Epic createImplicit(UUID initiativeId) {
    Epic epic = new Epic();
    epic.initiativeId = initiativeId;
    epic.implicit = true;
    epic.origin = InitiativeOrigin.NATIVE;
    return epic;
  }

  private static String validName(String name) {
    return EntityText.validName(name, "Epic", "epic.name", InvalidEpicException::new);
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
