package br.com.davisoares.bouleplan.adapter.in.rest;

import static br.com.davisoares.bouleplan.adapter.in.rest.IntrospectionApi.WEEK;
import static org.hamcrest.Matchers.equalTo;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class IntrospectionBodiesStrictTest {

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
  }

  private static void assertMalformed(String json) {
    IntrospectionApi.put(WEEK, json)
        .statusCode(400)
        .body(IntrospectionApi.CODE, equalTo("http.400"));
  }

  @Test
  @DisplayName("a save body that is not the documented object is a malformed request")
  void malformedBodies() {
    assertMalformed("");
    assertMalformed("[]");
    assertMalformed("{}");
    assertMalformed("{\"answers\": null}");
    assertMalformed("{\"answers\": {}}");
    assertMalformed("{\"answers\": \"x\"}");
    assertMalformed("{\"answers\": [], \"extra\": 1}");
    assertMalformed("{\"answers\": [], \"answers\": []}");
    assertMalformed("{\"answers\": []} {}");
  }

  @Test
  @DisplayName("an answer entry needs a known key once and a text answer, and nothing else")
  void malformedEntries() {
    assertMalformed("{\"answers\": [\"went_well\"]}");
    assertMalformed("{\"answers\": [{\"key\": \"nope\", \"answer\": \"x\"}]}");
    assertMalformed("{\"answers\": [{\"answer\": \"x\"}]}");
    assertMalformed("{\"answers\": [{\"key\": \"went_well\"}]}");
    assertMalformed("{\"answers\": [{\"key\": null, \"answer\": \"x\"}]}");
    assertMalformed("{\"answers\": [{\"key\": \"went_well\", \"answer\": null}]}");
    assertMalformed("{\"answers\": [{\"key\": \"went_well\", \"answer\": 1}]}");
    assertMalformed("{\"answers\": [{\"key\": 1, \"answer\": \"x\"}]}");
    assertMalformed(
        "{\"answers\": [{\"key\": \"went_well\", \"answer\": \"x\", \"prompt\": \"Q\"}]}");
    assertMalformed(
        "{\"answers\": [{\"key\": \"went_well\", \"answer\": \"x\"},"
            + " {\"key\": \"went_well\", \"answer\": \"y\"}]}");
  }

  @Test
  @DisplayName("a malformed body saves nothing")
  void nothingSaved() {
    assertMalformed(
        "{\"answers\": [{\"key\": \"went_well\", \"answer\": \"x\"}, {\"key\": \"nope\"}]}");

    IntrospectionApi.get(WEEK).body("updatedAt", org.hamcrest.Matchers.nullValue());
  }
}
