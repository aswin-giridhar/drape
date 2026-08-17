# Drape

**Digital colour draping.** Measure someone's skin, eyes and lips, work out which colours
actually suit them, then hang real garments on their body to prove it.

Built for the YouCam API Skin AI & Apparel VTO Hackathon, in the **Skin AI + Apparel VTO**
combined track.

**Live:** https://drape-five-delta.vercel.app — no sign-in, and the three completed
sittings need no API units, so you can explore the whole product immediately.

---

## Screenshots

| | |
| --- | --- |
| ![The hero](shots/01-home.png) | ![Your colour card](shots/02-card.png) |
| **The sitting.** The interface is deliberately achromatic — the only colour on screen is the user's own measured palette. | **Your colour card.** Measured skin, eye and lip hex; ITA depth; undertone; contrast. Monospace means instrument-read. |
| ![The scrub, worst colour](shots/04-scrub-worst.png) | ![The scrub, best colour](shots/05-scrub-best.png) |
| **The draping scrub — scroll begins.** The sitter is pinned at their worst colour: charcoal, 0.5, avoid. | **…and ends on their best.** Scrolling has changed the garment on their body through fourteen real try-on renders to marigold, 8.3. Scrolling *is* draping. |
| ![A second sitter](shots/06-card-sitter2.png) | ![From the collection](shots/03-gallery.png) |
| **A second sitter** measures Dark Autumn — and the same rail reorders completely. | **From the collection.** All twenty YouCam catalogue pieces ranked against the palette. |
| ![Best against worst](shots/10-compare.png) | ![Bring your own piece](shots/07-byop.png) |
| **Best against worst.** Same body, same light, same photograph — fourteen colours apart. Everything deciding which is which was measured from their face. | **Bring your own piece.** Upload any garment; its colour is read in the browser and judged against your measurements, with reasons. |

---

## The problem

People cannot tell which colours suit them. The professional answer is *colour draping*: a
stylist holds fabric swatches against your face and judges which ones make you look healthy and
which make you look tired. It works, and it sells for £100–300 a session — demand is large and
growing across Korea, China and India.

It does not scale. It needs a trained human, good daylight, and physical fabric. Online shoppers
get none of that, so they guess, and colour is a leading reason clothes come back.

## What Drape does

1. **Measures.** YouCam's Facial Colour Tones Analyzer returns skin, eye, lip and eyebrow colour
   as hex values. YouCam's AI Skin Analysis returns fourteen concern scores including redness.
2. **Reasons.** Drape's own colour engine converts those measurements into a personal palette:
   ITA° for depth, the b\*/a\* ratio for undertone, hair-to-skin lightness spread for contrast.
   A twelve-season classification places the person in a three-axis space and names a season plus
   a runner-up.
3. **Judges.** Any garment — a product photo, a screenshot, something in a basket — is reduced to
   its dominant colour and scored against that palette with ΔE2000, plus contrast fit and a
   redness penalty. The score comes with reasons, not just a number.
4. **Proves it.** YouCam's AI Clothes Virtual Try-On hangs the garment on the person's own body.

### The house rail, and the draping scrub

The clearest demonstration is the **house rail**: one garment, fourteen colours spanning warm to
cool and light to deep. Nothing changes but the colour, so the ranking is entirely about the
person. For the sitter in the demo — measured as True Spring — it ranks Marigold 8.3 and Camel 6.2
at the top, and Charcoal, Slate and Petrol at the bottom. That is textbook warm-clear colour
theory, arrived at purely from measurement. A second sitter measures Dark Autumn, and the same
fourteen garments reorder completely — Rust rises to the top and Marigold falls away.

You don't click through that rail. You **scroll** it. The sitter stays pinned while scrolling
cycles the garment on their body from their worst colour up to their best, with the score, verdict and
palette position moving in step. Every frame is a real YouCam try-on render generated ahead of
time and served as a static file, so the whole interaction costs no units at view time and cannot
fail while someone is looking at it.

