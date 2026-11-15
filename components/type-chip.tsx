import { TYPE_STYLE } from "@/lib/types"
import { cn } from "cn"

export function TypeChip({
  type,
  factor,
  className,
}: {
  type: string
  factor?: number
  className?: string
}) {
  const style = TYPE_STYLE[type] ?? { bg: "#444", fg: "#fff" }
  const multiplier = factor == null ? null : factor === 4 ? "4×" : factor === 2 ? "2×" : factor === 0 ? "0" : null
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tracking-wide", className)}
      style={{ background: style.bg, color: style.fg }}
    >
      {type}
      {multiplier ? <span className="font-bold">{multiplier}</span> : null}
    </span>
  )
}
