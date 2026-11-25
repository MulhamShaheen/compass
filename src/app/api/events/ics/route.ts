import { loadDb, SignedOutError } from "@/lib/db/store";
import { eventCalendar } from "@/lib/events/ics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { events } = await loadDb();
    const id = new URL(request.url).searchParams.get("id");
    const selected = id === null ? events : events.filter((event) => event.id === id);
    if (id !== null && !selected.length) return new Response("Event not found.", { status: 404 });
    return new Response(eventCalendar(selected), {
      headers: {
        "cache-control": "private, no-store",
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="compass-events.ics"',
      },
    });
  } catch (error) {
    if (error instanceof SignedOutError) return new Response("Sign in to export events.", { status: 401 });
    throw error;
  }
}
