"use client";

import * as React from "react";
import { Loader2, Save, Unlock, Lock, Truck } from "lucide-react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const DAYS_OF_WEEK = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];

export default function DeliveryLockPage() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [limits, setLimits] = React.useState<Record<string, number | null>>({});
  const [activeDays, setActiveDays] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const fetchLimits = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, "deliveryLimits", "config");
        const docSnap = await getDoc(docRef);

        const initialLimits: Record<string, number | null> = {};
        const initialActive: Record<string, boolean> = {};

        DAYS_OF_WEEK.forEach(day => {
          initialLimits[day] = null;
          initialActive[day] = false;
        });

        if (docSnap.exists()) {
          const data = docSnap.data();
          DAYS_OF_WEEK.forEach(day => {
            if (data[day] !== undefined && data[day] !== null) {
              initialLimits[day] = data[day];
              initialActive[day] = true;
            }
          });
        }

        setLimits(initialLimits);
        setActiveDays(initialActive);
      } catch (error) {
        console.error("Error fetching delivery limits:", error);
        toast({ title: "Erro ao carregar configurações", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchLimits();
  }, [toast]);

  const handleLimitChange = (day: string, value: string) => {
    const parsed = parseInt(value, 10);
    setLimits(prev => ({ ...prev, [day]: isNaN(parsed) ? 0 : parsed }));
  };

  const handleToggleDay = (day: string, checked: boolean) => {
    setActiveDays(prev => ({ ...prev, [day]: checked }));
    if (checked && (limits[day] === null || limits[day] === undefined)) {
      setLimits(prev => ({ ...prev, [day]: 0 }));
    }
  };

  const handleSave = async () => {
    try {
      setIsSubmitting(true);
      const dataToSave: Record<string, any> = { updatedAt: serverTimestamp() };
      
      DAYS_OF_WEEK.forEach(day => {
        if (activeDays[day]) {
          dataToSave[day] = limits[day] || 0;
        } else {
          dataToSave[day] = null; // Removido/ilimitado
        }
      });

      await setDoc(doc(db, "deliveryLimits", "config"), dataToSave, { merge: true });
      
      toast({ title: "Configurações salvas com sucesso!" });
    } catch (error) {
      console.error("Error saving limits:", error);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-10">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
          <Truck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bloqueio de Entregas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure o limite diário de entregas por dia da semana.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Capacidade de Transporte</CardTitle>
          <CardDescription>
            Ative os dias em que deseja limitar a quantidade e informe o número máximo de entregas.
            Dias desativados não terão limite na aba de pedido de venda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {DAYS_OF_WEEK.map((day) => {
              const isActive = activeDays[day];
              return (
                <div 
                  key={day} 
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border gap-4 transition-colors",
                    isActive ? "bg-muted/30 border-primary/20 shadow-sm" : "bg-card"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <Switch 
                      checked={isActive} 
                      onCheckedChange={(c) => handleToggleDay(day, c)} 
                    />
                    <div className="flex items-center gap-2">
                      {isActive ? <Lock className="h-4 w-4 text-primary" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
                      <Label className={cn("font-medium text-base", !isActive && "text-muted-foreground")}>
                        {day}
                      </Label>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:w-1/3">
                    <Label className={cn(!isActive && "opacity-50")}>Limite:</Label>
                    <Input
                      type="number"
                      min="0"
                      value={limits[day] !== null ? limits[day] : ""}
                      onChange={(e) => handleLimitChange(day, e.target.value)}
                      disabled={!isActive}
                      className={cn("text-right font-medium", !isActive && "opacity-50")}
                      placeholder="Ilimitado"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
        <CardFooter className="bg-muted/20 border-t justify-end p-6">
          <Button onClick={handleSave} disabled={isSubmitting} size="lg" className="min-w-[150px]">
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                Salvar Limites
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
      
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 flex gap-3 text-blue-800 dark:text-blue-300">
        <div className="mt-0.5"><Truck className="h-5 w-5" /></div>
        <p className="text-sm leading-relaxed">
          <strong>Como funciona:</strong> Ao tentar agendar uma entrega na aba <em>Pedido de Venda</em>, o sistema contará 
          quantos pedidos (não cancelados) já existem para aquela data. Se a soma total atingir o limite configurado aqui, 
          não será possível selecionar a data no calendário.
        </p>
      </div>
    </div>
  );
}
