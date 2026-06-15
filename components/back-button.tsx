"use client"

import { usePathname, useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"

// Shown on every in-app page except the dashboard. Uses real back navigation
// when there's history, falling back to the dashboard on a direct landing.
const BackButton = () => {
  const pathname = usePathname()
  const router = useRouter()

  if (pathname === "/dashboard") return null

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
    } else {
      router.push("/dashboard")
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Go back"
      className="btn-outline !px-3 !py-2 text-xs"
    >
      <ChevronLeft className="size-4" /> Back
    </button>
  )
}

export default BackButton
