"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        // `pb-1.5` gives every form field breathing room between the label
        // and the input (padding, not margin — margin would collapse against
        // the parent's space-y-* sibling gap). `leading-tight` restores a small
        // line-height buffer that `leading-none` had killed.
        "flex items-center gap-2 pb-1.5 text-sm leading-tight font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
