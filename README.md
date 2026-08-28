# Create something for OH Play

This is the starter kit and official finished-pack contribution repository for
**OH Play**. It contains everything needed to make one supported pack type:
a **Game Cards world**. You do not need the private OH Play application or any
knowledge of React, Vite, or its internal code.

## Licensing at a glance

**Starter kit, tooling, validators, schema, and contributor docs →
[MIT License](LICENSE).**

**Pack content and assets → each pack's own `pack.json` licensing metadata.**
The repository MIT licence never grants rights to third-party images, text,
data, or other contributed content. Read [`LICENSING.md`](LICENSING.md) before
reusing anything beyond the starter infrastructure.

For original community pack content, the preferred default is
**CC BY-NC-SA 4.0** (`CC-BY-NC-SA-4.0`). The creator keeps ownership and may
separately commercialise their own work. Third-party assets retain their own
licences.

## Which situation fits you?

### I have an idea

You do **not** need to know GitHub or programming to have an idea for OH Play.
The public OH Play website will provide the contact option in C4B. Until then,
use the contact option on OH Play rather than trying to turn an unfinished idea
into a technical submission.

### I want to build a pack with a coding agent

You can work with Codex, Claude Code, Cursor, or another repository-aware
coding agent. The agent does not need OH Play codebase knowledge: this
repository is its technical contract.

Read the copyable prompt below, then let the agent read [`AGENTS.md`](AGENTS.md)
first.

### I already know Git and GitHub

Read [`CONTRIBUTING.md`](CONTRIBUTING.md), create your pack under
`packs/game-cards/<pack-id>/`, validate it locally, and open a pull request.

**Technical validation is not OH Play approval.** Every pack receives human
technical, editorial, factual, and rights review before it can be accepted.

## Using a coding agent?

Copy this prompt into your coding agent:

```text
I want to create an OH Play Game Cards pack.

Read this repository's AGENTS.md first and follow it as the technical contract.

My idea is:

  <WRITE YOUR IDEA HERE>

Help me turn the idea into a valid OH Play pack.

I may not be a programmer, so explain important choices simply and handle the
technical pack structure for me.

Requirements:

- work only inside a new packs/game-cards/<pack-id>/ directory
- use the provided template and reference pack
- include English and Hungarian
- use factual, traceable sources
- never invent sources, licences, creators, attribution, or provenance
- use only assets we have the right to submit
- keep runtime assets local
- do not modify the starter infrastructure or OH Play core code
- run the repository validator
- fix all technical validation errors

When validation passes, give me a short report covering:
1. what you created
2. sources
3. asset/licensing status
4. anything that still needs human review

VALID does not mean accepted or published.
OH Play performs human review before inclusion.
```

For experienced agent users:

```text
Read AGENTS.md and create a Game Cards pack for <topic>. Work only under
packs/game-cards/<id>. Iterate until npm validation passes. Never invent
provenance or licensing.
```

## Start here

1. Read [`CONTRIBUTING.md`](CONTRIBUTING.md).
2. Inspect [`examples/template/`](examples/template/) and the complete
   [`examples/wild-animals-reference/`](examples/wild-animals-reference/).
3. Create one folder at `packs/game-cards/<stable-pack-id>/`.
4. Validate it:

   ```bash
   npm run validate -- packs/game-cards/my-pack
   ```

5. Open a pull request after the command ends with `VALID`.

The template is deliberately tiny and has only one Battle card, so it needs
real completion before it can validate. The Wild Animals reference is a valid
**REFERENCE / EXAMPLE**, not a production submission.

## Magyarul, röviden

Nem kell programozónak lenned ahhoz, hogy ötleted legyen az OH Playhez. A
kész, technikai csomagokhoz ezt a tárolót és az itt lévő validátort használjuk;
a csomagokban angol és magyar tartalom is kötelező. Ötlethez a C4B-ben érkező
OH Play kapcsolatfelvételi lehetőséget használd. A `VALID` eredmény nem jelent
automatikus elfogadást vagy publikálást.

## Commands

This kit has no runtime dependencies. With Node.js 20 or newer:

```bash
npm run validate -- packs/game-cards/my-pack
npm run validate:all
npm test
```

`validate:all` checks every actual submitted pack; examples are not part of the
submission catalogue. `npm test` is a small offline starter-kit smoke test.
