import { readDb } from "@/lib/db/local-store";

export const dynamic = "force-dynamic";

/** All of the character's data as JSON. Points are not included: they are always computed from checkpoints. */
export function GET() {
  const { dev: _dev, ...data } = readDb();
  void _dev;
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="compass-export.json"`,
    },
  });
}
