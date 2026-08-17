"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractGarmentColour } from "@/lib/garment";
import { scoreGarment, type ColourProfile, type GarmentScore } from "@/lib/palette";
import { labelFor } from "@/lib/skinzip";
import { describeGarment, type Description } from "@/lib/describe";
import { measureGarmentGeometry } from "@/lib/geometry";
import { necklineFor } from "@/lib/faceshape";
import { metalFor, rankLips } from "@/lib/adornment";
import { useSpeech } from "@/lib/useSpeech";
import { Lightbox, Zoomable } from "./Lightbox";
import { PaletteCard } from "./PaletteCard";

/* ------------------------------------------------------------------ */
/* Shapes mirroring the API responses                                  */
/* ------------------------------------------------------------------ */

interface SeasonPayload {
  name: string;
  blurb: string;
  best: string[];
  avoid: string[];
  runnerUp: string;
  confidence: number;
}
interface SkinPayload {
  concerns: { concern: string; raw: number; ui: number }[];
  overall: number;
  skinAge?: number;
  masks: Record<string, string>;
  normalisedFace?: string;
}
interface ScanResult {
  profile: ColourProfile;
  season: SeasonPayload;
  skin: SkinPayload | null;
  tone: { skinHex: string; hairHex: string; eyeHex: string; lipHex: string; hairName?: string };
  warnings: { field: string; message: string; needsConfirmation: boolean }[];
  /** Present only for the completed sittings, which were measured offline. */
  faceAttributes?: { faceShape?: string };
}
interface Sitter {
  id: string;
  name: string;
  /** The file the analyser actually read. Kept as provenance; not displayed. */
  facePhoto: string;
  /**
   * A sharp display crop of the same head, cut from the full-length original at
   * native resolution. The measured file was enlarged to 1200px from roughly
   * 600px of real detail, so showing it magnified its own softness on the one
   * image the whole product rests on.
   */
  portrait: string;
  bodyPhoto: string;
  preset: string;
}

const SITTERS: Sitter[] = [
  {
    id: "person_b",
    name: "Sitting no. 1",
    facePhoto: "/models/person_b_face.jpg",
    portrait: "/models/person_b_portrait.jpg",
    bodyPhoto: "/models/person_b.jpg",
    preset: "/presets/person_b.json",
  },
  {
    id: "person_c",
    name: "Sitting no. 2",
    facePhoto: "/models/person_c_face.jpg",
    portrait: "/models/person_c_portrait.jpg",
    bodyPhoto: "/models/person_c.jpg",
    preset: "/presets/person_c.json",
  },
  {
    id: "person_a",
    name: "Sitting no. 3",
    facePhoto: "/models/person_a_face.jpg",
    portrait: "/models/person_a_portrait.jpg",
    bodyPhoto: "/models/person_a.jpg",
    preset: "/presets/person_a.json",
  },
];

/* ------------------------------------------------------------------ */

export default function Page() {
  const [sitter, setSitter] = useState<Sitter | null>(null);
  const [ownFace, setOwnFace] = useState<string | null>(null);
  const [ownBody, setOwnBody] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState<{
    units?: number;
    tryOnsAffordable?: number;
    liveGenerationAvailable?: boolean;
    unreachable?: boolean;
  } | null>(null);

  const voice = useSpeech();

  // Re-scan for reveal targets whenever the view changes.
  useReveals(scan ? sitter?.id ?? "own" : "intro");

  useEffect(() => {
    fetch("/api/budget")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setBudget)
      .catch(() => setBudget({ unreachable: true }));
  }, []);

  const bodyPhoto = sitter?.bodyPhoto ?? ownBody;

  const openSitting = useCallback(async (s: Sitter) => {
    setError(null);
    setBusy("Opening the sitting");
    try {
      const r = await fetch(s.preset);
      if (!r.ok) throw new Error();
      setScan(await r.json());
      setSitter(s);
      setOwnFace(null);
      setOwnBody(null);
    } catch {
      setError(
        "That sitting couldn't be opened. You can still run a live analysis with your own photograph.",
      );
    } finally {
      setBusy(null);
    }
  }, []);

  const runScan = useCallback(async (faceDataUri: string) => {
    setError(null);
    setBusy("Measuring — about 20 seconds");
    try {
      const r = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: faceDataUri }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "The analysis failed.");
      setScan(j);
      setSitter(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The analysis failed.");
    } finally {
      setBusy(null);
    }
  }, []);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="wordmark">
          Drape <small>Colour analysis</small>
        </div>
        <div className="meter" style={{ gap: "1.25rem" }}>
          {voice.available && (
            <button
              className="voicetoggle"
              onClick={voice.toggle}
              aria-pressed={voice.on}
              title="Read descriptions aloud throughout"
            >
              {voice.on ? "Voice on" : "Voice off"}
            </button>
          )}
          {budget?.unreachable ? (
            <>
              <i className="off" />
              API unreachable
            </>
          ) : budget ? (
            <>
              <i className={budget.liveGenerationAvailable ? "" : "off"} />
              {/* "593 units" is a dashboard readout, not something a shopper can
                  act on. The same number said as try-ons is the part that
                  actually means anything to whoever is standing here. */}
              {budget.liveGenerationAvailable
                ? `${budget.tryOnsAffordable ?? 0} live try-ons left`
                : "live generation paused"}
            </>
          ) : (
            <>
              <i className="off" />
              checking
            </>
          )}
        </div>
      </header>

      {!scan && <Hero />}

      {error && (
        <div className="notice" role="alert">
          <strong>That didn&apos;t work</strong>
          {error}
        </div>
      )}

      {budget?.liveGenerationAvailable === false && !budget.unreachable && (
        <div className="notice paused">
          <strong>Live generation paused</strong>
          The demo budget has reached its reserve. Every completed sitting below still works in
          full — nothing here is a placeholder.
        </div>
      )}

      {busy && (
        <p className="working">
          <span className="spinner" />
          {busy}
        </p>
      )}

      {!scan && (
        <TheSitting
          sitters={SITTERS}
          onOpen={openSitting}
          onFace={(u) => {
            setOwnFace(u);
            runScan(u);
          }}
          onBody={setOwnBody}
          hasBody={!!ownBody}
          busy={!!busy}
        />
      )}

      {scan && (
        <>
          <SectionNav />
          <ColourCard
            scan={scan}
            portrait={sitter?.portrait ?? ownFace ?? undefined}
            sitterId={sitter?.id}
          />
          <TheRail scan={scan} bodyPhoto={bodyPhoto} sitterId={sitter?.id} voice={voice} />
          <TheFootwear profile={scan.profile} />
          {/* Bring-your-own sits above the catalogue: it is the section that
              proves this works on anything, and it was previously buried
              eleven screens down beneath a grid of football kits. */}
          <YourOwnPiece scan={scan} bodyPhoto={bodyPhoto} sitterId={sitter?.id} voice={voice} />
          <TheGallery scan={scan} bodyPhoto={bodyPhoto} sitterId={sitter?.id} />
          <div style={{ paddingTop: "var(--hang)" }}>
            <button
              className="ghost"
              onClick={() => {
                setScan(null);
                setSitter(null);
                setOwnFace(null);
                setOwnBody(null);
              }}
            >
              Close this sitting
            </button>
          </div>
        </>
      )}

      <footer
        style={{
          marginTop: "var(--hang)",
          borderTop: "1px solid var(--hairline)",
          paddingTop: "1.5rem",
        }}
      >
        <p className="data" style={{ fontSize: "0.625rem", color: "var(--pencil)", maxWidth: "72ch", lineHeight: 1.8 }}>
          Built on the YouCam API — Facial Colour Tones Analyzer, AI Skin Analysis and AI Clothes
          Virtual Try-On. Skin figures shown are the engine&apos;s raw scores, not the flattering
          display scores. Try-on renders preserve hue to within about five degrees; exact
          lightness may vary.
        </p>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */


