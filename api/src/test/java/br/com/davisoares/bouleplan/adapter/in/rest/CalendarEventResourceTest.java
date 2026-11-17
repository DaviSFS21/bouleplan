package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.RestAssured;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
@SuppressWarnings({
  "PMD.TooManyMethods",
  "PMD.AvoidDuplicateLiterals"
}) // one test per rule, times inline
class CalendarEventResourceTest {

  private static final String START = "startTime";
  private static final String END = "endTime";

  @Inject EntityManager entityManager;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
  }

  @Test
  @DisplayName("POST creates an event with HH:mm times, a Location and a trimmed title")
  void create() {
    String id =
        PlannerApi.postEvent(
                PlannerApi.eventJson("  Dentist ", PlannerApi.TUESDAY, "09:00", "09:30"))
            .statusCode(201)
            .header("Location", containsString("/calendar-events/"))
            .extract()
            .path(PlannerApi.ID);

    PlannerApi.planner(PlannerApi.MONDAY)
        .statusCode(200)
        .body("events[0].id", equalTo(id))
        .body("events[0].title", equalTo("Dentist"))
        .body("events[0].date", equalTo(PlannerApi.TUESDAY))
        .body("events[0].startTime", equalTo("09:00"))
        .body("events[0].endTime", equalTo("09:30"))
        .body("events[0].createdAt", notNullValue())
        .body("events[0].updatedAt", notNullValue());
  }

  @Test
  @DisplayName("PATCH merges title, day and times; absent fields stay")
  void patch() {
    String id = PlannerApi.createEventId("Dentist", PlannerApi.TUESDAY, "09:00", "09:30");

    PlannerApi.patchEvent(id, "{\"title\": \"Doctor\"}")
        .statusCode(200)
        .body("title", equalTo("Doctor"))
        .body(START, equalTo("09:00"))
        .body(END, equalTo("09:30"));
    PlannerApi.patchEvent(id, "{\"endTime\": \"10:15\", \"date\": \"2026-11-18\"}")
        .statusCode(200)
        .body("title", equalTo("Doctor"))
        .body("date", equalTo(PlannerApi.WEDNESDAY))
        .body(START, equalTo("09:00"))
        .body(END, equalTo("10:15"));
    PlannerApi.patchEvent(id, "{}").statusCode(200).body(END, equalTo("10:15"));
  }

  @Test
  @DisplayName("PATCH accepts the merge-patch media type")
  void mergePatchMediaType() {
    String id = PlannerApi.createEventId("Dentist", PlannerApi.TUESDAY, "09:00", "09:30");

    RestAssured.given()
        .contentType("application/merge-patch+json")
        .body("{\"title\": \"Doctor\"}")
        .patch(PlannerApi.EVENTS + "/" + id)
        .then()
        .statusCode(200)
        .body("title", equalTo("Doctor"));
  }

  @Test
  @DisplayName("DELETE removes the event for good")
  void delete() {
    String id = PlannerApi.createEventId("Dentist", PlannerApi.TUESDAY, "09:00", "09:30");

    PlannerApi.deleteEvent(id).statusCode(204);

    PlannerApi.planner(PlannerApi.MONDAY).body("events", empty());
    InitiativeAssertions.assertNotFound(PlannerApi.deleteEvent(id));
    InitiativeAssertions.assertNotFound(PlannerApi.patchEvent(id, "{}"));
  }

  @Test
  @DisplayName("an unknown event is 404 for PATCH and DELETE")
  void unknown() {
    String id = "00000000-0000-0000-0000-0000000000aa";

    InitiativeAssertions.assertNotFound(PlannerApi.patchEvent(id, "{\"title\": \"x\"}"));
    InitiativeAssertions.assertNotFound(PlannerApi.deleteEvent(id));
  }

  @Test
  @DisplayName("an event of another user is 404")
  void foreignEvent() {
    String id = TestData.insertForeignEvent(entityManager);

    InitiativeAssertions.assertNotFound(PlannerApi.patchEvent(id, "{\"title\": \"x\"}"));
    InitiativeAssertions.assertNotFound(PlannerApi.deleteEvent(id));
  }

  @Test
  @DisplayName("the title is required, at most 300 characters and free of control characters")
  void titleRules() {
    String ok = "\"date\": \"2026-11-17\", \"startTime\": \"09:00\", \"endTime\": \"10:00\"";
    InitiativeAssertions.assertProblem(
        PlannerApi.postEvent("{\"title\": \" \", " + ok + "}"), 400, "calendar-event.title.blank");
    InitiativeAssertions.assertProblem(
        PlannerApi.postEvent("{" + ok + "}"), 400, "calendar-event.title.blank");
    InitiativeAssertions.assertProblem(
        PlannerApi.postEvent("{\"title\": \"" + "a".repeat(301) + "\", " + ok + "}"),
        400,
        "calendar-event.title.too-long");
    InitiativeAssertions.assertProblem(
        PlannerApi.postEvent("{\"title\": \"a\\u0000b\", " + ok + "}"),
        400,
        "calendar-event.title.invalid-characters");
    String id = PlannerApi.createEventId("Dentist", PlannerApi.TUESDAY, "09:00", "09:30");
    InitiativeAssertions.assertProblem(
        PlannerApi.patchEvent(id, "{\"title\": \"\"}"), 400, "calendar-event.title.blank");
  }

  @Test
  @DisplayName("times must be quarter hours with the start before the end")
  void timeRules() {
    for (String[] times :
        new String[][] {
          {"09:10", "10:00"}, {"09:00", "10:05"}, {"10:00", "10:00"}, {"11:00", "10:00"}
        }) {
      InitiativeAssertions.assertProblem(
          PlannerApi.postEvent(PlannerApi.eventJson("x", PlannerApi.TUESDAY, times[0], times[1])),
          400,
          PlannerApi.EVENT_TIME);
    }
    InitiativeAssertions.assertProblem(
        PlannerApi.postEvent("{\"title\": \"x\", \"date\": \"2026-11-17\"}"),
        400,
        PlannerApi.EVENT_TIME);
    String id = PlannerApi.createEventId("Dentist", PlannerApi.TUESDAY, "09:00", "09:30");
    InitiativeAssertions.assertProblem(
        PlannerApi.patchEvent(id, "{\"endTime\": \"08:45\"}"), 400, PlannerApi.EVENT_TIME);
    PlannerApi.patchEvent(id, "{}").body(END, equalTo("09:30"));
  }

  @Test
  @DisplayName("an event can end at 23:45 and start at 00:00")
  void dayLimits() {
    PlannerApi.postEvent(PlannerApi.eventJson("Night", PlannerApi.TUESDAY, "00:00", "23:45"))
        .statusCode(201);
  }

  @Test
  @DisplayName("events overlap each other freely")
  void overlap() {
    PlannerApi.createEventId("A", PlannerApi.TUESDAY, "09:00", "10:00");
    PlannerApi.createEventId("B", PlannerApi.TUESDAY, "09:30", "10:30");
    PlannerApi.createEventId("C", PlannerApi.TUESDAY, "09:00", "10:00");

    PlannerApi.planner(PlannerApi.MONDAY).body("events.size()", equalTo(3));
  }

  @Test
  @DisplayName("bodies are strict: bad types, formats, unknown and null fields are http.400")
  void strictBodies() {
    String id = PlannerApi.createEventId("Dentist", PlannerApi.TUESDAY, "09:00", "09:30");
    for (String body :
        new String[] {
          "{\"title\": 1}",
          PlannerApi.eventJson("x", "2026-13-01", "09:00", "10:00"),
          PlannerApi.eventJson("x", PlannerApi.TUESDAY, "9:00", "10:00"),
          PlannerApi.eventJson("x", PlannerApi.TUESDAY, "09:00:00", "10:00"),
          PlannerApi.eventJson("x", PlannerApi.TUESDAY, "09:00", "24:00"),
          PlannerApi.eventJson("x", PlannerApi.TUESDAY, "09:00", "10:00")
              .replace("\"09:00\"", "900"),
          "{\"title\": \"x\", \"color\": \"azul\"}",
          "{\"title\": \"x\", \"title\": \"y\"}",
          "[]",
          "\"x\"",
          "{\"title\": \"x\"} x",
          ""
        }) {
      InitiativeAssertions.assertMalformed(PlannerApi.postEvent(body));
    }
    for (String body :
        new String[] {
          "{\"title\": null}",
          "{\"date\": null}",
          "{\"startTime\": null}",
          "{\"endTime\": null}",
          "{\"startTime\": \"9:00\"}",
          "{\"id\": \"x\"}"
        }) {
      InitiativeAssertions.assertMalformed(PlannerApi.patchEvent(id, body));
    }
    PlannerApi.planner(PlannerApi.MONDAY).body("events.size()", equalTo(1));
  }
}
