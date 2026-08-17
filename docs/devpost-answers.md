# Paste-ready Devpost answers

Copy each block into the matching form field.

---

## Inspiration

The most useful thing we can tell you about Drape is what it refused to claim.

Our original headline feature was going to be: run YouCam's Skin Analysis on the try-on render and prove that the right garment colour measurably improves your skin. We built it, then tested it properly — the same shirt in warm orange and cool teal, with a repeat run of an identical input to establish the noise floor. Noise came back at 0. Warm versus cool moved the overall score by **0.2 points**. The larger movement we had seen earlier was generative face smoothing, not colour physics. So we deleted our own headline feature rather than ship a confidently wrong number inside a product whose entire pitch is objectivity.

That decision set the rule for everything after it, and we ended up applying it four times.

The idea itself is older than any of it. Colour analysis is a real service: a stylist holds fabric swatches against your face and watches what each one does to you — some make you look healthy, some make you look tired. People pay £100–300 and give up an afternoon for it, and demand is large across Korea, China and India. It does not scale: it needs a trained human, good daylight and physical fabric. Online shoppers get none of that, so they guess — and colour is a leading reason clothes get returned. Drape replaces the swatch book with measurement.

---

## What it does

**1. It measures.** Five YouCam endpoints run against one sitting. The Facial Colour Tones Analyzer (`skin-tone-analysis`, 20 units) returns skin, eye, lip and eyebrow colour as hex. AI Skin Analysis (`skin-analysis`, 16 units) returns fourteen concern scores including redness. Face Attribute Analysis (`face-attr-analysis`, 10 units) returns face shape. AI Hair Colour (`hair-color`, 1 unit) shows the contrast axis moving. AI Clothes Virtual Try-On (`task/cloth` v2, 2 units) hangs the garment on the body.

**2. It reasons — and this part is ours.** Our own colour engine turns those measurements into a personal palette: ITA angle for depth, the ratio of b\* to a\* for undertone, hair-to-skin lightness spread for contrast, CIEDE2000 for every colour distance, and a twelve-season classification that names a season plus a runner-up with a confidence figure when someone sits near a boundary. It costs **zero API units**, which is what makes it affordable to rank a whole catalogue and a whole wardrobe for free.

We did not assume this had to be ours. We enumerated the platform's documented operations looking for a seasonal-palette or personal-colour endpoint. There is none.

**3. It judges.** Any garment — a product photo, a screenshot, something already in your basket — is reduced to its dominant colour in the browser and scored against the palette with ΔE2000, weighted by how well its temperature matches your undertone, with a penalty when a hue sits beside measured facial redness. Every score comes with reasons, not just a number.

**4. It proves it, by scrolling.** The draping scrub pins the sitter while scrolling cycles the garment on their body from their worst colour to their best, through **fourteen real try-on renders** generated ahead of time. Draping *is* holding swatch after swatch against someone and watching what each does; scrolling is the same gesture. Because the frames are pre-rendered the interaction costs nothing at view time and cannot fail while a judge is looking at it. It ends on the two extremes side by side.

**5. It answers the questions people actually ask.** Gold or silver. Which lipstick. Which neckline — driven by measured face shape, and labelled as conventional guidance rather than measurement, because a lookup table is not an instrument. None of these needed a new endpoint.

**6. It says it out loud.** Every garment is described in words and read aloud via Web Speech, with live regions and full keyboard operation. Online clothes shopping is built entirely on pictures and not everyone gets one. A visual API producing a non-visual answer.

**7. It hands you the object, and lets you keep the result.** Each rail frame toggles between the garment worn and a 3D turntable of it. There is a downloadable palette card, a footwear rail, a render zoom, and a wardrobe audit that scores 24 items you already own — zero units, nothing uploaded.

---

## How we built it

Next.js and TypeScript on Vercel. Pixel work happens in the browser on `<canvas>`; every API call happens on the server, so credentials never reach the client.

The authentication was the first real piece of engineering. YouCam's S2S flow is a V1 RSA PKCS#1 v1.5 `id_token`, built from the API key and a timestamp and exchanged for a bearer token — and it is **not in the published OpenAPI specs**. We built it from the interface rather than the prose.

The colour engine is pure maths, no model and no units. That is deliberate: it makes ranking free, and it means the reasoning is inspectable rather than asserted.

---

## Challenges we ran into

Four things we measured, could not establish, and published rather than papering over.

**1. Garment colour does not measurably improve your skin scores.** 0.2 points against a noise floor of 0. We cut the feature that depended on it.

**2. `face-attr-analysis` is the same colour engine as `skin-tone-analysis`.** The tone analyser gets hair wrong — it returned `#FAF0BE (Blonde)` for a subject with abundant dark brown hair — so we integrated a fourth endpoint hoping for an *independent* second reading. Two instruments disagreeing would have been real evidence. Across three sitters and nine colour readings, **seven came back byte-identical** and the other two differed by less than a just-noticeable difference (ΔE76 **2.73** and **0.69**). Where one endpoint had no hair reading, neither did the other. It cannot corroborate anything, so we kept it for the one thing it uniquely gives — face shape — and published the negative result.

**3. The Fitzpatrick analyzer returns what our own ITA already predicts.** Third attempt at a second opinion, 10 units a call. It returned III for the sitter at ITA **30.2** and VI for the sitter at ITA **−47.5**. We chose those two deliberately, at opposite ends of the range, because a single mid-range match cannot separate "derivable" from "coincidence" — two exact hits at the extremes can.

**4. Contrast is measured but does not separate two sitters who share a season.** We tried to fix it before the deadline by deriving a contrast coordinate per season from that season's own palette and sweeping the weight. It did not validate: the derivation was circular, and no weight improved all three sitters. A constant has to be stable in a neighbourhood, not merely different at two points. So the defect is documented and the fix is not shipped.

