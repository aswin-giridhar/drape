# Drape — design spec

**Date:** 2026-08-16 (revised after reading official docs + validation round 2)
**Hackathon:** YouCam API Skin AI & Apparel VTO (deadline 2026-08-17 15:45 UTC)
**Track:** Skin AI + Apparel VTO (combined)

---

## 1. The problem

People cannot tell which colours suit them. The professional answer is **colour
draping**: a stylist holds fabric swatches against your face and judges which
ones make you look healthy and which make you look tired. It works, and it sells
for $100–300 a session.

It does not scale. It needs a trained human, good daylight, and physical fabric.
Online shoppers get none of that, so they guess, and colour is a leading reason
clothes come back.

**Drape replaces the swatch book with measurement.**

### The one-sentence link between the two APIs

> Your **measured skin, eye and lip colour and your measured redness** decide
> which garment colours we surface, and Apparel VTO shows the result on your own
> body before you buy.

Skin AI is not a bolt-on. Its output is the input to the apparel recommendation.

---

## 2. Measured and documented constraints

Measured against the live API on 2026-08-16 and cross-checked against
`docs.perfectcorp.com`. Do not re-derive these from guesses.

### Costs and latency (measured)

| API | Task | Cost | Latency |
| --- | --- | --- | --- |
| Skin Analysis | `task/skin-analysis` (14 SD concerns) | **16 units** | 10–12 s |
| Skin Analysis | 1–3 concerns | 9 units | ~4 s |
| Facial Colour Tones | `task/skin-tone-analysis` | **20 units** | ~9 s |
| Apparel VTO | `task/cloth` (v2) | **2 units** | 13–17 s |
| Apparel VTO | `task/cloth-v4` | 2 units | ~24 s |

Full profile = 16 + 20 = **36 units**. Each try-on = 2 units.
**903 units remaining**; must also cover judging 2026-08-18 → 08-31.

### Correctness rules (these change the code)

1. **Use `raw_score`, never `ui_score`.** The docs state plainly that `ui_score`
   is adjusted upward "to produce more favorable results… acknowledging that
   consumers generally prefer positive evaluations". A product claiming objective
   measurement must not display a number engineered to flatter.
2. **Face width must exceed 60% of image width** (documented; verified: 38% and
   53% fail, 67% passes). Not pixel count — upscaling a small face does not help.
   Recommended capture band is 60–80%.
3. **Polling is mandatory.** If a task is not polled within its retention window
   it expires and **units are still charged**. Never fire-and-forget.
4. **Failed tasks cost 0 units** (documented and measured repeatedly).
5. **`src_file_url` is validated asynchronously** — a bad URL still returns HTTP
   200 and starts a task. Never treat the POST status as validation.
6. **Use `task/cloth` (v2), not `cloth-v4`, for colour work.** Measured hue
   fidelity against a known reference garment:

   | Version | ΔE | Hue shift |
   | --- | --- | --- |
   | v2 | 9.9–17.3 | **−4 to −5°** |
   | v4 | 23.7 | −11.8° |

   Hue is the axis that decides warm vs cool, and v2 preserves it roughly twice
   as well. v4 remains the option if outerwear support is needed.
7. **VTO face preservation is mode-dependent:**

   | Mode | ΔL\* on face vs original |
   | --- | --- |
   | `upper_body` + own garment image | **−0.7** (face effectively untouched) |
   | `full_body` + catalogue template | **+6.8** (face visibly regenerated) |

   Therefore: profile the user **only from their original photo**, and prefer
   `upper_body` + `ref_file_id` whenever the face is in frame.
8. **`hair_color` from skin-tone-analysis is unreliable.** Measured: returned
   `#FAF0BE "Blonde"` for a subject with abundant, clearly visible dark brown
   hair. `skin_color`, `eye_color` and `lip_color` matched independent
   measurement and are trusted. Hair colour must be independently computed and
   shown to the user for confirmation.

### Input specs

| | Skin Analysis (SD) | Apparel VTO |
| --- | --- | --- |
| Min | short side ≥ 480 px | long side ≥ 128 px |
| Max | long side auto-resized to 2560 | long side ≤ 4096 |
| File | < 10 MB, jpg/jpeg/png | < 10 MB, jpg/png |
| Pose | front-facing, neutral, eyes open, mouth closed | standing, facing forward |

For `lower_body`, the reference must be a **worn** outfit, not a flat product
shot. Shoulders must be visible for `upper_body`.

### The claim we deliberately do NOT make

We tested whether garment colour measurably improves skin scores, using the same
shirt in warm orange vs cool teal, with a repeat run for noise:

| Comparison | Total movement across 14 concerns |
| --- | --- |
| Same garment twice (noise) | 0 — the pipeline is deterministic |
| Warm vs cool garment | 4.0; overall score +0.2 |

The effect is negligible. The larger movement seen against the original photo is
**generative face smoothing, not colour physics** — proven because warm and cool
barely differ from each other while both differ from the original.

**Drape must never claim a try-on improves measured skin.** We show the
reasoning and the picture; we do not fabricate a proof metric.

---

## 3. Architecture

One engine, three surfaces. The engine is our own code and costs zero units,
which is what makes three surfaces affordable.

