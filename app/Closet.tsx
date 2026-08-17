"use client";

import { useCallback, useState } from "react";
import { extractGarmentColour } from "@/lib/garment";
import { scoreGarment, type ColourProfile, type GarmentScore } from "@/lib/palette";
import { nameColour } from "@/lib/describe";

/**
 * The wardrobe audit.
 *
 * "What should I buy" is the question a shop asks you. "Is the coat I already
 * own doing me any favours" is the question you ask yourself, far more often,
 * and nothing answers it.
 *
 * This is the same machinery as a single garment judgement, run over a pile of
 * them and then sorted into three piles a person can act on. Every part of it
 * runs in the browser: the dominant colour comes off a canvas, the score is our
 * own maths. NO API CALLS, NO UNITS - which is what makes auditing thirty things
 * reasonable when auditing one with a try-on would not be.
 *
 * The verdict bands are the ones `scoreGarment` already uses, not new numbers
 * invented for this screen. A second set of thresholds over the same score is
 * how a product ends up disagreeing with itself.
 */

interface Piece {
  id: string;
  name: string;
  src: string;
  hex: string;
  patterned: boolean;
  score: GarmentScore;
}

type Pile = "keep" | "restyle" | "rehome";

/** Bands taken from the existing verdicts so the two can never diverge. */
function pileFor(s: GarmentScore): Pile {
  if (s.verdict === "great" || s.verdict === "good") return "keep";
  if (s.verdict === "risky") return "restyle";
  return "rehome";
}

const PILES: { key: Pile; title: string; note: string }[] = [
  { key: "keep", title: "Keep", note: "These sit in your palette. Wear them near your face." },
  {
    key: "restyle",
    title: "Wear it further away",
    note: "Not wrong, but not doing you favours at the neckline. Below the waist, or with your colours on top.",
  },
  {
    key: "rehome",
    title: "Let it go",
    note: "These fight your colouring. If you love one, keep it away from your face entirely.",
  },
];

export function Closet({ profile }: { profile: ColourProfile }) {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [busy, setBusy] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);

  const add = useCallback(
    async (files: FileList) => {
      const list = Array.from(files).slice(0, 24);
      setBusy(list.length);
      const bad: string[] = [];

      for (const file of list) {
        try {
          const src = await new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result as string);
            fr.onerror = () => reject(new Error("unreadable"));
            fr.readAsDataURL(file);
          });
          const colour = await extractGarmentColour(src);
          const score = scoreGarment(colour.hex, profile);
          setPieces((p) => [
            ...p,
            {
              id: `${file.name}-${p.length}`,
              name: file.name.replace(/\.[^.]+$/, ""),
              src,
              hex: colour.hex,
              patterned: colour.patterned,
              score,
            },
          ]);
        } catch {
          // Name the ones that failed. A pile that silently loses items is worse
          // than one that admits it dropped them.
          bad.push(file.name);
        } finally {
          setBusy((n) => n - 1);
        }
      }
      if (bad.length) setFailed((f) => [...f, ...bad]);
    },
    [profile],
  );

  const grouped = PILES.map((p) => ({
    ...p,
    items: pieces.filter((x) => pileFor(x.score) === p.key).sort((a, b) => b.score.score - a.score.score),
  }));

  return (
    <section className="section" id="closet">
      <div className="section-head">
        <h2>Your wardrobe</h2>
        <span className="idx">No units · nothing leaves your device</span>
      </div>

      <p style={{ maxWidth: "52ch", marginTop: 0 }}>
        The question people actually ask is not what to buy, it is whether the coat they already
        own is doing them any favours. Photograph what is in your wardrobe and find out. Colour is
        read in your browser and scored against your measurements, so this costs nothing and no
        photograph is uploaded anywhere.
      </p>

      <label className="filebtn" style={{ background: "var(--ink)", color: "var(--wall)" }}>
        Add up to 24 pieces
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-file"
          onChange={(e) => {
            if (e.target.files?.length) add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      <p className="status-line" role="status" aria-live="polite">
        {busy > 0
          ? `Reading ${busy} more…`
          : pieces.length > 0
            ? `${pieces.length} pieces audited. ${grouped[0].items.length} to keep, ${grouped[1].items.length} to wear further from your face, ${grouped[2].items.length} to let go.`
            : "Nothing audited yet."}
      </p>

      {failed.length > 0 && (
        <div className="notice">
          <strong>Couldn&apos;t read these</strong>
          {failed.join(", ")} — they were skipped rather than guessed at.
        </div>
      )}

      {pieces.length > 0 && (
        <div className="piles">
          {grouped.map((pile) => (
            <div key={pile.key} className="pile">
              <div className="pile-head">
                <h3>{pile.title}</h3>
                <span className="data">{pile.items.length}</span>
              </div>
              <p className="pile-note">{pile.note}</p>
              {pile.items.length === 0 ? (
                <p className="pile-empty">Nothing here.</p>
              ) : (
                <ul className="pile-list">
                  {pile.items.map((it) => (
                    <li key={it.id}>
                      <img src={it.src} alt="" />
                      <div className="pile-meta">
                        <span className="pile-name">{it.name}</span>
                        <span className="data pile-colour">
                          <span className="chip" style={{ background: it.hex }} />
                          {nameColour(it.hex).name} {it.hex.toUpperCase()}
                          {it.patterned ? " · patterned" : ""}
                        </span>
                      </div>
                      <span className="pile-score">
                        {it.score.score.toFixed(1)}
                        <small>/10</small>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
