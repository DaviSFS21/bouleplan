package br.com.davisoares.bouleplan.adapter.in.rest;

import static br.com.davisoares.bouleplan.adapter.in.rest.IntrospectionApi.ANSWERS_ANSWER;
import static br.com.davisoares.bouleplan.adapter.in.rest.IntrospectionApi.CLOSED;
import static br.com.davisoares.bouleplan.adapter.in.rest.IntrospectionApi.CODE;
import static br.com.davisoares.bouleplan.adapter.in.rest.IntrospectionApi.WEEK;
import static br.com.davisoares.bouleplan.adapter.in.rest.IntrospectionApi.WEEK_INVALID;
import static br.com.davisoares.bouleplan.adapter.in.rest.IntrospectionApi.answer;
import static br.com.davisoares.bouleplan.adapter.in.rest.IntrospectionApi.body;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
@SuppressWarnings({
  "PMD.TooManyStaticImports",
  "PMD.TooManyMethods",
  "PMD.AvoidDuplicateLiterals"
}) // one test per rule, with the keys and bodies inline
class IntrospectionResourceTest {

  private static final String PROMPTS = "answers.prompt";
  private static final String KEYS = "answers.key";
  private static final String UPDATED_AT = "updatedAt";
  private static final String CLOSED_AT = "closedAt";

