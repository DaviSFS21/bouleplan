package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.FindTaskRelationsUseCase;
import br.com.davisoares.bouleplan.application.port.in.TaskRelations;
import br.com.davisoares.bouleplan.domain.Task;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.NotFoundException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Builds task responses with the blocker links the tasks have. */
@ApplicationScoped
class TaskResponses {

  private final FindTaskRelationsUseCase findRelations;

  TaskResponses(FindTaskRelationsUseCase findRelations) {
    this.findRelations = findRelations;
  }

  TaskResponse of(Task task) {
    return TaskResponse.from(
        task,
        findRelations
            .findFor(List.of(task.getId()))
            .getOrDefault(task.getId(), TaskRelations.NONE));
  }

  List<TaskResponse> ofAll(List<Task> tasks) {
    Map<UUID, TaskRelations> relations = findRelations.findForAllVisible();
    return tasks.stream()
        .map(task ->
            TaskResponse.from(task, relations.getOrDefault(task.getId(), TaskRelations.NONE)))
        .toList();
  }

  TaskResponse ofOrNotFound(Optional<Task> task) {
    return of(task.orElseThrow(NotFoundException::new));
  }
}
