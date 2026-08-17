"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { extractGarmentColour } from "@/lib/garment";
import { measureGarmentGeometry } from "@/lib/geometry";
import { describeGarment, type Description, type GarmentGeometry } from "@/lib/describe";
import { buildProfile, type ColourProfile } from "@/lib/palette";
import { useSpeech } from "@/lib/useSpeech";
import "./fitting-room.css";

/**
 * The Fitting Room.
 *
 * Built for someone who cannot see the product photograph. The try-on render is
 * generated in order to be MEASURED, not in order to be looked at; what the
 * person receives is speech.
 *
 * Design rules, applied throughout:
 *   - Every state change is announced through a live region.
 *   - Nothing is conveyed by colour, position or icon alone.
 *   - The whole flow is reachable and operable from the keyboard in document
 *     order; there are no custom widgets to learn.
 *   - The render is shown, but it is secondary - it lets a sighted companion
 *     confirm what was described.
 */

interface Wearer {
  id: string;
  name: string;
  bodyPhoto: string;
  preset: string;
}

const WEARERS: Wearer[] = [
  { id: "person_b", name: "Sitting no. 1", bodyPhoto: "/models/person_b.jpg", preset: "/presets/person_b.json" },
  { id: "person_c", name: "Sitting no. 2", bodyPhoto: "/models/person_c.jpg", preset: "/presets/person_c.json" },
  { id: "person_a", name: "Sitting no. 3", bodyPhoto: "/models/person_a.jpg", preset: "/presets/person_a.json" },
];

