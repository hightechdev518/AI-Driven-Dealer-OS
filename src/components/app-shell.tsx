import { Sidebar } from "@/components/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:pl-64">
        <div className="min-h-screen px-4 pb-8 pt-20 lg:px-8 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
