"use client";

/*
 * PaletteCard — the thing the client keeps.
 *
 * A real colour-analysis session ends with a physical fan of swatches that
 * lives in a handbag and gets held up against a rail in a shop. Ours ended
 * with a closed browser tab. This draws the whole result to a canvas at phone
 * proportions (1080x1440, i.e. 3:4) and hands it over as a PNG.
 *
 * Two rules govern the drawing, inherited from globals.css:
 *
 * 1. The card is achromatic apart from the measured colours themselves. Every
 *    chromatic pixel belongs to the user's palette, never to the brand.
 * 2. No colour carries meaning on its own — every swatch prints its own hex,
 *    so the card survives being photocopied, screenshotted in greyscale, or
 *    read by someone who does not see the difference between two of them.
 *
 * The canvas is opaque to assistive technology, so the same information is
 * also emitted as real DOM text below it. The canvas is the souvenir; the
 * list is the record.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import "./palette-card.css";

/* Card geometry, in CSS pixels. Backing store is scaled by devicePixelRatio. */
const CARD_W = 1080;
const CARD_H = 1440;
const MARGIN = 76;
const FRAME = 40;
const RIGHT = CARD_W - MARGIN;
const COL_W = RIGHT - MARGIN;

/* Gallery neutrals, matching the --wall / --ink / --hairline tokens. */
const GROUND = "#F3F3F3";
const INK = "#101010";
const HAIRLINE = "#D8D6D2";
const PENCIL = "#8C8C8C";

const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "ui-monospace, Menlo, Consolas, monospace";
const SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif";

export type PaletteCardProps = {
  seasonName: string;
  blurb: string;
  best: string[];
  metal: { best: "gold" | "silver" | null; sentence: string; hex: string };
  lips: { name: string; hex: string; score: number }[];
  skinHex: string;
  ita: number;
  undertone: string;
  contrast: string;
};

/* ---------------------------------------------------------------- helpers */

/**
 * Letter-spaced text, drawn character by character.
 *
 * ctx.letterSpacing exists but only in recent Chrome and Safari; a tracked
 * label silently collapsing to untracked elsewhere would change the whole
 * feel of the card, so this walks the string instead.
 */
function trackedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return text.length > 0 ? w - spacing : 0;
}

function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
): void {
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacing;
  }
}

/** Shrink a font until the string fits `maxWidth`. Returns the size used. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  family: string,
  weight: string,
  startSize: number,
  minSize: number,
): number {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

/** Greedy wrap, capped at `maxLines`; the last line is ellipsised if needed. */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line.length === 0 ? word : `${line} ${word}`;
    if (ctx.measureText(next).width <= maxWidth || line.length === 0) {
      line = next;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line.length > 0) lines.push(line);
  if (lines.length === maxLines && line.length > 0 && !lines.includes(line)) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

function rule(ctx: CanvasRenderingContext2D, y: number): void {
  ctx.fillStyle = HAIRLINE;
  ctx.fillRect(MARGIN, y, COL_W, 1);
}

function label(ctx: CanvasRenderingContext2D, text: string, y: number): void {
  ctx.fillStyle = PENCIL;
  ctx.font = `500 17px ${MONO}`;
  drawTracked(ctx, text.toUpperCase(), MARGIN, y, 3.2);
}

/**
 * A measured colour. Always stroked with a hairline: a swatch close to the
 * near-white ground would otherwise have no edge at all.
 */
