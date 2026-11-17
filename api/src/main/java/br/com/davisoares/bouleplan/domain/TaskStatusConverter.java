package br.com.davisoares.bouleplan.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** Persists {@link TaskStatus} as its token. */
@Converter(autoApply = true)
public class TaskStatusConverter implements AttributeConverter<TaskStatus, String> {

  @Override
  public String convertToDatabaseColumn(TaskStatus attribute) {
    return attribute == null ? null : attribute.getToken();
  }

  @Override
  public TaskStatus convertToEntityAttribute(String dbData) {
    return dbData == null ? null : TaskStatus.fromToken(dbData);
  }
}
