package br.com.davisoares.bouleplan.adapter.in.rest;

/** Thrown when a request body is required but absent or unreadable. */
class MalformedRequestException extends RuntimeException {

  private static final long serialVersionUID = 1L;

  MalformedRequestException() {
    super();
  }

  MalformedRequestException(Throwable cause) {
    super(cause);
  }
}
