package br.com.davisoares.bouleplan.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import br.com.davisoares.bouleplan.application.port.out.InitiativeRepository;
import br.com.davisoares.bouleplan.domain.Initiative;
import br.com.davisoares.bouleplan.domain.InitiativeColor;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class InitiativeServiceTest {

  private static final UUID USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

  private final List<Initiative> stored = new ArrayList<>();
  private final CurrentUser currentUser = () -> USER_ID;
  private final InitiativeRepository repository =
      new InitiativeRepository() {
        @Override
        public void save(Initiative initiative) {
          stored.add(initiative);
        }

        @Override
        public List<Initiative> findActiveByUser(UUID userId) {
          return stored.stream().filter(Initiative::isActive).toList();
        }
      };
  private final InitiativeService service = new InitiativeService(repository, currentUser);

  @Test
  @DisplayName("create gives the first initiative the first palette color")
  void firstGetsYellow() {
    Initiative created = service.create("First");

    assertThat(created.getColor()).isEqualTo(InitiativeColor.YELLOW);
    assertThat(stored).containsExactly(created);
  }

  @Test
  @DisplayName("an archived initiative frees its color for the next one")
  void archivedFreesColor() {
    service.create("First").archive();

    assertThat(service.create("Second").getColor()).isEqualTo(InitiativeColor.YELLOW);
  }

  @Test
  @DisplayName("listActive returns only active initiatives")
  void listsOnlyActive() {
    service.create("First").archive();
    Initiative second = service.create("Second");

    assertThat(service.listActive()).containsExactly(second);
  }
}
