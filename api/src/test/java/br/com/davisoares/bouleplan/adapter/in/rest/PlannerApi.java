package br.com.davisoares.bouleplan.adapter.in.rest;

import static io.restassured.RestAssured.given;

import io.restassured.http.ContentType;
import io.restassured.response.ValidatableResponse;

/** Test helpers for the planner REST tests. */
@SuppressWarnings("PMD.TooManyMethods") // one small helper per endpoint
final class PlannerApi {

  static final String EVENTS = "/calendar-events";
  static final String ITEMS = "/scheduled-items";
  static final String MONDAY = "2026-11-16";
  static final String TUESDAY = "2026-11-17";
  static final String WEDNESDAY = "2026-11-18";
  static final String OVERLAP = "scheduled-item.overlap";
  static final String DUPLICATE = "scheduled-item.duplicate";
  static final String TASK_DONE = "scheduled-item.task-done";
  static final String ITEM_TIME = "scheduled-item.time.invalid";
  static final String EVENT_TIME = "calendar-event.time.invalid";
  static final String ID = "id";

  private PlannerApi() {}

  static ValidatableResponse send(String method, String path, String json) {
    return given().contentType(ContentType.JSON).body(json).when().request(method, path).then();
  }

  static ValidatableResponse postEvent(String json) {
    return send("POST", EVENTS, json);
  }

  static ValidatableResponse patchEvent(String id, String json) {
    return send("PATCH", EVENTS + "/" + id, json);
  }

  static ValidatableResponse deleteEvent(String id) {
    return given().when().delete(EVENTS + "/" + id).then();
  }

  static ValidatableResponse postItem(String json) {
    return send("POST", ITEMS, json);
  }

  static ValidatableResponse patchItem(String id, String json) {
    return send("PATCH", ITEMS + "/" + id, json);
  }

  static ValidatableResponse deleteItem(String id) {
    return given().when().delete(ITEMS + "/" + id).then();
  }

  static ValidatableResponse planner(String weekStart) {
    return given().queryParam("weekStart", weekStart).get("/planner").then();
  }

  static ValidatableResponse taskItems(String taskId) {
    return given().get(TaskApi.PATH + "/" + taskId + "/scheduled-items").then();
  }

  static String eventJson(String title, String date, String start, String end) {
    return "{\"title\": \"%s\", \"date\": \"%s\", \"startTime\": \"%s\", \"endTime\": \"%s\"}"
        .formatted(title, date, start, end);
  }

  static String blockJson(String taskId, String date, String start, String end) {
    return "{\"taskId\": \"%s\", \"date\": \"%s\", \"startTime\": \"%s\", \"endTime\": \"%s\"}"
        .formatted(taskId, date, start, end);
  }

  static String dayListJson(String taskId, String date) {
    return "{\"taskId\": \"%s\", \"date\": \"%s\"}".formatted(taskId, date);
  }

  static String createEventId(String title, String date, String start, String end) {
    return postEvent(eventJson(title, date, start, end)).statusCode(201).extract().path(ID);
  }

  static String createBlockId(String taskId, String date, String start, String end) {
    return postItem(blockJson(taskId, date, start, end)).statusCode(201).extract().path(ID);
  }

  static String createDayListId(String taskId, String date) {
    return postItem(dayListJson(taskId, date)).statusCode(201).extract().path(ID);
  }

  static void markDone(String taskId) {
    TaskApi.patch(taskId, "{\"status\": \"done\"}").statusCode(200);
  }
}
