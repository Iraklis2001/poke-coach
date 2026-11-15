"use client"

import type { ReactNode } from "react"

export function PanelShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 overflow-hidden rounded-none border-2 border-black bg-[#f8f8f8] font-sans text-black antialiased-none [-webkit-font-smoothing:none]">
      {children}
    </div>
  )
}
