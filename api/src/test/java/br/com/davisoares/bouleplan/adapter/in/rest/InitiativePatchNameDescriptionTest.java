package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class InitiativePatchNameDescriptionTest {

  private static final String NAME = "name";
  private static final String DESCRIPTION = "description";
  private static final String OTHER_NAME = "{\"name\": \"X\"}";

  private String id;

  @BeforeEach
  void setUp() {
    TestData.deleteAllInitiatives();
    id = InitiativeApi.idOf(InitiativeApi.create("Keep"));
  }

  @Test
  @DisplayName("an empty object changes nothing")
  void emptyPatch() {
    InitiativeApi.patch(id, "{\"description\": \"Text\"}").statusCode(200);

    InitiativeApi.patch(id, "{}")
        .statusCode(200)
        .body(NAME, Matchers.equalTo("Keep"))
        .body(DESCRIPTION, Matchers.equalTo("Text"));
  }

  @Test
  @DisplayName("name: a value renames, absent keeps")
  void nameValue() {
    InitiativeApi.patch(id, "{\"name\": \"  New \"}")
        .statusCode(200)
        .body(NAME, Matchers.equalTo("New"));
    InitiativeApi.patch(id, "{\"color\": \"azul\"}")
        .statusCode(200)
        .body(NAME, Matchers.equalTo("New"));
  }

  @Test
  @DisplayName("name: null is blank")
  void nameNull() {
    InitiativeAssertions.assertProblem(
        InitiativeApi.patch(id, "{\"name\": null}"), 400, "initiative.name.blank");
  }

  @Test
  @DisplayName("name: blank, too long and control characters are rejected")
  void nameRules() {
    InitiativeAssertions.assertProblem(
        InitiativeApi.patch(id, "{\"name\": \"  \"}"), 400, "initiative.name.blank");
    InitiativeAssertions.assertProblem(
        InitiativeApi.patch(id, "{\"name\": \"" + "a".repeat(201) + "\"}"),
        400,
        "initiative.name.too-long");
    InitiativeAssertions.assertProblem(
        InitiativeApi.patch(id, "{\"name\": \"a\\nb\"}"),
        400,
        "initiative.name.invalid-characters");
  }

  @Test
  @DisplayName("description: value sets, null clears, blank clears, absent keeps")
  void descriptionSemantics() {
    InitiativeApi.patch(id, "{\"description\": \"  line\\nbreak \"}")
        .statusCode(200)
        .body(DESCRIPTION, Matchers.equalTo("line\nbreak"));
    InitiativeApi.patch(id, OTHER_NAME).body(DESCRIPTION, Matchers.equalTo("line\nbreak"));
    InitiativeApi.patch(id, "{\"description\": \"  \"}")
        .statusCode(200)
        .body(DESCRIPTION, Matchers.nullValue());
    InitiativeApi.patch(id, "{\"description\": \"again\"}").statusCode(200);
    InitiativeApi.patch(id, "{\"description\": null}")
        .statusCode(200)
        .body(DESCRIPTION, Matchers.nullValue());
  }

  @Test
  @DisplayName("description: too long and control characters are rejected")
  void descriptionRules() {
    InitiativeAssertions.assertProblem(
        InitiativeApi.patch(id, "{\"description\": \"" + "a".repeat(10_001) + "\"}"),
        400,
        "initiative.description.too-long");
    InitiativeAssertions.assertProblem(
        InitiativeApi.patch(id, "{\"description\": \"a\\u0000b\"}"),
        400,
        "initiative.description.invalid-characters");
    InitiativeApi.patch(id, "{\"description\": \"" + "a".repeat(10_000) + "\"}").statusCode(200);
  }
}
