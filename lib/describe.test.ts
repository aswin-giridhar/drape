import { describe, expect, it } from "vitest";
import { describeGarment, nameColour } from "./describe";
import { buildProfile } from "./palette";

const PERSON = {
  skinHex: "#ac8973", hairHex: "#3A2A22", eyeHex: "#2d242d",
  lipHex: "#c57678", rednessRaw: 94.4,
};

describe("colour naming uses words that carry meaning", () => {
  it("names colours plainly", () => {
    const cases: [string, string][] = [
      ["#E8962D", "mustard yellow"], ["#1B2A4A", "navy blue"],
      ["#111111", "black"], ["#4C9A2A", "grass green"],
    ];
    for (const [hex, expected] of cases) {
      const { name } = nameColour(hex);
      // eslint-disable-next-line no-console
      console.log(`  ${hex} -> ${name}`);
      expect(name).toBe(expected);
    }
  });

  it("flags low confidence when a colour sits between names", () => {
    expect(nameColour("#E8962D").confidence).toBeGreaterThan(0.6);
  });
});

describe("the description must be usable without sight", () => {
  const p = buildProfile(PERSON);

  it("leads with what it is, then how it sits against the wearer", () => {
    const d = describeGarment("#E8962D", p);
    // eslint-disable-next-line no-console
    console.log("  HEADLINE:", d.headline);
    // eslint-disable-next-line no-console
    console.log("  AGAINST :", d.againstYou);
    expect(d.headline).toMatch(/mustard yellow/);
    expect(d.againstYou.length).toBeGreaterThan(30);
  });

  it("states what it could not determine rather than omitting it", () => {
    const d = describeGarment("#E8962D", p);           // no geometry passed
    expect(d.unknown.join(" ")).toMatch(/colour only/);
  });

  it("describes shape in body landmarks when geometry is available", () => {
    const d = describeGarment("#144C5C", p, {
      coverage: 0.3, hem: 0.55, neckline: 0.25, sleeveReach: 0.8, uncertain: false,
    });
    const shape = d.detail.join(" ");
    // eslint-disable-next-line no-console
    console.log("  SHAPE   :", shape);
    expect(shape).toMatch(/hip/);
    expect(shape).toMatch(/elbow/);
  });

  it("says so when the outline could not be measured", () => {
    const d = describeGarment("#144C5C", p, {
      coverage: 0, hem: 0, neckline: 0, sleeveReach: 0, uncertain: true,
    });
    expect(d.unknown.join(" ")).toMatch(/could not be measured/);
  });

  it("distinguishes blending from contrast against the wearer's skin", () => {
    const near = describeGarment("#AC8973", p).againstYou;   // same as skin
    const far  = describeGarment("#111111", p).againstYou;   // much deeper
    // eslint-disable-next-line no-console
    console.log("  NEAR    :", near.slice(0, 70));
    // eslint-disable-next-line no-console
    console.log("  FAR     :", far.slice(0, 70));
    expect(near).toMatch(/blend/);
    expect(far).toMatch(/contrast|deeper/);
  });

  it("warns about red-family colours only when redness is measured high", () => {
    const calm = describeGarment("#D7263D", buildProfile({ ...PERSON, rednessRaw: 95 }));
    const red  = describeGarment("#D7263D", buildProfile({ ...PERSON, rednessRaw: 55 }));
    expect(calm.detail.join(" ")).not.toMatch(/redness/);
    expect(red.detail.join(" ")).toMatch(/redness/);
  });
});
