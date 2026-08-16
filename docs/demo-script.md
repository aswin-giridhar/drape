# Drape — demo video script

**Target: 2:30. Measured narration rate 2.65 words/sec → budget ≤ 400 words.**
This script is **396 words**. Do not add to it without cutting elsewhere.

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

### Beat 3 — the rail · 0:52–1:34 · 108 words
**On screen:** scroll to the house rail. Hover a couple of tombstone labels.

> Here's the part that matters. One garment. Fourteen colours. Nothing changes
> but the colour — so the ranking is entirely about her.
>
> Marigold, eight point three. Camel, six point two. Down at the bottom,
> charcoal and slate and fuchsia.
>
> That ordering isn't a vibe. Every garment's colour is extracted in the browser
> and scored against her palette using Delta E 2000, the perceptual colour
> difference standard, weighted by how well its temperature matches her
> undertone. That scoring engine is our own code, and it costs zero API units —
> which is why we can rank a whole rail for free.

---

### Beat 4 — hang it · 1:34–1:59 · 66 words
**On screen:** click "Hang it on me" on Marigold. Cut the wait. Reveal the render.

> Then we prove it. YouCam's AI Clothes Virtual Try-On puts the top-ranked
> colour on her actual body, in about fifteen seconds, for two units.
>
> One thing we deliberately don't claim: we tested whether the garment changes
> her measured skin scores. It moves them by nought point two. So we don't
> pretend otherwise — we show the reasoning and the picture.

---

### Beat 5 — a second sitter · 1:59–2:19 · 53 words
**On screen:** back, open Sitting no. 2, jump to the rail.

> Different person, same rail. She measures Dark Autumn — depth minus
> forty-seven, low contrast. Now rust and moss rank top, and marigold falls
> away. Same fourteen garments, completely different answer, because the answer
> was never about the garments.

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
