# Devpost submission copy

Paste-ready text for the submission form. Track: **Skin AI + Apparel VTO**.

---

## Project name

**Drape**

## Tagline (short description)

The colour analysis that shows its working. We measure your skin, eyes and lips,
prove which colours suit you on your own body — and tell you plainly what we
can't know.

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

**1. It measures.** Three YouCam APIs run on one photograph. The Facial Colour
Tones Analyzer returns skin, eye, lip and eyebrow colour as hex values. AI Skin
Analysis returns fourteen skin concerns, including redness. Face Attribute
Analysis returns face shape, which drives neckline guidance — because a neckline
does as much work against a face as a colour does.

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

**4b. It answers the two questions people actually ask.** Gold or silver, and
what lipstick. Both come from measurements we already hold: metal tone follows
directly from undertone, and a lipstick is a colour held against the same face as
a garment, so the garment scorer ranks shades unchanged. No extra endpoint, no
extra units.

**5. It says it out loud.** Every garment is also described in words and read
aloud — colour, how it sits against your skin, and where it falls on your body.
Online clothes shopping is built entirely on pictures, and not everyone gets one.
The visual API produces a non-visual answer.

**6. It hands you the object.** Each rail frame toggles between the garment worn
and a 3D reconstruction of it built from the flat product photograph, which you
can turn.

**The house rail** is the clearest demonstration: one garment, fourteen colours
spanning warm to cool and light to deep. Nothing changes but the colour, so the
ranking is entirely about the person. Our first sitter measures True Spring and
gets Marigold 8.3 and Camel 6.2 at the top. Our second measures Dark Autumn — and
the same fourteen garments reorder completely, with Rust on top. Same rail,
different person, different answer.

And you don't click through it, you **scroll** it. The sitter stays pinned while
scrolling cycles the garment on their body from their worst colour up to their best.
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
  brown hair**, and omits hair colour entirely for some faces. Drape substitutes a
  dark default and labels the contrast figure **"estimated, not measured"** on the
  card, because an estimate and a measurement must never look alike on a page whose
  whole claim is that it measured something.
- **The 3D turntable disagreed with our own swatch.** Image-to-3D bakes the product
  photograph's shading into the mesh albedo, so a per-colour mesh sat a mean ΔE76 of
  **12.2** from the swatch printed beside it — a colour-analysis app contradicting
  itself about a colour. One mesh tinted at runtime from the same hex makes them
  structurally unable to diverge; measured error fell to about **3**, and the payload
  from 1016KB to 165KB.

### Accomplishments we're proud of

The claim we deliberately **don't** make. Our first design was to re-run Skin
Analysis on the try-on image and prove the garment improved your skin. We tested
it properly — same shirt in warm orange and cool teal, with a repeat run to
establish noise — and the effect was 0.2 points on a 0–100 scale. The larger
movement we first saw was generative face smoothing, not colour physics. So we
cut our own headline feature rather than ship a confidently wrong number in a
product whose entire pitch is objectivity.

And we did it again, on the last day. The tone analyser gets hair colour wrong, so
we integrated a fourth endpoint — Face Attribute Analysis — hoping for an
**independent** second reading. Two instruments disagreeing would have been real
evidence, and would have let us replace "estimated" with a measurement. Across
three sitters and nine colour readings, seven came back **byte-identical** and the
other two differed by less than a just-noticeable difference (ΔE76 2.73 and 0.69).
Where one endpoint had no hair reading, neither did the other.

It is one colour engine behind two endpoint names. It cannot corroborate anything,
and presenting it as a cross-check would have manufactured confidence out of a
value that was never independent. So we kept the endpoint for the one thing it
uniquely provides — face shape — and published the negative result instead.

Then we tried a third time, with the Fitzpatrick Skin Type analyzer, on the
theory that a dedicated skin-type instrument might be independent of the tone
analyser. It returns a single Roman numeral, costs 10 units a call, and returned
exactly what our own ITA angle already predicts - III for the sitter at ITA 30.2,
VI for the sitter at ITA -47.5. We picked those two deliberately, at opposite ends
of the range, because a single mid-range match cannot tell "derivable" from
"coincidence". Two exact hits at the extremes can.

