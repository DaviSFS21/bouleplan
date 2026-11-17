package br.com.davisoares.bouleplan.application.service;

import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.GetInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.ListInitiativesUseCase;
import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import br.com.davisoares.bouleplan.application.port.out.InitiativeRepository;
import br.com.davisoares.bouleplan.application.port.out.UserLock;
import br.com.davisoares.bouleplan.domain.Initiative;
import br.com.davisoares.bouleplan.domain.InitiativeColor;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Use cases for initiatives. */
@ApplicationScoped
public class InitiativeService
    implements CreateInitiativeUseCase, ListInitiativesUseCase, GetInitiativeUseCase {

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
}
