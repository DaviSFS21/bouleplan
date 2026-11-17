package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.path.json.JsonPath;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class InitiativePatchRequestTest {

  private static final String UPDATED_AT = "updatedAt";

  @Inject EntityManager entityManager;

  private String id;

  @BeforeEach
  void setUp() {
    TestData.deleteAllInitiatives();
    id = InitiativeApi.idOf(InitiativeApi.create("Keep"));
  }

  @Test
  @DisplayName("unknown fields, wrong types and bad bodies are malformed requests")
  void malformed() {
    for (String body :
        new String[] {
          "{\"origin\": \"native\"}",
          "{\"name\": 5}",
          "{\"color\": [\"azul\"]}",
          "[]",
          "null",
          "{not json",
          "{} {}",
          ""
        }) {
      InitiativeAssertions.assertMalformed(InitiativeApi.patch(id, body));
    }
  }

  @Test
  @DisplayName("application/json has the same semantics as merge-patch")
  void plainJson() {
    InitiativeApi.patch(id, "application/json", "{\"description\": null, \"name\": \"Plain\"}")
        .statusCode(200)
        .body("name", Matchers.equalTo("Plain"))
        .body("description", Matchers.nullValue());
  }

  @Test
  @DisplayName("other content types are rejected with 415")
  void unsupportedMediaType() {
    InitiativeAssertions.assertProblem(
        InitiativeApi.patch(id, "text/plain", "{}"), 415, "http.415");
  }

  @Test
  @DisplayName("updatedAt moves forward on update and createdAt does not")
  void updatedAtChanges() {
    JsonPath before = JsonPath.from(InitiativeApi.get(id).extract().asString());

    JsonPath after =
        JsonPath.from(InitiativeApi.patch(id, "{\"name\": \"Later\"}").extract().asString());

    assertThat(OffsetDateTime.parse(after.getString(UPDATED_AT)))
        .isAfter(OffsetDateTime.parse(before.getString(UPDATED_AT)));
    assertThat(after.getString("createdAt")).isEqualTo(before.getString("createdAt"));
    JsonPath reread = JsonPath.from(InitiativeApi.get(id).extract().asString());
    assertThat(reread.getString(UPDATED_AT)).isEqualTo(after.getString(UPDATED_AT));
  }

  @Test
  @DisplayName("an unknown id is 404")
  void unknownId() {
    InitiativeAssertions.assertNotFound(InitiativeApi.patch(UUID.randomUUID().toString(), "{}"));
  }

  @Test
  @DisplayName("archived, deleted and foreign initiatives are 404")
  void notEditable() {
    String archived = InitiativeApi.idOf(InitiativeApi.create("Archived"));
    InitiativeActions.archive(archived).statusCode(200);
    String deleted = InitiativeApi.idOf(InitiativeApi.create("Deleted"));
    InitiativeActions.delete(deleted).statusCode(204);
    String foreign = TestData.insertForeignInitiative(entityManager);

    InitiativeAssertions.assertNotFound(InitiativeApi.patch(archived, "{\"name\": \"X\"}"));
    InitiativeAssertions.assertNotFound(InitiativeApi.patch(deleted, "{\"name\": \"X\"}"));
    InitiativeAssertions.assertNotFound(InitiativeApi.patch(foreign, "{\"name\": \"X\"}"));
  }
}
