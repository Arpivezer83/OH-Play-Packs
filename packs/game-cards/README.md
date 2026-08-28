# Submitted OH Play Game Cards packs

This is the only submission catalogue:

```text
packs/game-cards/<pack-id>/
```

Use one immediate directory per pack. Its name must equal the stable `id` in
`pack.json`. Keep all runtime assets inside that pack's `assets/` folder, with
no remote runtime images, executable/source files, symlinks, or SVG.

Examples belong under `examples/`, never here. Validate before opening a pull
request:

```bash
npm run validate -- packs/game-cards/<pack-id>
```

Every pack remains human-reviewed. Read the full
[contribution guide](../../CONTRIBUTING.md).
