import { redirect } from "next/navigation";
import { AdminLogin } from "@/components/AdminLogin";
import { hasExplicitAdminPin, isAdminCookieAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminCookieAuthenticated()) {
    redirect("/admin");
  }

  return <AdminLogin pinConfigured={hasExplicitAdminPin()} />;
}
