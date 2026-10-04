import { Prologue } from "@/components/prologue/Prologue";
import { loadDbOrLogin } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export default async function ProloguePage() {
  // No redirect when already written: finishing the Prologue refreshes this page,
  // and the closing "Your story starts today" moment must stay on screen.
  return (
    <main className="prologue">
      <Prologue alreadyWritten={!!(await loadDbOrLogin()).profile?.prologueCompletedAt} />
    </main>
  );
}
