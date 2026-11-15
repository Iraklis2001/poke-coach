"use client"

export function TitleBar({
  title,
  level,
  compact,
  onClose,
  onToggleCompact,
}: {
  title: string
  level?: string
  compact: boolean
  onClose?: () => void
  onToggleCompact: () => void
}) {
  return (
    <header className="hud-drag flex items-center gap-2 border-b-2 border-black bg-[#e3350d] px-3 py-1.5" title="Drag to move">
      <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">{title}</p>
      {level ? <p className="text-[12px] font-bold text-white">{level}</p> : null}
      <div className="hud-nodrag flex items-center gap-2">
        <button type="button" className="text-[11px] font-bold text-white hover:text-yellow-200" onClick={onToggleCompact}>
          {compact ? "More" : "Less"}
        </button>
        {onClose ? (
          <button type="button" className="text-[12px] font-bold text-white hover:text-yellow-200" onClick={onClose}>
            ✕
          </button>
        ) : null}
      </div>
    </header>
  )
}
