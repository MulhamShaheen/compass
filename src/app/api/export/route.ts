import { loadDb, SignedOutError } from "@/lib/db/store";
import { calendarStore } from "@/lib/calendar/store";

export const dynamic = "force-dynamic";

/** All of the character's data as JSON. Points are not included: they are always computed from checkpoints. */
export async function GET() {
  try {
    const { dev: _dev, ...data } = await loadDb();
    void _dev;
    const calendar = await (await calendarStore()).load();
    return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), ...data, calendar }, null, 2), {
      headers: {
        "cache-control": "private, no-store",
        "content-type": "application/json",
        "content-disposition": `attachment; filename="compass-export.json"`,
      },
    });
  } catch (e) {
    if (e instanceof SignedOutError) return new Response("Sign in to export your data.", { status: 401 });
    throw e;
  }
}
