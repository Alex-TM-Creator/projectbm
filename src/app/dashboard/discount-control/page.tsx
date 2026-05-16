
"use client";

import * as React from "react";
import { Loader2, Save, Percent, Shield } from "lucide-react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { Role, DiscountLimit } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function DiscountControlPage() {
  const { toast } = useToast();
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [limits, setLimits] = React.useState<DiscountLimit[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [localLimits, setLocalLimits] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [rolesSnap, limitsSnap] = await Promise.all([
          getDocs(collection(db, "roles")),
          getDocs(collection(db, "discountLimits")),
        ]);
        
        const rolesList = rolesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Role));
        const limitsList = limitsSnap.docs.map(d => ({ id: d.id, ...d.data() } as DiscountLimit));

        setRoles(rolesList);
        setLimits(limitsList);

        const initialLocalLimits: Record<string, string> = {};
        rolesList.forEach(role => {
            const limit = limitsList.find(l => l.id === role.id);
            initialLocalLimits[role.id] = (limit?.maxDiscountPercentage || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        });
        setLocalLimits(initialLocalLimits);

      } catch (error) {
        toast({ title: "Erro ao carregar dados", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast]);
  
  const handlePercentageChange = (roleId: string, value: string) => {
    const onlyDigits = value.replace(/[^0-9]/g, '');
    if (onlyDigits === '') {
        setLocalLimits(prev => ({ ...prev, [roleId]: '' }));
        return;
    }

    const numericValue = parseInt(onlyDigits, 10) / 100;
    const formattedValue = numericValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    
    setLocalLimits(prev => ({ ...prev, [roleId]: formattedValue }));
  };

  const parseFormattedPercentage = (value: string): number => {
    if (!value) return 0;
    // Remove o ponto de milhar e troca a vírgula por ponto para o parseFloat
    return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
  };


  const handleSaveAll = async () => {
    setIsSaving(true);
    const batch = writeBatch(db);
    try {
      roles.forEach(role => {
        const docRef = doc(db, "discountLimits", role.id);
        const numericValue = parseFormattedPercentage(localLimits[role.id] ?? '0');
        const clampedValue = Math.max(0, Math.min(100, numericValue)); // Garante que o valor esteja entre 0 e 100
        
        batch.set(docRef, { id: role.id, maxDiscountPercentage: clampedValue });
      });
      await batch.commit();
      toast({ title: "Limites salvos!", description: "Os limites de desconto por função foram atualizados." });
      
      const limitsSnap = await getDocs(collection(db, "discountLimits"));
      const limitsList = limitsSnap.docs.map(d => ({ id: d.id, ...d.data() } as DiscountLimit));
      const newLocalLimits: Record<string, string> = {};
      roles.forEach(role => {
          const limit = limitsList.find(l => l.id === role.id);
          newLocalLimits[role.id] = (limit?.maxDiscountPercentage || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      });
      setLocalLimits(newLocalLimits);

    } catch (error) {
      toast({ title: "Erro ao salvar", description: "Não foi possível salvar os limites de desconto.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <Percent /> Controle de Desconto
          </h1>
          <p className="text-muted-foreground">
            Defina o percentual máximo de desconto que cada função pode aplicar.
          </p>
        </div>
        <Button onClick={handleSaveAll} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar Tudo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Limites de Desconto por Função</CardTitle>
          <CardDescription>
            Insira o valor máximo de desconto (%) que cada função pode conceder em um pedido. Pedidos que ultrapassarem este limite exigirão aprovação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Função</TableHead>
                  <TableHead className="w-[200px]">Limite de Desconto (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map(role => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>
                      <div className="relative">
                        <Input
                          type="text"
                          value={localLimits[role.id] || ''}
                          onChange={(e) => handlePercentageChange(role.id, e.target.value)}
                          className="pl-2 pr-8 text-right"
                          placeholder="0,00"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
