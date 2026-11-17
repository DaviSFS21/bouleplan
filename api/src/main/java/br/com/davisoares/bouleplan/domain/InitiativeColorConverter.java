package br.com.davisoares.bouleplan.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** Persists {@link InitiativeColor} as its token name. */
@Converter(autoApply = true)
public class InitiativeColorConverter implements AttributeConverter<InitiativeColor, String> {

  @Override
  public String convertToDatabaseColumn(InitiativeColor attribute) {
    return attribute == null ? null : attribute.getToken();
  }

  @Override
  public InitiativeColor convertToEntityAttribute(String dbData) {
    return dbData == null ? null : InitiativeColor.fromToken(dbData);
  }
}
