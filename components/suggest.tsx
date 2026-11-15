"use client"

import { useId, useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "cn"

export type SuggestOption = {
  id: string
  label: string
  hint?: string
  group?: string
}

export function Suggest({
  label,
  selectedLabel,
  placeholder,
  options,
  onSelect,
}: {
  label: string
  selectedLabel: string
  placeholder: string
  options: (query: string) => SuggestOption[]
  onSelect: (id: string) => void
}) {
  const listId = useId()
  const [query, setQuery] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const text = query ?? selectedLabel
  const results = open ? options(query ?? "") : []
  const shown = results.slice(0, 12)

  function choose(id: string) {
    onSelect(id)
    setQuery(null)
    setOpen(false)
  }

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium tracking-wide text-muted-foreground" htmlFor={listId}>
        {label}
      </label>
      <Input
        id={listId}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${listId}-list`}
        aria-autocomplete="list"
        className="h-10 bg-background/70"
        placeholder={placeholder}
        value={text}
        onFocus={(event) => {
          setOpen(true)
          setActive(0)
          event.currentTarget.select()
        }}
        onBlur={() => {
          setOpen(false)
          setQuery(null)
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
          setActive(0)
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setOpen(true)
            setActive((index) => Math.min(shown.length - 1, index + 1))
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setActive((index) => Math.max(0, index - 1))
          } else if (event.key === "Enter" && open && shown[active]) {
            event.preventDefault()
            choose(shown[active].id)
          } else if (event.key === "Escape") {
            setOpen(false)
            setQuery(null)
          }
        }}
      />
      {open && shown.length > 0 ? (
        <ul
          id={`${listId}-list`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-popover p-1 shadow-xl"
        >
          {shown.map((option, index) => {
            const showGroup = option.group && option.group !== shown[index - 1]?.group
            return (
              <li key={`${option.group ?? ""}-${option.id}`} role="option" aria-selected={index === active}>
                {showGroup ? (
                  <p className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {option.group}
                  </p>
                ) : null}
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm",
                    index === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/70",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    choose(option.id)
                  }}
                >
                  <span className="font-medium">{option.label}</span>
                  {option.hint ? <span className="shrink-0 text-xs text-muted-foreground">{option.hint}</span> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
