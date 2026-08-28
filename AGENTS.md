# OH Play Packs — agent contract

Read this file first. Then read, in order:

1. [`CONTRIBUTING.md`](CONTRIBUTING.md)
2. [`schema/oh-play-pack.schema.json`](schema/oh-play-pack.schema.json)
3. [`examples/template/`](examples/template/)
4. [`examples/wild-animals-reference/`](examples/wild-animals-reference/)

This repository is self-contained. Do not look for or require the private OH
Play application, React knowledge, Vite knowledge, routing knowledge, or
private source files.

## Normal-task boundary

For a normal request to create or change a pack, work **only** inside:

```text
packs/game-cards/<new-pack-id>/**
```

Do not modify the schema, validators, examples, CI, contributor docs, package
configuration, or another submitted pack unless the human explicitly asks to
work on this starter infrastructure itself.

Packs are data, not code. Do not add dependencies, application code,
executable scripts, symlinks, remote runtime resources, or code of any kind to
a pack directory. Keep runtime assets local and use the allowed raster formats
described in `CONTRIBUTING.md`.

## Factual and rights integrity

Never invent a source, author, creator, licence, attribution, access date, or
provenance record. Never infer image rights because an image is online or easy
to download. Do not fabricate plausible-looking factual values or claim that a
source supports a field when it does not.

The repository's MIT licence applies to its starter tooling and documentation;
it does **not** permit copying arbitrary images, text, datasets, or other
third-party assets. Follow each pack's and asset's own licensing metadata.
For original pack content, the preferred contribution licence is
`CC-BY-NC-SA-4.0`; this keeps authorship with the creator and does not grant
commercial rights to other parties. Never infer permission from the repository
licence. Unresolved rights must be reported to the human.
Report unresolved rights to the human rather than treating the repository
licence as permission.

Separate known facts from unresolved information. Use traceable factual
sources, preserve the required source field paths and access dates, and report
unresolved factual or licensing issues to the human instead of filling them
in. A passing validator is **not** permission to claim a pack is legally safe,
copyright cleared, factually verified, or OH Play approved.

## Working loop

1. Understand the human's pack idea and intended audience.
2. Inspect the template and complete reference.
3. Propose a useful card and stat structure in plain language.
4. Confirm that structure with available factual evidence.
5. Create `packs/game-cards/<new-pack-id>/`.
6. Add EN/HU content, local assets, attribution/licensing metadata, and
   field-level provenance.
7. Run `npm run validate -- packs/game-cards/<new-pack-id>`.
8. Fix every technical validation error and repeat.
9. Stop when it says `VALID`, or when genuinely blocked by missing evidence or
   rights information.

Do not turn a missing fact or licence into an invented answer merely to make
the validator pass.

## Final report

End every normal pack task with a short human-readable report containing:

- pack ID and title;
- cards created and stats used;
- sources used;
- runtime assets and licence/attribution status;
- validator result; and
- unresolved items that need human review.

Human review remains mandatory after technical validation.
