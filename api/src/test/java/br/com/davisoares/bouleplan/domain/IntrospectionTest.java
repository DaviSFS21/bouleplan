package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import java.lang.reflect.Field;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@SuppressWarnings({
  "PMD.TooManyMethods",
  "PMD.AvoidDuplicateLiterals",
  "PMD.AvoidAccessibilityAlteration"
}) // one test per rule; one test stores an old sheet shape the entity cannot build
class IntrospectionTest {

  private static final UUID USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private static final LocalDate MONDAY = LocalDate.of(2026, 11, 16);
  private static final String WELL = "went_well";
  private static final String BADLY = "went_badly";
  private static final String IMPROVE = "to_improve";

  private static String codeOfAnswer(String text) {
    Introspection sheet = Introspection.draft(USER_ID, MONDAY);
    return ((DomainRuleViolation) catchThrowable(() -> sheet.answer(Map.of(WELL, text)))).code();
  }

  private static List<String> answersOf(Introspection sheet) {
    return sheet.getAnswers().stream().map(IntrospectionAnswer::answer).toList();
  }

  @Test
  @DisplayName("a draft has the three questions in order, with empty answers and no closing")
  void draft() {
    Introspection sheet = Introspection.draft(USER_ID, MONDAY);

    assertThat(sheet.getAnswers())
        .containsExactly(
            new IntrospectionAnswer(WELL, "O que foi bom?", ""),
            new IntrospectionAnswer(BADLY, "O que foi ruim?", ""),
            new IntrospectionAnswer(IMPROVE, "Como posso melhorar?", ""));
    assertThat(sheet.getUserId()).isEqualTo(USER_ID);
    assertThat(sheet.getWeekStart()).isEqualTo(MONDAY);
    assertThat(sheet.isClosed()).isFalse();
    assertThat(sheet.getClosedAt()).isNull();
    assertThat(sheet.getUpdatedAt()).isNull();
  }

  @Test
  @DisplayName("the week must be a Monday with a year from 1 to 9999")
  void week() {
    for (LocalDate bad :
        new LocalDate[] {
          null, MONDAY.plusDays(1), LocalDate.of(10_000, 1, 3), LocalDate.of(0, 12, 27)
        }) {
      Throwable thrown = catchThrowable(() -> Introspection.draft(USER_ID, bad));

      assertThat(thrown)
          .isInstanceOf(InvalidIntrospectionException.class)
          .extracting(t -> ((DomainRuleViolation) t).code())
          .isEqualTo("introspection.week.invalid");
    }
    assertThat(Introspection.requireWeek(LocalDate.of(1, 1, 1))).isEqualTo(LocalDate.of(1, 1, 1));
  }

  @Test
  @DisplayName("answering changes only the given keys and keeps the prompts")
  void answerKeepsOthers() {
    Introspection sheet = Introspection.draft(USER_ID, MONDAY);

    sheet.answer(Map.of(BADLY, "Late nights"));
    sheet.answer(Map.of(WELL, "Finished the plan"));

    assertThat(answersOf(sheet)).containsExactly("Finished the plan", "Late nights", "");
    assertThat(sheet.getAnswers())
        .extracting(IntrospectionAnswer::prompt)
        .containsExactly("O que foi bom?", "O que foi ruim?", "Como posso melhorar?");
  }

  @Test
  @DisplayName("an answer is trimmed, gets LF line breaks and may be cleared")
  void answerText() {
    Introspection sheet = Introspection.draft(USER_ID, MONDAY);

    sheet.answer(Map.of(WELL, "  one\r\ntwo\rthree\tx \n"));

    assertThat(answersOf(sheet).get(0)).isEqualTo("one\ntwo\nthree\tx");

    sheet.answer(Map.of(WELL, "   "));

    assertThat(answersOf(sheet).get(0)).isEmpty();
  }

