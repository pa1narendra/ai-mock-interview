"use client"

import { useEffect } from "react"
import { Download } from "lucide-react"

// Opens the print dialog (Save as PDF). While printing, the page switches to
// the light theme (a dark PDF wastes ink and reads badly) and the title is
// swapped for a descriptive name, since browsers name the PDF after it.
// The listeners also cover Ctrl+P on the report page.
const PrintButton = ({ fileName }: { fileName?: string }) => {
  useEffect(() => {
    const root = document.documentElement
    let printing = false
    let wasDark = false
    let originalTitle = ""
    // beforeprint can fire more than once per print; only the first one
    // records the state to restore.
    const before = () => {
      if (printing) return
      printing = true
      wasDark = root.classList.contains("dark")
      root.classList.remove("dark")
      originalTitle = document.title
      if (fileName) document.title = fileName
    }
    const after = () => {
      if (!printing) return
      printing = false
      if (wasDark) root.classList.add("dark")
      document.title = originalTitle
    }
    window.addEventListener("beforeprint", before)
    window.addEventListener("afterprint", after)
    return () => {
      window.removeEventListener("beforeprint", before)
      window.removeEventListener("afterprint", after)
    }
  }, [fileName])

  return (
    <button className="btn-outline" onClick={() => window.print()}>
      <Download className="size-4" /> Download PDF
    </button>
  )
}

export default PrintButton
