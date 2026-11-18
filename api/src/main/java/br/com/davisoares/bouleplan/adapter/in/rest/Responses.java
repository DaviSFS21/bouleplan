package br.com.davisoares.bouleplan.adapter.in.rest;

/** Constants shared by the OpenAPI annotations of the resources. */
final class Responses {

  static final String OK = "200";
  static final String BAD_REQUEST = "400";
  static final String NOT_FOUND = "404";
  static final String CONFLICT = "409";
  static final String UNPROCESSABLE = "422";
  static final String NO_ACTIVE = "No active initiative with this id";

  static final String NO_EPIC = "No active epic with this id in an active initiative of the user";

  static final String NO_TASK =
      "No active task with this id in an active epic and initiative of the user";

  static final String NO_EVENT = "No event with this id of the user";

  static final String NO_ITEM =
      "No item with this id whose task is active in an active epic and initiative of the user";

  private Responses() {}
}