That is the point of the interaction rather than a flourish on top of it: draping *is* holding
swatch after swatch against someone and watching what each one does. Scrolling is the same
gesture. Anyone who uploads their own photograph gets a clickable rail instead — we render on
demand rather than faking the scrub with a CSS tint.

The scrub is sequential, so it ends with the two extremes **side by side**: their best colour
against their worst, same body and same light, with the measured reasoning under each. That is the
question a shopper actually asks, and it had no answer anywhere else in the product.

### The garment as an object

Every rail frame carries a **Worn / Turn it** toggle. "Turn it" replaces the photograph, in
the same frame, with a 3D reconstruction of the garment built from the flat product shot
(Runware `tripo:v3.1@0`, optimised with gltf-transform from 40MB to 165KB).

One mesh serves all fourteen colours, tinted at runtime from the same hex the swatch uses.
That is a correctness decision before it is a size one: the reconstruction bakes the product
photograph's own shading into its albedo, so a per-colour mesh sat a mean ΔE76 of **12.2**
from the swatch printed beside it — a colour-analysis app disagreeing with itself about a
colour. Driving both from one hex makes them structurally unable to diverge, and measured
the error down to about **3**.

### Metals and lip colours

Every real colour-analysis session ends with two questions: *gold or silver?* and
*what lipstick?* Drape answers both, and **neither needed a new endpoint**.

Metal tone is the most direct inference available from undertone, which we already
measure, so the verdict branches on the undertone the card already prints rather
than on a second threshold over the same ratio. Lipstick is a colour held against
the same face as a garment, so `scoreGarment` ranks twelve shades unchanged.

The shade list deliberately spans cool blue-reds through warm corals to neutral
browns, because a list containing only flattering colours cannot separate. Measured
spread between best and worst shade across the three sitters: **4.9, 6.8 and 2.6
points**, and the orderings hold up - the warm sitters sink blue-red, berry and
plum, while the Dark Autumn sitter takes terracotta, plum and brick.

**The link between the two APIs, in one sentence:** your measured undertone and redness decide
which garment colours we surface, and Apparel VTO shows the result on your own body before you buy.

## Why this isn't a wrapper

The APIs measure skin and render try-ons. Neither tells you which colours suit someone. That
mapping is ours, it runs in `lib/colour.ts` and `lib/palette.ts`, it costs zero API units, and it
is what turns two measurements into a recommendation.

We can now say that as a **verified** claim rather than an assertion. We enumerated the platform's
documented operations looking for a seasonal-palette or personal-colour endpoint: there is none.
The twelve-season classifier in `lib/palette.ts` is ours.

Drape also **cross-validates the API against itself**. Our independently computed skin L\*a\*b\* is
checked against the API's `skin_color`, and the reported hair colour is sanity-checked. That
matters: the tone analyser returns `#FAF0BE "Blonde"` for a subject with abundant dark brown hair.
Rather than silently mis-seasoning someone, Drape substitutes a dark default and labels the
contrast figure **"estimated, not measured"** on the colour card — an estimate and a measurement
must never look alike on a page whose whole claim is that it measured something.

---

## What we measured, rather than assumed

Everything below was measured against the live API and cross-checked against the official docs.
The full record is in [`docs/superpowers/specs/2026-08-16-drape-design.md`](docs/superpowers/specs/2026-08-16-drape-design.md).

| Fact | Value |
| --- | --- |
| AI Skin Analysis, 14 concerns | 16 units, 10–12 s |
| Facial Colour Tones Analyzer | 20 units, ~9 s |
| AI Clothes VTO (`task/cloth`) | 2 units, 13–17 s |
| Failed tasks | 0 units (docs confirm; measured repeatedly) |
| VTO determinism | identical inputs → identical output, so caching is safe |

Three findings that changed the build:

- **`ui_score` is not a measurement.** Perfect Corp's docs state it is adjusted upward "to produce
  more favorable results". Drape displays **`raw_score`** everywhere.
- **Skin Analysis needs the face to fill >60% of the image width.** It is a *fraction*, not a pixel
  count — a sharp 1000px face inside a wide frame still fails. Upscaling does not rescue it.
