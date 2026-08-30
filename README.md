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

You do not need to be a developer to contribute to OH Play. There are three
paths, and which one fits you depends on how far you want to take your idea
yourself.

### A. I only have an idea

No GitHub, no coding, nothing technical required. Use the idea/contact option
on the OH Play website itself (**Contribute → I only have an idea**) to send
your idea directly. A human reads it and lets you know whether it fits OH
Play and what a good next step looks like.

Please don't try to turn an unfinished idea into a technical pack submission
here — that just makes both harder to review.

### B. I want to build it with a coding agent

A coding agent (tools like Codex, Claude Code, or Cursor) is an AI assistant
that can read instructions and write the pack's files for you — you don't
need to know how to code yourself, and it doesn't need any OH Play codebase
knowledge: this repository is its entire technical contract.

Have the agent read [`AGENTS.md`](AGENTS.md) first, then give it the starter
prompt below (English or Hungarian). You stay responsible for the factual
accuracy and licensing decisions the agent proposes — a passing validator is
not the same as those being correct. **A validator pass also does not mean
automatic acceptance**: OH Play still reviews every pack by hand before it
can join the app.

### C. I already know Git and GitHub

Read [`CONTRIBUTING.md`](CONTRIBUTING.md), create your pack under
`packs/game-cards/<pack-id>/`, validate it locally, and open a pull request.

**Technical validation is not OH Play approval.** Every pack receives human
technical, editorial, factual, and rights review before it can be accepted.

If Git/GitHub terms are unfamiliar: a **repo** is this project's public
folder; a **fork** is your own copy of it; a **branch** is your own working
version; a **pull request (PR)** is you asking OH Play to review what you
built; the **validator** is the automatic technical checker described below;
**CI** is the automatic check GitHub runs on your PR the moment you open it.

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

**Magyarul induló prompt** (ugyanaz a coding agentednek, magyarul):

```text
Egy OH Play Játékkártya packot szeretnék készíteni.

Először olvasd el a repository AGENTS.md fájlját, és kövesd azt technikai szerződésként.

Az ötletem:

  <ÍRD IDE AZ ÖTLETEDET>

Segíts az ötletet valódi, érvényes OH Play packká alakítani.

Lehet, hogy nem vagyok programozó, ezért a fontos döntéseket egyszerűen
magyarázd el, és a technikai pack-szerkezetet intézd helyettem.

Követelmények:

- csak egy új packs/game-cards/<pack-azonosító>/ könyvtáron belül dolgozz
- használd a megadott sablont és referenciapacket
- legyen benne angol és magyar szöveg is
- használj tényszerű, visszakereshető forrásokat
- soha ne találj ki forrást, licencet, alkotót, attribúciót vagy eredetiséget
- csak olyan asseteket használj, amelyeket jogunk van beküldeni
- a futáshoz használt assetek maradjanak helyiek
- ne módosítsd a starter infrastruktúrát vagy az OH Play alapkódját
- futtasd a repository validatorát
- javíts ki minden technikai validációs hibát

Ha a validálás sikeres, adj egy rövid összefoglalót, amely tartalmazza:
1. mit hoztál létre
2. a forrásokat
3. az asset/licenc állapotát
4. mi az, amit még emberi átnézésnek kell megvizsgálnia

A VALID nem jelent elfogadást vagy publikálást.
Az OH Play minden esetben emberi átnézést is végez a bekerülés előtt.
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

## What this repository supports today

The automatically checked, standardized pack format is available for
**Game Cards worlds only** (V1) — the structure described in this README and
validated by the scripts below. We're genuinely open to other kinds of game
ideas too; those just don't yet have a standardized technical format here, so
send them through the idea route above (path A) instead, and a human will
work out the right next step with you.

## Magyarul, röviden

Nem kell fejlesztőnek lenned ahhoz, hogy hozzájárulj az OH Playhez. Három út
létezik, attól függően, mennyire szeretnéd magad megvalósítani az ötletedet.

**A. Csak egy ötletem van.** Nem kell GitHub és programozás sem. Küldd el az
ötletedet az OH Play weboldalán elérhető lehetőségen keresztül (**Alkoss
velünk → Csak egy ötletem van**). Ember nézi át, és megmondja, illik-e az OH
Playhez, illetve mi legyen a következő lépés.

**B. AI-jal/coding agenttel megépíteném.** A coding agent (például Codex,
Claude Code, Cursor) egy AI asszisztens, amely el tudja olvasni az
utasításaidat, és helyetted megírja a pack fájljait — neked magadnak nem kell
kódolnod. Először olvastasd el vele az [`AGENTS.md`](AGENTS.md) fájlt, majd
add oda neki a fenti magyar indító promptot. A tényszerűségért és a
licencdöntésekért továbbra is te felelsz. A `VALID` eredmény sem jelent
automatikus elfogadást — az OH Play minden packot emberileg is átnéz.

**C. GitHubon küldeném be.** Olvasd el a [`CONTRIBUTING.md`](CONTRIBUTING.md)
fájlt, hozd létre a packedet a `packs/game-cards/<pack-id>/` alatt, validáld
helyben, majd nyiss pull requestet. Ha a Git/GitHub szavak ismeretlenek: a
**repo** ennek a projektnek a nyilvános mappája; a **fork** a te saját
másolatod róla; a **branch** a saját dolgozó változatod; a **pull request
(PR)** az, amikor megkéred az OH Playt, hogy nézze át, amit készítettél; a
**validator** az automatikus technikai ellenőrző; a **CI** az automatikus
ellenőrzés, amit a GitHub a PR megnyitásakor azonnal lefuttat.

Az automatikusan ellenőrizhető pack-formátum egyelőre a Game Cards
kártyacsomagokhoz érhető el. Más játékötleteket is örömmel várunk — ehhez az
A utat használd, és együtt kitaláljuk a következő lépést.

## Commands

This kit has no runtime dependencies. With Node.js 20 or newer:

```bash
npm run validate -- packs/game-cards/my-pack
npm run validate:all
npm test
```

`validate:all` checks every actual submitted pack; examples are not part of the
submission catalogue. `npm test` is a small offline starter-kit smoke test.
