# OH Play Game Cards pack template

This folder is a documentation fixture, not a production pack and not a
submission-ready content set. Copy it outside the application catalogue, then
replace every illustrative value, the placeholder source, and the template
asset before proposing a real pack.

`pack.json` follows the checked-in canonical schema at
[`src/communityPacks/oh-play-pack.schema.json`](../../src/communityPacks/oh-play-pack.schema.json).
The adjacent SVG exists only to demonstrate the required relative local asset
path. A real pack keeps every asset under its own `assets/` directory; image
URLs belong in provenance, never in the runtime `image.path` field.

The single card and `battle` capability deliberately demonstrate shape only.
They are not sufficient for a useful, reviewed deck, so C2 correctly reports
that Battle needs an even, non-zero card count. Use the separate valid
`community-pack-reference-wild-animals` fixture to exercise the CLI.