- **`task/cloth` (v2) beats `cloth-v4` for colour fidelity.** Measured hue shift against a known
  reference garment: −4 to −5° on v2 versus −11.8° on v4. Hue is the axis that decides warm vs
  cool, so Drape uses v2.

### A claim we deliberately do not make

We tested whether garment colour measurably improves skin scores, using the same shirt in warm
orange and cool teal, with a repeat run to establish noise:

| Comparison | Total movement across 14 concerns |
| --- | --- |
| Same garment twice (noise) | 0 |
| Warm vs cool garment | 4.0; overall score +0.2 |

The effect is negligible. The larger movement seen against the original photograph is **generative
face smoothing, not colour physics** — proven because warm and cool barely differ from each other
while both differ from the original. So Drape never claims a try-on improves your measured skin.
It shows the reasoning and the picture.

### A second claim we went looking for, and could not make

The tone analyser gets hair wrong. So we added a fourth endpoint,
`face-attr-analysis`, hoping for an **independent** second reading — two instruments
disagreeing would be real evidence, and would let us replace "estimated" with a measurement.

Measured across three sitters, nine colour readings:

| | `skin-tone-analysis` | `face-attr-analysis` | |
| --- | --- | --- | --- |
| person_b hair | `#FAF0BE` | `#FAF0BE` | identical |
| person_b eye | `#2D242D` | `#2D242D` | identical |
| person_b lip | `#C57678` | `#C57678` | identical |
| person_c hair | *absent* | *absent* | both absent |
| person_a eye | `#332127` | `#392529` | ΔE76 2.73 |
| person_a lip | `#B97C7D` | `#B97D7D` | ΔE76 0.69 |

Seven of nine byte-identical; the other two differ by less than a just-noticeable
difference. **This is one colour engine behind two endpoint names.** It cannot corroborate
the tone analyser, and presenting it as a cross-check would manufacture confidence out of a
value that was never independent — so we don't.

What it *does* give is **face shape**, which nothing else on the platform returns, and that
earns the call on its own. The rail shows one crew-neck t-shirt in fourteen colours, and a
neckline does as much work against a face as a colour does. Each sitter gets a measured
shape — Triangle, Square, Oblong — and one line of neckline guidance, labelled
*conventional guidance, not measurement*, because a lookup table is not an instrument.

Two things worth knowing if you use this endpoint: the response keys are not the request
keys (you ask for `faceShape`, you get `faceshape`, and the colours arrive nested under
`color`), and it needs `face_angle_strictness_level: "flexible"` or it rejects ordinary
portraits with `error_face_angle_upward`.

---

## YouCam APIs used

| API | Endpoint | Role |
| --- | --- | --- |
| Facial Colour Tones Analyzer | `POST /s2s/v2.0/task/skin-tone-analysis` | skin / eye / lip / hair hex — drives the palette |
| AI Skin Analysis | `POST /s2s/v2.0/task/skin-analysis` | 14 raw concern scores; redness feeds garment scoring |
| AI Clothes Virtual Try-On | `POST /s2s/v2.0/task/cloth` | hangs garments on the subject |
| Face Attribute Analysis | `POST /s2s/v2.0/task/face-attr-analysis` | face shape — drives neckline guidance |
| Garment catalogue | `GET /s2s/v2.0/task/template/cloth` | the gallery, ranked by palette |
| File upload | `POST /s2s/v2.0/file/{feature}` | presigned upload for every image |
| Units | `GET /s2s/v1.0/client/credit` | live budget guard |

Authentication is the V1 server-to-server flow: an RSA PKCS#1 v1.5 `id_token` built from the API
key and a timestamp, exchanged at `POST /s2s/v1.0/client/auth` for a bearer token
(`lib/youcam.ts`). Credentials stay server-side and never reach the browser.

---

## Running it

Requires Node 20+.

```bash
git clone https://github.com/aswin-giridhar/drape.git
cd drape
npm install
cp .env.example .env      # then fill in your two YouCam values
npm run dev               # http://localhost:3000
```

