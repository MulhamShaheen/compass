import { Prologue } from "@/components/prologue/Prologue";
import { readDb } from "@/lib/db/local-store";

export const dynamic = "force-dynamic";

export default function ProloguePage() {
  // No redirect when already written: finishing the Prologue refreshes this page,
  // and the closing "Your story starts today" moment must stay on screen.
  return (
    <main className="prologue">
      <Prologue alreadyWritten={!!readDb().profile?.prologueCompletedAt} />
    </main>
  );
}
