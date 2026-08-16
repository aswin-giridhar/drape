import { describe, expect, it } from "vitest";
import { buildProfile, classifySeason, scoreGarment, SEASONS } from "./palette";
import { deltaE2000, hexToLab, ita, undertoneFromLab } from "./colour";

/**
 * person_b, from the real API responses captured in fixtures/api/.
 * skin/eye/lip are the API's own values; hair is corrected because the API
 * returned "#FAF0BE (Blonde)" for a subject with clearly dark brown hair -
 * see the spec, section 2, rule 8.
 */
const PERSON_B = {
  skinHex: "#ae8a6f",
  hairHex: "#3A2A22",
  eyeHex: "#1e181c",
  lipHex: "#e6818a",
  rednessRaw: 93.5,
};

describe("colour primitives", () => {
  it("matches the independently measured ITA for person_b", () => {
    // Our pixel-level measurement of the API's own resize_image gave L*56.6 -> ITA 26.2
    const angle = ita(hexToLab(PERSON_B.skinHex));
    expect(angle).toBeGreaterThan(15);
    expect(angle).toBeLessThan(40);
  });

  it("separates a known-warm from a known-cool skin tone", () => {
    const warm = undertoneFromLab(hexToLab("#D2A679")); // golden
    const cool = undertoneFromLab(hexToLab("#D8A0A6")); // pink
    expect(warm.ratio).toBeGreaterThan(cool.ratio);
    expect(warm.undertone).toBe("warm");
    expect(cool.undertone).toBe("cool");
  });

  it("deltaE2000 is zero for identical colours and large for opposites", () => {
    expect(deltaE2000(hexToLab("#123456"), hexToLab("#123456"))).toBeCloseTo(0, 5);
    expect(deltaE2000(hexToLab("#000000"), hexToLab("#FFFFFF"))).toBeGreaterThan(90);
  });
});

describe("season classification", () => {
  it("assigns person_b a season with a named runner-up", () => {
    const p = buildProfile(PERSON_B);
    const m = classifySeason(p);
    expect(SEASONS.map((s) => s.name)).toContain(m.season.name);
    expect(m.runnerUp.name).not.toBe(m.season.name);
    // eslint-disable-next-line no-console
    console.log(
      `person_b -> ${m.season.name} (runner-up ${m.runnerUp.name}, confidence ${m.confidence.toFixed(2)})`,
      `| ITA ${p.ita.toFixed(1)} depth ${p.depth} undertone ${p.undertone} (${p.undertoneRatio.toFixed(2)}) contrast ${p.contrast}`,
    );
  });
});

describe("THE GATE: garment scoring must separate", () => {
  const p = buildProfile(PERSON_B);
  const m = classifySeason(p);

  /**
   * HELD-OUT colours. Scoring the palette anchors against themselves is
   * tautological (deltaE 0 -> score 10) and cannot fail, so it proves nothing.
   * These are chosen by colour theory for a warm / light / clear person and
   * deliberately appear in NO season's `best` array.
   */
  const HELD_OUT_FLATTERING = ["#F08A5D", "#E9B44C", "#7FB069", "#EFA00B"]; // warm, clear
  const HELD_OUT_CLASHING = ["#4C516D", "#7A6C7D", "#495057", "#5C6B73"]; // cool, muted, deep

  it("separates held-out flattering from held-out clashing colours", () => {
    const anchors = new Set(SEASONS.flatMap((s) => [...s.best, ...s.avoid].map((h) => h.toUpperCase())));
    for (const h of [...HELD_OUT_FLATTERING, ...HELD_OUT_CLASHING]) {
      expect(anchors.has(h.toUpperCase()), `${h} must not be a palette anchor`).toBe(false);
    }

    const flattering = HELD_OUT_FLATTERING.map((h) => scoreGarment(h, p).score);
    const clashing = HELD_OUT_CLASHING.map((h) => scoreGarment(h, p).score);
    const minFlat = Math.min(...flattering);
    const maxClash = Math.max(...clashing);
    // eslint-disable-next-line no-console
    console.log(
      `HELD-OUT separation for ${m.season.name}: worst flattering ${minFlat.toFixed(2)} vs best clashing ${maxClash.toFixed(2)}`,
    );
    expect(minFlat).toBeGreaterThan(maxClash);
  });

  it("gives a clearly wrong colour a low verdict", () => {
    // whichever season, something from the opposite corner must score badly
    const opposite = SEASONS.find(
      (s) => Math.sign(s.temp) !== Math.sign(m.season.temp) && Math.abs(s.value - m.season.value) > 0.3,
    );
    expect(opposite).toBeDefined();
    const worst = Math.min(...opposite!.best.map((h) => scoreGarment(h, p).score));
    expect(worst).toBeLessThan(6.5);
  });

  it("is STABLE: ranking does not flip under a small threshold change", () => {
    // Re-score with the redness cutoff nudged either side of its value.
    const probe = ["#8AA9C1", "#BC6C25", "#000000", "#FFE5B4", "#0077B6", "#A5A58D"];
    const rank = (redness: number) =>
      probe
        .map((h) => ({ h, s: scoreGarment(h, { ...p, rednessRaw: redness }).score }))
        .sort((a, b) => b.s - a.s)
        .map((x) => x.h);

    const base = rank(93.5);
    const lower = rank(88);
    const higher = rank(98);
    // eslint-disable-next-line no-console
    console.log("ranking @93.5:", base.join(" > "));
    expect(lower).toEqual(base);
    expect(higher).toEqual(base);
  });

  it("penalises red-adjacent hues only when redness is actually elevated", () => {
    const calmSkin = { ...p, rednessRaw: 95 };
    const redSkin = { ...p, rednessRaw: 55 };
    const warmRed = "#D34E24";
    const calm = scoreGarment(warmRed, calmSkin).score;
    const red = scoreGarment(warmRed, redSkin).score;
    // eslint-disable-next-line no-console
    console.log(`red-adjacent hue: calm skin ${calm.toFixed(2)} vs red skin ${red.toFixed(2)}`);
    expect(red).toBeLessThan(calm);
  });
});
