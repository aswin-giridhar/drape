# Devpost submission copy

Paste-ready text for the submission form. Track: **Skin AI + Apparel VTO**.

---

## Project name

**Drape**

## Tagline (short description)

Digital colour draping — measure your skin, eyes and lips, get the colours that
actually suit you, and see them on your own body before you buy.

---

## About the project

### Inspiration

Colour analysis is a real, thriving service. A stylist holds fabric swatches
against your face and watches what each one does to you — some make you look
healthy, some make you look tired. It works, and people pay £100–300 and give up
an afternoon for it. Demand is booming across Korea, China and India.

It does not scale. It needs a trained human, good daylight, and physical fabric.
Online shoppers get none of that, so they guess — and colour is a leading reason
clothes get returned.

Drape replaces the swatch book with measurement.

### What it does

**1. It measures.** Two YouCam APIs run on one photograph. The Facial Colour
Tones Analyzer returns skin, eye, lip and eyebrow colour as hex values. AI Skin
Analysis returns fourteen skin concerns, including redness.

**2. It reasons.** Our own colour engine turns those measurements into a personal
palette: ITA° for depth (the standard dermatological measure of skin tone), the
ratio of b\* to a\* for undertone, hair-to-skin lightness spread for contrast. A
twelve-season classification places the person in a three-axis space and names
their season plus a runner-up, with a confidence figure when they sit near a
boundary.

**3. It judges.** Any garment — a product photo, a screenshot, something already
in your basket — is reduced to its dominant colour and scored against that palette
using ΔE2000, weighted by how well its temperature matches your undertone, with a
penalty when a hue sits beside measured facial redness. Every score comes with
reasons, not just a number.

**4. It proves it.** YouCam's AI Clothes Virtual Try-On hangs the garment on your
own body in about fifteen seconds.

**The house rail** is the clearest demonstration: one garment, fourteen colours
spanning warm to cool and light to deep. Nothing changes but the colour, so the
ranking is entirely about the person. Our first sitter measures True Spring and
gets Marigold 8.3 and Camel 6.2 at the top. Our second measures Dark Autumn — and
the same fourteen garments reorder completely, with Rust on top. Same rail,
different person, different answer.

And you don't click through it, you **scroll** it. The sitter stays pinned while
scrolling cycles the garment on her body from her worst colour up to her best.
Every frame is a real try-on render generated ahead of time, so the interaction
costs nothing at view time and cannot fail while a judge is looking at it. That
is deliberate: draping is holding swatch after swatch against someone and
watching what each does. Scrolling is the same gesture.

### How we built it

Next.js on Vercel. The YouCam S2S client handles the V1 RSA `id_token` auth flow,
presigned uploads, and mandatory task polling — an unpolled task expires and the
units are charged anyway. Credentials never leave the server.

The colour engine is pure maths in TypeScript and costs zero API units, which is
what makes it affordable to rank a whole catalogue and a whole rail for free;
units are spent only on the try-on you actually ask for. Garment colour extraction
runs in the browser on `<canvas>`, so there is no server-side image dependency.

### Challenges we ran into

We measured everything against the live API rather than assuming, and several
findings changed the build:

- **`ui_score` is not a measurement.** Perfect Corp's own docs say it is adjusted
  upward "to produce more favorable results". A product claiming to measure cannot
  display a number engineered to flatter, so Drape shows `raw_score` throughout.
- **Skin Analysis needs the face to fill more than 60% of the image width.** It is
  a fraction, not a pixel count — a sharp 1000px face in a wide frame still fails,
  and upscaling does not rescue it.
- **`task/cloth` beats `cloth-v4` for colour fidelity.** Measured hue shift against
  a known reference garment: −4 to −5° on v2 versus −11.8° on v4. Hue is the axis
  that decides warm versus cool, so we use v2 despite v4 being newer.
- **The tone analyser returned "#FAF0BE (Blonde)" for a subject with abundant dark
  brown hair**, and omits hair colour entirely for some faces. Drape cross-validates
  and asks the user to confirm rather than silently mis-seasoning them.

### Accomplishments we're proud of

The claim we deliberately **don't** make. Our first design was to re-run Skin
Analysis on the try-on image and prove the garment improved your skin. We tested
it properly — same shirt in warm orange and cool teal, with a repeat run to
establish noise — and the effect was 0.2 points on a 0–100 scale. The larger
movement we first saw was generative face smoothing, not colour physics. So we
cut our own headline feature rather than ship a confidently wrong number in a
product whose entire pitch is objectivity.

### What we learned

That the interesting work sits between the two APIs, not inside either one. YouCam
measures skin and renders try-ons superbly; neither tells you which colours suit
someone. Building that bridge — and being honest about where it is confident and
where it is estimating — is the product.

### What's next for Drape

Integrating YouCam's JS Camera Kit for guided capture, so users take a compliant
photograph first time instead of discovering the 60% face-width rule from an error
message. Then the wardrobe audit: photograph what you already own and find out
what to keep, restyle or let go.

---

## Built with

`youcam-api` · `perfect-corp` · `nextjs` · `typescript` · `react` · `vercel` ·
`ciede2000` · `colour-science` · `canvas`

## Try it out

- Live: https://drape-five-delta.vercel.app
- Code: https://github.com/aswin-giridhar/drape

**Testing notes for judges:** no sign-in. Three completed sittings are stored from
real API responses and use no units, so the full colour card, palette and skin
reading render instantly. Try-ons and your own photographs call the live API. If
you upload your own, use a head-and-shoulders shot where your face fills about
two-thirds of the frame, plus a full-length photo for the try-on.
