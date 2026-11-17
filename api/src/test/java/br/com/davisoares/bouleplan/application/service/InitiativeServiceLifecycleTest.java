package br.com.davisoares.bouleplan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand;
import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand.Change;
import br.com.davisoares.bouleplan.application.port.out.InitiativeRepository;
import br.com.davisoares.bouleplan.domain.Initiative;
import br.com.davisoares.bouleplan.domain.InitiativeColor;
import br.com.davisoares.bouleplan.domain.InvalidInitiativeException;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** The repository stub answers any id with the single initiative under test. */
class InitiativeServiceLifecycleTest {

  private static final UUID USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private static final UUID ANY_ID = UUID.randomUUID();

  private final Initiative initiative = Initiative.create(USER_ID, "Study", InitiativeColor.BLUE);
  private final InitiativeRepository repository =
      new InitiativeRepository() {
        @Override
        public void save(Initiative saved) {
          throw new UnsupportedOperationException();
        }

        @Override
        public List<Initiative> findActiveByUser(UUID userId) {
          return List.of(initiative);
        }

        @Override
        public Optional<Initiative> findByIdAndUserForUpdate(UUID id, UUID userId) {
          return Optional.of(initiative);
        }

        @Override
        public Optional<Initiative> findActiveByIdAndUser(UUID id, UUID userId) {
          return Optional.of(initiative).filter(Initiative::isActive);
        }
      };
  private final InitiativeService service =
      new InitiativeService(repository, () -> USER_ID, userId -> {});

  private static UpdateInitiativeCommand command(
      Change<String> name,
      Change<String> description,
      Change<LocalDate> deadline,
      Change<String> color) {
    return new UpdateInitiativeCommand(name, description, deadline, color);
  }

  private static UpdateInitiativeCommand onlyColor(Change<String> color) {
    return command(Change.absent(), Change.absent(), Change.absent(), color);
  }

  @Test
  @DisplayName("update changes only the fields that are present")
  void updatePartial() {
    initiative.describe("keep");

    service.update(
        ANY_ID,
        command(
            Change.of("Renamed"),
            Change.absent(),
            Change.of(LocalDate.of(2027, 5, 1)),
            Change.of("rosa")));

    assertThat(initiative.getName()).isEqualTo("Renamed");
    assertThat(initiative.getDescription()).isEqualTo("keep");
    assertThat(initiative.getOverallDeadline()).isEqualTo(LocalDate.of(2027, 5, 1));
    assertThat(initiative.getColor()).isEqualTo(InitiativeColor.PINK);
  }

  @Test
  @DisplayName("update with a present null clears description and deadline")
  void updateNullClears() {
    initiative.describe("text");
    initiative.scheduleDeadline(LocalDate.of(2027, 5, 1));

    service.update(
        ANY_ID, command(Change.absent(), Change.of(null), Change.of(null), Change.absent()));

    assertThat(initiative.getDescription()).isNull();
    assertThat(initiative.getOverallDeadline()).isNull();
  }

  @Test
  @DisplayName("update rejects a null name, a null color and an unknown color")
  void updateErrors() {
    assertThatThrownBy(() ->
            service.update(
                ANY_ID,
                command(Change.of(null), Change.absent(), Change.absent(), Change.absent())))
        .hasFieldOrPropertyWithValue("ruleCode", "initiative.name.blank");
    assertThatThrownBy(() -> service.update(ANY_ID, onlyColor(Change.of(null))))
        .hasFieldOrPropertyWithValue("ruleCode", "initiative.color.required");
    assertThatThrownBy(() -> service.update(ANY_ID, onlyColor(Change.of("blue"))))
        .isInstanceOf(InvalidInitiativeException.class)
        .hasFieldOrPropertyWithValue("ruleCode", "initiative.color.invalid");
  }

  @Test
  @DisplayName("update, archive and delete skip an initiative that is not active")
  void inactiveIsInvisible() {
    initiative.archive();

    assertThat(service.update(ANY_ID, onlyColor(Change.absent()))).isEmpty();
    assertThat(service.archive(ANY_ID)).isEmpty();
    assertThat(service.delete(ANY_ID)).isEmpty();
  }

  @Test
  @DisplayName("archive and unarchive round-trip")
  void archiveRoundTrip() {
    assertThat(service.archive(ANY_ID)).isPresent();
    assertThat(initiative.isArchived()).isTrue();

    assertThat(service.unarchive(ANY_ID)).isPresent();
    assertThat(initiative.isActive()).isTrue();
    assertThat(service.unarchive(ANY_ID)).isPresent();
  }

  @Test
  @DisplayName("unarchive skips a deleted initiative")
  void unarchiveDeleted() {
    initiative.archive();
    initiative.softDelete();

    assertThat(service.unarchive(ANY_ID)).isEmpty();
  }

  @Test
  @DisplayName("delete and restore round-trip, and restore of a live one is a no-op")
  void deleteRoundTrip() {
    assertThat(service.restore(ANY_ID)).isPresent();
    assertThat(service.delete(ANY_ID)).isPresent();
    assertThat(initiative.isDeleted()).isTrue();

    assertThat(service.restore(ANY_ID)).isPresent();
    assertThat(initiative.isDeleted()).isFalse();
  }
}
