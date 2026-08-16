"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { extractGarmentColour } from "@/lib/garment";
import { scoreGarment, type ColourProfile, type GarmentScore } from "@/lib/palette";
import { labelFor } from "@/lib/skinzip";

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
}
interface Sitter {
  id: string;
  name: string;
  facePhoto: string;
  bodyPhoto: string;
  preset: string;
}

const SITTERS: Sitter[] = [
  {
    id: "person_b",
    name: "Sitting no. 1",
    facePhoto: "/models/person_b_face.jpg",
    bodyPhoto: "/models/person_b.jpg",
    preset: "/presets/person_b.json",
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
    liveGenerationAvailable?: boolean;
    unreachable?: boolean;
  } | null>(null);

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
        <div className="meter">
          {budget?.unreachable ? (
            <>
              <i className="off" />
              API unreachable
            </>
          ) : budget ? (
            <>
              <i className={budget.liveGenerationAvailable ? "" : "off"} />
              {budget.units?.toFixed(0)} units ·{" "}
              {budget.liveGenerationAvailable ? "live" : "paused"}
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
          <ColourCard scan={scan} portrait={sitter?.facePhoto ?? ownFace ?? undefined} />
          <TheGallery scan={scan} bodyPhoto={bodyPhoto} sitterId={sitter?.id} />
          <YourOwnPiece scan={scan} bodyPhoto={bodyPhoto} sitterId={sitter?.id} />
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
        <p className="eyebrow">Digital colour draping</p>
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
      <div className="section-head">
        <h2>The sitting</h2>
        <span className="idx">Choose a subject</span>
      </div>

      <div className="gallery">
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
              <span className="meta">Completed sitting · no units used</span>
            </div>
          </button>
        ))}

        <div style={{ gridColumn: "span 2", minWidth: 0 }}>
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
      <input
        type="file"
        accept="image/jpeg,image/png"
        hidden
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

function ColourCard({ scan, portrait }: { scan: ScanResult; portrait?: string }) {
  const { profile, season, skin, tone, warnings } = scan;
  const photo = portrait ?? skin?.normalisedFace;
  const [showAll, setShowAll] = useState(false);
  const rednessMask = skin?.masks?.redness;

  return (
    <section className="section" id="card">
      <div className="section-head">
        <h2>Your colour card</h2>
        <span className="idx">Measured, not guessed</span>
      </div>

      {warnings.map((w) => (
        <div className="notice" key={w.field}>
          <strong>{w.needsConfirmation ? "Please confirm" : "Worth knowing"}</strong>
          {w.message}
        </div>
      ))}

      <div className="sitting">
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
              Hover a panel to drape it · ITA angle, {profile.depth}, {profile.undertone}
            </span>
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
          </dl>

          <div style={{ marginTop: "2.5rem" }}>
            <p className="eyebrow">The verdict</p>
            <h3 className="display season">{season.name}</h3>
            <p style={{ margin: 0, color: "var(--graphite)", maxWidth: "40ch" }}>{season.blurb}</p>
            {season.confidence < 0.35 && (
              <p className="data" style={{ fontSize: "0.6875rem", color: "var(--pencil)", marginTop: "0.75rem" }}>
                Close to {season.runnerUp} — confidence {season.confidence.toFixed(2)}. Colours
                shared by both are safest.
              </p>
            )}

            <p className="eyebrow" style={{ marginTop: "2rem" }}>
              Your palette
            </p>
            <ul className="swatches">
              {season.best.map((hex) => (
                <li key={hex} style={{ background: hex }} data-hex={hex.toUpperCase()} />
              ))}
            </ul>
          </div>
        </div>
      </div>

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
        <h2>The gallery</h2>
        <span className="idx">
          {ranked.length ? `${ranked.length} pieces · hung best first` : "Ranked for your palette"}
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

      <div className="gallery">
        {ranked.map((item) => {
          const s = scores[item.id];
          const shown = tryOns[item.id];
          return (
            <div key={item.id} className="exhibit" style={{ cursor: "default" }}>
              <div className="frame">
                <img src={shown ?? item.thumb} alt={item.title} />
              </div>
              <div className="label">
                <div className="label-row">
                  <span className="title">{item.title}</span>
                  <span className="score">{s.score.toFixed(1)}</span>
                </div>
                <span className="meta">
                  {item.category} · {s.verdict} · ΔE {s.deltaE.toFixed(0)}
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
}: {
  scan: ScanResult;
  bodyPhoto?: string | null;
  sitterId?: string;
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
      <div className="section-head">
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
              <img src={tryOn ?? garment} alt={tryOn ? "The garment hung on you" : "The garment"} />
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
