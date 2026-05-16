
"use client";

import * as React from "react";
import {
  Loader2,
  Trophy,
  Award,
  Gem,
  Crown,
  RefreshCw,
  Users,
  DollarSign,
  Percent,
  Calendar as CalendarIcon,
  Frown,
  Send,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { SalesOrder, Driver, DeliveryAssistant, Service, DeliveryTeamPaymentOrder } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

type TeamMemberPayment = {
  id: string;
  name: string;
  type: 'Motorista' | 'Ajudante';
  participations: number;
  amountToReceive: number;
};

export default function DeliveryTeamPaymentPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [isCalculating, setIsCalculating] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [allOrders, setAllOrders] = React.useState<SalesOrder[]>([]);
  const [allServices, setAllServices] = React.useState<Service[]>([]);
  const [drivers, setDrivers] = React.useState<Driver[]>([]);
  const [assistants, setAssistants] = React.useState<DeliveryAssistant[]>([]);
  
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [companyCommission, setCompanyCommission] = React.useState<number>(10);
  const [teamPaymentResults, setTeamPaymentResults] = React.useState<TeamMemberPayment[]>([]);
  const [totalStairServiceValue, setTotalStairServiceValue] = React.useState(0);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [
        ordersSnap,
        servicesSnap,
        driversSnap,
        assistantsSnap,
      ] = await Promise.all([
        getDocs(query(collection(db, "salesOrders"), where("deliveryStatus", "==", "concluido"))),
        getDocs(collection(db, "services")),
        getDocs(query(collection(db, "drivers"))),
        getDocs(query(collection(db, "deliveryAssistants"))),
      ]);

      setAllOrders(ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SalesOrder)));
      setAllServices(servicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
      setDrivers(driversSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Driver)));
      setAssistants(assistantsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as DeliveryAssistant)));

    } catch (error) {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const calculatePayments = React.useCallback(() => {
    setIsCalculating(true);
    const { from, to } = dateRange || {};
    if (!from) {
        setIsCalculating(false);
        return;
    };

    const filteredOrders = allOrders.filter(order => {
      if (!order.deliveryDate) return false;
      const deliveryDate = parseISO(order.deliveryDate);
      return isWithinInterval(deliveryDate, { start: startOfDay(from), end: endOfDay(to || from) });
    });
    
    const stairService = allServices.find(s => s.name.toLowerCase().includes("subida de escada"));
    if (!stairService) {
        toast({title: "Serviço não encontrado", description: "O serviço 'Subida de Escada' precisa estar cadastrado."});
        setIsCalculating(false);
        return;
    }

    let totalValue = 0;
    const participations = new Map<string, { name: string; count: number; type: 'Motorista' | 'Ajudante' }>();

    filteredOrders.forEach(order => {
      const hasStairService = order.services?.some(s => s.serviceId === stairService.id);
      if (hasStairService) {
        const servicePrice = order.services.find(s => s.serviceId === stairService.id)?.price || 0;
        totalValue += servicePrice;
        
        if (order.driverId) {
            const driver = drivers.find(d => d.id === order.driverId);
            if (driver) {
                const current = participations.get(driver.id) || { name: driver.name, count: 0, type: 'Motorista' };
                current.count += 1;
                participations.set(driver.id, current);
            }
        }
        order.assistantIds?.forEach(assistantId => {
            const assistant = assistants.find(a => a.id === assistantId);
            if (assistant) {
                const current = participations.get(assistant.id) || { name: assistant.name, count: 0, type: 'Ajudante' };
                current.count += 1;
                participations.set(assistant.id, current);
            }
        });
      }
    });

    setTotalStairServiceValue(totalValue);
    
    const amountToDistribute = totalValue * (1 - companyCommission / 100);
    const totalParticipations = Array.from(participations.values()).reduce((sum, p) => sum + p.count, 0);

    if (totalParticipations === 0) {
      setTeamPaymentResults([]);
       setIsCalculating(false);
      return;
    }

    const valuePerParticipation = amountToDistribute / totalParticipations;

    const results: TeamMemberPayment[] = Array.from(participations.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      type: data.type,
      participations: data.count,
      amountToReceive: data.count * valuePerParticipation,
    })).sort((a,b) => b.amountToReceive - a.amountToReceive);

    setTeamPaymentResults(results);
    setIsCalculating(false);

  }, [dateRange, allOrders, drivers, assistants, allServices, companyCommission, toast]);
  
  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  
  const handleGenerateOrder = async () => {
    if (teamPaymentResults.length === 0) {
        toast({ title: "Nenhum resultado para gerar", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    try {
        const totalAmount = teamPaymentResults.reduce((sum, r) => sum + r.amountToReceive, 0);
        const orderData: Omit<DeliveryTeamPaymentOrder, 'id'> = {
            periodStartDate: dateRange?.from?.toISOString() || '',
            periodEndDate: dateRange?.to?.toISOString() || '',
            companyCommission,
            totalServiceValue: totalStairServiceValue,
            totalDistributed: totalAmount,
            results: teamPaymentResults,
            createdAt: serverTimestamp(),
            status: 'pending',
            paidAt: null,
        };

        const docRef = await addDoc(collection(db, 'deliveryTeamPaymentOrders'), orderData);
        toast({ title: "Ordem de Pagamento Gerada!", description: "Você será redirecionado para a página de impressão."});
        router.push(`/dashboard/delivery-payment-team/history/${docRef.id}`);

    } catch (error) {
        toast({ title: "Erro ao gerar ordem", variant: "destructive"});
        console.error(error);
    } finally {
        setIsSubmitting(false);
    }
  };


  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Pagamento da Equipe de Entrega</h1>
          <p className="text-muted-foreground">Calcule o pagamento referente ao serviço de subida de escada.</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros e Cálculo</CardTitle>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="space-y-2">
                <Label htmlFor="date">Selecione o período</Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button id="date" variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "LLL dd, y", {locale: ptBR})} - ${format(dateRange.to, "LLL dd, y", {locale: ptBR})}` : format(dateRange.from, "LLL dd, y")) : <span>Selecione a data</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR}/>
                    </PopoverContent>
                </Popover>
            </div>
            <div className="space-y-2">
                <Label htmlFor="commission">Comissão da Empresa (%)</Label>
                <div className="relative">
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                    <Input id="commission" type="number" value={companyCommission} onChange={e => setCompanyCommission(Number(e.target.value))} className="pl-9"/>
                </div>
            </div>
             <Button onClick={calculatePayments} className="self-end" disabled={isCalculating}>
                {isCalculating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Calcular Pagamentos
            </Button>
           </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Valor Total dos Serviços</CardTitle></CardHeader>
                    <CardContent><p className="text-2xl font-bold">{formatCurrency(totalStairServiceValue)}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Comissão da Empresa</CardTitle></CardHeader>
                    <CardContent><p className="text-2xl font-bold">{formatCurrency(totalStairServiceValue * (companyCommission/100))}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total a Distribuir</CardTitle></CardHeader>
                    <CardContent><p className="text-2xl font-bold text-green-600">{formatCurrency(totalStairServiceValue * (1 - companyCommission/100))}</p></CardContent>
                </Card>
            </div>
            
            {teamPaymentResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed">
                    <Frown className="h-16 w-16 text-muted-foreground" />
                    <h2 className="mt-4 text-xl font-semibold">Nenhum resultado</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Não foram encontradas entregas com "subida de escada" no período.</p>
                </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membro da Equipe</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead className="text-center">Nº de Participações</TableHead>
                    <TableHead className="text-right">Valor a Receber</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamPaymentResults.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell className="font-medium">{result.name}</TableCell>
                      <TableCell><Badge variant="outline">{result.type}</Badge></TableCell>
                      <TableCell className="text-center">{result.participations}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(result.amountToReceive)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                 <TableFooter>
                    <TableRow className="text-lg font-bold">
                        <TableCell colSpan={3} className="text-right">Total Distribuído</TableCell>
                        <TableCell className="text-right">{formatCurrency(teamPaymentResults.reduce((sum, r) => sum + r.amountToReceive, 0))}</TableCell>
                    </TableRow>
                 </TableFooter>
              </Table>
            )}
            </>
          )}
        </CardContent>
         <CardFooter>
            <Button onClick={handleGenerateOrder} disabled={isSubmitting || teamPaymentResults.length === 0}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                Gerar Ordem de Pagamento
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