```
  photo ──► smart-crop (face >60% width) ──┬─► Skin Analysis      [16u]
                                           └─► Skin Tone Analysis [20u]
                                                    │
                                     raw_score concerns + skin/eye/lip hex
                                                    │
                                                    ▼
                              COLOUR PROFILE  (our code, 0 units)
                              · ITA°          → depth
                              · b*/a*         → undertone
                              · skin/eye/hair → contrast
                              · raw redness   → hues to avoid
                                                    │
                                                    ▼
                                    season + palette (hex swatches)
                                                    │
                          score(garment colour, profile) → 0-10 + reasons
                                                    │
             ┌──────────────────────┼──────────────────────┐
             ▼                      ▼                      ▼
           JUDGE                DISCOVER                CLOSET
       any garment →        catalogue ranked        your own clothes →
       score + try-on       by palette              keep / restyle / donate
```

### Why this is not a wrapper

The API measures skin and renders try-ons. It does not say which colours suit
someone. That mapping — ITA° → depth, b\*/a\* → undertone, measured redness →
hues to avoid, then ΔE2000 from a garment's dominant colour to the palette — is
ours, and it is the part that creates the recommendation.

We also **cross-validate the API against itself**: our independently computed
skin L\*a\*b\* is checked against the API's `skin_color`, and our computed hair
colour against `hair_color`. Disagreements are surfaced to the user for
confirmation rather than silently trusted — which is how a real colour analyst
works, and how we caught the blonde/brunette error.

### Colour science used

- **ITA°** = `atan2(L* − 50, b*) × 180/π`, the standard dermatological measure of
  skin tone depth. Verified on real API output (L\*56.6 a\*13.5 b\*13.5 → 26.2°,
  "tan"), and consistent with the API's own `skin_color` of `#ae8a6f`.
- **Undertone** from the `b*/a*` ratio of trimmed skin pixels (20th–90th
  percentile, to drop shadows and highlights).
- **Skin pixels** isolated with a YCbCr mask before conversion to CIE L\*a\*b\*.
- **Garment colour** by k-means, ignoring background.
- **Match score** from ΔE2000 to the nearest palette anchor, penalised when the
  hue sits near the user's high-redness range.

---

## 4. Components

| Unit | Responsibility | Depends on |
| --- | --- | --- |
| `lib/youcam.ts` | Auth (RSA id_token), re-auth on 401, upload, task start, **mandatory polling**, unzip | env secrets |
| `lib/facecrop.ts` | Detect face, crop so face > 60% of width, reject with guidance if impossible | — |
| `lib/colour.ts` | sRGB→Lab, skin mask, ITA°, undertone, contrast, hair colour | — |
| `lib/palette.ts` | Profile → season → palette; `scoreGarment()` + reasons | `colour.ts` |
| `lib/budget.ts` | Unit ledger, reserve floor, degraded mode | `youcam.ts` |
| `lib/cache.ts` | Hash-keyed cache of scans and try-ons (safe: VTO is deterministic) | — |
| `app/api/*` | Server-only routes; secrets never reach the browser | above |

Each is independently testable against the captured fixtures, so the UI can be
built without spending units.

---

## 5. Error handling

- Absent and broken must never produce the same value. Quota exhaustion or a
  network failure raises a typed error and renders a visible message — never an
  empty palette.
- Translate error codes into actionable guidance; never surface them raw:
  `error_src_face_too_small` → "move closer — your face should fill about
  two-thirds of the frame"; `error_face_not_forward_facing`,
  `error_face_angle_*` → the specific correction the docs name; `error_pose` →
  "stand facing the camera"; `error_invalid_ref` → "use a photo of the garment
  being worn".
- Validate response **content**, not just HTTP status.
- **Budget guard:** below a reserve floor of **150 units**, live generation
  pauses and the app serves pre-generated examples behind an explicit banner. It
  must still show its best cached answer, never a blank.

---

## 6. Scope and sequencing

Code freeze at **T−6h (2026-08-17 09:45 UTC)** for video, screenshots, README and
the submission form.

1. **Must ship:** scan → colour profile → palette report → Judge (score + try-on)
2. **Should ship:** Discover (catalogue ranked by palette)
3. **If time:** Closet

Deploy a hello-world to Vercel in the first hour — `/mnt/*` under WSL is slow and
"deploying is just config" is a hypothesis until a request lands.

---

## 7. Unit budget

- Full profile 36 units; each try-on 2 units.
- Pre-generate and ship cached results for the three stock models, so judges see
  a complete experience instantly at zero cost, with live mode available for
  their own photo.
- Cache scans by photo hash and try-ons by (person, garment). Because VTO is
  deterministic this is invisible to a judge.

---

## 8. Testing

- Unit-test `colour.ts` and `palette.ts` against captured fixtures — no API
  calls, no units.
- A known-warm and known-cool swatch must score differently; a gate that cannot
  separate is not a gate.
- Verify the deployed URL from outside the dev machine before submitting.
- Run the documented setup commands verbatim in a clean shell.

---

## 9. Demo assets

Stock models inside the app (Pexels licence permits commercial use); the entrant
appears on camera narrating. Stock people are shown as product demonstrations,
not as subjects being judged — `skin_age` is not displayed for stock models.

Fixtures already captured: `person_b` full-body + compliant face crop, full
14-concern scan with masks, tone analysis, VTO outputs in warm/cool on v2 and v4,
and a recoloured garment pair for regression testing.
