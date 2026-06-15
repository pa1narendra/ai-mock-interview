"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Share2, Check, Copy } from "lucide-react"
import { toggleReportShare } from "@/lib/actions/reports"

const ShareReportButton = ({ reportId, initialShareId }: { reportId: string; initialShareId: string | null }) => {
  const [shareId, setShareId] = useState<string | null>(initialShareId)
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = shareId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/shared/${shareId}`
    : ""

  async function toggle() {
    setPending(true)
    const res = await toggleReportShare(reportId)
    setPending(false)
    if (!res.success) {
      toast.error("Could not update sharing. Please try again.")
      return
    }
    setShareId(res.shareId ?? null)
    toast.success(res.shareId ? "Public link created" : "Sharing turned off")
  }

  async function copy() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    toast.success("Link copied")
    setTimeout(() => setCopied(false), 2000)
  }

  if (!shareId) {
    return (
      <button className="btn-outline" onClick={toggle} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />} Share
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 max-sm:flex-col">
      <button className="btn-outline" onClick={copy}>
        {copied ? <Check className="size-4 text-spark-400" /> : <Copy className="size-4" />} Copy link
      </button>
      <button className="text-xs text-mist-500 hover:text-alert-400" onClick={toggle} disabled={pending}>
        {pending ? "..." : "Stop sharing"}
      </button>
    </div>
  )
}

export default ShareReportButton
