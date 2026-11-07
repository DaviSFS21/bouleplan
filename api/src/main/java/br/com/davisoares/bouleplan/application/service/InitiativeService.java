package br.com.davisoares.bouleplan.application.service;

import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.ListInitiativesUseCase;
import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import br.com.davisoares.bouleplan.application.port.out.InitiativeRepository;
import br.com.davisoares.bouleplan.domain.Initiative;
import br.com.davisoares.bouleplan.domain.InitiativeColor;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.UUID;

/** Use cases for initiatives. */
@ApplicationScoped
public class InitiativeService implements CreateInitiativeUseCase, ListInitiativesUseCase {

  private final InitiativeRepository repository;
  private final CurrentUser currentUser;

  /** Wires the outbound ports. */
  public InitiativeService(InitiativeRepository repository, CurrentUser currentUser) {
    this.repository = repository;
    this.currentUser = currentUser;
  }

  @Override
  @Transactional
  public Initiative create(String name) {
    UUID userId = currentUser.id();
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
}
