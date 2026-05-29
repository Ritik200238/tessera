import { AdminPanel } from "@/components/admin-panel";

export const metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-[color:var(--color-muted-foreground)] max-w-2xl">
          The documented mitigation when the agent is unreachable. The owner or agent address can
          trigger manual liquidations and the emergency pause. Non-privileged callers see a
          read-only positions table with CSV export (TDD §5.2 / G2).
        </p>
      </header>
      <AdminPanel />
    </div>
  );
}
