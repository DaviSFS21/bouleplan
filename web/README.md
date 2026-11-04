# Bouléplan — web

Frontend do Bouléplan (Next.js, App Router, TypeScript, pnpm).

## Requisitos

- Node.js 22 ou superior (`.node-version`)
- pnpm 10 (versão exata em `packageManager`; use `corepack enable`)

## Instalação

```bash
pnpm install --frozen-lockfile
```

## Desenvolvimento

```bash
pnpm dev
```

Abre em <http://localhost:3000>.

## Verificações

| Comando              | O que faz                                                    |
| -------------------- | ------------------------------------------------------------ |
| `pnpm lint`          | ESLint rígido (type-aware), falha com qualquer aviso         |
| `pnpm typecheck`     | gera os tipos do Next (`next typegen`) e roda `tsc --noEmit` |
| `pnpm format`        | Formata o projeto com Prettier                               |
| `pnpm format:check`  | Verifica a formatação (usado na CI)                          |
| `pnpm test`          | Testes com Vitest                                            |
| `pnpm test:watch`    | Testes em modo watch                                         |
| `pnpm test:coverage` | Testes com cobertura (`coverage/lcov.info` p/ SonarQube)     |
| `pnpm build`         | Build de produção                                            |
| `pnpm start`         | Serve o build de produção                                    |

## Telemetria

A telemetria do Next.js é desativada definindo a variável de ambiente
`NEXT_TELEMETRY_DISABLED=1` (a CI já faz isso). Localmente:

```bash
export NEXT_TELEMETRY_DISABLED=1
```