export default function FittingRoom() {
  const [profile, setProfile] = useState<ColourProfile | null>(null);
  const [wearer, setWearer] = useState<Wearer | null>(null);
  const [bodyPhoto, setBodyPhoto] = useState<string | null>(null);
  const [status, setStatus] = useState("Choose who is trying the garment on.");
  const [description, setDescription] = useState<Description | null>(null);
  const [render, setRender] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  // The shared hook, not a second copy: the voice preference is global and
  // persisted, so someone who needs it on gets it on every surface. This page
  // used to keep its own flag, which meant the two disagreed.
  const voice = useSpeech();

  /** Speak, and always mirror to the live region so nothing is audio-only. */
  const announce = useCallback(
    (text: string, speak = false) => {
      setStatus(text);
      if (speak) voice.say(text);
    },
    [voice],
  );

  const chooseWearer = useCallback(
    async (w: Wearer) => {
      announce(`Loading ${w.name}.`);
      try {
        const r = await fetch(w.preset);
        if (!r.ok) throw new Error();
        const scan = await r.json();
        setProfile(buildProfile({
          skinHex: scan.tone.skinHex,
          hairHex: scan.profile.hairHex,
          eyeHex: scan.tone.eyeHex,
          lipHex: scan.tone.lipHex,
          rednessRaw: scan.profile.rednessRaw,
        }));
        setWearer(w);
        setBodyPhoto(w.bodyPhoto);
        setDescription(null);
        setRender(null);
        announce(
          `${w.name} selected. Their skin measures ${scan.profile.undertone} in undertone. Now add a garment to try on.`,
          true,
        );
      } catch {
        announce("That wearer could not be loaded. Please choose another.", true);
      }
    },
    [announce],
  );

  const tryGarment = useCallback(
    async (garmentDataUri: string) => {
      if (!profile || !bodyPhoto) return;
      setBusy(true);
      setDescription(null);
      setRender(null);
      try {
        announce("Reading the colour of the garment.");
        const colour = await extractGarmentColour(garmentDataUri);

        announce("Putting it on. This takes about fifteen seconds.");
        const personBase64 = bodyPhoto.startsWith("data:")
          ? bodyPhoto
          : await toDataUri(bodyPhoto);
        const res = await fetch("/api/tryon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personBase64,
            garmentBase64: garmentDataUri,
            category: "upper_body",
            cacheKey: wearer?.id,
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "The try-on did not complete.");
        setRender(j.imageUrl);

        announce("Measuring how it sits.");
        let geometry: GarmentGeometry | undefined;
        try {
          geometry = await measureGarmentGeometry(bodyPhoto, j.imageUrl);
        } catch {
          geometry = undefined; // description says so; never silently omitted
        }

        const d = describeGarment(colour.hex, profile, geometry, { patterned: colour.patterned });
        setDescription(d);
        announce(d.spoken, true);
        resultRef.current?.focus();
      } catch (e) {
        announce(
          e instanceof Error ? e.message : "Something went wrong. Please try that garment again.",
          true,
        );
      } finally {
        setBusy(false);
      }
    },
    [profile, bodyPhoto, wearer, announce],
  );

  return (
    <div className="fr">
      <a className="skip" href="#main">Skip to the fitting room</a>

      <header>
        <h1>The Fitting Room</h1>
        <p className="sub">
          Online clothes shopping is built entirely on pictures. This describes a garment on your
          body in words: its colour, how it sits against your skin, and where it falls.
        </p>
      </header>

      {/* Live region: every state change lands here, whether or not speech is on. */}
      <p className="status" role="status" aria-live="polite">{status}</p>

      <main id="main">
        <section aria-labelledby="step1">
          <h2 id="step1">Step 1. Who is trying it on?</h2>
          <div className="row">
            {WEARERS.map((w) => (
              <button
                key={w.id}
                onClick={() => chooseWearer(w)}
                aria-pressed={wearer?.id === w.id}
                disabled={busy}
              >
                {w.name}
                {wearer?.id === w.id ? " — selected" : ""}
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="step2">
          <h2 id="step2">Step 2. Add the garment</h2>
          {!profile && <p className="hint">Choose a wearer first.</p>}
          <label className="file">
            <span>Choose a garment photograph</span>
            <input
              type="file"
              accept="image/jpeg,image/png"
              disabled={!profile || busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => tryGarment(reader.result as string);
                reader.readAsDataURL(f);
              }}
            />
          </label>
        </section>

        <section aria-labelledby="step3">
          <h2 id="step3">Step 3. What it looks like on you</h2>

          <div className="controls">
            <button onClick={voice.toggle} aria-pressed={voice.on}>
              {voice.on ? "Speech is on" : "Speech is off"}
            </button>
            {description && (
              <button onClick={() => voice.say(description.spoken, true)}>
                Read the description again
              </button>
            )}
          </div>

          <div className="result" ref={resultRef} tabIndex={-1} aria-live="polite">
            {!description && !busy && <p className="hint">No garment described yet.</p>}
            {busy && <p className="hint">Working. The status above updates as each step finishes.</p>}
            {description && (
              <article>
                <h3>{description.headline}</h3>
                <p className="against">{description.againstYou}</p>
                {description.detail.length > 0 && (
                  <ul>
                    {description.detail.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                )}
                {description.unknown.length > 0 && (
                  <div className="unknown">
                    <h4>What we could not tell you</h4>
                    <ul>
                      {description.unknown.map((u) => <li key={u}>{u}</li>)}
                    </ul>
                  </div>
                )}
              </article>
            )}
          </div>

          {render && (
            <figure className="render">
              <img src={render} alt={description?.spoken ?? "The garment shown on the wearer"} />
              <figcaption>
                The render is here so a sighted companion can check it against the description. It
                is not needed to use this page.
              </figcaption>
            </figure>
          )}
        </section>
      </main>

      <footer>
        <p>
          Built on the YouCam API. AI Clothes Virtual Try-On generates the image; AI Skin Analysis
          and the Facial Colour Tones Analyzer measure the wearer. The image exists to be measured,
          not to be looked at.
        </p>
      </footer>
    </div>
  );
}

async function toDataUri(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("That photograph could not be read.");
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("That photograph could not be read."));
    fr.readAsDataURL(blob);
  });
}
