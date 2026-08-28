# Contributing an OH Play Pack

OH Play welcomes finished, well-prepared packs through this repository. It is
curated: a passing validator result is necessary but does not guarantee
acceptance, publication, factual endorsement, or legal/licence verification.

## Before you start

The V1 supported external type is a **Game Cards world**. A real pack needs:

- English and Hungarian (`en` and `hu`) for every required localized field;
- traceable sources for factual fields and comparison stats;
- an explicit licence for the contributor's pack content; and
- per-asset creator, provenance, and licence metadata where applicable.

Submit only content and assets you have the right to share. A pack-level
licence never replaces an individual third-party asset's licence.

Your original work remains yours; OH Play does not take ownership. We prefer
`CC-BY-NC-SA-4.0` for original pack content so it can be played and shared
non-commercially. You may separately commercialise your own work or grant
different commercial permission.

## Learn from the examples

[`examples/template/`](examples/template/) explains the smallest structure.
It intentionally has one illustrative Battle card, so it is not a finished
submission. Replace every illustrative fact, source, and asset before making a
real pack.

[`examples/wild-animals-reference/`](examples/wild-animals-reference/) is a
complete, valid **REFERENCE / EXAMPLE**. It demonstrates EN/HU content, stats,
provenance, asset attribution, and licences. It is not in the submission
catalogue or the production OH Play catalogue.

## Create your pack

Create exactly one stable lowercase kebab-case directory per pack:

```text
packs/
  game-cards/
    <pack-id>/
      pack.json
      assets/
        <local-raster-image>
```

The folder name must match `pack.json`'s `id`. Runtime images must stay inside
that pack's `assets/` directory. Allowed submission asset types are AVIF, JPEG,
PNG, and WebP. SVG is excluded from submission directories because it can carry
active content; it is used only in the examples. Do not add scripts,
JavaScript/TypeScript, executable files, symlinks, remote runtime images, or
code to a pack.

## Validate locally

With Node.js 20 or newer, no dependency installation is needed:

```bash
npm run validate -- packs/game-cards/<pack-id>
```

Success ends with `VALID`. An invalid pack exits non-zero and shows a code,
path, and message, for example:

```text
INVALID — 1 error

[MISSING_ASSET]
content.cards[4].image.path
Local runtime image "assets/gray-wolf.webp" does not exist.
```

To check every actual submitted pack:

```bash
npm run validate:all
```

## Submit a pull request

1. Fork this repository and create a branch.
2. Add or change only `packs/game-cards/<pack-id>/` for a normal pack task.
3. Run the local validator and fix every error.
4. Open a pull request and complete the submission template.

The public CI validates changed pack roots with the same trusted validator. It
does not execute anything supplied inside a pack directory. CI failure tells
you what to fix; CI pass is not a publication decision.

## What happens after CI

Human reviewers assess editorial fit, factual sources, translations, gameplay,
image usability, and whether rights metadata appears plausible. They may ask
for changes or decline a technically valid pack. Good candidates encourage
playing together, work for families/friends/groups, are clear and respectful,
accurate where factual, properly sourced, legally usable, ad-free, and
appropriate for their audience.

Spam, disguised marketing, unlicensed copied material, unclear ownership,
broken/incomplete packs, tracking/account requirements, and technically valid
but ill-fitting content are not accepted by default.

## Promotion into OH Play

V1 keeps a deliberate public/private boundary:

```text
public pack PR reviewed and merged
  → internal maintainer copies/imports the approved pack into private OH Play
  → internal validator and diff review
  → normal private review and merge
```

Promotion is manual in V1. A merged public pack is not automatically loaded or
published in OH Play.

## If you only have an idea

You do not need GitHub or programming to have an idea for OH Play. The public
OH Play site will surface the contact route in C4B. Until then, use the contact
option on OH Play; do not invent an unofficial address or submit incomplete
technical packs.
