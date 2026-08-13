"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2, Loader2 } from "lucide-react"
import { deleteInterview } from "@/lib/actions/interviews"

const DeleteInterviewButton = ({ id }: { id: string }) => {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    if (!confirm("Delete this interview and its reports? This can't be undone.")) return
    setPending(true)
    const res = await deleteInterview(id)
    if (res.success) {
      toast.success("Interview deleted")
      router.refresh()
    } else {
      toast.error("Could not delete the interview.")
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      aria-label="Delete interview"
      className="rounded-full border border-border bg-surface/80 p-2 text-muted-foreground backdrop-blur transition-colors hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  )
}

export default DeleteInterviewButton
