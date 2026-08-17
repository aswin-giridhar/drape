# Submission checklist

Deadline: **2026-08-17 15:45 UTC**.

Everything in section 1 is done. Sections 2 and 3 need a human.

---

## 1. Already done and verified live

- [x] **Public repo with a licence** — https://github.com/aswin-giridhar/drape, MIT
- [x] **Working app judges can test without restriction** — https://drape-five-delta.vercel.app
      No sign-in. Three completed sittings cost zero units, so the whole product
      is explorable even if the budget runs out.
- [x] **Live budget headroom** — checked at 14:34 UTC: 492 units, 171 try-ons
      available, live generation ON. The reserve floor guarantees a judge
      arriving late still gets a live run.
- [x] **Text description** — `docs/devpost-submission.md`, paste-ready
- [x] **Screenshots** — `shots/*.png`, recaptured against the live site
- [x] **All routes verified on production**, not just locally

---

## 2. You must do these — in this order

### a. Record the video

Script: **`docs/demo-script.md`**. 436 spoken words, **2:44 at the measured
narration rate of 2.65 words/sec**, over 2:52 of footage. The hard limit is
**3:00** — do not overrun it.

Notes that matter:
- Use **Sitting no. 1 and Sitting no. 2**, so nothing depends on a live scan
  succeeding on camera.
- Say numbers as words: "eight point three", not "8.3".
- A try-on takes 13-17 seconds. **Cut around it** rather than filming dead air.
- Every figure in the script was checked against the live presets. Do not
  improvise new numbers on camera.

### b. Upload to YouTube — **PUBLIC**

Not unlisted. Not private. The rules require it to be publicly visible, and a
private link is the single easiest way to fail on a technicality.

Paste the URL into the Devpost form and then **open it in a logged-out browser
window** to confirm it really is public.

### c. Submit on Devpost

Copy from `docs/devpost-submission.md`. It already contains the project name,
tagline, full description, "built with" tags, and the two URLs.

Track: **Skin AI + Apparel VTO**.

---

## 3. If you have spare minutes at the end

- Re-open https://drape-five-delta.vercel.app in a private window and click
  through one sitting end to end. That is the exact path a judge takes.
- Check the YouTube link from a logged-out window (see above).
- Confirm the Devpost entry actually shows as **submitted**, not draft.

---

## What to say if a judge asks "what is novel here?"

Five YouCam endpoints feed one measured colour profile, and the product then
publishes what it could **not** establish:

1. Garment colour moves measured skin scores by 0.2 points — noise. We cut our
   own headline feature over it.
2. `face-attr-analysis` returns the same colour engine as the tone analyser —
   7 of 9 readings byte-identical across three sitters.
3. The Fitzpatrick analyzer returns exactly what our own ITA angle predicts,
   at both ends of the range.
4. Contrast still does not separate two sitters who share a season, and the fix
   we attempted did not validate, so it is documented rather than shipped.

Three separate attempts to find a second independent instrument on this
platform, all resolving to one engine. That is a real, reusable result about
the API, arrived at by measurement rather than assertion.
