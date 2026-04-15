# Copilot Instructions

## Project Overview

An implementation of the [HTTP Message Signatures](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-message-signatures) specification for Node.js, published as the `http-message-signatures` npm package. It supports two specs: the primary **HTTP WG** (httpbis) spec and the legacy **Network WG** (cavage) spec.

## Local Development

Use `nvm` to ensure you're running the correct Node.js version. The required version is pinned in `.nvmrc`:

```sh
nvm use
```

## Build, Test & Lint

```sh
npm run build         # tsc — compiles src/ to lib/
npm run test          # mocha + ts-node (all tests)
npm run test:coverage # tests with nyc coverage
npm run lint          # eslint across src/ and test/
npm run lint:fix      # eslint with auto-fix
```

Run a single test file:

```sh
npx mocha -r ts-node/register -r test/bootstrap.ts 'test/httpbis/httpbis.spec.ts'
```

Run a single test by name:

```sh
npx mocha -r ts-node/register -r test/bootstrap.ts 'test/**/*.ts' --grep 'derives @method component'
```

Note: the `-r test/bootstrap.ts` flag is required — it registers the sinon-chai plugin.

## Architecture

The library exposes two specification implementations via named exports: `httpbis` (primary) and `cavage` (legacy). Both share common types and a pluggable crypto layer.

**Core modules:**

- `src/httpbis/index.ts` — HTTP WG spec implementation: component derivation (derived components like `@method`, `@target-uri`, `@authority`, etc.), signature base construction using structured headers (RFC 8941), signing, and verification. This is the main implementation and the largest file in the codebase.
- `src/cavage/index.ts` — Legacy Network WG spec implementation. Back-ports httpbis concepts but with different header formats (single `Signature` header vs dictionary-based `Signature`/`Signature-Input` pair). Algorithm names are mapped between the two specs (e.g., `hs2019` ↔ `rsa-pss-sha512`).
- `src/types/index.ts` — Shared interfaces: `Request`, `Response`, `SigningKey`, `VerifyingKey`, `SignConfig`, `VerifyConfig`, `ComponentParser`. The `SigningKey`/`VerifyingKey` interfaces are the extension points for custom crypto.
- `src/algorithm/index.ts` — Built-in Node.js crypto signers/verifiers via `createSigner()` and `createVerifier()`. Supports HMAC-SHA256, RSA-PSS-SHA512, RSA-v1.5-SHA256, RSA-v1.5-SHA1 (legacy, for cavage compatibility), ECDSA-P256-SHA256, ECDSA-P384-SHA384, and Ed25519.
- `src/structured-header.ts` — Wrappers around the `structured-headers` package (RFC 8941) for parsing/serializing Dictionary, List, and Item types. Includes `quoteString()` which normalizes component name strings into valid structured field format.
- `src/errors/` — Typed error classes for signature verification failures (`ExpiredError`, `MalformedSignatureError`, `UnacceptableSignatureError`, `UnknownKeyError`, `UnsupportedAlgorithmError`, `VerificationError`).

**Key design pattern:** The crypto layer is fully pluggable. `createSigner()`/`createVerifier()` are convenience helpers using Node.js `crypto`, but consumers can provide any object conforming to `SigningKey`/`VerifyingKey` (e.g., SubtleCrypto, KMS services).

## Conventions

- **Testing:** Mocha + Chai + Sinon. The test bootstrap (`test/bootstrap.ts`) registers sinon-chai. Tests use `mockdate` for time-dependent signature tests. Test structure mirrors source (e.g., `test/httpbis/` tests `src/httpbis/`). Integration tests are suffixed `.int.ts`; unit tests are primarily organized by mirrored paths under `test/` and may use either `.spec.ts` or plain `.ts` filenames.
- **Commit messages:** Follow [Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint. Semantic-release uses these to generate automated releases and changelogs, so correct commit types are critical.
  - `fix` — Bug fixes or behavioural corrections. Triggers a **patch** release.
  - `feat` — New backwards-compatible functionality. Triggers a **minor** release.
  - `feat!` (or any type with `!`) — Breaking changes. Triggers a **major** release.
  - `chore` — Dependency updates, tooling, housekeeping. **Does not normally trigger a release.**
  - `ci` — CI/workflow changes. **Does not normally trigger a release.**
  - `style` — Refactoring or stylistic changes with no functional impact. **Does not normally trigger a release.**
  - `test` — Changes only touching test files. **Does not normally trigger a release.**
  - In practice, only use `fix` and `feat` for changes that are intended to appear in the changelog and trigger a release. All other commit types are "invisible" to the release process.
  - Note that with the current semantic-release defaults, some other types may also trigger releases (for example `perf`, `revert`, or any commit marked with `!`).
- **Commits and merges:**
  - Commits should be atomic and ideally deployable in isolation — all tests, linting, and commitlinting should pass on each individual commit.
  - PRs are merged using a **merge commit** (no squash-merge or rebase-merge). Each commit in the PR history is preserved.
  - To keep branches up to date with the base branch, **rebase** onto it rather than merging it in.
  - When a commit in an open PR needs correcting (e.g. fixing a typo, addressing review feedback), **amend** the original commit (or use interactive rebase) rather than adding a new commit. This keeps the history clean and preserves the correct commit type. If a separate follow-up commit is unavoidable, it must use the same type as the commit it corrects — never `fix`, which would incorrectly trigger a release.
  - All changes must go through a **pull request** — no direct commits to master.
- **ESLint rules:** 4-space indentation, single quotes, trailing commas on multiline, `prefer-destructuring`, `prefer-template`, `prefer-arrow-callback`, no parameter reassignment.
- **TypeScript:** Targets Node.js 16 (`@tsconfig/node16`). Source in `src/`, compiled output in `lib/`. Only `lib/` is published to npm.
- **Keeping this file up to date:** If a change affects the architecture, conventions, build process, or any other information documented here, update this file as part of the same PR.
