import { buildSample } from "@/lib/dev/sample";

/** Fixed clock used to compare against numbers produced by the HTML prototype. */
export const SAMPLE_NOW = new Date("2026-10-02T12:00:00Z");
export const SAMPLE_TZ = "UTC";

export function sample() {
  return buildSample(SAMPLE_NOW, SAMPLE_TZ);
}
