package br.com.davisoares.bouleplan.application.service;

import br.com.davisoares.bouleplan.application.port.in.ArchiveEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreateEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.DeleteEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.GetEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.ListEpicsUseCase;
import br.com.davisoares.bouleplan.application.port.in.RestoreEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.UnarchiveEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateEpicCommand;
import br.com.davisoares.bouleplan.application.port.in.UpdateEpicUseCase;
import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import br.com.davisoares.bouleplan.application.port.out.EpicRepository;
import br.com.davisoares.bouleplan.application.port.out.InitiativeRepository;
import br.com.davisoares.bouleplan.domain.Epic;
import br.com.davisoares.bouleplan.domain.Initiative;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Use cases for epics. */
@ApplicationScoped
public class EpicService
    implements ListEpicsUseCase,
        CreateEpicUseCase,
        GetEpicUseCase,
        UpdateEpicUseCase,
        ArchiveEpicUseCase,
        UnarchiveEpicUseCase,
        DeleteEpicUseCase,
        RestoreEpicUseCase {

  private final EpicRepository epics;
  private final InitiativeRepository initiatives;
  private final CurrentUser currentUser;

  /** Wires the outbound ports. */
  public EpicService(
      EpicRepository epics, InitiativeRepository initiatives, CurrentUser currentUser) {
    this.epics = epics;
    this.initiatives = initiatives;
    this.currentUser = currentUser;
  }

  @Override
  public Optional<List<Epic>> listActive(UUID initiativeId) {
    return initiatives
        .findActiveByIdAndUser(initiativeId, currentUser.id())
        .map(initiative -> epics.findActiveNamedByInitiative(initiative.getId()));
  }

  @Override
  @Transactional
  public Optional<Epic> create(UUID initiativeId, String name) {
    return initiatives
        .findByIdAndUserForUpdate(initiativeId, currentUser.id())
        .filter(Initiative::isActive)
        .map(initiative -> {
          Epic epic = Epic.create(initiative.getId(), name);
          epics.save(epic);
          return epic;
        });
  }

  @Override
  public Optional<Epic> find(UUID id) {
    return epics.findActiveNamedByIdAndUser(id, currentUser.id());
  }

  @Override
  @Transactional
  public Optional<Epic> update(UUID id, UpdateEpicCommand command) {
    return findActiveForUpdate(id)
        .map(epic -> {
          if (command.name().present()) {
            epic.rename(command.name().value());
          }
          return epic;
        });
  }

  @Override
  @Transactional
  public Optional<Epic> archive(UUID id) {
    return findActiveForUpdate(id)
        .map(epic -> {
          epic.archive();
          return epic;
        });
  }

  @Override
  @Transactional
  public Optional<Epic> unarchive(UUID id) {
    return lockForWrite(id)
        .filter(epic -> !epic.isDeleted())
        .map(epic -> {
          epic.unarchive();
          return epic;
        });
  }

  @Override
  @Transactional
  public Optional<Epic> delete(UUID id) {
    return findActiveForUpdate(id)
        .map(epic -> {
          epic.softDelete();
          return epic;
        });
  }

  @Override
  @Transactional
  public Optional<Epic> restore(UUID id) {
    return lockForWrite(id)
        .map(epic -> {
          epic.restore();
          return epic;
        });
  }

  private Optional<Epic> findActiveForUpdate(UUID id) {
    return lockForWrite(id).filter(Epic::isActive);
  }

  // Lock order: initiative, then epic. The epic is not loaded before its initiative is locked.
  private Optional<Epic> lockForWrite(UUID id) {
    UUID userId = currentUser.id();
    return epics
        .findInitiativeIdOfNamed(id)
        .flatMap(initiativeId -> initiatives.findByIdAndUserForUpdate(initiativeId, userId))
        .filter(Initiative::isActive)
        .flatMap(initiative -> epics.findNamedByIdAndUserForUpdate(id, userId));
  }
}
