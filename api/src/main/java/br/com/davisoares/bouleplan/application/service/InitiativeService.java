package br.com.davisoares.bouleplan.application.service;

import br.com.davisoares.bouleplan.application.port.in.ArchiveInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.DeleteInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.GetInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.ListInitiativesUseCase;
import br.com.davisoares.bouleplan.application.port.in.RestoreInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.UnarchiveInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand;
import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import br.com.davisoares.bouleplan.application.port.out.InitiativeRepository;
import br.com.davisoares.bouleplan.application.port.out.UserLock;
import br.com.davisoares.bouleplan.domain.Initiative;
import br.com.davisoares.bouleplan.domain.InitiativeColor;
import br.com.davisoares.bouleplan.domain.InvalidInitiativeException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Use cases for initiatives. */
@ApplicationScoped
public class InitiativeService
    implements CreateInitiativeUseCase,
        ListInitiativesUseCase,
        GetInitiativeUseCase,
        UpdateInitiativeUseCase,
        ArchiveInitiativeUseCase,
        UnarchiveInitiativeUseCase,
        DeleteInitiativeUseCase,
        RestoreInitiativeUseCase {

  private final InitiativeRepository repository;
  private final CurrentUser currentUser;
  private final UserLock userLock;

  /** Wires the outbound ports. */
  public InitiativeService(
      InitiativeRepository repository, CurrentUser currentUser, UserLock userLock) {
    this.userLock = userLock;
    this.repository = repository;
    this.currentUser = currentUser;
  }

  @Override
  @Transactional
  public Initiative create(String name) {
    UUID userId = currentUser.id();
    userLock.lock(userId);
    List<InitiativeColor> inUse =
        repository.findActiveByUser(userId).stream().map(Initiative::getColor).toList();
    Initiative initiative = Initiative.create(userId, name, InitiativeColor.suggestNext(inUse));
    repository.save(initiative);
    return initiative;
  }

  @Override
  public List<Initiative> listActive() {
    return repository.findActiveByUser(currentUser.id());
  }

  @Override
  public Optional<Initiative> find(UUID id) {
    return repository.findActiveByIdAndUser(id, currentUser.id());
  }

  @Override
  @Transactional
  public Optional<Initiative> update(UUID id, UpdateInitiativeCommand command) {
    return findActiveForUpdate(id)
        .map(initiative -> {
          if (command.name().present()) {
            initiative.rename(command.name().value());
          }
          if (command.description().present()) {
            initiative.describe(command.description().value());
          }
          if (command.overallDeadline().present()) {
            initiative.scheduleDeadline(command.overallDeadline().value());
          }
          if (command.color().present()) {
            initiative.recolor(parseColor(command.color().value()));
          }
          return initiative;
        });
  }

  @Override
  @Transactional
  public Optional<Initiative> archive(UUID id) {
    return findActiveForUpdate(id)
        .map(initiative -> {
          initiative.archive();
          return initiative;
        });
  }

  @Override
  @Transactional
  public Optional<Initiative> unarchive(UUID id) {
    return repository
        .findByIdAndUserForUpdate(id, currentUser.id())
        .filter(initiative -> !initiative.isDeleted())
        .map(initiative -> {
          initiative.unarchive();
          return initiative;
        });
  }

  @Override
  @Transactional
  public Optional<Initiative> delete(UUID id) {
    return findActiveForUpdate(id)
        .map(initiative -> {
          initiative.softDelete();
          return initiative;
        });
  }

  @Override
  @Transactional
  public Optional<Initiative> restore(UUID id) {
    return repository
        .findByIdAndUserForUpdate(id, currentUser.id())
        .map(initiative -> {
          initiative.restore();
          return initiative;
        });
  }

  private Optional<Initiative> findActiveForUpdate(UUID id) {
    return repository.findByIdAndUserForUpdate(id, currentUser.id()).filter(Initiative::isActive);
  }

  private static InitiativeColor parseColor(String token) {
    return token == null
        ? null
        : InitiativeColor.findByToken(token)
            .orElseThrow(() ->
                new InvalidInitiativeException(
                    "initiative.color.invalid", "Unknown color token: " + token));
  }
}
