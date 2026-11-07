package br.com.davisoares.bouleplan;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Ensures the application boots and reaches a real PostgreSQL. */
@QuarkusTest
class HealthReadinessTest {

  @Test
  @DisplayName("GET /q/health/ready returns 200 and the datasource check is UP")
  void readinessReportsDatasourceUp() {
    given()
        .when()
        .get("/q/health/ready")
        .then()
        .statusCode(200)
        .body("status", equalTo("UP"))
        .body("checks.name", hasItem("Database connections health check"))
        .body(
            "checks.find { it.name == 'Database connections health check' }.status", equalTo("UP"));
  }
}
