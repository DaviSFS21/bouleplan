package br.com.davisoares.bouleplan.domain;

import java.util.List;

/** The questions of the weekly review, in order; the server owns their text. */
public final class IntrospectionQuestions {

  private static final List<Question> QUESTIONS =
      List.of(
          new Question("went_well", "O que foi bom?"),
          new Question("went_badly", "O que foi ruim?"),
          new Question("to_improve", "Como posso melhorar?"));

  private IntrospectionQuestions() {}

  /** Key and prompt of one question. */
  public record Question(String key, String prompt) {}

  /** The current questions in display order. */
  public static List<Question> all() {
    return QUESTIONS;
  }

  /** Whether the key names a current question. */
  public static boolean isKnown(String key) {
    return QUESTIONS.stream().anyMatch(question -> question.key().equals(key));
  }
}
