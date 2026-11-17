package br.com.davisoares.bouleplan.adapter.in.rest;

import static br.com.davisoares.bouleplan.adapter.in.rest.InitiativeApi.COLOR;
import static br.com.davisoares.bouleplan.adapter.in.rest.InitiativeApi.NAME;
import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import io.restassured.response.ExtractableResponse;
import io.restassured.response.Response;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class InitiativeResourceTest {

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
            .body(COLOR, Matchers.equalTo("amarelo"))
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
    InitiativeApi.create("First");

    InitiativeApi.post("{\"name\": \"Second\"}")
        .statusCode(201)
        .body(COLOR, Matchers.equalTo("lima"));
  }

  @Test
  @DisplayName("listing returns the created initiatives in creation order")
  void listInOrder() {
    InitiativeApi.create("First");
    InitiativeApi.create("Second");

    given()
        .when()
        .get(InitiativeApi.PATH)
        .then()
        .statusCode(200)
        .body("$", Matchers.hasSize(2))
        .body(NAME, Matchers.contains("First", "Second"))
        .body(COLOR, Matchers.contains("amarelo", "lima"));
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
        .isIn("amarelo", "lima", "verde", "turquesa", "azul", "roxo", "rosa", "marrom");
    assertThat(json.getString("origin")).isEqualTo("native");
    assertThat(OffsetDateTime.parse(json.getString("createdAt"))).isNotNull();
  }
}
