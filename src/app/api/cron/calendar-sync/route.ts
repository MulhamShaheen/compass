import { timingSafeEqual } from "node:crypto";
import { syncAllCalendars } from "@/lib/calendar/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Calendar sync is not configured.", { status: 503 });
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const totals = await syncAllCalendars();
    return Response.json(totals, { status: totals.failed ? 502 : 200 });
  } catch {
    return new Response("Calendar sync is unavailable.", { status: 503 });
  }
}