Some things we measured that did work out:

- **`task/cloth` v2 beats `cloth-v4` on colour fidelity.** Hue shift against a known reference: −4 to −5° on v2 versus −11.8° on v4. Hue is the axis that decides warm versus cool.
- **`ui_score` is not a measurement.** Perfect Corp's own docs say it is adjusted upward "to produce more favorable results". Drape shows `raw_score` throughout.
- **Skin Analysis needs the face to fill more than 60% of the image width.** A fraction, not a pixel count — a sharp 1000px face in a wide frame still fails, and upscaling does not rescue it.
- **The 3D turntable disagreed with its own swatch.** Image-to-3D bakes the product photograph's shading into the mesh albedo, so a per-colour mesh sat a mean ΔE76 of **12.2** from the swatch printed beside it. One mesh, tinted at runtime from the same hex the swatch uses, makes them structurally unable to diverge: error fell to about **3**, payload from 40MB to **165KB**.

---

## Accomplishments that we're proud of

Deleting our own best demo twice, and saying so in the submission.

Beyond that: five endpoints integrated including an auth flow that is not in the published specs; a colour engine that costs nothing to run, so ranking a whole wardrobe is free; a scroll interaction that is the domain metaphor rather than a flourish on it; and a visual API made to produce a non-visual answer.

The design carries the same argument. The interface is deliberately achromatic, because colour analysts judge against neutral surfaces — every chromatic pixel on screen belongs to the user's measured palette, never to the brand. Measured values are set in monospace and interpretations in serif, so you can see at a glance what was instrument-read and what was inferred.

---

## What we learned

That the interesting work sits *between* the two APIs, not inside either one. YouCam measures skin and renders try-ons well; neither tells you which colours suit someone. Building that bridge, and being explicit about where it is confident and where it is estimating, is the product.

And that a platform can wear more names than it has engines. Three endpoints, three attempts at a second opinion, one colour engine. That is worth knowing, and we would rather publish it than quietly ship a cross-check that cannot cross-check anything.

---

## What's next for Drape

**Guided capture.** YouCam's JS Camera Kit validates face ratio, lighting and pose live, so people meet the 60%-face-width rule before the shutter rather than as an error message afterwards.

**Footwear, which is closer than we thought.** We assumed it needed a new endpoint. It does not: `task/cloth` accepts `garment_category: "shoes"` for 2 units, preserves the sitter, pose and background, and measures a hue shift of **+2.2°** — better than the −4 to −5° we get on tops. The dedicated `task/shoes` endpoint is the one to avoid: colour-accurate, but it returns a different pose, a different dress and a beach-sunset background. `task/scarf` is worse for our purposes — given a marigold reference it returned a navy patterned scarf in an invented street scene. What footwear needs is garment photography, not engineering.

**An agentic surface via MCP.** YouCam ships MCP servers for beauty, fashion and creators. We probed them on the wire and verified they are callable with the bare API key, no RSA exchange — they are not integrated in this build. Notably none of their tools answers "does this suit me?": the try-on tools take a reference image, not a colour. So MCP would buy agent-callable rendering, and the colour reasoning stays ours either way.

**The wardrobe audit, made real.** It already scores 24 items for zero units with nothing uploaded. Next it should tell you what to keep, restyle or let go.

---

# YouTube upload

## Title

```
Drape — the £300 colour analysis, measured (YouCam API Hackathon)
```

## Description

```
Drape is digital colour draping. It measures your skin, eyes and lips, works out
which colours actually suit you, then hangs real garments on your own body to
prove it.

A stylist holding fabric against your face costs £100–300 and takes an afternoon.
This does the same thing by measurement, in about a minute.

Try it: https://drape-five-delta.vercel.app
Code:  https://github.com/aswin-giridhar/drape  (MIT)

Built for the YouCam API Skin AI & Apparel VTO Hackathon.

WHAT YOU SEE IN THIS VIDEO
0:00  The problem — colour analysis is real, and it does not scale
0:16  A sitting: three YouCam APIs run on one photograph
0:52  The draping scrub — one garment, fourteen colours, ranked by measurement
1:45  Described in words and read aloud, and the garment as a 3D object
2:07  Two claims we deliberately do not make
2:22  A second sitter, and the same rail reorders completely

YOUCAM APIS USED
· Facial Colour Tones Analyzer (skin-tone-analysis)
· AI Skin Analysis (skin-analysis)
· AI Clothes Virtual Try-On (task/cloth v2)
· Face Attribute Analysis (face-attr-analysis)
· AI Hair Colour (hair-color)

Authentication is the V1 server-to-server RSA PKCS#1 v1.5 id_token flow, which is
not in the published OpenAPI specs.

WHAT WE MEASURED AND COULD NOT PROVE
The colour engine — ITA angle, undertone ratio, hair-to-skin contrast, CIEDE2000,
twelve-season classification — is ours and costs zero API units. But the part we
are proudest of is what we published rather than shipped:

· Garment colour moves measured skin scores by 0.2 points, against a noise floor
  of 0. We cut our own headline feature over it.
· We added a fourth endpoint hoping for an independent second opinion on hair
  colour. Seven of nine readings came back byte-identical to the first endpoint.
  One engine, two names.
· The Fitzpatrick analyzer returns exactly what our own ITA already predicts, at
  both ends of the range.
· Contrast is measured, printed, and still does not separate two sitters who share
  a season. The fix we attempted did not validate, so it is documented as a
  limitation rather than shipped.

Three separate attempts to find a second independent instrument on this platform,
all resolving to one engine. That is a real result about the API, arrived at by
measurement rather than assertion.

#YouCamAPI #PerfectCorp #Hackathon #ColourAnalysis #VirtualTryOn #NextJS
```
