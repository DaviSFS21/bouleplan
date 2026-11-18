package br.com.davisoares.bouleplan.domain;

/** One question of a sheet with its answer; the prompt is the text the sheet was created with. */
public record IntrospectionAnswer(String key, String prompt, String answer) {}
