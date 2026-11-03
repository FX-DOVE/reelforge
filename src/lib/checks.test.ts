import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stripScriptBoilerplate } from "./screenplay";
import { coerceAspect, fitDurations } from "./platform";
import { mediaSrc } from "./mediaSrc";
import { VOICES, canonicalVoice } from "./voiceCatalog";
import { decideQuota } from "./quota";
import { thirdPartyTtsAllowed } from "./providers/tts";

describe("screenplay boilerplate", () => {
  it("drops an empty title and the placeholder scene before the real title", () => {
    const raw = "\nTITLE:\n\nINT. LOCATION - DAY\n\nCUT TO:\n\nTITLE: The Name You Misspell\n\nINT. CAFE - DAY\nHana looks up.\n";
    const out = stripScriptBoilerplate(raw);
    assert.equal(out.startsWith("TITLE: The Name You Misspell"), true);
    assert.equal(out.includes("INT. LOCATION - DAY"), false);
  });

  it("keeps a real opening scene", () => {
    const raw = "TITLE: Real\n\nINT. KITCHEN - NIGHT\nA kettle boils.\n";
    assert.equal(stripScriptBoilerplate(raw), raw);
  });
});

describe("platform format", () => {
  it("refuses 16:9 for a YouTube Short", () => {
    assert.equal(coerceAspect("yt_shorts", "16:9"), "9:16");
    assert.equal(coerceAspect("yt_shorts", "1:1"), "1:1");
    assert.equal(coerceAspect("yt_long", "9:16"), "16:9");
  });

  it("caps a 66s short at 60s", () => {
    const fitted = fitDurations([8, 8, 8, 8, 8, 8, 8, 10], 60);
    const sum = fitted.reduce((a, b) => a + b, 0);
    assert.ok(sum <= 60.05, `sum ${sum}`);
    assert.ok(fitted.length >= 1);
  });
});

describe("media urls", () => {
  it("cache-busts app file urls once", () => {
    assert.equal(mediaSrc("/api/files/abc/a.png"), "/api/files/abc/a.png?v=2");
    assert.equal(mediaSrc("/api/files/abc/a.png?v=2"), "/api/files/abc/a.png?v=2");
    assert.equal(mediaSrc("https://cdn.example/a.png"), "https://cdn.example/a.png");
  });
});

describe("voices", () => {
  it("does not publish Edge neural ids", () => {
    for (const v of VOICES) {
      assert.equal(/neural|en-US-|en-NG-|en-GB-/i.test(v.id + v.label), false);
      assert.equal(v.id.startsWith("mms-"), true);
    }
    assert.equal(canonicalVoice("en-US-AndrewNeural"), "mms-narrator");
    assert.equal(canonicalVoice("mms-ng-f"), "mms-ng-f");
  });
});

describe("meta-only gates", () => {
  it("blocks third-party TTS while Meta-only is on", () => {
    assert.equal(thirdPartyTtsAllowed(true, "on"), false);
    assert.equal(thirdPartyTtsAllowed(true, undefined), false);
    assert.equal(thirdPartyTtsAllowed(false, "on"), true);
    assert.equal(thirdPartyTtsAllowed(false, "off"), false);
  });

  it("quota message trips at the cap and stays quiet under it", () => {
    assert.equal(decideQuota(40, 10, 40, 160)?.includes("Hourly"), true);
    assert.equal(decideQuota(10, 160, 40, 160)?.includes("Daily"), true);
    assert.equal(decideQuota(3, 3, 40, 160), null);
    assert.equal(decideQuota(100, 100, 0, 0), null);
  });
});
