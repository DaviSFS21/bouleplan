package br.com.davisoares.bouleplan.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** Persists {@link InitiativeOrigin} as its token. */
@Converter(autoApply = true)
public class InitiativeOriginConverter implements AttributeConverter<InitiativeOrigin, String> {

  @Override
  public String convertToDatabaseColumn(InitiativeOrigin attribute) {
    return attribute == null ? null : attribute.getToken();
  }

  @Override
  public InitiativeOrigin convertToEntityAttribute(String dbData) {
    return dbData == null ? null : InitiativeOrigin.fromToken(dbData);
  }
}
