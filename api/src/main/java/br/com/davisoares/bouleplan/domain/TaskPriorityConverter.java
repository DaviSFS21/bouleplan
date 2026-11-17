package br.com.davisoares.bouleplan.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** Persists {@link TaskPriority} as its token. */
@Converter(autoApply = true)
public class TaskPriorityConverter implements AttributeConverter<TaskPriority, String> {

  @Override
  public String convertToDatabaseColumn(TaskPriority attribute) {
    return attribute == null ? null : attribute.getToken();
  }

  @Override
  public TaskPriority convertToEntityAttribute(String dbData) {
    return dbData == null ? null : TaskPriority.fromToken(dbData);
  }
}
