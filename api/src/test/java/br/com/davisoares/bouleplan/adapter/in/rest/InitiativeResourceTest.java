package br.com.davisoares.bouleplan.adapter.in.rest;

import static br.com.davisoares.bouleplan.adapter.in.rest.InitiativeApi.COLOR;
import static br.com.davisoares.bouleplan.adapter.in.rest.InitiativeApi.NAME;
import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import io.restassured.response.ExtractableResponse;
import io.restassured.response.Response;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class InitiativeResourceTest {

  private static final String YELLOW = "amarelo";

  private static final String FIRST = "First";

  @Inject EntityManager entityManager;

  @BeforeEach
  void cleanDatabase() {
    TestData.deleteAllInitiatives();
  }

  @Test
  @DisplayName("listing with no initiatives returns an empty array")
  void listEmpty() {
    given().when().get(InitiativeApi.PATH).then().statusCode(200).body("$", Matchers.empty());
  }

  @Test
  @DisplayName("creating returns 201, a Location header and the initiative")
  void createReturnsCreated() {
    ExtractableResponse<Response> response =
        InitiativeApi.post("{\"name\": \"  Study plan \"}")
            .statusCode(201)
            .contentType(ContentType.JSON)
            .body(NAME, Matchers.equalTo("Study plan"))
            .body(COLOR, Matchers.equalTo(YELLOW))
            .body("origin", Matchers.equalTo("native"))
            .body("description", Matchers.nullValue())
            .body("overallDeadline", Matchers.nullValue())
            .extract();

    String id = response.path("id");
    assertThat(response.header("Location")).endsWith("/initiatives/" + id);
  }

  @Test
  @DisplayName("the second initiative gets lime")
  void secondGetsLime() {
    InitiativeApi.create(FIRST);

    InitiativeApi.post("{\"name\": \"Second\"}")
        .statusCode(201)
        .body(COLOR, Matchers.equalTo("lima"));
  }

  @Test
  @DisplayName("listing returns the created initiatives in creation order")
  void listInOrder() {
    InitiativeApi.create(FIRST);
    InitiativeApi.create("Second");

    given()
        .when()
        .get(InitiativeApi.PATH)
        .then()
        .statusCode(200)
        .body("$", Matchers.hasSize(2))
        .body(NAME, Matchers.contains(FIRST, "Second"))
        .body(COLOR, Matchers.contains(YELLOW, "lima"));
  }

  @Test
  @DisplayName("the created body has exactly the contract fields and types")
  void createdBodyMatchesContract() {
    JsonPath json = JsonPath.from(InitiativeApi.create("Contract"));

    assertThat(json.getMap("$").keySet())
        .isEqualTo(
            Set.of("id", NAME, "description", "overallDeadline", COLOR, "origin", "createdAt"));
    assertThat(UUID.fromString(json.getString("id"))).isNotNull();
    assertThat(json.getString(NAME)).isEqualTo("Contract");
    assertThat(json.getString(COLOR))
        .isIn(YELLOW, "lima", "verde", "turquesa", "azul", "roxo", "rosa", "marrom");
    assertThat(json.getString("origin")).isEqualTo("native");
    assertThat(OffsetDateTime.parse(json.getString("createdAt"))).isNotNull();
  }

  @Test
  @DisplayName("GET by id returns the initiative the Location header points to")
  void returnsLocationTarget() {
    String location =
        InitiativeApi.post("{\"name\": \"First\"}").statusCode(201).extract().header("Location");

    given()
        .when()
        .get(location)
        .then()
        .statusCode(200)
        .contentType(ContentType.JSON)
        .body(NAME, Matchers.equalTo(FIRST))
        .body(COLOR, Matchers.equalTo(YELLOW));
  }

  @Test
  @DisplayName("GET by id hides an initiative of another user")
  void hidesForeignInitiative() {
    UUID otherUser = UUID.randomUUID();
    UUID foreignId = UUID.randomUUID();
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery("insert into app_user (id, name) values (?1, 'Other')")
              .setParameter(1, otherUser)
              .executeUpdate();
          entityManager
              .createNativeQuery(
                  "insert into initiative (id, user_id, name, color)"
                      + " values (?1, ?2, 'Theirs', 'azul')")
              .setParameter(1, foreignId)
              .setParameter(2, otherUser)
              .executeUpdate();
        });

    try {
      given().when().get(InitiativeApi.PATH + "/" + foreignId).then().statusCode(404);
    } finally {
      QuarkusTransaction.requiringNew()
          .run(() -> {
            entityManager
                .createNativeQuery("delete from initiative where user_id = ?1")
                .setParameter(1, otherUser)
                .executeUpdate();
            entityManager
                .createNativeQuery("delete from app_user where id = ?1")
                .setParameter(1, otherUser)
                .executeUpdate();
          });
    }
  }

  @Test
  @DisplayName("a soft-deleted initiative is neither listed nor returned by id")
  void softDeletedIsHidden() {
    String json = InitiativeApi.create("Gone");
    UUID id = UUID.fromString(JsonPath.from(json).getString("id"));
    QuarkusTransaction.requiringNew()
        .run(() ->
            entityManager
                .createNativeQuery("update initiative set deleted_at = now() where id = ?1")
                .setParameter(1, id)
                .executeUpdate());

    given().when().get(InitiativeApi.PATH).then().body("$", Matchers.empty());
    given().when().get(InitiativeApi.PATH + "/" + id).then().statusCode(404);
    InitiativeApi.post("{\"name\": \"Next\"}").body(COLOR, Matchers.equalTo(YELLOW));
  }
}
