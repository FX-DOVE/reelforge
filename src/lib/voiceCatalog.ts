/**
 * Character voices are pitch/tempo shapes on one Meta MMS-TTS voice (facebook/mms-tts-*),
 * not third-party neural voices. Legacy Edge-style ids still map here so older projects keep a stable shape.
 */
export interface VoiceShape {
  id: string;
  label: string;
  pitch: number;
  tempo: number;
}

export const VOICES: VoiceShape[] = [
  { id: "mms-narrator", label: "Narrator · warm", pitch: 0.93, tempo: 1 },
  { id: "mms-bright", label: "Bright · clear", pitch: 1.16, tempo: 1.02 },
  { id: "mms-doc", label: "Documentary · steady", pitch: 0.9, tempo: 0.98 },
  { id: "mms-calm", label: "Calm · measured", pitch: 1.08, tempo: 0.98 },
  { id: "mms-ng-m", label: "Nigeria · male", pitch: 0.88, tempo: 1 },
  { id: "mms-ng-f", label: "Nigeria · female", pitch: 1.14, tempo: 1 },
  { id: "mms-ad", label: "Ad read · direct", pitch: 0.95, tempo: 1.03 },
  { id: "mms-friendly", label: "Friendly · light", pitch: 1.18, tempo: 1.02 },
  { id: "mms-ke-m", label: "Kenya · male", pitch: 0.86, tempo: 0.99 },
  { id: "mms-za-f", label: "South Africa · female", pitch: 1.12, tempo: 1 },
  { id: "mms-child", label: "Child · high", pitch: 1.32, tempo: 1.04 },
];

const LEGACY: Record<string, string> = {
  "en-US-AndrewNeural": "mms-narrator",
  "en-US-AriaNeural": "mms-bright",
  "en-GB-RyanNeural": "mms-doc",
  "en-GB-SoniaNeural": "mms-calm",
  "en-NG-AbeoNeural": "mms-ng-m",
  "en-NG-EzinneNeural": "mms-ng-f",
  "en-US-GuyNeural": "mms-ad",
  "en-US-JennyNeural": "mms-friendly",
  "en-KE-ChilembaNeural": "mms-ke-m",
  "en-ZA-LeahNeural": "mms-za-f",
  "en-US-AnaNeural": "mms-child",
};

export function canonicalVoice(id?: string): string {
  if (!id) return "mms-narrator";
  return LEGACY[id] || id;
}

export function voiceShape(id?: string): { pitch: number; tempo: number } {
  const canon = canonicalVoice(id);
  const row = VOICES.find((v) => v.id === canon);
  if (row) return { pitch: row.pitch, tempo: row.tempo };
  let h = 0;
  for (const c of canon) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const j = ((h % 7) - 3) * 0.012;
  return { pitch: +(0.96 + j).toFixed(3), tempo: +(1 + j / 2).toFixed(3) };
}

export const voiceLabel = (id?: string) => VOICES.find((v) => v.id === canonicalVoice(id))?.label || "Meta MMS";

/** espeak-ng (offline, not an AI model) uses this only to pick a formant. */
export const shapeIsFemale = (id?: string) =>
  /mms-(bright|calm|ng-f|friendly|za-f|child)|Aria|Sonia|Ezinne|Jenny|Leah|Ana|female/i.test(id || "");
