"use client"

import type { Advice } from "@/lib/advise"
import { cn } from "cn"

export function AdviceBlock({
  advice,
  compact,
}: {
  advice: Advice | null
  compact: boolean
}) {
  const pick = advice?.moves.find((move) => move.recommended) ?? null
  const switchPick = advice?.switches.find((option) => option.recommended) ?? null

  return (
    <>
      {switchPick && advice?.verdict === "switch" ? (
        <div className="mt-1.5">
          <p className="text-[20px] font-bold leading-none text-black">Send {switchPick.name}</p>
          <p className="mt-1.5 text-[12px] text-black">{pick ? `Then click ${pick.name}.` : switchPick.reason}</p>
        </div>
      ) : pick ? (
        <div className="mt-1.5">
          <p className="text-[20px] font-bold leading-none text-black">{pick.name}</p>
          <p className="mt-1.5 text-[12px] text-black">
            {pick.type}. {pick.label}.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[13px] leading-5 text-black">{advice?.headline ?? "Type the Pokémon in front of you."}</p>
      )}

      {!compact && advice && advice.moves.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {advice.moves.map((move) => (
            <li key={`${move.id}-${move.type}`}>
              <div
                className={cn(
                  "flex items-baseline gap-2 rounded-none bg-white px-2.5 py-2 text-left text-black",
                  move.recommended ? "border-2 border-blue-600 bg-blue-100" : "border-2 border-black",
                )}
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{move.name}</span>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-black">{move.label}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}
