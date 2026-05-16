
"use client";

import * as React from "react";
import {
  collection,
  getDocs,
  query,
  limit,
  startAfter,
  orderBy,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Cake, Phone, Mail, RefreshCw, ChevronRight } from "lucide-react";
import type { Customer } from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const months = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const days = Array.from({ length: 31 }, (_, i) => ({
  value: (i + 1).toString().padStart(2, "0"),
  label: (i + 1).toString(),
}));

export default function BirthdayReportPage() {
  const { toast } = useToast();
  const [birthdays, setBirthdays] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isFetchingMore, setIsFetchingMore] = React.useState(false);
  const [lastVisible, setLastVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLastPage, setIsLastPage] = React.useState(false);
  
  const today = new Date();
  const [selectedDay, setSelectedDay] = React.useState<string>(today.getDate().toString().padStart(2, "0"));
  const [selectedMonth, setSelectedMonth] = React.useState<string>((today.getMonth() + 1).toString().padStart(2, "0"));

  const BATCH_SIZE = 500; 

  const fetchBirthdays = React.useCallback(async (cursor: QueryDocumentSnapshot<DocumentData> | null = null, reset = false) => {
    if (cursor) setIsFetchingMore(true);
    else setLoading(true);

    if (reset) {
        setBirthdays([]);
        setLastVisible(null);
        setIsLastPage(false);
    }

    try {
      const targetMonthDay = `${selectedMonth}-${selectedDay}`;

      const customersRef = collection(db, "customers");
      let q;
      
      if (cursor && !reset) {
        q = query(customersRef, orderBy("name"), startAfter(cursor), limit(BATCH_SIZE));
      } else {
        q = query(customersRef, orderBy("name"), limit(BATCH_SIZE));
      }

      const snapshot = await getDocs(q);
      
      const foundBirthdays = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Customer))
        .filter(customer => {
          if (!customer.birthDate) return false;
          // O formato da data no banco é YYYY-MM-DD. Comparamos apenas os índices 5 a 10 (MM-DD)
          return customer.birthDate.substring(5, 10) === targetMonthDay;
        });

      if (cursor && !reset) {
        setBirthdays(prev => [...prev, ...foundBirthdays]);
      } else {
        setBirthdays(foundBirthdays);
      }

      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      setLastVisible(lastDoc || null);
      setIsLastPage(snapshot.docs.length < BATCH_SIZE);

    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao carregar aniversariantes", variant: "destructive" });
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  }, [toast, selectedDay, selectedMonth]);

  React.useEffect(() => {
    fetchBirthdays(null, true);
  }, [selectedDay, selectedMonth, fetchBirthdays]);

  const formatPhoneNumber = (number: string) => {
    const cleaned = number.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
    }
    return number;
  };

  const selectedMonthLabel = months.find(m => m.value === selectedMonth)?.label;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <Cake className="text-primary" /> Aniversariantes
          </h1>
          <p className="text-muted-foreground">
            Clientes que celebram aniversário em {selectedDay} de {selectedMonthLabel}.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2">
                <Select value={selectedDay} onValueChange={setSelectedDay}>
                    <SelectTrigger className="w-20">
                        <SelectValue placeholder="Dia" />
                    </SelectTrigger>
                    <SelectContent>
                        {days.map(d => (
                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-36">
                        <SelectValue placeholder="Mês" />
                    </SelectTrigger>
                    <SelectContent>
                        {months.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Button variant="outline" size="icon" onClick={() => fetchBirthdays(null, true)} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resultados da Busca</CardTitle>
          <CardDescription>
            {birthdays.length > 0 
              ? `${birthdays.length} aniversariante(s) identificado(s) nos registros carregados.` 
              : "Nenhum aniversariante identificado nos registros carregados até agora."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !isFetchingMore ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome do Cliente</TableHead>
                      <TableHead>Telefones</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Dia/Mês</TableHead>
                      <TableHead>Documento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {birthdays.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium whitespace-nowrap">{customer.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {customer.phones.map((phone, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs whitespace-nowrap">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                {formatPhoneNumber(phone.number)}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2 text-xs">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {customer.email || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap font-semibold">
                            {customer.birthDate ? `${customer.birthDate.substring(8, 10)}/${customer.birthDate.substring(5, 7)}` : "N/A"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {customer.cpf || customer.cnpj || "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {birthdays.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                          Nenhum aniversariante encontrado nos registros analisados até o momento.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {!isLastPage && (
                <div className="flex justify-center pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => fetchBirthdays(lastVisible)} 
                    disabled={isFetchingMore}
                  >
                    {isFetchingMore ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronRight className="mr-2 h-4 w-4" />
                    )}
                    Analisar mais registros...
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
