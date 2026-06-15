"use client"

import { Download } from "lucide-react"

const PrintButton = () => (
  <button className="btn-outline" onClick={() => window.print()}>
    <Download className="size-4" /> Download PDF
  </button>
)

export default PrintButton
