"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import dayjs from "dayjs"
import { FileText, Trash2, Loader2 } from "lucide-react"
import { deleteMyResume } from "@/lib/actions/resumes"

const ProfileResume = ({ meta }: { meta: { fileName: string; updatedAt: string } | null }) => {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  if (!meta) {
    return (
      <p className="text-sm text-mist-500">
        No resume saved yet. Upload one when you create a &quot;Target a job&quot; interview and it&apos;ll be
        saved here and reused automatically.
      </p>
    )
  }

  async function handleDelete() {
    if (!confirm("Delete your saved resume? Future interviews won't use it until you upload again.")) return
    setPending(true)
    const res = await deleteMyResume()
    if (res.success) {
      toast.success("Resume deleted")
      router.refresh()
    } else {
      toast.error("Could not delete your resume.")
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-mist-100">
          <FileText className="size-4 text-spark-300" /> {meta.fileName}
          <span className="text-mist-500">· updated {dayjs(meta.updatedAt).format("MMM D, YYYY")}</span>
        </span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          aria-label="Delete resume"
          className="rounded-full border border-white/10 p-2 text-mist-500 transition-colors hover:border-alert-400/40 hover:text-alert-400 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
      </div>
      <p className="text-xs text-mist-500">
        To replace it, upload a new PDF when creating your next targeted interview.
      </p>
    </div>
  )
}

export default ProfileResume
