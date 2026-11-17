package br.com.davisoares.bouleplan.application.service;

import br.com.davisoares.bouleplan.application.port.in.AddTaskBlockerUseCase;
import br.com.davisoares.bouleplan.application.port.in.FindTaskRelationsUseCase;
import br.com.davisoares.bouleplan.application.port.in.RemoveTaskBlockerUseCase;
import br.com.davisoares.bouleplan.application.port.in.TaskRelations;
import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import br.com.davisoares.bouleplan.application.port.out.TaskBlockerLink;
import br.com.davisoares.bouleplan.application.port.out.TaskBlockerRepository;
import br.com.davisoares.bouleplan.application.port.out.TaskRepository;
import br.com.davisoares.bouleplan.application.port.out.UserLock;
import br.com.davisoares.bouleplan.domain.Task;
import br.com.davisoares.bouleplan.domain.TaskBlockerException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

/** Use cases for the blocker links between tasks. */
@ApplicationScoped
public class TaskBlockerService
    implements AddTaskBlockerUseCase, RemoveTaskBlockerUseCase, FindTaskRelationsUseCase {

  private final TaskBlockerRepository blockers;
  private final TaskRepository tasks;
  private final TaskLocker locker;
  private final UserLock userLock;
  private final CurrentUser currentUser;

  /** Wires the outbound ports. */
  public TaskBlockerService(
      TaskBlockerRepository blockers,
      TaskRepository tasks,
      TaskLocker locker,
      UserLock userLock,
      CurrentUser currentUser) {
    this.blockers = blockers;
    this.tasks = tasks;
    this.locker = locker;
    this.userLock = userLock;
    this.currentUser = currentUser;
  }

  // The user lock serializes every link write, so the cycle check cannot race another insert.
  @Override
  @Transactional
  public boolean add(UUID blockingId, UUID blockedId) {
    userLock.lock(currentUser.id());
    boolean reachable = lockBoth(blockingId, blockedId);
    if (reachable) {
      requireAllowed(blockingId, blockedId);
      blockers.add(blockingId, blockedId);
    }
    return reachable;
  }

  @Override
  @Transactional
  public boolean remove(UUID blockingId, UUID blockedId) {
    userLock.lock(currentUser.id());
    boolean reachable = lockBoth(blockingId, blockedId);
    if (reachable) {
      blockers.remove(blockingId, blockedId);
    }
    return reachable;
  }

  private void requireAllowed(UUID blockingId, UUID blockedId) {
    if (blockingId.equals(blockedId)) {
      throw TaskBlockerException.self();
    }
    if (blockers.reaches(blockedId, blockingId)) {
      throw TaskBlockerException.cycle();
    }
  }

  @Override
  public Map<UUID, TaskRelations> findFor(Collection<UUID> taskIds) {
    List<TaskBlockerLink> links = taskIds.isEmpty() ? List.of() : blockers.findTouching(taskIds);
    Map<UUID, Integer> rank = rankOfVisible(links);
    Comparator<UUID> listOrder = Comparator.comparing(rank::get);
    Map<UUID, List<UUID>> blocksOf =
        group(links, rank, TaskBlockerLink::blockingId, TaskBlockerLink::blockedId, listOrder);
    Map<UUID, List<UUID>> blockedByOf =
        group(links, rank, TaskBlockerLink::blockedId, TaskBlockerLink::blockingId, listOrder);
    return taskIds.stream()
        .distinct()
        .collect(
            Collectors.toMap(
                Function.identity(),
                id ->
                    new TaskRelations(
                        blocksOf.getOrDefault(id, List.of()),
                        blockedByOf.getOrDefault(id, List.of()))));
  }

  // The position of each visible task of the links in the task list order.
  private Map<UUID, Integer> rankOfVisible(List<TaskBlockerLink> links) {
    List<UUID> endpoints =
        links.stream()
            .flatMap(link -> Stream.of(link.blockingId(), link.blockedId()))
            .distinct()
            .toList();
    List<UUID> inListOrder =
        endpoints.isEmpty()
            ? List.of()
            : tasks.findVisibleByIdsAndUser(endpoints, currentUser.id()).stream()
                .map(Task::getId)
                .toList();
    return IntStream.range(0, inListOrder.size())
        .boxed()
        .collect(Collectors.toMap(inListOrder::get, Function.identity()));
  }

  private static Map<UUID, List<UUID>> group(
      List<TaskBlockerLink> links,
      Map<UUID, Integer> rank,
      Function<TaskBlockerLink, UUID> owner,
      Function<TaskBlockerLink, UUID> other,
      Comparator<UUID> order) {
    return links.stream()
        .filter(link -> rank.containsKey(other.apply(link)))
        .collect(
            Collectors.groupingBy(
                owner,
                Collectors.collectingAndThen(
                    Collectors.mapping(other, Collectors.toList()),
                    list -> list.stream().sorted(order).toList())));
  }

  // Tasks are locked by id, after the user, so that opposite writes cannot deadlock.
  private boolean lockBoth(UUID first, UUID second) {
    return Stream.of(first, second)
        .distinct()
        .sorted()
        .map(id -> locker.lock(id).filter(Task::isActive))
        .allMatch(Optional::isPresent);
  }
}
