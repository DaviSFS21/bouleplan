# Bouléplan — instruções para agentes

Monorepo pessoal do Davi: `api/` (Quarkus) e `web/` (Next.js). Leia o `README.md` da raiz e o do projeto em que for mexer.

## Forma de trabalho
- Trabalhe por etapas e pare para revisão ao fim de cada uma; explique o porquê das decisões. Quando houver mais de um caminho razoável, apresente as opções com prós e contras antes de escolher.
- Cada etapa do roadmap vira uma branch e um pull request.
- Desenvolvimento por **fatia vertical**: uma funcionalidade de ponta a ponta (domínio → API → tela) por vez.
- **TDD**: escreva o teste antes do código.

## Idioma
- Identificadores de código, tabelas e colunas em inglês, seguindo o ERD (`initiative`, `phase`, `task`, `scheduled_item`…).
- Documentação, comentários, mensagens de commit, descrições de PR e textos da interface em português.

## Backend (`api/`)
- Java 21, Quarkus imperativo (nunca reactive), Panache, PostgreSQL, Flyway (o schema é do Flyway; Hibernate não gera tabelas).
- Hexagonal relaxado: a entidade JPA/Panache carrega a regra de negócio (sem classe de domínio duplicada nem mapper); a separação fica nas portas (`application.port.in`/`out`) e nos adaptadores (`adapter.in.rest`, `adapter.out.persistence`). `domain` nunca depende de `adapter`.
- Checkstyle (Google Java Style) e PMD rígidos: violação quebra o build. Não desligue regras sem justificar no próprio arquivo de configuração.
- `./gradlew check` precisa passar antes de qualquer commit. Os testes sobem o Postgres via Dev Services (precisa de Docker).

## Frontend (`web/`)
- Next.js App Router, TypeScript estrito, pnpm, Vitest + Testing Library.
- ESLint com `--max-warnings=0` e Prettier. Antes de commitar: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- A interface segue o Design System Bouléplan: use sempre os tokens, nunca cores ou tamanhos fixos.

## Modelo de dados (MVP)
Tabelas do ERD: `user`, `initiative`, `phase`, `task`, `task_blocker`, `scheduled_item`, `calendar_event`. O ERD e as decisões de modelagem estão no Notion (página "Técnico & Roadmap"), que é a fonte de verdade. Pontos que mais causam erro:
- Toda tarefa aponta para uma `phase`; iniciativa sem fases nomeadas ganha uma fase implícita (`is_implicit = true`), que a interface esconde.
- `is_blocked` é situação da tarefa, independente de `status` (`to_do`, `in_progress`, `done`) e de `task_blocker`.
- Arquivar e excluir são reversíveis (`archived_at`, `deleted_at`); só o item marcado recebe o carimbo.
- `initiative.color` guarda o nome do token, nunca o hex.