  @Inject EntityManager entityManager;
  @Inject CurrentUser currentUser;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
  }

  @Test
  @DisplayName("a week with no sheet is a virtual draft that is not stored")
  void virtualDraft() {
    IntrospectionApi.get(WEEK)
        .statusCode(200)
        .body("weekStart", equalTo(WEEK))
        .body(KEYS, contains("went_well", "went_badly", "to_improve"))
        .body(PROMPTS, contains("O que foi bom?", "O que foi ruim?", "Como posso melhorar?"))
        .body(ANSWERS_ANSWER, contains("", "", ""))
        .body(CLOSED_AT, nullValue())
        .body(UPDATED_AT, nullValue());
    IntrospectionApi.get(WEEK).body(UPDATED_AT, nullValue());
  }

  @Test
  @DisplayName("saving creates the sheet, and reading returns what was saved")
  void saveThenRead() {
    IntrospectionApi.put(WEEK, body(answer("went_badly", "Late nights")))
        .statusCode(200)
        .body(ANSWERS_ANSWER, contains("", "Late nights", ""))
        .body(UPDATED_AT, notNullValue())
        .body(CLOSED_AT, nullValue());

    IntrospectionApi.get(WEEK)
        .statusCode(200)
        .body(ANSWERS_ANSWER, contains("", "Late nights", ""))
        .body(UPDATED_AT, notNullValue());
  }

  @Test
  @DisplayName("keys that are not sent keep their stored answer")
  void missingKeysStay() {
    IntrospectionApi.put(WEEK, body(answer("went_well", "A"), answer("to_improve", "C")))
        .statusCode(200);

    IntrospectionApi.put(WEEK, body(answer("went_badly", "B")))
        .statusCode(200)
        .body(ANSWERS_ANSWER, contains("A", "B", "C"));
    IntrospectionApi.put(WEEK, body())
        .statusCode(200)
        .body(ANSWERS_ANSWER, contains("A", "B", "C"));
  }

  @Test
  @DisplayName("an answer is trimmed, its line breaks are LF and it may be cleared")
  void answerText() {
    IntrospectionApi.put(
            WEEK, "{\"answers\": [{\"key\": \"went_well\", \"answer\": \"  a\\r\\nb\\rc \"}]}")
        .statusCode(200)
        .body("answers[0].answer", equalTo("a\nb\nc"));

    IntrospectionApi.put(WEEK, body(answer("went_well", " ")))
        .statusCode(200)
        .body("answers[0].answer", equalTo(""));
  }

  @Test
  @DisplayName("an answer with control characters or over 10000 characters is refused")
  void answerRules() {
    IntrospectionApi.put(
            WEEK, "{\"answers\": [{\"key\": \"went_well\", \"answer\": \"a\\u0000b\"}]}")
        .statusCode(400)
        .body(CODE, equalTo("introspection.answer.invalid-characters"));
    IntrospectionApi.put(WEEK, body(answer("went_well", "a".repeat(10_001))))
        .statusCode(400)
        .body(CODE, equalTo("introspection.answer.too-long"));
    IntrospectionApi.put(WEEK, body(answer("went_well", "a".repeat(10_000)))).statusCode(200);
  }

  @Test
  @DisplayName("a refused answer saves nothing, not even the other answers of the request")
  void refusedSavesNothing() {
    IntrospectionApi.put(
            WEEK, body(answer("went_well", "fine"), answer("went_badly", "a".repeat(10_001))))
        .statusCode(400);

    IntrospectionApi.get(WEEK)
        .body(UPDATED_AT, nullValue())
        .body(ANSWERS_ANSWER, contains("", "", ""));
  }

  @Test
  @DisplayName("the week must be a Monday with a valid year, for every operation")
  void weekInvalid() {
    for (String week :
        new String[] {"2026-11-17", "not-a-date", "2026-13-01", "10000-01-03", "0000-12-27"}) {
      IntrospectionApi.get(week).statusCode(400).body(CODE, equalTo(WEEK_INVALID));
      IntrospectionApi.put(week, body()).statusCode(400).body(CODE, equalTo(WEEK_INVALID));
      IntrospectionApi.close(week).statusCode(400).body(CODE, equalTo(WEEK_INVALID));
    }
    IntrospectionApi.get("9999-12-27").statusCode(200);
  }

  @Test
  @DisplayName("closing stamps the sheet and a closed sheet refuses saves and a second close")
  void closing() {
    IntrospectionApi.put(WEEK, body(answer("went_well", "A"))).statusCode(200);

    IntrospectionApi.close(WEEK)
        .statusCode(200)
        .body(CLOSED_AT, notNullValue())
        .body(ANSWERS_ANSWER, contains("A", "", ""));

    IntrospectionApi.put(WEEK, body(answer("went_well", "B")))
        .statusCode(409)
        .body(CODE, equalTo(CLOSED));
    IntrospectionApi.put(WEEK, body()).statusCode(409).body(CODE, equalTo(CLOSED));
    IntrospectionApi.close(WEEK).statusCode(409).body(CODE, equalTo(CLOSED));
    IntrospectionApi.get(WEEK)
        .statusCode(200)
        .body(CLOSED_AT, notNullValue())
        .body(ANSWERS_ANSWER, contains("A", "", ""));
  }

  @Test
  @DisplayName("closing a week with no sheet creates an empty closed one")
  void closeCreates() {
    IntrospectionApi.close(WEEK)
        .statusCode(200)
        .body(CLOSED_AT, notNullValue())
        .body(UPDATED_AT, notNullValue())
        .body(ANSWERS_ANSWER, contains("", "", ""));

    IntrospectionApi.get(WEEK).body(CLOSED_AT, notNullValue());
  }

  @Test
  @DisplayName("sheets of different weeks are independent")
  void weeksAreIndependent() {
    IntrospectionApi.put(WEEK, body(answer("went_well", "A"))).statusCode(200);
    IntrospectionApi.close(WEEK).statusCode(200);

    IntrospectionApi.put("2026-11-23", body(answer("went_well", "B")))
        .statusCode(200)
        .body(ANSWERS_ANSWER, contains("B", "", ""))
        .body(CLOSED_AT, nullValue());
  }

  @Test
  @DisplayName("a saved sheet keeps the prompt it was created with, even if the question changed")
  void promptsStayStored() {
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery(
                  "insert into introspection (id, user_id, week_start, answers)"
                      + " values (?1, ?2, ?3, cast(?4 as jsonb))")
              .setParameter(1, UUID.randomUUID())
              .setParameter(2, currentUser.id())
              .setParameter(3, LocalDate.parse(WEEK))
              .setParameter(
                  4, "[{\"key\": \"went_well\", \"prompt\": \"Old question?\", \"answer\": \"\"}]")
              .executeUpdate();
        });

    IntrospectionApi.get(WEEK).body(PROMPTS, contains("Old question?"));
    IntrospectionApi.put(WEEK, body(answer("went_well", "A"), answer("to_improve", "C")))
        .statusCode(200)
        .body(KEYS, contains("went_well", "to_improve"))
        .body(PROMPTS, contains("Old question?", "Como posso melhorar?"))
        .body(ANSWERS_ANSWER, contains("A", "C"));
  }
}
