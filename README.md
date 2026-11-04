# Bouléplan

Gerenciador pessoal de iniciativas e tarefas: kanban de iniciativas, fases e tarefas, mais um planner semanal com três camadas visuais (compromisso fixo, tempo dedicado e prazo).

O nome vem do Boulé, o conselho da Atenas antiga que preparava a pauta sem decidir por ninguém: o app organiza e dá clareza, a decisão continua sua.

## Estrutura do repositório

| Pasta | O quê | Stack |
| --- | --- | --- |
| [`api/`](api/README.md) | Backend REST | Java 21, Quarkus (imperativo, Panache), Gradle (Kotlin DSL), Flyway |
| [`web/`](web/README.md) | Frontend | Next.js (App Router), React, TypeScript, pnpm, Vitest |
| `compose.yaml` | PostgreSQL para desenvolvimento | Docker Compose |
| `.github/workflows/` | CI | GitHub Actions + SonarQube Cloud |

## Pré-requisitos

- Docker (com Docker Compose)
- JDK 21
- Node.js 22 e pnpm 10

## Rodando localmente

Na raiz, suba o banco:

```bash
docker compose up -d
```

Em um terminal, a API (em modo dev, com recarga automática):

```bash
cd api && ./gradlew quarkusDev
```

Em outro terminal, o frontend:

```bash
cd web && pnpm install && pnpm dev
```

Cada projeto tem no próprio README os comandos de lint, testes e build.

## Qualidade e CI

Todo push na `main` e todo pull request passam pelo workflow [`CI`](.github/workflows/ci.yml):

1. **API**: Checkstyle e PMD (qualquer violação quebra o build), testes contra um PostgreSQL real e build.
2. **Web**: Prettier, ESLint (zero avisos), checagem de tipos, testes com cobertura e build de produção.
3. **Sonar**: junta a cobertura dos dois lados e roda o SonarQube Cloud. O job falha se o quality gate reprovar.

### Configuração única do SonarQube Cloud

1. Em [sonarcloud.io](https://sonarcloud.io), importe a organização do GitHub e o repositório `DaviSFS21/bouleplan`.
2. Confira se a organização e a chave do projeto batem com [`sonar-project.properties`](sonar-project.properties) (`davisfs21` e `DaviSFS21_bouleplan`).
3. Em *Administration → Analysis Method*, desligue a **Automatic Analysis** (a análise vem do CI).
4. Gere um token em *My Account → Security* e cadastre-o no GitHub como secret de Actions chamado `SONAR_TOKEN`.

## Documentação

- Produto, modelagem e roadmap: Notion (página "bouléplan").
- Interface: Design System Bouléplan.
- Decisões de arquitetura: `docs/adr/`, quando passarem a surgir com frequência.