/**
 * Releases [data-reveal] elements as they scroll into view.
 *
 * Deliberately NOT applied around the pinned scrub: a transform on an ancestor
 * establishes a containing block and breaks position: sticky.
 */
function useReveals(key: unknown) {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return; // stays visible

    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            en.target.classList.add("seen");
            io.unobserve(en.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    // Marking an element .watching is what hides it, so we only ever hide
    // something we are definitely observing.
    const watch = () => {
      for (const el of document.querySelectorAll("[data-reveal]:not(.watching)")) {
        el.classList.add("watching");
        io.observe(el);
      }
    };
    watch();

    // Sections that arrive after a fetch (the comparison, the catalogue) are
    // not in the DOM on the first pass.
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });

    // Belt and braces: anything still unseen after a few seconds is released,
    // so a missed observation can never leave content invisible.
    const failsafe = window.setTimeout(() => {
      document
        .querySelectorAll("[data-reveal].watching:not(.seen)")
        .forEach((el) => el.classList.add("seen"));
    }, 6000);

    return () => {
      io.disconnect();
      mo.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [key]);
}

/**
 * An open sitting runs to roughly a dozen screens, most of it the pinned scrub.
 * Without a way to move between sections the later ones are undiscoverable.
 */
function SectionNav() {
  const items = [
    { id: "card", label: "Colour card" },
    { id: "rail", label: "The rail" },
    { id: "own", label: "Your own piece" },
    { id: "gallery", label: "Collection" },
  ];
  const [current, setCurrent] = useState("card");

  useEffect(() => {
    const onScroll = () => {
      // The section whose top has most recently passed the sticky bars.
      let active = items[0].id;
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top <= 140) active = it.id;
      }
      setCurrent(active);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <nav className="sectionnav" aria-label="Sections of this sitting">
      {items.map((it) => (
        <a key={it.id} href={`#${it.id}`} aria-current={current === it.id ? "true" : undefined}>
          {it.label}
        </a>
      ))}
    </nav>
  );
}