  @Test
  @DisplayName("an answer has at most 10000 characters and no control characters")
  void answerRules() {
    assertThat(codeOfAnswer("a".repeat(10_001))).isEqualTo("introspection.answer.too-long");
    assertThat(codeOfAnswer("a\u0000b")).isEqualTo("introspection.answer.invalid-characters");
    assertThat(codeOfAnswer("a\u001bb")).isEqualTo("introspection.answer.invalid-characters");

    Introspection sheet = Introspection.draft(USER_ID, MONDAY);
    sheet.answer(Map.of(WELL, "a".repeat(10_000)));

    assertThat(answersOf(sheet).get(0)).hasSize(10_000);
  }

  @Test
  @DisplayName("a key the stored sheet lacks is added in question order with the current prompt")
  void missingKeyIsAdded() throws ReflectiveOperationException {
    Introspection sheet = Introspection.draft(USER_ID, MONDAY);
    Field field = Introspection.class.getDeclaredField("answers");
    field.setAccessible(true);
    field.set(
        sheet,
        List.of(
            new IntrospectionAnswer(WELL, "Old?", "A"),
            new IntrospectionAnswer(IMPROVE, "Old?", "C")));

    sheet.answer(Map.of(BADLY, "B"));

    assertThat(sheet.getAnswers())
        .containsExactly(
            new IntrospectionAnswer(WELL, "Old?", "A"),
            new IntrospectionAnswer(BADLY, "O que foi ruim?", "B"),
            new IntrospectionAnswer(IMPROVE, "Old?", "C"));
  }

  @Test
  @DisplayName("answer violations speak of an answer, not a description")
  void answerWording() {
    Introspection sheet = Introspection.draft(USER_ID, MONDAY);

    assertThat(catchThrowable(() -> sheet.answer(Map.of(WELL, "a".repeat(10_001)))))
        .hasMessage("Answer must have at most 10000 characters");
    assertThat(catchThrowable(() -> sheet.answer(Map.of(WELL, "a\u0000"))))
        .hasMessage("Answer must not contain control or invalid characters");
  }

  @Test
  @DisplayName("a week after the current one cannot be closed, the current and past ones can")
  void futureWeek() {
    OffsetDateTime sunday = OffsetDateTime.parse("2026-11-22T23:00:00Z");

    Throwable future =
        catchThrowable(() -> Introspection.draft(USER_ID, MONDAY.plusDays(7)).close(sunday));

    assertThat(future).isInstanceOf(FutureWeekException.class);
    assertThat(((DomainRuleViolation) future).code()).isEqualTo("introspection.week.future");
    assertThat(catchThrowable(() -> Introspection.draft(USER_ID, MONDAY).close(sunday))).isNull();
    assertThat(
            catchThrowable(() -> Introspection.draft(USER_ID, MONDAY.minusDays(7)).close(sunday)))
        .isNull();
    assertThat(
            catchThrowable(
                () -> Introspection.draft(USER_ID, MONDAY.plusDays(7)).close(sunday.plusHours(1))))
        .isNull();
  }

  @Test
  @DisplayName("closing stamps the time once and freezes the sheet")
  void close() {
    Introspection sheet = Introspection.draft(USER_ID, MONDAY);
    OffsetDateTime at = OffsetDateTime.parse("2026-11-22T18:00:00-03:00");

    sheet.close(at);

    assertThat(sheet.isClosed()).isTrue();
    assertThat(sheet.getClosedAt()).isEqualTo(at);
    assertThat(catchThrowable(() -> sheet.close(at)))
        .isInstanceOf(IntrospectionClosedException.class);
    Throwable answered = catchThrowable(() -> sheet.answer(Map.of(WELL, "x")));
    assertThat(answered).isInstanceOf(IntrospectionClosedException.class);
    assertThat(((DomainRuleViolation) answered).code()).isEqualTo("introspection.closed");
  }

  @Test
  @DisplayName("the questions are known by key")
  void questions() {
    assertThat(IntrospectionQuestions.isKnown(WELL)).isTrue();
    assertThat(IntrospectionQuestions.isKnown("other")).isFalse();
    assertThat(IntrospectionQuestions.isKnown(null)).isFalse();
  }
}
