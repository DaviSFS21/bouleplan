package br.com.davisoares.bouleplan.domain;

/** A business rule was broken; the stable {@link #code()} lets clients pick their own text. */
public abstract class DomainRuleViolation extends RuntimeException {

  private static final long serialVersionUID = 1L;

  private final String ruleCode;

  /** Creates the violation with a stable machine-readable code and a developer message. */
  protected DomainRuleViolation(String code, String message) {
    super(message);
    this.ruleCode = code;
  }

  /** Stable code such as {@code initiative.name.blank}. */
  public String code() {
    return ruleCode;
  }
}
