package br.com.davisoares.bouleplan;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

/**
 * Architecture rules for the relaxed hexagonal architecture.
 *
 * <p>Plain JUnit 5 (no {@code @QuarkusTest}) so that it stays fast: it only inspects the compiled
 * production classes.
 *
 * <p>{@code adapter.in} has no classes yet, so the two rules whose subject is that package opt in
 * with {@code allowEmptyShould(true)} per rule (not the global {@code archRule.failOnEmptyShould}),
 * so a mistyped pattern in any other rule still fails. Remove them when the REST adapter lands.
 */
@AnalyzeClasses(
    packages = "br.com.davisoares.bouleplan",
    importOptions = ImportOption.DoNotIncludeTests.class)
final class ArchitectureTest {

  private static final String DOMAIN = "br.com.davisoares.bouleplan.domain..";
  private static final String APPLICATION = "br.com.davisoares.bouleplan.application..";
  private static final String ADAPTER = "br.com.davisoares.bouleplan.adapter..";
  private static final String ADAPTER_IN = "br.com.davisoares.bouleplan.adapter.in..";
  private static final String ADAPTER_OUT = "br.com.davisoares.bouleplan.adapter.out..";
  private static final String APPLICATION_SERVICE =
      "br.com.davisoares.bouleplan.application.service..";
  private static final String APPLICATION_PORT_OUT =
      "br.com.davisoares.bouleplan.application.port.out..";

  @ArchTest
  static final ArchRule DOMAIN_DOES_NOT_DEPEND_ON_APPLICATION_OR_ADAPTER =
      noClasses()
          .that()
          .resideInAPackage(DOMAIN)
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage(APPLICATION, ADAPTER)
          .because("the domain is the core and must not know the layers that use it");

  @ArchTest
  static final ArchRule APPLICATION_DOES_NOT_DEPEND_ON_ADAPTER =
      noClasses()
          .that()
          .resideInAPackage(APPLICATION)
          .should()
          .dependOnClassesThat()
          .resideInAPackage(ADAPTER)
          .because("the application layer talks to the outside world only through ports");

  @ArchTest
  static final ArchRule INBOUND_ADAPTERS_DO_NOT_DEPEND_ON_OUTBOUND_ADAPTERS =
      noClasses()
          .that()
          .resideInAPackage(ADAPTER_IN)
          .should()
          .dependOnClassesThat()
          .resideInAPackage(ADAPTER_OUT)
          .allowEmptyShould(true)
          .because("adapters are independent of each other and are wired through the application");

  @ArchTest
  static final ArchRule OUTBOUND_ADAPTERS_DO_NOT_DEPEND_ON_INBOUND_ADAPTERS =
      noClasses()
          .that()
          .resideInAPackage(ADAPTER_OUT)
          .should()
          .dependOnClassesThat()
          .resideInAPackage(ADAPTER_IN)
          .because("adapters are independent of each other and are wired through the application");

  @ArchTest
  static final ArchRule INBOUND_ADAPTERS_USE_ONLY_INBOUND_PORTS =
      noClasses()
          .that()
          .resideInAPackage(ADAPTER_IN)
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage(APPLICATION_SERVICE, APPLICATION_PORT_OUT)
          .allowEmptyShould(true)
          .because("inbound adapters must reach the application only through inbound ports");

  @ArchTest
  static final ArchRule DOMAIN_DOES_NOT_DEPEND_ON_REST_OR_HTTP =
      noClasses()
          .that()
          .resideInAPackage(DOMAIN)
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage("jakarta.ws.rs..", "io.quarkus.rest..", "org.jboss.resteasy..")
          .because("entities may use JPA and Panache, but must stay independent of the web layer");

  @ArchTest
  static final ArchRule TOP_LEVEL_SLICES_ARE_FREE_OF_CYCLES =
      slices()
          .matching("br.com.davisoares.bouleplan.(*)..")
          .should()
          .beFreeOfCycles()
          .because("cycles between domain, application and adapter would defeat the layering");

  private ArchitectureTest() {}
}
