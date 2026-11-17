package br.com.davisoares.bouleplan.adapter.in.rest;

import static io.restassured.RestAssured.given;

import io.restassured.http.ContentType;
import io.restassured.response.ValidatableResponse;

/** Test helpers for the introspection REST tests. */
final class IntrospectionApi {

  static final String WEEK = "2026-11-16";
  static final String CLOSED = "introspection.closed";
  static final String WEEK_INVALID = "introspection.week.invalid";
  static final String CODE = "code";
  static final String ANSWERS_ANSWER = "answers.answer";

  private IntrospectionApi() {}

  static String path(String week) {
    return "/introspections/" + week;
  }

  static ValidatableResponse get(String week) {
    return given().get(path(week)).then();
  }

  static ValidatableResponse put(String week, String json) {
    return given().contentType(ContentType.JSON).body(json).when().put(path(week)).then();
  }

  static ValidatableResponse close(String week) {
    return given().when().post(path(week) + "/close").then();
  }

  static String answer(String key, String text) {
    return "{\"key\": \"%s\", \"answer\": \"%s\"}".formatted(key, text);
  }

  static String body(String... answers) {
    return "{\"answers\": [" + String.join(", ", answers) + "]}";
  }
}
