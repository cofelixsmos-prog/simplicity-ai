import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getLatestHarnessRequest } from "@/lib/db/repo"
import { HarnessAccessGate } from "@/components/ui/harness/access-gate"
import { HarnessWorkspace } from "@/components/ui/harness/workspace"

export const metadata = { title: "Harness — Simplicity" }
export const dynamic = "force-dynamic"

export default async function HarnessPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  if (!user.harnessAccess) {
    const latest = await getLatestHarnessRequest(user.id)
    return (
      <HarnessAccessGate
        initialRequest={latest ? { status: latest.status as "pending" | "approved" | "denied", createdAt: latest.createdAt } : null}
      />
    )
  }

  return <HarnessWorkspace userName={user.name} />
}
