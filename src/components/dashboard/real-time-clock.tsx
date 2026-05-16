"use client"

import * as React from "react"
import { format } from "date-fns"
import { ptBR } from 'date-fns/locale'

export function RealTimeClock() {
  const [date, setDate] = React.useState(new Date())

  React.useEffect(() => {
    const timerId = setInterval(() => {
      setDate(new Date())
    }, 1000)

    return () => clearInterval(timerId)
  }, [])

  const formattedDate = format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const formattedTime = format(date, "HH:mm:ss");


  return (
    <div className="hidden items-center gap-2 text-sm font-medium md:flex">
      <span>{formattedDate}</span>
      <span className="text-muted-foreground">{formattedTime}</span>
    </div>
  )
}
