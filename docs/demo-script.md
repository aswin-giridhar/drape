# Drape — demo video script

**Target: 2:30. Measured narration rate 2.65 words/sec → budget ≤ 400 words.**
This script is **359 words ≈ 2:15 spoken**, over **2:32 of footage** — the
17-second margin is deliberate breathing room between beats. Don't spend it all.

Rules requirements this script satisfies: 1–3 minutes, explains which YouCam APIs
were used, shows the project working on the device it was built for.

---

### Beat 1 — the problem · 0:00–0:16 · 42 words
**On screen:** the hero, colour deck fanned open.

> Colour analysis is a real service. A stylist holds fabric against your face and
> watches what it does to you. It works — and it costs a hundred to three hundred
> pounds, and takes an afternoon. This is that, measured.

---

### Beat 2 — the sitting · 0:16–0:52 · 95 words
**On screen:** click Sitting no. 1 → colour card fills in. Linger on the readout.

> I open a sitting. Two YouCam APIs run on one photograph. The Facial Colour
> Tones Analyzer returns her skin, eye and lip colour as measured hex values.
> AI Skin Analysis returns fourteen skin concerns.
>
> Everything in monospace here was read by an instrument. Skin, brown at
> AE8A6F. Depth, twenty-seven degrees on the ITA scale — the standard
> dermatological measure. Undertone, warm. Contrast, medium.
>
> From those numbers, not from a guess, she's a True Spring. And the palette
> hangs beside her face, the way a stylist would hold it.

---

### Beat 3 — the draping scrub · 0:52–1:45 · 132 words
**On screen:** the pinned stage. Keep scrolling steadily — the garment changes
on her body: charcoal → petrol → moss → ivory → marigold.

> Here's the part that matters. One garment. Fourteen colours. Nothing changes
> but the colour — so the ranking is entirely about her.
>
> And I'm not clicking through a grid. I'm scrolling, and the garment is
> changing on her body. Every one of these is a real YouCam try-on render,
> generated ahead of time. This is what a stylist does — holds swatch after
> swatch against you and watches what each one does.
>
> Charcoal, nought point five. Moss, two point seven. Ivory, four point seven.
> And her best — marigold, eight point three.
>
> That ordering isn't a vibe. Each colour is scored against her palette with
> Delta E 2000, the perceptual colour-difference standard, weighted by how well
> its temperature matches her measured undertone. That engine is our own code
> and costs zero API units.

---

### Beat 4 — the honest bit · 1:45–2:00 · 42 words
**On screen:** let marigold hold on screen.

> One thing we deliberately don't claim. We tested whether the garment changes
> her measured skin scores. It moves them by nought point two. So we don't
> pretend otherwise — we show the reasoning and the picture.

---

### Beat 5 — a second sitter · 2:00–2:20 · 53 words
**On screen:** back, open Sitting no. 2, scroll her scrub to the end.

> Different person, same rail. She measures Dark Autumn — depth minus
> forty-seven, low contrast. Now rust ranks top and marigold falls away. Same
> fourteen garments, completely different answer, because the answer was never
> about the garments.

---

### Beat 6 — close · 2:19–2:30 · 32 words
**On screen:** scroll to the gallery, then the wordmark.

> Facial Colour Tones Analyzer, AI Skin Analysis, AI Clothes Virtual Try-On —
> one measurement, one decision. Drape. It's live, and you can sit for it
> yourself.

---

## Recording notes

- The try-on takes 13–17 seconds. **Cut around it** — don't film dead air.
- Say numbers as words ("eight point three"), it reads better than "8.7".
- The app is at https://drape-five-delta.vercel.app — use Sitting no. 1 and 2 so
  nothing depends on a live scan succeeding on camera.
- If narrating live, watch the pace: 2.65 words/sec is conversational, not rushed.