So: three endpoints, three attempts to find a second opinion, and the platform
gives you one engine wearing three names. That is worth knowing, and we would
rather publish it than quietly ship a cross-check that cannot cross-check
anything.

We also went looking for a shortcut and confirmed there isn't one: we enumerated
the platform's documented operations for a seasonal-palette or personal-colour
endpoint. There is none. The twelve-season classifier is ours.

### Why this isn't another colour-analysis app

Colour analysis apps shipped in numbers this year - PersonalColorAI, ColorMine,
Dressika, BeautySpark. We looked at them before claiming novelty. They compete on
asserted accuracy: "95%+ precision", "94.4% on benchmarks", "trained on 30,000
draping sessions." None of them show you a single measurement.

Drape inverts that. Every number on screen is one an instrument produced, labelled
with how it was derived - ITA angle for depth, b*/a* ratio for undertone, ΔE2000
distance for the garment. Monospace type means instrument-read; serif means
inferred. You can see which is which at a glance.

And it is the only one we know of that publishes what it could not establish. We
built a feature to prove a garment improves your measured skin, tested it
properly, measured the effect at 0.2 points, and deleted it. That number is in
this submission and in the README.

The category is crowded. Trustworthy measurement in it is not.

### A limitation we are publishing rather than papering over

Contrast is measured and printed on the card, and it does **not** drive the season.
Two of our three sitters differ by 20 points of hair-to-skin lightness contrast and
both classify as True Spring at high confidence, because the classifier weights
temperature, depth and skin chroma only.

We tried to fix it before the deadline by deriving a contrast coordinate per season
from that season's own palette, then sweeping the weight. It failed on both counts:
the derivation was contaminated by an unrelated palette edit made hours earlier, and
no weight improved all three sitters — the third only reaches a plausible season at a
weight that has already pushed the second off hers. A constant has to be stable in a
neighbourhood, not merely different at two points.

So the defect is documented and the fix is not shipped. That is the same decision we
made about the skin-score claim, for the same reason.

### What we learned

That the interesting work sits between the two APIs, not inside either one. YouCam
measures skin and renders try-ons superbly; neither tells you which colours suit
someone. Building that bridge — and being honest about where it is confident and
where it is estimating — is the product.

### What's next for Drape

**Guided capture.** YouCam's JS Camera Kit validates face ratio, lighting and pose
live, so people take a compliant photograph first time instead of meeting the
60%-face-width rule as an error message.

**The complete look.** YouCam's fashion suite covers shoes, hats, bags, jewellery
and fabric. The same measured profile that ranks a top can rank all of them - and
metal tone is a genuine colour-analysis prescription, since warm undertones take
gold and cool take silver, which we already measure. We tested the accessory
endpoints during the hackathon and found `task/scarf` is a generative styling tool
rather than a colour-accurate try-on: given a marigold reference it returned a navy
patterned scarf and an invented street scene. Building on it would have broken the
one guarantee this product makes, so it waits for a colour-faithful path.

**An agentic surface via MCP.** YouCam ships MCP servers for beauty, fashion and
creators. A styling agent that holds your measured profile and answers "does this
work on me?" for anything you point at is the natural next form of this product.

**The wardrobe audit.** Photograph what you already own and find out what to keep,
restyle, or let go.

---

## Built with

`youcam-api` · `perfect-corp` · `nextjs` · `typescript` · `react` · `vercel` ·
`ciede2000` · `colour-science` · `canvas` · `web-speech-api` · `model-viewer` ·
`gltf` · `runware` · `accessibility`

## Try it out

- Live: https://drape-five-delta.vercel.app
- Code: https://github.com/aswin-giridhar/drape

**Testing notes for judges:** no sign-in. Turn **Voice** on in the header to hear
any garment described; press **Turn it** on the rail plate to handle the garment in
3D; click any generated render to enlarge it, with a fit/actual-size toggle. Three completed sittings are stored from
real API responses and use no units, so the full colour card, palette and skin
reading render instantly. Try-ons and your own photographs call the live API. If
you upload your own, use a head-and-shoulders shot where your face fills about
two-thirds of the frame, plus a full-length photo for the try-on.
