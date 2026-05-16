"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"

export default function SettingsPage() {

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Personalize a aparência e o comportamento da aplicação.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
          <CardDescription>
            Customize a interface para se adequar ao seu estilo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Mudar Tema</p>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
