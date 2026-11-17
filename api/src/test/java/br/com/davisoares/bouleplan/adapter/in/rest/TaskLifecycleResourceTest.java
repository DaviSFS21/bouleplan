package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskLifecycleResourceTest {

  private static final String TITLE = "title";
  private static final String WRITE = "Write";

  private String id;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    id = TaskApi.createId(TaskApi.initiativeId("Study"), WRITE);
  }

  @Test
  @DisplayName("archive returns the task and hides it; archiving again is 404")
  void archive() {
    TaskActions.archive(id).statusCode(200).body(TITLE, equalTo(WRITE));

    TaskApi.list().body("", empty());
    InitiativeAssertions.assertNotFound(TaskApi.get(id));
    InitiativeAssertions.assertNotFound(TaskActions.archive(id));
  }

  @Test
  @DisplayName("unarchive brings the task back; on an active task it is a no-op")
  void unarchive() {
    TaskActions.unarchive(id).statusCode(200).body(TITLE, equalTo(WRITE));
    TaskActions.archive(id).statusCode(200);

    TaskActions.unarchive(id).statusCode(200).body(TITLE, equalTo(WRITE));

    TaskApi.list().body(TITLE, contains(WRITE));
  }

  @Test
  @DisplayName("delete is 204 and hides the task; deleting again is 404")
  void delete() {
    TaskActions.delete(id).statusCode(204);

    TaskApi.list().body("", empty());
    InitiativeAssertions.assertNotFound(TaskApi.get(id));
    InitiativeAssertions.assertNotFound(TaskActions.delete(id));
  }

  @Test
  @DisplayName("restore brings a deleted task back; on a task that is not deleted it is a no-op")
  void restore() {
    TaskActions.restore(id).statusCode(200).body(TITLE, equalTo(WRITE));
    TaskActions.delete(id).statusCode(204);

    TaskActions.restore(id).statusCode(200).body(TITLE, equalTo(WRITE));

    TaskApi.list().body(TITLE, contains(WRITE));
  }

  @Test
  @DisplayName("an archived task can be deleted only after unarchiving")
  void archivedThenDelete() {
    TaskActions.archive(id).statusCode(200);

    InitiativeAssertions.assertNotFound(TaskActions.delete(id));
    TaskActions.unarchive(id).statusCode(200);
    TaskActions.delete(id).statusCode(204);
  }

  @Test
  @DisplayName("a deleted task cannot be unarchived, and restoring keeps an archived one archived")
  void deletedAndArchivedStates() {
    TaskActions.delete(id).statusCode(204);
    InitiativeAssertions.assertNotFound(TaskActions.unarchive(id));
    TaskActions.restore(id).statusCode(200);
    TaskActions.archive(id).statusCode(200);

    TaskActions.restore(id).statusCode(200);

    TaskApi.list().body("", empty());
    TaskActions.unarchive(id).statusCode(200);
    TaskApi.list().body(TITLE, contains(WRITE));
  }
}
