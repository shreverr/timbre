import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <DashboardSidebar userEmail={user.email ?? ""} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
