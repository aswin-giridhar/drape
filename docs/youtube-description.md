# YouTube upload

## Title (one of these)

```
Drape — the £300 colour analysis, done by measurement | YouCam API Hackathon
```

```
I measured my face and let it pick my clothes — Drape, built on the YouCam API
```

---

## Description

Chapter timestamps were computed from the narration audio, not estimated. All
gaps are at least 10 seconds, which is what YouTube requires for chapters to
appear.

```
Somebody holds a piece of fabric against your face and you watch yourself change.
One colour makes you look rested. The next makes you look like you have flu.
Nothing about you moved — only the cloth.

That is colour draping. It is a real profession, it costs £100–300 a session, and
it does not scale: it needs a trained eye, real daylight and physical fabric.
Online, where most clothes are now bought, you get none of them. So you guess —
and colour is one of the leading reasons clothes get sent back.

Drape does the same job by measurement. It reads your skin, eyes and lips as
numbers, turns them into a palette with colour science, and then hangs real
garments on your own body so you can see it rather than take our word for it.

▸ Try it: https://drape-five-delta.vercel.app
▸ Code:  https://github.com/aswin-giridhar/drape (MIT)

Built for the YouCam API Skin AI & Apparel VTO Hackathon.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHAPTERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
0:00  The problem
0:14  A sitting — three YouCam APIs on one photograph
0:27  Reading the instruments
0:55  The draping scrub — one garment, fourteen colours
1:23  How the score is calculated
1:37  In words, read aloud, and in 3D
2:02  Two claims we deliberately don't make
2:22  A second sitter, a different answer
2:36  Close

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUCAM APIS USED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
· Facial Colour Tones Analyzer (skin-tone-analysis)
· AI Skin Analysis (skin-analysis)
· AI Clothes Virtual Try-On (task/cloth v2)
· Face Attribute Analysis (face-attr-analysis)
· AI Hair Colour (hair-color)

Authentication is the V1 server-to-server RSA PKCS#1 v1.5 id_token flow, which
is not in the published OpenAPI specs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE PART WE ARE PROUDEST OF IS WHAT WE COULD NOT PROVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The colour engine — ITA angle, undertone ratio, hair-to-skin contrast, CIEDE2000,
twelve-season classification — is ours, and costs zero API units. But four things
we measured did not go our way, and we published them instead of hiding them:

1. Our original headline feature was "this colour measurably improves your skin".
   We tested it properly: 0.2 points, against a noise floor of 0. We deleted it.

2. We added a fourth endpoint hoping for an independent second opinion on hair
   colour. Seven of nine readings came back byte-identical to the first endpoint,
   and the other two differed by less than the eye can see. One engine, two names.

3. The Fitzpatrick analyzer returns exactly what our own ITA angle already
   predicts — at both ends of the range, on sitters we chose for that reason.

4. Contrast is measured, printed on screen, and still does not separate two
   sitters who share a season. The fix we attempted did not validate, so it ships
   as a documented limitation rather than a guess.

Two attempts at a second opinion, across three endpoints, one colour engine. That
is a real result about the platform, arrived at by measurement rather than
assertion — and it is why we think a product that shows its working beats one
that advertises its accuracy.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALSO IN THERE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every garment is described in words and read aloud, so a blind or low-vision
shopper gets the answer too — a visual API producing a non-visual output. There
is a 3D turntable of each garment, a downloadable palette card to hold up in a
shop, a footwear rail, and a wardrobe audit that scores things you already own
for zero API units with nothing uploaded anywhere.

#YouCamAPI #PerfectCorp #Hackathon #ColourAnalysis #VirtualTryOn #NextJS
#Accessibility #ColourScience
```

---

## Pinned comment (optional)

```
Everything in the video is live at https://drape-five-delta.vercel.app — click
"Sitting no. 1" and the whole thing runs at zero API cost, including all fourteen
try-on renders and the 3D turntable. Happy to answer anything about the colour
engine or the API findings.
```
