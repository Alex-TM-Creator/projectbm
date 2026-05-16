
"use client";

import * as React from "react";
import { Save, Loader2, FileText } from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function AdditionalObservationsPage() {
  const { toast } = useToast();
  const [observation, setObservation] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    const fetchGlobalObservation = async () => {
      try {
        const docRef = doc(db, "settings", "globalObservations");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setObservation(docSnap.data().text || "");
        }
      } catch (error) {
        console.error("Error fetching global observation:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGlobalObservation();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "settings", "globalObservations"), {
        id: 'globalObservations',
        text: observation
      }, { merge: true });
      toast({ title: "Observação Salva!", description: "Este texto aparecerá na impressão de todos os pedidos." });
    } catch (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
          <FileText /> Observações Adicionais (Global)
        </h1>
        <p className="text-muted-foreground">
          O texto inserido aqui aparecerá no final da impressão de TODOS os pedidos de venda.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Texto para Impressão</CardTitle>
          <CardDescription>Esta observação é fixa e aparecerá em todos os documentos impressos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Ex: Não aceitamos devoluções sem etiqueta. Prazo de garantia: 90 dias."
            rows={10}
          />
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2"/>}
            Salvar Observação Global
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
