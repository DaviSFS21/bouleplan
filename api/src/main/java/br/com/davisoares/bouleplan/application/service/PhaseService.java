package br.com.davisoares.bouleplan.application.service;

import br.com.davisoares.bouleplan.application.port.in.ArchivePhaseUseCase;
import br.com.davisoares.bouleplan.application.port.in.CreatePhaseUseCase;
import br.com.davisoares.bouleplan.application.port.in.DeletePhaseUseCase;
import br.com.davisoares.bouleplan.application.port.in.GetPhaseUseCase;
import br.com.davisoares.bouleplan.application.port.in.ListPhasesUseCase;
import br.com.davisoares.bouleplan.application.port.in.RestorePhaseUseCase;
import br.com.davisoares.bouleplan.application.port.in.UnarchivePhaseUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdatePhaseCommand;
import br.com.davisoares.bouleplan.application.port.in.UpdatePhaseUseCase;
import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import br.com.davisoares.bouleplan.application.port.out.InitiativeRepository;
import br.com.davisoares.bouleplan.application.port.out.PhaseRepository;
import br.com.davisoares.bouleplan.domain.Initiative;
import br.com.davisoares.bouleplan.domain.Phase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Use cases for phases. */
@ApplicationScoped
public class PhaseService
    implements ListPhasesUseCase,
        CreatePhaseUseCase,
        GetPhaseUseCase,
        UpdatePhaseUseCase,
        ArchivePhaseUseCase,
        UnarchivePhaseUseCase,
        DeletePhaseUseCase,
        RestorePhaseUseCase {

  private final PhaseRepository phases;
  private final InitiativeRepository initiatives;
  private final CurrentUser currentUser;

  /** Wires the outbound ports. */
  public PhaseService(
      PhaseRepository phases, InitiativeRepository initiatives, CurrentUser currentUser) {
    this.phases = phases;
    this.initiatives = initiatives;
    this.currentUser = currentUser;
  }

  @Override
  public Optional<List<Phase>> listActive(UUID initiativeId) {
    return initiatives
        .findActiveByIdAndUser(initiativeId, currentUser.id())
        .map(initiative -> phases.findActiveNamedByInitiative(initiative.getId()));
  }

  @Override
  @Transactional
  public Optional<Phase> create(UUID initiativeId, String name) {
    return initiatives
        .findByIdAndUserForUpdate(initiativeId, currentUser.id())
        .filter(Initiative::isActive)
        .map(initiative -> {
          Phase phase = Phase.create(initiative.getId(), name);
          phases.save(phase);
          return phase;
        });
  }

  @Override
  public Optional<Phase> find(UUID id) {
    return phases.findActiveNamedByIdAndUser(id, currentUser.id());
  }

  @Override
  @Transactional
  public Optional<Phase> update(UUID id, UpdatePhaseCommand command) {
    return findActiveForUpdate(id)
        .map(phase -> {
          if (command.name().present()) {
            phase.rename(command.name().value());
          }
          return phase;
        });
  }

  @Override
  @Transactional
  public Optional<Phase> archive(UUID id) {
    return findActiveForUpdate(id)
        .map(phase -> {
          phase.archive();
          return phase;
        });
  }

  @Override
  @Transactional
  public Optional<Phase> unarchive(UUID id) {
    return lockForWrite(id)
        .filter(phase -> !phase.isDeleted())
        .map(phase -> {
          phase.unarchive();
          return phase;
        });
  }

  @Override
  @Transactional
  public Optional<Phase> delete(UUID id) {
    return findActiveForUpdate(id)
        .map(phase -> {
          phase.softDelete();
          return phase;
        });
  }

  @Override
  @Transactional
  public Optional<Phase> restore(UUID id) {
    return lockForWrite(id)
        .map(phase -> {
          phase.restore();
          return phase;
        });
  }

  private Optional<Phase> findActiveForUpdate(UUID id) {
    return lockForWrite(id).filter(Phase::isActive);
  }

  // Lock order: initiative, then phase. The phase is not loaded before its initiative is locked.
  private Optional<Phase> lockForWrite(UUID id) {
    UUID userId = currentUser.id();
    return phases
        .findInitiativeIdOfNamed(id)
        .flatMap(initiativeId -> initiatives.findByIdAndUserForUpdate(initiativeId, userId))
        .filter(Initiative::isActive)
        .flatMap(initiative -> phases.findNamedByIdAndUserForUpdate(id, userId));
  }
}
