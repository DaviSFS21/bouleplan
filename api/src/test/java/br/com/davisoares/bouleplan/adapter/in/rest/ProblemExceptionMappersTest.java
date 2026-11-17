package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.domain.InvalidInitiativeException;
import jakarta.ws.rs.NotFoundException;
import org.jboss.resteasy.reactive.RestResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ProblemExceptionMappersTest {

  private final ProblemExceptionMappers mappers = new ProblemExceptionMappers();

  @Test
  @DisplayName("an unexpected exception becomes a 500 that does not leak its message")
  void internalDoesNotLeak() {
    RestResponse<Problem> response = mappers.internal(new IllegalStateException("secret detail"));

    assertThat(response.getStatus()).isEqualTo(500);
    assertThat(response.getMediaType().toString()).isEqualTo("application/problem+json");
    assertThat(response.getEntity().type()).isEqualTo("/problems/internal");
    assertThat(response.getEntity().status()).isEqualTo(500);
    assertThat(response.getEntity().detail()).doesNotContain("secret");
  }

  @Test
  @DisplayName("a domain violation becomes a 400 carrying the rule message")
  void invalidInitiative() {
    RestResponse<Problem> response =
        mappers.invalidInitiative(new InvalidInitiativeException("Name must not be blank"));

    assertThat(response.getStatus()).isEqualTo(400);
    assertThat(response.getEntity().type()).isEqualTo("/problems/invalid-initiative");
    assertThat(response.getEntity().detail()).isEqualTo("Name must not be blank");
  }

  @Test
  @DisplayName("a JAX-RS web exception keeps its status")
  void webApplicationExceptionKeepsStatus() {
    RestResponse<Problem> response = mappers.webApplication(new NotFoundException());

    assertThat(response.getStatus()).isEqualTo(404);
    assertThat(response.getEntity().status()).isEqualTo(404);
    assertThat(response.getEntity().type()).isEqualTo("/problems/http-error");
  }
}
