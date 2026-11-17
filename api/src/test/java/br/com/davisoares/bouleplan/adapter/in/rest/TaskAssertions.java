package br.com.davisoares.bouleplan.adapter.in.rest;

/** Assertions shared by the task REST tests. */
final class TaskAssertions {

  private TaskAssertions() {}

  static void assertEveryOperationNotFound(String id) {
    InitiativeAssertions.assertNotFound(TaskApi.get(id));
    InitiativeAssertions.assertNotFound(TaskApi.patch(id, TaskApi.NEW_TITLE));
    InitiativeAssertions.assertNotFound(TaskActions.archive(id));
    InitiativeAssertions.assertNotFound(TaskActions.unarchive(id));
    InitiativeAssertions.assertNotFound(TaskActions.delete(id));
    InitiativeAssertions.assertNotFound(TaskActions.restore(id));
  }

  static String createBody(String phaseId) {
    return "{\"title\": \"New\", \"phaseId\": \"" + phaseId + "\"}";
  }
}
