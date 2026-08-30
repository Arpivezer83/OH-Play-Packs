# Contributing an OH Play Pack

OH Play welcomes finished, well-prepared packs through this repository. It is
curated: a passing validator result is necessary but does not guarantee
acceptance, publication, factual endorsement, or legal/licence verification.

**OH Play is not anti-screen.** We believe screens and digital tools are
genuinely valuable when they entertain meaningfully, teach something, help
people create, think, discover, or connect — what we push back on is
technology deliberately built to maximize time on the device, exploit
compulsive behavior, or manipulate attention. That is the standard every
contribution is measured against below.

**OH Play is open to creators, not fully open source.** The core app is not
currently an open-source community project; OnlyHuman sets the mission,
safety boundaries, and architecture, and maintains it directly. This
repository exists to make contribution transparent and accessible to
anyone, not just people who already work with us.

## GitHub terms, in plain language

If some of this is unfamiliar: a **repo** (repository) is this project's
public folder; a **fork** is your own personal copy of it under your GitHub
account; a **branch** is a working version of your fork set aside for one
change; a **pull request (PR)** is a request asking OH Play to review your
proposed pack; the **validator** is the automatic technical checker described
below; **CI** is the automatic GitHub check that runs the validator for you
the moment you open a pull request.

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
image usability, and whether rights metadata appears plausible. They apply
the same canonical checklist to every submission — the OH Play acceptance
standard — not an unwritten feeling:

**Required** — a submission normally fails if any of these fail:

- no advertising or disguised marketing;
- no engagement manipulation or addictive loop design;
- appropriate and safe for the stated audience;
- no unnecessary accounts, tracking, or personal-data collection;
- rights-cleared or owned contribution;
- important factual claims can be verified where relevant;
- rules are understandable and the activity is genuinely playable;
- no malware, executable payload, external runtime code, or unsafe assets;
- no hateful, sexual, exploitative, or otherwise inappropriate material for
  the stated audience.

**OH fit** — should meaningfully satisfy at least one, preferably several:

- strengthens human-to-human connection;
- builds real-world skills, knowledge, or curiosity;
- encourages creativity;
- encourages observation or exploration;
- encourages movement or an offline continuation;
- provides a calm, finite, non-manipulative digital experience;
- contributes something genuinely useful or original to the collection.

The human test we apply: *if the attention-grabbing mechanics disappeared,
would there still be something worth playing?*

When a submission does not go forward, reviewers name the specific reason —
for example `technical-invalid`, `incomplete`, `rights-or-provenance`,
`factual-sourcing`, `child-safety`, `advertising-or-promotion`,
`privacy-or-tracking`, `manipulative-engagement`, `editorial-quality`,
`unclear-rules`, `outside-current-pack-format`, `weak-oh-fit`, or
`duplicate-or-too-similar` — rather than a vague "it doesn't feel OnlyHuman
enough." A rejected submission is not necessarily rejected forever; a
revised version addressing the named reason is welcome.

## Mistakes happen

We check rules, facts, sources, and community contributions more than once —
human review plus automated and agent-assisted checks. That reduces errors;
it does not guarantee perfection. If you find something inaccurate, outdated,
or off, tell us the same way you'd send an idea (see below) — we will fix it.

## About the technical validator

The validator checks structure, local assets, provenance completeness, and
licensing metadata — it does not verify that a factual claim is *true*, only
that a source is present and traceable. `VALID` is a technical result, never
a publication decision. The public CI
([`.github/workflows/validate-community-packs.yml`](.github/workflows/validate-community-packs.yml))
also never runs a pull request's own copy of the validator against itself: it
checks out the trusted base-branch code to decide whether *your* PR passes,
so a PR cannot make itself pass by editing the validator — and a PR that
touches anything outside its own `packs/game-cards/<pack-id>/` fails that
check by design, not by accident.

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

You do not need GitHub or programming to have an idea for OH Play. Use the
idea/contact option already on the OH Play website (**Contribute → I only
have an idea**) rather than trying to turn an unfinished idea into an
incomplete technical pack submission here. A human reads every idea and
lets you know whether it fits OH Play and what a good next step looks like.

The standardized, automatically validated pack format described in this
document currently covers Game Cards worlds only. OH Play is open to other
kinds of game ideas too — they just don't have a technical submission format
here yet, so the idea route above is the right way to send them.