function Hero() {
  // A colour deck fanned open — the physical object this product replaces.
  const fan = [
    "#BC6C25", "#DDA15E", "#606C38", "#283618", "#A3B18A",
    "#8AA9C1", "#C08497", "#9A8C98", "#4361EE", "#0B3954",
    "#F7B801", "#FF6B35", "#CDB4DB", "#BDE0FE", "#023047",
  ];
  return (
    <section className="hero">
      <div>
        <h1 className="display">
          Know what
          <br />
          <em>suits you.</em>
        </h1>
        <p className="lede" style={{ marginTop: "1.75rem" }}>
          A stylist holds cloth against your face and watches what it does to you. It works, it
          costs £100–300, and it takes an afternoon. Drape measures the same thing — your skin,
          eyes and lips — then hangs the answer on your own body.
        </p>
      </div>
      <div className="fan" aria-hidden="true">
        {fan.map((hex, i) => {
          // Spread the cards evenly across a 96° arc, pivoting at the base.
          const angle = -48 + (96 * i) / (fan.length - 1);
          return (
            <span
              key={hex}
              style={{
                background: hex,
                transform: `rotate(${angle}deg)`,
                animationDelay: `${i * 40}ms`,
                zIndex: fan.length - Math.abs(i - (fan.length - 1) / 2),
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function TheSitting({
  sitters,
  onOpen,
  onFace,
  onBody,
  hasBody,
  busy,
}: {
  sitters: Sitter[];
  onOpen: (s: Sitter) => void;
  onFace: (u: string) => void;
  onBody: (u: string) => void;
  hasBody: boolean;
  busy: boolean;
}) {
  return (
    <section className="section" id="sitting">
      <div className="section-head" data-reveal>
        <h2>The sitting</h2>
        <span className="idx">Choose a subject</span>
      </div>

      <div className="gallery" data-reveal>
        {sitters.map((s) => (
          <button key={s.id} className="exhibit" onClick={() => onOpen(s)} disabled={busy}>
            <div className="frame">
              <img src={s.bodyPhoto} alt="" />
            </div>
            <div className="label">
              <div className="label-row">
                <span className="title">{s.name}</span>
                <span className="score">Open</span>
              </div>
              <span className="meta">Completed sitting</span>
            </div>
          </button>
        ))}

        <div style={{ gridColumn: "span 2", minWidth: 0, gridRow: "span 1" }}>
          <div
            style={{
              border: "1px solid var(--ink)",
              padding: "clamp(1.25rem, 3vw, 2rem)",
              background: "var(--mount)",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "1.5rem",
            }}
          >
            <div>
              <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>
                Sit for it yourself
              </p>
              <p style={{ margin: 0, color: "var(--graphite)", fontSize: "0.9375rem", maxWidth: "38ch" }}>
                Two photographs. A head-and-shoulders shot where your face fills roughly
                two-thirds of the frame — that&apos;s what the analyser needs to read your skin —
                and a full-length one so garments can be hung on you.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <FileButton label="Portrait — begin" onFile={onFace} disabled={busy} />
              <FileButton
                label={hasBody ? "Full length ✓" : "Full length"}
                onFile={onBody}
                disabled={busy}
                ghost
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FileButton({
  label,
  onFile,
  disabled,
  ghost,
}: {
  label: string;
  onFile: (dataUri: string) => void;
  disabled?: boolean;
  ghost?: boolean;
}) {
  return (
    <label
      className="filebtn"
      style={{
        background: ghost ? "transparent" : "var(--ink)",
        color: ghost ? "var(--ink)" : "var(--wall)",
        border: "1px solid var(--ink)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {label}
      {/* Visually hidden, NOT `hidden`. `hidden` takes the input out of the tab
          order, which made the primary call-to-action unreachable by keyboard
          and invisible to a screen reader. Clipping it keeps it focusable, and
          `.filebtn:focus-within` draws the ring on the label. */}
      <input
        type="file"
        accept="image/jpeg,image/png"
        className="sr-file"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => onFile(reader.result as string);
          reader.readAsDataURL(f);
        }}
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */

function ColourCard({
  scan,
  portrait,
  sitterId,
}: {
  scan: ScanResult;
  portrait?: string;
  sitterId?: string;
}) {
  const { profile, season, skin, tone, warnings } = scan;
  const photo = portrait ?? skin?.normalisedFace;
  const [showAll, setShowAll] = useState(false);
  const rednessMask = skin?.masks?.redness;
  const neckline = necklineFor(scan.faceAttributes?.faceShape);
  // The two questions every colour-analysis session ends with, answered from
  // measurements we already hold rather than from another API call.
  const metal = useMemo(() => metalFor(profile), [profile]);
  const lips = useMemo(() => rankLips(profile), [profile]);

  return (
    <section className="section" id="card">
      <div className="section-head">
        <h2>Your colour card</h2>
        <span className="idx">Measured, not guessed</span>
      </div>

      {warnings.map((w) => (
        <div className="notice" key={w.field}>
          {/* "Please confirm" promised a control that does not exist - there is
              no swatch picker on this page, so it read as a dead instruction.
              The honest label says what the reading IS, which is the thing the
              reader needs anyway on a page whose claim is "measured, not
              guessed". */}
          <strong>{w.needsConfirmation ? "Estimated, not measured" : "Worth knowing"}</strong>
          {w.message}
        </div>
      ))}

      <div className="sitting" data-reveal>
        <div className="drape-frame">
          <div className="drape-plate">
            {photo && <img src={photo} alt="The subject of this sitting" />}
            <div className="drape-panels">
              {season.best.slice(0, 8).map((hex) => (
                <div key={hex} className="drape-panel" style={{ background: hex }} tabIndex={0}>
                  <span>{hex.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="label">
            <div className="label-row">
              <span className="title">{season.name}</span>
              <span className="score">{profile.ita.toFixed(1)}°</span>
            </div>
            <span className="meta">
              {profile.depth}, {profile.undertone} · ITA angle
            </span>
            <span className="hint-inline">Hover a panel to hold that colour against the face</span>
          </div>
        </div>

        <div>
          <p className="eyebrow">Instrument readings</p>
          <dl className="readout">
            <div>
              <dt>Skin</dt>
              <dd>
                <span className="chip" style={{ background: tone.skinHex }} />
                {tone.skinHex.toUpperCase()}
              </dd>
            </div>
            <div>
              <dt>Eyes</dt>
              <dd>
                <span className="chip" style={{ background: tone.eyeHex }} />
                {tone.eyeHex.toUpperCase()}
              </dd>
            </div>
            <div>
              <dt>Lips</dt>
              <dd>
                <span className="chip" style={{ background: tone.lipHex }} />
                {tone.lipHex.toUpperCase()}
              </dd>
            </div>
            <div>
              <dt>Depth (ITA)</dt>
              <dd>
                {profile.ita.toFixed(1)}° · {profile.depth}
              </dd>
            </div>
            <div>
              <dt>Undertone</dt>
              <dd>
                {profile.undertone} · {profile.undertoneRatio.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>Contrast</dt>
              <dd>
                {profile.contrast} · ΔL* {profile.contrastSpread.toFixed(0)}
              </dd>
            </div>
            {profile.rednessRaw !== undefined && (
              <div>
                <dt>Redness</dt>
                <dd>{profile.rednessRaw.toFixed(1)} raw</dd>
              </div>
            )}
            {neckline && (
              <div>
                <dt>Face shape</dt>
                <dd>{neckline.shape}</dd>
              </div>
            )}
          </dl>

          <div style={{ marginTop: "2.5rem" }}>
            <h3 className="display season">{season.name}</h3>
            <p style={{ margin: 0, color: "var(--graphite)", maxWidth: "40ch" }}>{season.blurb}</p>
            {season.confidence < 0.35 && (
              <p className="data" style={{ fontSize: "0.6875rem", color: "var(--pencil)", marginTop: "0.75rem" }}>
                Close to {season.runnerUp} — confidence {season.confidence.toFixed(2)}. Colours
                shared by both are safest.
              </p>
            )}

            <ul className="swatches" style={{ marginTop: "2rem" }}>
              {season.best.map((hex) => (
                <li key={hex} style={{ background: hex }} data-hex={hex.toUpperCase()} />
              ))}
            </ul>
          </div>

          {/* Everything below is DERIVED from the season above, so it belongs
              below it. Appending each new block to the end of the card had left
              the headline answer sitting underneath three pieces of advice that
              only make sense once you have read it. */}
          {/* Shape is the one thing the face-attribute endpoint tells us that
              nothing else on the platform does - its colour readings turned out
              to be the same engine as the tone analyser. The advice itself is
              convention rather than measurement, and says so. */}
          {neckline && (
            <div className="neckline">
              <p className="eyebrow" style={{ marginTop: "2rem" }}>
                Necklines &mdash; conventional guidance, not measurement
              </p>
              <p style={{ margin: "0 0 0.5rem", maxWidth: "40ch" }}>{neckline.advice}</p>
              <p className="data" style={{ fontSize: "0.6875rem", color: "var(--pencil)", margin: 0 }}>
                {neckline.crewVerdict}
              </p>
            </div>
          )}

          <div className="adorn">
            <p className="eyebrow" style={{ marginTop: "2rem" }}>
              Gold or silver
            </p>
            <div className="metal-row">
              <span className="metal-chip" style={{ background: metal.hex }} aria-hidden="true" />
              <p style={{ margin: 0, maxWidth: "38ch" }}>{metal.sentence}</p>
            </div>
            <p className="data basis">{metal.basis}</p>

            <p className="eyebrow" style={{ marginTop: "2rem" }}>
              Lip colours, ranked
            </p>
            <ol className="lips">
              {lips.slice(0, 6).map((l) => (
                <li key={l.hex}>
                  <span className="lip-chip" style={{ background: l.hex }} aria-hidden="true" />
                  <span className="lip-name">{l.name}</span>
                  <span className="lip-score">
                    {l.score.score.toFixed(1)}
                    <small>/10</small>
                  </span>
                </li>
              ))}
            </ol>
            <p className="data basis">
              Scored by the same engine that ranks the garments, against the same measured face.
            </p>
          </div>

          <HairLever photo={portrait} sitterId={sitterId} />

        </div>
      </div>

      {/* Full width, outside the two-column grid. This is the last thing in the
          card and the only thing you take away, so it should not sit in a
          half-empty column with a screen of nothing beside it. The lips prop
          passes the whole score object: the card prints the verdict word next
          to the number, which is signal that is not carried by colour. */}
      <PaletteCard
        seasonName={season.name}
        blurb={season.blurb}
        best={season.best}
        metal={metal}
        lips={lips}
        skinHex={tone.skinHex}
        ita={profile.ita}
        undertone={profile.undertone}
        contrast={profile.contrast}
      />

      {skin && (
        <div style={{ marginTop: "var(--hang)" }}>
          <div className="section-head" style={{ borderTopColor: "var(--hairline)" }}>
            <h2 style={{ fontSize: "clamp(1.25rem,2.2vw,1.6rem)" }}>The skin reading</h2>
            <button className="ghost" onClick={() => setShowAll((s) => !s)}>
              {showAll ? "Show the three worst" : "Show all fourteen"}
            </button>
          </div>

          <div className="sitting">
            <div>
              <dl className="readout">
                {(showAll ? skin.concerns : skin.concerns.slice(0, 3)).map((c) => (
                  <div key={c.concern}>
                    <dt>{labelFor(c.concern)}</dt>
                    <dd>{c.raw.toFixed(1)}</dd>
                  </div>
                ))}
              </dl>
              <p style={{ color: "var(--graphite)", fontSize: "0.875rem", maxWidth: "42ch" }}>
                Fourteen concerns, lowest first — higher is better. Redness is the one that feeds
                the garment advice: it decides whether warm reds near your face are a risk.
              </p>
            </div>
            {rednessMask && (
              <div className="drape-frame">
                {/* The mask is a transparent overlay from the API - it only reads
                    as a heat map when composited back onto the face it came from. */}
                <div className="drape-plate">
                  {photo && <img src={photo} alt="" />}
                  <img
                    src={rednessMask}
                    alt="Heat map of measured facial redness"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      mixBlendMode: "multiply",
                    }}
                  />
                </div>
                <div className="label">
                  <div className="label-row">
                    <span className="title">Redness map</span>
                    <span className="score">
                      {skin.concerns.find((c) => c.concern === "redness")?.raw.toFixed(1)}
                    </span>
                  </div>
                  <span className="meta">YouCam AI Skin Analysis · detection mask</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

interface CatalogueItem {
  id: string;
  thumb: string;
  title: string;
  category: string;
}

/** House rail: one cut, many colours — digital draping in its purest form. */
interface RailItem extends CatalogueItem {
  hex: string;
}




/**
 * Contrast is the one axis of a season a person can actually change, and hair is
 * the lever. So this sits directly under the measured contrast figure.
 *
 * What it deliberately does NOT do is quote a new contrast number off the
 * result. The renderer TINTS rather than replaces - a requested colour at L* 55
 * came back at L* 27 in shadow, because it preserves the original shading - so
 * any dL* measured from it would be a number we invented. The render shows the
 * look; the reading stays with the photograph that was actually measured.
 */
const HAIR_SHADES = [
  { name: "Lighter", hex: "#A87B52" },
  { name: "Warm brown", hex: "#6F4E37" },
  { name: "Deep", hex: "#2B1B17" },
];

function HairLever({ photo, sitterId }: { photo?: string; sitterId?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [shot, setShot] = useState<{ hex: string; name: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!photo) return null;

  const run = async (shade: { name: string; hex: string }) => {
    setBusy(shade.hex);
    setError(null);
    try {
      const imageBase64 = photo.startsWith("data:") ? photo : await toDataUri(photo);
      const r = await fetch("/api/hair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, hex: shade.hex, cacheKey: sitterId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "That didn't come back.");
      setShot({ ...shade, url: j.imageUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't come back.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="hairlever">
      <p className="eyebrow" style={{ marginTop: "2rem" }}>
        Change the contrast
      </p>
      <p style={{ margin: "0 0 0.75rem", maxWidth: "40ch" }}>
        Contrast is the one part of your colouring you can actually change. Here is the same
        photograph with different hair.
      </p>
      <div className="hair-row">
        {HAIR_SHADES.map((s) => (
          <button key={s.hex} onClick={() => run(s)} disabled={!!busy} className="hair-btn">
            <span className="hair-chip" style={{ background: s.hex }} aria-hidden="true" />
            {busy === s.hex ? "Working" : s.name}
          </button>
        ))}
      </div>
      {error && <p className="data basis" role="alert">{error}</p>}
      {shot && (
        <figure className="hair-shot">
          <Zoomable
            src={shot.url}
            alt={`The sitter with ${shot.name.toLowerCase()} hair`}
            caption="Generated by YouCam Hair Colour. It tints rather than replaces, so the original shading shows through."
          >
            <img src={shot.url} alt={`The sitter with ${shot.name.toLowerCase()} hair`} />
          </Zoomable>
          <figcaption className="data basis">
            {shot.name} — one unit. This renders the look; it does not re-measure your contrast,
            because the renderer tints rather than replaces and any figure taken off it would be
            invented.
          </figcaption>
        </figure>
      )}
    </div>
  );
}


/**
 * The footwear rail.
 *
 * Same argument as the house rail, one storey down: one shoe, four colours,
 * nothing changing but the colour, so the ranking is entirely about the wearer.
 *
 * These renders are pre-generated static files, so browsing them costs a judge
 * nothing. They came from `task/cloth` with `garment_category: "shoes"` - the
 * SAME endpoint the garments use - which preserves the sitter, the pose and the
 * studio background. The dedicated `task/shoes` endpoint does not: it is
 * colour-accurate but returns a different pose, a different dress and an
 * invented beach background, so it is deliberately not used here.
 *
 * The swatch is the shoe we asked for, not the shoe that came back. The render
 * preserves the studio lighting, so mid-tones lift by roughly 0.3 in lightness
 * while hue holds to within a couple of degrees on the saturated colours. The
 * caption says so rather than letting the two quietly disagree.
 */
interface ShoeItem {
  slug: string;
  title: string;
  hex: string;
  thumb: string;
  render: string;
}

function TheFootwear({ profile }: { profile: ColourProfile }) {
  const [shoes, setShoes] = useState<ShoeItem[] | null>(null);
  const [shown, setShown] = useState<ShoeItem | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/shoes/manifest.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => alive && setShoes(j))
      .catch(() => alive && setShoes([])); // absent, not broken
    return () => {
      alive = false;
    };
  }, []);

  const ranked = useMemo(
    () =>
      (shoes ?? [])
        .map((s) => ({ item: s, score: scoreGarment(s.hex, profile) }))
        .sort((a, b) => b.score.score - a.score.score),
    [shoes, profile],
  );

  if (!shoes || shoes.length === 0) return null;

  return (
    <section className="section" id="footwear">
      <div className="section-head">
        <h2>And on your feet</h2>
        <span className="idx">One boot, four colours · ranked for you</span>
      </div>

      <p style={{ maxWidth: "48ch", marginTop: 0 }}>
        The same measurement decides footwear. These are real try-on renders from the same
        endpoint the garments use, generated ahead of time, so looking through them costs nothing.
      </p>

      <div className="gallery" data-reveal>
        {ranked.map(({ item, score }) => (
          <div key={item.slug} className="exhibit" style={{ cursor: "default" }}>
            <div className="frame">
              <Zoomable
                src={item.render}
                alt={`The sitter wearing the ${item.title.toLowerCase()} boot`}
                caption={`${item.title} — YouCam AI Clothes Virtual Try-On, shoes category. The render keeps the studio lighting, so it sits lighter than the swatch.`}
              >
                <img src={item.render} alt={`The sitter wearing the ${item.title.toLowerCase()} boot`} />
              </Zoomable>
            </div>
            <div className="label">
              <div className="label-row">
                <span className="title">{item.title}</span>
                <span className="score">
                  {score.score.toFixed(1)}
                  <small>/10</small>
                </span>
              </div>
              <span className="meta">
                {item.hex} {score.verdict} · ΔE {score.deltaE.toFixed(0)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** sRGB hex to the linear-space triple glTF baseColorFactor expects. */
function srgbToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)];
}

/**
 * The turntable.
 *
 * The garment as a solid object you can turn, reconstructed from the flat
 * product photograph by an image-to-3D model.
 *
 * ONE mesh serves every colour, tinted at runtime from the same hex the swatch
 * uses. That is not a size optimisation, it is a correctness one: the earlier
 * version shipped a separate reconstruction per colour, and because the
 * reconstruction bakes the product photograph's own shading into its albedo,
 * the mesh sat a mean ΔE76 of 12.2 away from the swatch beside it - a
 * colour-analysis app disagreeing with itself about the colour. Driving both
 * from one hex makes them structurally unable to diverge, and measured the
 * error down to about 3. It also means all fourteen rail colours work, where
 * five meshes existed and nine 404ed.
 *
 * The camera is aimed explicitly. The garment faces +X and model-viewer's
 * default orbit sits on +Z, so the default view was the shirt edge-on - a
 * 30%-wide sliver filling a fifth of the frame. 90deg puts the camera in front
 * of it: 59% fill, and the first frame already reads as a garment, which is why
 * there is no auto-rotate to wait through.
 */
const MESH_SRC = "/models3d/shirt.glb";

function Turntable({ hex, title }: { hex: string; title: string }) {
  const ref = useRef<HTMLElement & { model?: { materials: unknown[] } }>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let alive = true;
    // HEAD first: a missing mesh must not render an empty box.
    fetch(MESH_SRC, { method: "HEAD" })
      .then((r) => alive && setOk(r.ok))
      .catch(() => alive && setOk(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const mv = ref.current;
    if (!mv || !ok) return;

    const paint = () => {
      // `model` is undefined until the load event; both entry points are needed
      // because the colour also changes while the mesh is already loaded.
      const mat = (mv.model?.materials?.[0] ?? null) as {
        pbrMetallicRoughness: {
          baseColorTexture: { setTexture: (t: null) => void };
          setBaseColorFactor: (c: number[]) => void;
          setMetallicFactor: (v: number) => void;
          setRoughnessFactor: (v: number) => void;
        };
      } | null;
      if (!mat) return;
      const pbr = mat.pbrMetallicRoughness;
      pbr.baseColorTexture?.setTexture(null); // drop the baked-in photograph
      pbr.setBaseColorFactor([...srgbToLinear(hex), 1]);
      pbr.setMetallicFactor(0);
      pbr.setRoughnessFactor(0.9); // matte cotton, not satin
    };

    paint();
    mv.addEventListener("load", paint);
    return () => mv.removeEventListener("load", paint);
  }, [hex, ok]);

  if (!ok) {
    return (
      <div className="turntable">
        <p className="eyebrow" style={{ margin: 0 }}>
          The 3D reconstruction couldn&apos;t be loaded. The photograph above is unaffected.
        </p>
      </div>
    );
  }

  return (
    <div className="turntable">
      {/* @ts-expect-error - web component, not a React element */}
      <model-viewer
        ref={ref}
        src={MESH_SRC}
        alt={`A rotatable three-dimensional model of the ${title} garment`}
        camera-controls
        loading="eager"
        reveal="auto"
        camera-orbit="90deg 78deg 90%"
        min-camera-orbit="auto 60deg auto"
        max-camera-orbit="auto 95deg auto"
        interaction-prompt="auto"
        shadow-intensity="0.6"
        tone-mapping="neutral"
        exposure="0.85"
        environment-image="neutral"
        touch-action="pan-y"
        style={{ width: "100%", height: "100%", background: "transparent" }}
      />
      <p className="turntable-cap">Drag to turn · reconstructed from the flat product photograph</p>
    </div>
  );
}

type Voice = ReturnType<typeof useSpeech>;

/**
 * The spoken description of a garment, available anywhere a garment appears.
 *
 * This is the room's voice, not a separate mode: the text is always rendered,
 * speech is an enhancement, and it sits inside the same surface as the picture
 * rather than on a page of its own.
 */
function Described({
  hex,
  profile,
  voice,
  originalSrc,
  renderSrc,
  patterned,
}: {
  hex: string;
  profile: ColourProfile;
  voice: Voice;
  originalSrc?: string | null;
  renderSrc?: string | null;
  patterned?: boolean;
}) {
  const [desc, setDesc] = useState<Description | null>(null);
  const [measuring, setMeasuring] = useState(false);

  useEffect(() => {
    let alive = true;
    // Colour-only description immediately, so there is never a blank state.
    setDesc(describeGarment(hex, profile, undefined, { patterned }));
    if (!originalSrc || !renderSrc) return;
    setMeasuring(true);
    measureGarmentGeometry(originalSrc, renderSrc)
      .then((g) => alive && setDesc(describeGarment(hex, profile, g, { patterned })))
      .catch(() => {/* stays colour-only, and says so */})
      .finally(() => alive && setMeasuring(false));
    return () => {
      alive = false;
    };
  }, [hex, profile, originalSrc, renderSrc, patterned]);

  useEffect(() => {
    if (desc && voice.on) voice.say(desc.spoken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desc?.spoken, voice.on]);

  if (!desc) return null;

  return (
    <div className="described">
      <div className="described-head">
        <p className="eyebrow" style={{ margin: 0 }}>
          In words{measuring ? " · measuring the shape" : ""}
        </p>
        <button className="ghost" onClick={() => voice.say(desc.spoken, true)}>
          {voice.speaking ? "Reading…" : "Read aloud"}
        </button>
      </div>
      <p className="described-lead">{desc.headline}</p>
      <p>{desc.againstYou}</p>
      {desc.detail.length > 0 && (
        <ul>
          {desc.detail.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
      {desc.unknown.length > 0 && (
        <p className="described-unknown">{desc.unknown.join(" ")}</p>
      )}
    </div>
  );
}

/**
 * THE DRAPING SCRUB.
 *
 * The sitter stays pinned; scrolling walks the garment up their own ranking,
 * worst colour to best. Every frame is a real YouCam try-on render generated
 * ahead of time, so the whole interaction costs no units at view time and
 * cannot fail while someone is looking at it.
 *
 * Only shown when a pre-rendered sequence exists for this sitter. Someone who
 * uploaded their own photograph gets the clickable rail instead — we will not
 * fake this with a CSS tint.
 */
function DrapingScrub({
  frames,
  profile,
  voice,
  bodyPhoto,
}: {
  frames: { slug: string; title: string; hex: string; src: string; score: GarmentScore }[];
  profile: ColourProfile;
  voice: Voice;
  bodyPhoto?: string | null;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(0);
  /** Which view of the garment the plate is showing: worn, or as a solid. */
  const [solid, setSolid] = useState(false);
  /** The rail's frames are stacked by opacity, so the plate cannot simply be
      wrapped for zooming - it gets an explicit control for the current one. */
  const [zoomed, setZoomed] = useState(false);

  // Preload every frame before the stage can be scrolled through. Decoding is
  // the expensive part of a scroll sequence, and doing it mid-scroll stutters.
  useEffect(() => {
    let alive = true;
    frames.forEach((f) => {
      const img = new Image();
      img.onload = img.onerror = () => alive && setReady((n) => n + 1);
      img.src = f.src;
    });
    return () => {
      alive = false;
    };
  }, [frames]);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = stageRef.current;
        if (!el) return;
        const travel = el.offsetHeight - window.innerHeight;
        if (travel <= 0) return;
        const raw = Math.min(1, Math.max(0, -el.getBoundingClientRect().top / travel));
        // Reach the final frame at 90% of travel, not at exactly 100%. A linear
        // mapping makes the best colour exist only at p === 1, which sub-pixel
        // rounding and elastic scrolling never quite deliver - so their best
        // colour was unreachable. Landing early also lets it hold while you
        // scroll out, which is the note the section should end on.
        const p = Math.min(1, raw / 0.9);
        setIndex(Math.min(frames.length - 1, Math.floor(p * frames.length * 0.999)));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [frames.length]);

  const current = frames[index];
  const loading = ready < frames.length;

  return (
    <div
      ref={stageRef}
      className="scrub-stage"
      /*
       * About a third of a screen of travel per colour - roughly three wheel
       * notches, which reads as flipping swatches rather than trudging.
       *
       * The cap matters more than the constant: travel scaled linearly with a
       * frame count we don't control, and going from 9 colours to 14 pushed the
       * section to eleven screens and buried everything below it.
       */
      style={{ height: `${Math.min(100 + frames.length * 34, 580)}vh` }}
    >
      <div className="scrub-pin">
        {/* The plate holds BOTH views of the garment - worn, and as an object.
            Stacked below the picture the turntable was 344px in a 621px column,
            which put it permanently below the fold on a 13" laptop; sharing the
            frame costs no vertical space and makes the better argument anyway,
            because the two views are of the same thing. */}
        <div className="scrub-plate">
          {frames.map((f, i) => (
            <img
              key={f.slug}
              src={f.src}
              alt={i === index ? `The sitter wearing ${f.title}` : ""}
              className={i === index && !solid ? "on" : ""}
              aria-hidden={i !== index || solid}
            />
          ))}
          {solid && <Turntable hex={current.hex} title={current.title} />}
          {zoomed && !solid && (
            <Lightbox
              src={current.src}
              alt={`The sitter wearing ${current.title}`}
              caption={`${current.title} — ${current.hex.toUpperCase()}, scored ${current.score.score.toFixed(1)} out of 10. Generated by YouCam AI Clothes Virtual Try-On.`}
              onClose={() => setZoomed(false)}
            />
          )}
          <div className="plate-toggle" role="group" aria-label="How to view this garment">
            <button
              onClick={() => setSolid(false)}
              aria-pressed={!solid}
              className={!solid ? "on" : ""}
            >
              Worn
            </button>
            <button onClick={() => setSolid(true)} aria-pressed={solid} className={solid ? "on" : ""}>
              Turn it
            </button>
            {!solid && <button onClick={() => setZoomed(true)}>Enlarge</button>}
          </div>
        </div>

        <div>
          <p className="eyebrow" style={{ margin: 0 }}>
            {loading ? (
              <>
                <span className="spinner" style={{ marginRight: "0.5rem" }} />
                Preparing {ready} of {frames.length}
              </>
            ) : (
              <>
                Colour {index + 1} of {frames.length}
              </>
            )}
          </p>
          <h3 className="display scrub-name">{current.title}</h3>

          <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", marginTop: "1.5rem" }}>
            <span className="display scrub-score">{current.score.score.toFixed(1)}</span>
            <span className="data muted" style={{ fontSize: "0.75rem" }}>
              / 10
            </span>
            <span
              className="data"
              style={{
                marginLeft: "auto",
                fontSize: "0.625rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                border: "1px solid var(--ink)",
                padding: "0.3rem 0.6rem",
              }}
            >
              {current.score.verdict}
            </span>
          </div>

          <div className="scrub-bar">
            <i style={{ transform: `scaleX(${current.score.score / 10})` }} />
          </div>

          <dl className="readout" style={{ margin: 0 }}>
            <div>
              <dt>Colour</dt>
              <dd>
                <span className="chip" style={{ background: current.hex }} />
                {current.hex}
              </dd>
            </div>
            <div>
              <dt>Nearest in palette</dt>
              <dd>
                <span className="chip" style={{ background: current.score.nearestPaletteHex }} />
                ΔE {current.score.deltaE.toFixed(0)}
              </dd>
            </div>
          </dl>

          <div className="scrub-ticks" aria-hidden="true">
            {frames.map((f, i) => (
              <span key={f.slug} className={i <= index ? "on" : ""} style={{ background: f.hex }} />
            ))}
          </div>

          <p className="scrub-hint">
            <b>↓</b>
            {index < frames.length - 1 ? "Keep scrolling — it gets better" : "Their best colour"}
          </p>

          {/* The same garment, in words. Present on the main surface rather
              than behind a separate accessible page. */}
          <Described
            hex={current.hex}
            profile={profile}
            voice={voice}
            originalSrc={bodyPhoto ?? undefined}
            renderSrc={current.src}
          />
        </div>
      </div>
    </div>
  );
}

function TheRail({
  scan,
  bodyPhoto,
  sitterId,
  voice,
}: {
  scan: ScanResult;
  bodyPhoto?: string | null;
  sitterId?: string;
  voice: Voice;
}) {
  const [rail, setRail] = useState<RailItem[] | null>(null);
  const [tryOns, setTryOns] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [scrubSlugs, setScrubSlugs] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/rail/rail.json")
      .then((r) => r.json())
      .then(setRail)
      .catch(() => setErr("The house rail couldn't be loaded."));
  }, []);

  // Pre-rendered try-on sequence, if one exists for this sitter. Absent for
  // anyone who uploaded their own photograph — they get the clickable rail.
  useEffect(() => {
    if (!sitterId) {
      setScrubSlugs([]);
      return;
    }
    fetch(`/scrub/${sitterId}/frames.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((s) => setScrubSlugs(Array.isArray(s) ? s : []))
      .catch(() => setScrubSlugs([]));
  }, [sitterId]);

  // Each colour is declared, not sampled, so scoring is exact and instant.
  const ranked = useMemo(() => {
    if (!rail) return [];
    return rail
      .map((item) => ({ item, score: scoreGarment(item.hex, scan.profile) }))
      .sort((a, b) => b.score.score - a.score.score);
  }, [rail, scan.profile]);

  /** Worst colour first, so scrolling climbs towards their best. */
  const scrubFrames = useMemo(() => {
    if (!rail || !scrubSlugs?.length || !sitterId) return [];
    const bySlug = new Map(rail.map((r) => [r.thumb.split("/").pop()!.replace(".jpg", ""), r]));
    return scrubSlugs
      .map((slug) => {
        const item = bySlug.get(slug);
        if (!item) return null;
        return {
          slug,
          title: item.title,
          hex: item.hex,
          src: `/scrub/${sitterId}/${slug}.jpg`,
          score: scoreGarment(item.hex, scan.profile),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.score.score - b!.score.score) as {
      slug: string; title: string; hex: string; src: string; score: GarmentScore;
    }[];
  }, [rail, scrubSlugs, sitterId, scan.profile]);

  const hang = useCallback(
    async (item: RailItem) => {
      if (!bodyPhoto) return;
      setBusyId(item.id);
      setErr(null);
      try {
        const [personBase64, garmentBase64] = await Promise.all([
          bodyPhoto.startsWith("data:") ? Promise.resolve(bodyPhoto) : toDataUri(bodyPhoto),
          toDataUri(item.thumb),
        ]);
        const r = await fetch("/api/tryon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personBase64,
            garmentBase64,
            category: "upper_body",
            cacheKey: sitterId ? `${sitterId}-${item.id}` : undefined,
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "The try-on failed.");
        setTryOns((t) => ({ ...t, [item.id]: j.imageUrl }));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "The try-on failed.");
      } finally {
        setBusyId(null);
      }
    },
    [bodyPhoto, sitterId],
  );

  return (
    <section className="section" id="rail">
      <div className="section-head">
        <h2>The house rail</h2>
        <span className="idx">One cut, fourteen colours · ranked for you</span>
      </div>

      <p className="lede" style={{ marginBottom: "2rem" }}>
        This is draping itself: the same garment, over and over, in colours chosen to span warm to
        cool and light to deep. Only the colour changes — so the ranking is entirely about you.
        {scrubFrames.length >= 3 && " Scroll, and watch it change on them."}
      </p>

      {err && (
        <div className="notice" role="alert">
          <strong>That didn&apos;t work</strong>
          {err}
        </div>
      )}

      {/* Pre-rendered sitters get the scrub; everyone else gets the clickable rail. */}
      {scrubFrames.length >= 3 ? (
        <>
          <DrapingScrub frames={scrubFrames} profile={scan.profile} voice={voice} bodyPhoto={bodyPhoto} />
          {/* The scrub is strictly sequential, so the one question a shopper
              actually asks - is this better than that? - had no answer anywhere.
              Here they sit next to each other. */}
          <div className="compare" data-reveal>
            {[scrubFrames[scrubFrames.length - 1], scrubFrames[0]].map((f, i) => (
              <figure key={f.slug}>
                <Zoomable
                  src={f.src}
                  alt={`The sitter wearing ${f.title}`}
                  caption={`${f.title} — scored ${f.score.score.toFixed(1)} out of 10 against this sitter's measured palette.`}
                >
                  <img src={f.src} alt={`The sitter wearing ${f.title}`} />
                </Zoomable>
                <figcaption>
                  <span className="meta">{i === 0 ? "Their best" : "Their worst"}</span>
                  <span className="verdict-line">
                    <strong>{f.title}</strong>
                    <span>
                      {f.score.score.toFixed(1)}
                      <small>/10</small>
                    </span>
                  </span>
                  <span className="meta">
                    {f.hex} {f.score.verdict} · ΔE {f.score.deltaE.toFixed(0)}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="lede" style={{ marginTop: "1.5rem" }}>
            Same body, same light, same photograph — {scrubFrames.length} colours apart. Everything
            deciding which is which was measured from their face, not chosen by eye.
          </p>
        </>
      ) : (
      <div className="gallery" data-reveal>
        {ranked.map(({ item, score }) => {
          const shown = tryOns[item.id];
          return (
            <div key={item.id} className="exhibit" style={{ cursor: "default" }}>
              <div className="frame">
                {shown ? (
                  <Zoomable
                    src={shown}
                    alt={`${item.title}, hung on the sitter`}
                    caption={`${item.title} — generated by YouCam AI Clothes Virtual Try-On.`}
                  >
                    <img src={shown} alt={`${item.title}, hung on the sitter`} />
                  </Zoomable>
                ) : (
                  <img src={item.thumb} alt={item.title} />
                )}
              </div>
              <div className="label">
                <div className="label-row">
                  <span className="title">{item.title}</span>
                  <span className="score">
                    {score.score.toFixed(1)}
                    <small>/10</small>
                  </span>
                </div>
                <span className="meta">
                  {item.hex} {score.verdict} · ΔE {score.deltaE.toFixed(0)}
                </span>
                {shown && <span className="meta">Hung on the sitter · YouCam VTO</span>}
                {bodyPhoto && !shown && (
                  <button
                    className="ghost"
                    style={{ marginTop: "0.6rem", width: "100%" }}
                    disabled={busyId === item.id}
                    onClick={() => hang(item)}
                  >
                    {busyId === item.id ? (
                      <>
                        <span className="spinner" />
                        Hanging
                      </>
                    ) : (
                      "Hang it on me · 2 units"
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </section>
  );
}

function TheGallery({
  scan,
  bodyPhoto,
  sitterId,
}: {
  scan: ScanResult;
  bodyPhoto?: string | null;
  sitterId?: string;
}) {
  const [items, setItems] = useState<CatalogueItem[] | null>(null);
  const [scores, setScores] = useState<Record<string, GarmentScore>>({});
  const [tryOns, setTryOns] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [scoring, setScoring] = useState(true);

  useEffect(() => {
    fetch("/api/catalogue")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setItems(j.items);
      })
      .catch((e) => setErr(e.message ?? "The catalogue couldn't be loaded."));
  }, []);

  // Scoring every piece is free — it is our own colour maths, not an API call.
  useEffect(() => {
    if (!items) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, GarmentScore> = {};
      const failed: string[] = [];
      for (const item of items) {
        try {
          const c = await extractGarmentColour(item.thumb);
          next[item.id] = scoreGarment(c.hex, scan.profile);
        } catch {
          // Never silently drop a piece: a shorter gallery must not be mistaken
          // for a complete one. The count is surfaced below.
          failed.push(item.title);
        }
        if (cancelled) return;
      }
      if (!cancelled) {
        setScores(next);
        setSkipped(failed);
        setScoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items, scan.profile]);

  const ranked = useMemo(
    () =>
      (items ?? [])
        .filter((i) => scores[i.id])
        .sort((a, b) => scores[b.id].score - scores[a.id].score),
    [items, scores],
  );

  const hang = useCallback(
    async (item: CatalogueItem) => {
      if (!bodyPhoto) return;
      setBusyId(item.id);
      setErr(null);
      try {
        const personBase64 = bodyPhoto.startsWith("data:") ? bodyPhoto : await toDataUri(bodyPhoto);
        const r = await fetch("/api/tryon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personBase64,
            templateId: item.id,
            category: "full_body",
            cacheKey: sitterId,
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "The try-on failed.");
        setTryOns((t) => ({ ...t, [item.id]: j.imageUrl }));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "The try-on failed.");
      } finally {
        setBusyId(null);
      }
    },
    [bodyPhoto, sitterId],
  );

  return (
    <section className="section" id="gallery">
      <div className="section-head">
        <h2>From the collection</h2>
        <span className="idx">
          {ranked.length
            ? `${ranked.length} YouCam pieces · hung best first`
            : "Ranked for your palette"}
        </span>
      </div>

      {err && (
        <div className="notice" role="alert">
          <strong>That didn&apos;t work</strong>
          {err}
        </div>
      )}

      {(!items || scoring) && !err && (
        <p className="working">
          <span className="spinner" />
          {items ? `Reading colour — ${Object.keys(scores).length} of ${items.length}` : "Hanging the gallery"}
        </p>
      )}

      {skipped.length > 0 && (
        <div className="notice">
          <strong>{skipped.length} pieces not hung</strong>
          We couldn&apos;t read a single dominant colour from {skipped.join(", ")} — they&apos;re
          left out of the ranking rather than scored on a guess.
        </div>
      )}

      <div className="gallery" data-reveal>
        {ranked.map((item) => {
          const s = scores[item.id];
          const shown = tryOns[item.id];
          return (
            <div key={item.id} className="exhibit" style={{ cursor: "default" }}>
              <div className="frame">
                {shown ? (
                  <Zoomable
                    src={shown}
                    alt={`${item.title}, hung on the sitter`}
                    caption={`${item.title} — generated by YouCam AI Clothes Virtual Try-On.`}
                  >
                    <img src={shown} alt={`${item.title}, hung on the sitter`} />
                  </Zoomable>
                ) : (
                  <img src={item.thumb} alt={item.title} />
                )}
              </div>
              <div className="label">
                <div className="label-row">
                  <span className="title">{item.title}</span>
                  <span className="score">{s.score.toFixed(1)}</span>
                </div>
                <span className="meta">
                  {item.category} {s.verdict} · ΔE {s.deltaE.toFixed(0)}
                </span>
                {shown && <span className="meta">Hung on the sitter · YouCam VTO</span>}
                {bodyPhoto && !shown && (
                  <button
                    className="ghost"
                    style={{ marginTop: "0.6rem", width: "100%" }}
                    disabled={busyId === item.id}
                    onClick={() => hang(item)}
                  >
                    {busyId === item.id ? (
                      <>
                        <span className="spinner" />
                        Hanging
                      </>
                    ) : (
                      "Hang it on me · 2 units"
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function YourOwnPiece({
  scan,
  bodyPhoto,
  sitterId,
  voice,
}: {
  scan: ScanResult;
  bodyPhoto?: string | null;
  sitterId?: string;
  voice: Voice;
}) {
  const [garment, setGarment] = useState<string | null>(null);
  const [colour, setColour] = useState<{ hex: string; patterned: boolean } | null>(null);
  const [result, setResult] = useState<GarmentScore | null>(null);
  const [tryOn, setTryOn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const judge = useCallback(
    async (uri: string) => {
      setErr(null);
      setTryOn(null);
      setGarment(uri);
      try {
        const c = await extractGarmentColour(uri);
        setColour(c);
        setResult(scoreGarment(c.hex, scan.profile));
      } catch (e) {
        setColour(null);
        setResult(null);
        setErr(e instanceof Error ? e.message : "That garment couldn't be read.");
      }
    },
    [scan.profile],
  );

  const hang = useCallback(async () => {
    if (!garment || !bodyPhoto) return;
    setBusy(true);
    setErr(null);
    try {
      const personBase64 = bodyPhoto.startsWith("data:") ? bodyPhoto : await toDataUri(bodyPhoto);
      const r = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personBase64,
          garmentBase64: garment,
          category: "upper_body",
          cacheKey: sitterId,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "The try-on failed.");
      setTryOn(j.imageUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The try-on failed.");
    } finally {
      setBusy(false);
    }
  }, [garment, bodyPhoto, sitterId]);

  return (
    <section className="section" id="own">
      <div className="section-head" data-reveal>
        <h2>Bring your own piece</h2>
        <span className="idx">Anything, from anywhere</span>
      </div>

      <p className="lede" style={{ marginBottom: "2rem" }}>
        A product photo, a screenshot from a shop, something already in your basket. Drape reads
        its colour and judges it against your measurements — then hangs it on you.
      </p>

      <FileButton label="Choose a garment" onFile={judge} />

      {err && (
        <div className="notice" role="alert">
          <strong>That didn&apos;t work</strong>
          {err}
        </div>
      )}

      {garment && result && colour && (
        <div className="sitting" style={{ marginTop: "2.5rem" }}>
          <div className="drape-frame">
            <div className="drape-plate">
              {tryOn ? (
                <Zoomable
                  src={tryOn}
                  alt="The garment hung on you"
                  caption="Generated by YouCam AI Clothes Virtual Try-On. Hue is held to about five degrees; lightness may vary."
                >
                  <img src={tryOn} alt="The garment hung on you" />
                </Zoomable>
              ) : (
                <img src={garment} alt="The garment" />
              )}
            </div>
            <div className="label">
              <div className="label-row">
                <span className="title">{tryOn ? "Hung on you" : "As supplied"}</span>
                <span className="score">{colour.hex}</span>
              </div>
              <span className="meta">
                {tryOn ? "YouCam AI Clothes VTO · hue held to ~5°" : "Dominant colour, background removed"}
              </span>
            </div>
          </div>

          <div>
            <div className="verdict">
              <b className="display">{result.score.toFixed(1)}</b>
              <span className="of">/ 10</span>
              <span className="tag">{result.verdict}</span>
            </div>

            <dl className="readout" style={{ marginTop: "1.5rem" }}>
              <div>
                <dt>Garment</dt>
                <dd>
                  <span className="chip" style={{ background: colour.hex }} />
                  {colour.hex}
                </dd>
              </div>
              <div>
                <dt>Nearest in palette</dt>
                <dd>
                  <span className="chip" style={{ background: result.nearestPaletteHex }} />
                  {result.nearestPaletteHex.toUpperCase()}
                </dd>
              </div>
              <div>
                <dt>Difference</dt>
                <dd>ΔE {result.deltaE.toFixed(1)}</dd>
              </div>
            </dl>

            {colour.patterned && (
              <p className="data" style={{ fontSize: "0.6875rem", color: "var(--pencil)", marginTop: "0.75rem" }}>
                Patterned — judged on its dominant colour alone.
              </p>
            )}

            <ul className="reasons">
              {result.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>

            <Described
              hex={colour.hex}
              profile={scan.profile}
              voice={voice}
              originalSrc={bodyPhoto ?? undefined}
              renderSrc={tryOn ?? undefined}
              patterned={colour.patterned}
            />

            {bodyPhoto ? (
              <button onClick={hang} disabled={busy || !!tryOn} style={{ marginTop: "1.75rem" }}>
                {busy ? (
                  <>
                    <span className="spinner" />
                    Hanging
                  </>
                ) : tryOn ? (
                  "Hung"
                ) : (
                  "Hang it on me · 2 units"
                )}
              </button>
            ) : (
              <div className="notice" style={{ marginTop: "1.75rem" }}>
                <strong>One more photograph</strong>
                Add a full-length shot in the sitting above and this piece can be hung on you, not
                just scored.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

async function toDataUri(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("That photograph couldn't be read.");
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("That photograph couldn't be read."));
    fr.readAsDataURL(blob);
  });
}
