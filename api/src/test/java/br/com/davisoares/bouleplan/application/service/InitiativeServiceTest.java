package br.com.davisoares.bouleplan.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import br.com.davisoares.bouleplan.application.port.out.InitiativeRepository;
import br.com.davisoares.bouleplan.application.port.out.UserLock;
import br.com.davisoares.bouleplan.domain.Initiative;
import br.com.davisoares.bouleplan.domain.InitiativeColor;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class InitiativeServiceTest {

  private static final String FIRST = "First";

  private static final UUID USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

  private final List<Initiative> stored = new ArrayList<>();
  private final List<String> calls = new ArrayList<>();
  private final CurrentUser currentUser = () -> USER_ID;
  private final InitiativeRepository repository =
      new InitiativeRepository() {
        @Override
        public void save(Initiative initiative) {
          stored.add(initiative);
        }

        @Override
        public List<Initiative> findActiveByUser(UUID userId) {
          calls.add("read");
          return stored.stream().filter(Initiative::isActive).toList();
        }

        @Override
        public Optional<Initiative> findByIdAndUserForUpdate(UUID id, UUID userId) {
          return stored.stream()
              .filter(i -> id.equals(i.getId()) && userId.equals(i.getUserId()))
              .findFirst();
        }

        @Override
        public Optional<Initiative> findActiveByIdAndUser(UUID id, UUID userId) {
          return stored.stream()
              .filter(Initiative::isActive)
              .filter(i -> id.equals(i.getId()) && userId.equals(i.getUserId()))
              .findFirst();
        }
      };
  private final UserLock userLock = userId -> calls.add("lock");
  private final InitiativeService service =
      new InitiativeService(repository, currentUser, userLock);

  @Test
  @DisplayName("create gives the first initiative the first palette color")
  void firstGetsYellow() {
    Initiative created = service.create(FIRST);

    assertThat(created.getColor()).isEqualTo(InitiativeColor.YELLOW);
    assertThat(stored).containsExactly(created);
  }

  @Test
  @DisplayName("an archived initiative frees its color for the next one")
  void archivedFreesColor() {
    service.create(FIRST).archive();

    assertThat(service.create("Second").getColor()).isEqualTo(InitiativeColor.YELLOW);
  }

  @Test
  @DisplayName("listActive returns only active initiatives")
  void listsOnlyActive() {
    service.create(FIRST).archive();
    Initiative second = service.create("Second");

    assertThat(service.listActive()).containsExactly(second);
  }

  @Test
  @DisplayName("create locks the user before reading the colors in use")
  void locksBeforeReading() {
    service.create(FIRST);

    assertThat(calls).containsExactly("lock", "read");
  }

  @Test
  @DisplayName("find is empty for an unknown id")
  void findUnknown() {
    service.create(FIRST);

    assertThat(service.find(UUID.randomUUID())).isEmpty();
  }
}
