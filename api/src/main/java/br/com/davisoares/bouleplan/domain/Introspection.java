package br.com.davisoares.bouleplan.domain;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

/** The weekly review sheet of a user; once closed it never changes. */
@Entity
@Table(name = "introspection")
public class Introspection extends PanacheEntityBase {

  public static final String ANSWER_CODE = "introspection.answer";

  @Id @GeneratedValue @UuidGenerator private UUID id;

  @Column(name = "user_id", nullable = false, updatable = false)
  private UUID userId;

  @Column(name = "week_start", nullable = false, updatable = false)
  private LocalDate weekStart;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private List<IntrospectionAnswer> answers;

  @Column(name = "closed_at")
  private OffsetDateTime closedAt;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  /** For JPA. */
  protected Introspection() {
    super();
  }

  /** An empty sheet for the week, with the current questions; the week must be a valid Monday. */
  public static Introspection draft(UUID userId, LocalDate weekStart) {
    Introspection sheet = new Introspection();
    sheet.userId = userId;
    sheet.weekStart = requireWeek(weekStart);
    sheet.answers =
        IntrospectionQuestions.all().stream()
            .map(question -> new IntrospectionAnswer(question.key(), question.prompt(), ""))
            .toList();
    return sheet;
  }

  /** The date itself, or a violation with the code {@code introspection.week.invalid}. */
  public static LocalDate requireWeek(LocalDate weekStart) {
    if (Objects.isNull(weekStart)
        || !CalendarDates.isMonday(weekStart)
        || !EntityText.hasValidYear(weekStart)) {
      throw new InvalidIntrospectionException(
          "introspection.week.invalid",
          "The week must start on a Monday with a year between "
              + EntityText.MIN_DEADLINE_YEAR
              + " and "
              + EntityText.MAX_DEADLINE_YEAR);
    }
    return weekStart;
  }

  /**
   * Replaces the given answers by key; the others and every stored prompt stay. A key the sheet
   * does not have yet is added with the current prompt.
   */
  public void answer(Map<String, String> changes) {
    requireOpen();
    Map<String, String> validated =
        changes.entrySet().stream()
            .collect(Collectors.toMap(Map.Entry::getKey, entry -> validAnswer(entry.getValue())));
    List<IntrospectionAnswer> next = new ArrayList<>();
    for (IntrospectionQuestions.Question question : IntrospectionQuestions.all()) {
      IntrospectionAnswer stored = stored(question.key());
      if (Objects.nonNull(stored)) {
        next.add(withAnswer(stored, validated));
      } else if (validated.containsKey(question.key())) {
        next.add(
            new IntrospectionAnswer(
                question.key(), question.prompt(), validated.get(question.key())));
      }
    }
    answers.stream()
        .filter(stored -> !IntrospectionQuestions.isKnown(stored.key()))
        .forEach(stored -> next.add(withAnswer(stored, validated)));
    answers = next;
  }

  private IntrospectionAnswer stored(String key) {
    return answers.stream().filter(a -> a.key().equals(key)).findFirst().orElse(null);
  }

  private static IntrospectionAnswer withAnswer(
      IntrospectionAnswer stored, Map<String, String> validated) {
    return validated.containsKey(stored.key())
        ? new IntrospectionAnswer(stored.key(), stored.prompt(), validated.get(stored.key()))
        : stored;
  }

  /**
   * Stamps the closing time; a closed sheet cannot be closed again, nor can one of a week that
   * starts after the current week (UTC).
   */
  public void close(OffsetDateTime at) {
    requireOpen();
    LocalDate currentWeek =
        at.toLocalDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    if (weekStart.isAfter(currentWeek)) {
      throw new FutureWeekException();
    }
    closedAt = at;
  }

  /** Whether the sheet was closed. */
  public boolean isClosed() {
    return Objects.nonNull(closedAt);
  }

  private void requireOpen() {
    if (isClosed()) {
      throw new IntrospectionClosedException();
    }
  }

  private static String validAnswer(String text) {
    String valid =
        EntityText.validMultiline(text, "Answer", ANSWER_CODE, InvalidIntrospectionException::new);
    return valid == null ? "" : valid;
  }

  public UUID getId() {
    return id;
  }

  public UUID getUserId() {
    return userId;
  }

  public LocalDate getWeekStart() {
    return weekStart;
  }

  public List<IntrospectionAnswer> getAnswers() {
    return List.copyOf(answers);
  }

  public OffsetDateTime getClosedAt() {
    return closedAt;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public OffsetDateTime getUpdatedAt() {
    return updatedAt;
  }
}