function chip(
  ctx: CanvasRenderingContext2D,
  hex: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = hex;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function metalWord(best: "gold" | "silver" | null): string {
  if (best === "gold") return "Gold";
  if (best === "silver") return "Silver";
  return "Either";
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "palette";
}

/* ------------------------------------------------------------------ paint */

function paint(ctx: CanvasRenderingContext2D, p: PaletteCardProps): void {
  const lips = p.lips.slice(0, 3);
  const palette = p.best.slice(0, 12);

  ctx.clearRect(0, 0, CARD_W, CARD_H);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  /* Ground and frame. */
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(FRAME + 0.5, FRAME + 0.5, CARD_W - FRAME * 2 - 1, CARD_H - FRAME * 2 - 1);

  /* Masthead. */
  ctx.fillStyle = PENCIL;
  ctx.font = `500 18px ${MONO}`;
  drawTracked(ctx, "DRAPE", MARGIN, 88, 6);
  const stamp = "COLOUR ANALYSIS";
  const stampW = trackedWidth(ctx, stamp, 3);
  drawTracked(ctx, stamp, RIGHT - stampW, 88, 3);

  /* Season. */
  const seasonSize = fitFont(ctx, p.seasonName, COL_W, SERIF, "400", 88, 40);
  ctx.fillStyle = INK;
  ctx.font = `400 ${seasonSize}px ${SERIF}`;
  ctx.fillText(p.seasonName, MARGIN, 150);

  /* Blurb — two lines at most; the card is a souvenir, not a report. */
  ctx.font = `400 25px ${SANS}`;
  ctx.fillStyle = "#3A3A3A";
  const blurbLines = wrapLines(ctx, p.blurb, COL_W, 2);
  blurbLines.forEach((line, i) => ctx.fillText(line, MARGIN, 268 + i * 34));

  rule(ctx, 372);

  /* The palette. One row, each swatch labelled with its own hex. */
  label(ctx, `The palette · ${palette.length} colours`, 404);
  const gap = 10;
  const cell = (COL_W - gap * (palette.length - 1)) / palette.length;
  palette.forEach((hex, i) => {
    const x = MARGIN + i * (cell + gap);
    chip(ctx, hex, x, 444, cell, 168);
    const text = hex.toUpperCase();
    const size = fitFont(ctx, text, cell, MONO, "400", 16, 9);
    ctx.fillStyle = "#5A5A5A";
    ctx.font = `400 ${size}px ${MONO}`;
    const tw = ctx.measureText(text).width;
    ctx.fillText(text, x + (cell - tw) / 2, 624);
  });

  rule(ctx, 672);

  /* Metal. */
  label(ctx, "Metal", 700);
  chip(ctx, p.metal.hex, MARGIN, 736, 60, 60);
  ctx.fillStyle = INK;
  ctx.font = `400 34px ${SERIF}`;
  ctx.fillText(metalWord(p.metal.best), MARGIN + 84, 734);
  ctx.fillStyle = "#5A5A5A";
  ctx.font = `400 21px ${SANS}`;
  const metalLines = wrapLines(ctx, p.metal.sentence, COL_W - 84, 1);
  ctx.fillText(metalLines[0] ?? "", MARGIN + 84, 776);
  ctx.fillStyle = "#5A5A5A";
  ctx.font = `400 15px ${MONO}`;
  ctx.fillText(p.metal.hex.toUpperCase(), MARGIN, 804);

  rule(ctx, 836);

  /* Lips, best first. Score printed so the ranking is never colour-only. */
  label(ctx, "Lip colour", 864);
  lips.forEach((lip, i) => {
    const y = 904 + i * 78;
    chip(ctx, lip.hex, MARGIN, y, 52, 52);
    ctx.fillStyle = INK;
    ctx.font = `400 25px ${SANS}`;
    const name = wrapLines(ctx, lip.name, COL_W - 76 - 190, 1)[0] ?? "";
    ctx.fillText(name, MARGIN + 76, y + 4);
    ctx.fillStyle = "#5A5A5A";
    ctx.font = `400 15px ${MONO}`;
    ctx.fillText(lip.hex.toUpperCase(), MARGIN + 76, y + 34);
    const score = lip.score.toFixed(2);
    ctx.fillStyle = INK;
    ctx.font = `400 22px ${MONO}`;
    ctx.fillText(score, RIGHT - ctx.measureText(score).width, y + 14);
  });

  rule(ctx, 1174);

  /* What was measured. Monospace, because these are readings. */
  label(ctx, "Measured", 1202);
  ctx.fillStyle = INK;
  ctx.font = `400 21px ${MONO}`;
  ctx.fillText(`SKIN ${p.skinHex.toUpperCase()}    ITA ${p.ita.toFixed(1)}°`, MARGIN, 1238);
  ctx.fillText(
    `UNDERTONE ${p.undertone.toUpperCase()}    CONTRAST ${p.contrast.toUpperCase()}`,
    MARGIN,
    1270,
  );

  rule(ctx, 1318);

  /* Colophon. */
  ctx.fillStyle = INK;
  ctx.font = `400 38px ${SERIF}`;
  ctx.fillText("Drape", MARGIN, 1338);
  ctx.fillStyle = PENCIL;
  ctx.font = `400 18px ${MONO}`;
  const tag = "MEASURED, NOT GUESSED";
  const tagW = trackedWidth(ctx, tag, 2.4);
  drawTracked(ctx, tag, RIGHT - tagW, 1352, 2.4);
}

/* -------------------------------------------------------------- component */

export function PaletteCard(props: PaletteCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<string>("");

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(CARD_W * dpr);
    canvas.height = Math.round(CARD_H * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    paint(ctx, props);
  }, [props]);

  useEffect(() => {
    render();
    /*
     * Georgia and the system monospace are local faces, so the first paint is
     * usually already correct — but if the browser is still resolving them the
     * measurements above would be taken against a fallback. Repaint once the
     * font set settles rather than trusting the first pass.
     */
    let live = true;
    const fonts: FontFaceSet | undefined = document.fonts;
    if (fonts) {
      fonts.ready.then(() => {
        if (live) render();
      }).catch(() => {
        /* Font loading is advisory here; the first paint already stands. */
      });
    }
    return () => {
      live = false;
    };
  }, [render]);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStatus("Preparing your card…");
    canvas.toBlob((blob) => {
      if (!blob) {
        setStatus("The card could not be rendered. Try again, or screenshot the preview.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `drape-${slug(props.seasonName)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus("Saved as a PNG to your downloads.");
    }, "image/png");
  }, [props.seasonName]);

  const lips = props.lips.slice(0, 3);
  const ariaLabel =
    `Palette card for ${props.seasonName}. ${props.best.length} palette colours, ` +
    `metal ${metalWord(props.metal.best).toLowerCase()}, ` +
    `${lips.length} lip colours, skin ${props.skinHex}, ITA ${props.ita.toFixed(1)} degrees, ` +
    `${props.undertone} undertone, ${props.contrast} contrast. ` +
    `The same information is listed in text below.`;

  return (
    <section className="palette-card" aria-labelledby="palette-card-heading">
      <div className="palette-card__intro">
        <h2 id="palette-card-heading" className="palette-card__heading">
          Take your palette with you
        </h2>
        <p className="palette-card__lede">
          A studio session ends with a fan of swatches in your bag. This one ends with a card you
          can hold up against a rail.
        </p>
      </div>

      <div className="palette-card__stage">
        <canvas
          ref={canvasRef}
          className="palette-card__canvas"
          role="img"
          aria-label={ariaLabel}
        />
      </div>

      <div className="palette-card__actions">
        <button type="button" className="palette-card__button" onClick={download}>
          Download the card (PNG)
        </button>
        <p className="palette-card__status" role="status">
          {status}
        </p>
      </div>

      {/*
        The canvas is a single opaque bitmap to a screen reader, so everything
        printed on it is repeated here as real text. This is the record; the
        canvas is only the souvenir.
      */}
      <dl className="palette-card__record">
        <dt>Season</dt>
        <dd>
          {props.seasonName} — {props.blurb}
        </dd>
        <dt>Palette</dt>
        <dd>
          <ul>
            {props.best.map((hex, i) => (
              <li key={`${hex}-${i}`}>{hex.toUpperCase()}</li>
            ))}
          </ul>
        </dd>
        <dt>Metal</dt>
        <dd>
          {metalWord(props.metal.best)} ({props.metal.hex.toUpperCase()}) — {props.metal.sentence}
        </dd>
        <dt>Lip colours, best first</dt>
        <dd>
          <ol>
            {lips.map((lip, i) => (
              <li key={`${lip.hex}-${i}`}>
                {lip.name}, {lip.hex.toUpperCase()}, score {lip.score.toFixed(2)}
              </li>
            ))}
          </ol>
        </dd>
        <dt>Measured</dt>
        <dd>
          Skin {props.skinHex.toUpperCase()}, ITA {props.ita.toFixed(1)} degrees,{" "}
          {props.undertone} undertone, {props.contrast} contrast.
        </dd>
      </dl>
    </section>
  );
}

export default PaletteCard;