These steps were run verbatim from a fresh clone on a clean machine —
`npm install` (95 packages, 30s) and `npm run build` both complete green without
credentials. Credentials are only needed at request time, not at build time.

`.env` needs:

```
YouCam_API_KEY=sk-...
YouCam_SecretKey=MIGf...   # base64 DER RSA public key from the YouCam console
```

> If you save `.env` on Windows, watch for CRLF line endings — a trailing `\r` on the key produces
> an opaque auth failure. `lib/youcam.ts` trims values defensively for exactly this reason.

### Tests

```bash
npx vitest run lib/palette.test.ts      # colour engine — no API calls, no units
npx vitest run lib/youcam.smoke.test.ts # live auth + catalogue — 0 units
npx vitest run scripts/genpreset.test.ts# rebuilds the pre-scanned demo profile
```

The palette test is a real gate, not a formality: it scores **held-out** colours that appear in no
palette, and asserts the flattering set beats the clashing set. It also checks the ranking is
stable when the redness threshold is perturbed, because a threshold that only separates at one
point is a coin toss.

### Testing without spending units

Open **Sitting no. 1** on the live site. It is a completed analysis stored in
`public/presets/person_b.json` from real API responses, so the full colour card, palette and skin
reading render instantly at zero cost. Try-ons and your own photographs use the live API.

---

## Architecture

```
app/
  page.tsx              gallery UI — sitting, colour card, gallery, your own piece
  api/scan              tone + skin analysis -> colour profile
  api/tryon             apparel VTO, with a deterministic-safe cache
  api/catalogue         garment templates (free)
  api/budget            live unit balance for the honest "paused" banner
lib/
  colour.ts             CIEDE2000, ITA, undertone, contrast — pure maths
  palette.ts            12-season classification + garment scoring
  garment.ts            dominant-colour extraction, in the browser via canvas
  youcam.ts             YouCam S2S client
  profile.ts            assembly + cross-validation + warnings
  skinzip.ts            unpacks the Skin Analysis ZIP (raw scores, masks)
  budget.ts             reserve floor and degraded mode
fixtures/               real captured API responses, for free iteration
```

Pixel work happens in the browser; API calls happen on the server. That keeps secrets server-side
and avoids a native image dependency entirely.

### Design

The interface is deliberately achromatic. Colour analysts judge against neutral surfaces because
any surrounding hue biases perception of the colour being judged — so every chromatic pixel in
Drape belongs to the user's measured palette, never to the brand. Results are presented as a
gallery: each garment hangs framed with a tombstone label stating what it is and what we measured.
Measured values are set in monospace, interpretations in serif, so you can see at a glance what was
instrument-read and what was inferred.

---

## Honest limitations

- Seasonal colour analysis is a well-established practice but not a hard science. Drape grounds it
  in measured quantities and shows its working, including a confidence figure and a runner-up
  season when someone sits near a boundary.
- Try-on renders preserve hue to within about 5°, but lightness and chroma shift more. Stated in
  the interface rather than hidden.
- **Contrast is measured and shown, but does not drive the season.** `buildProfile`
  computes hair-to-skin lightness spread (printed as ΔL\*), while `classifySeason`
  weights only temperature, depth and skin chroma. Two of our sitters differ by 20
  points of contrast and both classify as True Spring at high confidence, which is
  the predictable result. We tried to fix it inside the hackathon by deriving a
  contrast coordinate per season from that season's own palette range, then sweeping
  its weight. It did not validate: the derivation was contaminated (we had edited two
  palettes hours earlier for an unrelated reason), and no weight improved all three
  sitters — sitter three only reaches a plausible season at a weight that has already
  knocked sitter two off hers. A constant has to be stable in a neighbourhood, not
  merely different at two points, so we are shipping the honest limitation rather than
  an unvalidated fix.
- Hair colour from the tone API is unreliable and is treated as such.
- Garment colour extraction judges a patterned item on its dominant colour, and says so.

## Licence

MIT — see [LICENSE](LICENSE).
