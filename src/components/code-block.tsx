"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  const ref = React.useRef<HTMLPreElement>(null)

  return (
    <div
      className={cn("relative rounded-lg bg-muted font-sans", className)}
      {...props}
    >
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Code</span>
        </div>
        <CopyButton value={ref.current?.innerText ?? ""} />
      </div>
      <div className="overflow-x-auto p-4 pt-0">
        <pre ref={ref} className="text-sm">
          {children}
        </pre>
      </div>
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const [hasCopied, setHasCopied] = React.useState(false)

  const onCopy = () => {
    navigator.clipboard.writeText(value)
    setHasCopied(true)
    setTimeout(() => setHasCopied(false), 2000)
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={onCopy}
          >
            {hasCopied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
            <span className="sr-only">Copy</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy code</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
