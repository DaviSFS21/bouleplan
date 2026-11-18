package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.in.AnswerChange;
import br.com.davisoares.bouleplan.application.port.in.ManageIntrospectionUseCase;
import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import br.com.davisoares.bouleplan.domain.IntrospectionAnswer;
import br.com.davisoares.bouleplan.domain.IntrospectionClosedException;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
@SuppressWarnings("PMD.AvoidInstantiatingObjectsInLoops") // each round builds its own commands
class IntrospectionConcurrencyTest {

  private static final int ROUNDS = 25;
  private static final String ROUND = "round %d";
  private static final LocalDate WEEK = IntrospectionRows.MONDAY;

  @Inject ManageIntrospectionUseCase introspections;
  @Inject CurrentUser currentUser;
  @Inject EntityManager entityManager;

  private IntrospectionRows rows;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    rows = new IntrospectionRows(entityManager, currentUser.id());
  }

  private void clear() {
    TestData.deleteAllInitiatives();
  }

  @Test
  @DisplayName("two first saves of the same week leave one row with both answers")
  void firstSavesRace() throws ExecutionException, InterruptedException {
    for (int round = 0; round < ROUNDS; round++) {
      clear();

      Races.race(
          () -> introspections.save(WEEK, List.of(new AnswerChange("went_well", "good"))),
          () -> introspections.save(WEEK, List.of(new AnswerChange("went_badly", "bad"))));

      assertThat(rows.count()).as(ROUND, round).isEqualTo(1);
      assertThat(introspections.get(WEEK).getAnswers())
          .extracting(IntrospectionAnswer::answer)
          .as(ROUND, round)
          .containsExactly("good", "bad", "");
    }
  }

  @Test
  @DisplayName("a save racing the close either lands before it or is refused, never after")
  void saveRacesClose() throws ExecutionException, InterruptedException {
    for (int round = 0; round < ROUNDS; round++) {
      clear();
      List<String> outcomes = new CopyOnWriteArrayList<>();

      Races.race(
          () ->
              outcomes.add(
                  attempt(() ->
                      introspections.save(WEEK, List.of(new AnswerChange("went_well", "x"))))),
          () -> outcomes.add(attempt(() -> introspections.close(WEEK))));

      assertThat(rows.count()).as(ROUND, round).isEqualTo(1);
      assertThat(outcomes).as(ROUND, round).contains("ok");
      assertThat(introspections.get(WEEK).isClosed()).isTrue();
    }
  }

  private static String attempt(Runnable action) {
    String outcome = "ok";
    try {
      action.run();
    } catch (IntrospectionClosedException e) {
      outcome = e.code();
    }
    return outcome;
  }
}
