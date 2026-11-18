package br.com.davisoares.bouleplan.application.service;

import br.com.davisoares.bouleplan.application.port.in.AnswerChange;
import br.com.davisoares.bouleplan.application.port.in.ManageIntrospectionUseCase;
import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import br.com.davisoares.bouleplan.application.port.out.IntrospectionRepository;
import br.com.davisoares.bouleplan.application.port.out.UserLock;
import br.com.davisoares.bouleplan.domain.Introspection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.stream.Collectors;

/** Use cases of the weekly review. */
@ApplicationScoped
public class IntrospectionService implements ManageIntrospectionUseCase {

  private final IntrospectionRepository sheets;
  private final UserLock userLock;
  private final CurrentUser currentUser;

  /** Wires the outbound ports. */
  public IntrospectionService(
      IntrospectionRepository sheets, UserLock userLock, CurrentUser currentUser) {
    this.sheets = sheets;
    this.userLock = userLock;
    this.currentUser = currentUser;
  }

  @Override
  public Introspection get(LocalDate weekStart) {
    LocalDate week = Introspection.requireWeek(weekStart);
    return sheets
        .findByUserAndWeek(currentUser.id(), week)
        .orElseGet(() -> Introspection.draft(currentUser.id(), week));
  }

  @Override
  @Transactional
  public Introspection save(LocalDate weekStart, List<AnswerChange> changes) {
    Introspection sheet = lockedSheet(weekStart);
    sheet.answer(
        changes.stream().collect(Collectors.toMap(AnswerChange::key, AnswerChange::answer)));
    return sheet;
  }

  @Override
  @Transactional
  public Introspection close(LocalDate weekStart) {
    Introspection sheet = lockedSheet(weekStart);
    sheet.close(OffsetDateTime.now(ZoneOffset.UTC));
    return sheet;
  }

  private Introspection lockedSheet(LocalDate weekStart) {
    LocalDate week = Introspection.requireWeek(weekStart);
    userLock.lock(currentUser.id());
    return sheets
        .findByUserAndWeek(currentUser.id(), week)
        .orElseGet(() -> {
          Introspection created = Introspection.draft(currentUser.id(), week);
          sheets.save(created);
          return created;
        });
  }
}
