package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.path.json.JsonPath;
import io.restassured.response.ValidatableResponse;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class PhaseResourceTest {

  private static final String DESIGN = "Design";
  private static final String BUILD = "Build";

  private String initiativeId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = PhaseApi.initiativeId("Study");
  }

  @Test
  @DisplayName("an initiative starts without phases")
  void emptyList() {
    PhaseApi.list(initiativeId).statusCode(200).body("", Matchers.empty());
  }

  @Test
  @DisplayName("create returns 201 and the phase with every field and no internal ones")
  void create() {
    String id = JsonPath.from(PhaseApi.create(initiativeId, " Design ")).getString("id");

    PhaseApi.get(id)
        .statusCode(200)
        .body("id", Matchers.equalTo(id))
        .body("initiativeId", Matchers.equalTo(initiativeId))
        .body(PhaseApi.NAME, Matchers.equalTo(DESIGN))
        .body("origin", Matchers.equalTo("native"))
        .body("createdAt", Matchers.notNullValue())
        .body("updatedAt", Matchers.notNullValue())
        .body("$", Matchers.not(Matchers.hasKey("implicit")))
        .body("$", Matchers.not(Matchers.hasKey("archivedAt")));
  }

  @Test
  @DisplayName("the Location header points to the created phase")
  void location() {
    ValidatableResponse response =
        PhaseApi.post(initiativeId, "{\"name\": \"Design\"}").statusCode(201);
    String id = response.extract().path("id");

    response.header("Location", Matchers.endsWith("/phases/" + id));
    PhaseApi.get(id).statusCode(200);
  }

  @Test
  @DisplayName("phases are listed in creation order")
  void creationOrder() {
    PhaseApi.create(initiativeId, "C");
    PhaseApi.create(initiativeId, "A");
    PhaseApi.create(initiativeId, "B");

    PhaseApi.list(initiativeId)
        .statusCode(200)
        .body(PhaseApi.NAME, Matchers.contains("C", "A", "B"));
  }

  @Test
  @DisplayName("phases of another initiative are not listed")
  void listIsPerInitiative() {
    PhaseApi.create(PhaseApi.initiativeId("Other"), BUILD);
    PhaseApi.create(initiativeId, DESIGN);

    PhaseApi.list(initiativeId).body(PhaseApi.NAME, Matchers.contains(DESIGN));
  }

  @Test
  @DisplayName("patch renames the phase")
  void rename() {
    String id = PhaseApi.createId(initiativeId, DESIGN);

    PhaseApi.patch(id, "{\"name\": \"  Build \"}")
        .statusCode(200)
        .body(PhaseApi.NAME, Matchers.equalTo(BUILD));
    PhaseApi.get(id).body(PhaseApi.NAME, Matchers.equalTo(BUILD));
  }

  @Test
  @DisplayName("an empty patch keeps the phase")
  void emptyPatch() {
    String id = PhaseApi.createId(initiativeId, DESIGN);

    PhaseApi.patch(id, "{}").statusCode(200).body(PhaseApi.NAME, Matchers.equalTo(DESIGN));
  }
}
