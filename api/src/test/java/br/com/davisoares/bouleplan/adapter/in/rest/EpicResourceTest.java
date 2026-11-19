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
class EpicResourceTest {

  private static final String DESIGN = "Design";
  private static final String BUILD = "Build";

  private String initiativeId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = EpicApi.initiativeId("Study");
  }

  @Test
  @DisplayName("an initiative starts without epics")
  void emptyList() {
    EpicApi.list(initiativeId).statusCode(200).body("", Matchers.empty());
  }

  @Test
  @DisplayName("create returns 201 and the epic with every field and no internal ones")
  void create() {
    String id = JsonPath.from(EpicApi.create(initiativeId, " Design ")).getString("id");

    EpicApi.get(id)
        .statusCode(200)
        .body("id", Matchers.equalTo(id))
        .body("initiativeId", Matchers.equalTo(initiativeId))
        .body(EpicApi.NAME, Matchers.equalTo(DESIGN))
        .body("origin", Matchers.equalTo("native"))
        .body("createdAt", Matchers.notNullValue())
        .body("updatedAt", Matchers.notNullValue())
        .body("$", Matchers.not(Matchers.hasKey("implicit")))
        .body("$", Matchers.not(Matchers.hasKey("archivedAt")));
  }

  @Test
  @DisplayName("the Location header points to the created epic")
  void location() {
    ValidatableResponse response =
        EpicApi.post(initiativeId, "{\"name\": \"Design\"}").statusCode(201);
    String id = response.extract().path("id");

    response.header("Location", Matchers.endsWith("/epics/" + id));
    EpicApi.get(id).statusCode(200);
  }

  @Test
  @DisplayName("epics are listed in creation order")
  void creationOrder() {
    EpicApi.create(initiativeId, "C");
    EpicApi.create(initiativeId, "A");
    EpicApi.create(initiativeId, "B");

    EpicApi.list(initiativeId).statusCode(200).body(EpicApi.NAME, Matchers.contains("C", "A", "B"));
  }

  @Test
  @DisplayName("epics of another initiative are not listed")
  void listIsPerInitiative() {
    EpicApi.create(EpicApi.initiativeId("Other"), BUILD);
    EpicApi.create(initiativeId, DESIGN);

    EpicApi.list(initiativeId).body(EpicApi.NAME, Matchers.contains(DESIGN));
  }

  @Test
  @DisplayName("patch renames the epic")
  void rename() {
    String id = EpicApi.createId(initiativeId, DESIGN);

    EpicApi.patch(id, "{\"name\": \"  Build \"}")
        .statusCode(200)
        .body(EpicApi.NAME, Matchers.equalTo(BUILD));
    EpicApi.get(id).body(EpicApi.NAME, Matchers.equalTo(BUILD));
  }

  @Test
  @DisplayName("an empty patch keeps the epic")
  void emptyPatch() {
    String id = EpicApi.createId(initiativeId, DESIGN);

    EpicApi.patch(id, "{}").statusCode(200).body(EpicApi.NAME, Matchers.equalTo(DESIGN));
  }
}
