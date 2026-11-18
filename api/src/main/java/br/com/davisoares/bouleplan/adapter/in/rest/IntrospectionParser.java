package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.AnswerChange;
import br.com.davisoares.bouleplan.domain.IntrospectionQuestions;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Reads the JSON body of a sheet save: known keys at most once, text answers only. */
final class IntrospectionParser {

  private static final Set<String> BODY_FIELDS = Set.of("answers");
  private static final Set<String> ANSWER_FIELDS = Set.of("key", "answer");

  private IntrospectionParser() {}

  static List<AnswerChange> save(ObjectMapper mapper, String body) {
    JsonNode answers = JsonBodies.readObject(mapper, body, BODY_FIELDS).get("answers");
    if (answers == null || !answers.isArray()) {
      throw new MalformedRequestException();
    }
    List<AnswerChange> changes = new ArrayList<>();
    Set<String> seen = new HashSet<>();
    for (JsonNode entry : answers) {
      AnswerChange change = answer(entry);
      if (!IntrospectionQuestions.isKnown(change.key()) || !seen.add(change.key())) {
        throw new MalformedRequestException();
      }
      changes.add(change);
    }
    return changes;
  }

  private static AnswerChange answer(JsonNode entry) {
    if (!entry.isObject() || !ANSWER_FIELDS.containsAll(fieldNames(entry))) {
      throw new MalformedRequestException();
    }
    return new AnswerChange(
        JsonFields.mandatory(JsonBodies.text(entry, "key")),
        JsonFields.mandatory(JsonBodies.text(entry, "answer")));
  }

  private static Set<String> fieldNames(JsonNode node) {
    Set<String> names = new HashSet<>();
    node.fieldNames().forEachRemaining(names::add);
    return names;
  }
}
