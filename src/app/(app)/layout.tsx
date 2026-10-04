import { redirect } from "next/navigation";
import { BootScreen } from "@/components/bits";
import { DevBar } from "@/components/DevBar";
import { Header, Nav } from "@/components/Header";
import { loadDbOrLogin } from "@/lib/db/store";
import { buildHeader } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const db = await loadDbOrLogin();
  if (!db.profile?.prologueCompletedAt) redirect("/prologue");
  const header = buildHeader(db);
  return (
    <div className="wrap">
      <BootScreen name={header.name} level={header.level.level} day={header.dayNumber} />
      <Header view={header} />
      <Nav reviewUnlocked={header.reviewUnlocked} />
      {children}
      <DevBar dayNumber={header.dayNumber} dayOffset={header.dayOffset} todayLabel={header.todayLabel} />
    </div>
  );
}
