
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
  const [teamsProduction, setTeamsProduction] = React.useState<{
    key: string;
    driverName: string;
    assistantNames: string[];
    ordersCount: number;
    totalValue: number;
    netValue: number;
  }[]>([]);

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
    const teamMap = new Map<string, {
      key: string;
      driverName: string;
      assistantNames: string[];
      ordersCount: number;
      totalValue: number;
      netValue: number;
      driverId: string;
      assistantIds: string[];
    }>();

    filteredOrders.forEach(order => {
      const hasStairService = order.services?.some(s => s.serviceId === stairService.id);
      if (hasStairService) {
        const servicePrice = order.services.find(s => s.serviceId === stairService.id)?.price || 0;
        totalValue += servicePrice;

        const driverId = order.driverId || 'no-driver';
        const assistantIds = order.assistantIds || [];
        
        // Generate unique team key based on driver and sorted assistant IDs
        const teamKey = [driverId, ...[...assistantIds].sort()].join('_');

        const driver = drivers.find(d => d.id === driverId);
        const driverName = driver ? driver.name : (driverId === 'no-driver' ? 'Sem Motorista' : 'Motorista Desconhecido');

        const astNames = assistantIds.map(aid => {
          const ast = assistants.find(a => a.id === aid);
          return ast ? ast.name : 'Ajudante Desconhecido';
        });

        const current = teamMap.get(teamKey) || {
          key: teamKey,
          driverName,
          assistantNames: astNames,
          ordersCount: 0,
          totalValue: 0,
          netValue: 0,
          driverId,
          assistantIds
        };

        current.ordersCount += 1;
        current.totalValue += servicePrice;
        teamMap.set(teamKey, current);
      }
    });

    setTotalStairServiceValue(totalValue);

    // Apply company commission to get net value for each team
    const teamsProductionList = Array.from(teamMap.values()).map(team => {
      const netValue = team.totalValue * (1 - companyCommission / 100);
      return {
        ...team,
        netValue
      };
    });

    setTeamsProduction(teamsProductionList);

    // Now divide the net value of each team among the active members of that team
    const memberPaymentsMap = new Map<string, {
      name: string;
      type: 'Motorista' | 'Ajudante';
      participations: number;
      amountToReceive: number;
    }>();

    teamsProductionList.forEach(team => {
      const teamSize = (team.driverId !== 'no-driver' ? 1 : 0) + team.assistantIds.length;
      if (teamSize === 0) return;

      const share = team.netValue / teamSize;

      if (team.driverId !== 'no-driver') {
        const current = memberPaymentsMap.get(team.driverId) || {
          name: team.driverName,
          type: 'Motorista',
          participations: 0,
          amountToReceive: 0
        };
        current.participations += team.ordersCount;
        current.amountToReceive += share;
        memberPaymentsMap.set(team.driverId, current);
      }

      team.assistantIds.forEach((aid, idx) => {
        const assistantName = team.assistantNames[idx];
        const current = memberPaymentsMap.get(aid) || {
          name: assistantName,
          type: 'Ajudante',
          participations: 0,
          amountToReceive: 0
        };
        current.participations += team.ordersCount;
        current.amountToReceive += share;
        memberPaymentsMap.set(aid, current);
      });
    });

    const results: TeamMemberPayment[] = Array.from(memberPaymentsMap.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      type: data.type,
      participations: data.participations,
      amountToReceive: data.amountToReceive,
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
            teamsProduction: teamsProduction.map(tp => ({
              key: tp.key,
              driverName: tp.driverName,
              assistantNames: tp.assistantNames,
              ordersCount: tp.ordersCount,
              totalValue: tp.totalValue,
              netValue: tp.netValue,
            })),
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
                <Label htmlFor="commission">Retenção da Empresa (%)</Label>
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
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Retenção da Empresa</CardTitle></CardHeader>
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
              <div className="space-y-8">
                {/* Resultado por Equipe */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Produção por Equipe
                  </h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Equipe (Motorista + Ajudantes)</TableHead>
                          <TableHead className="text-center">Nº de Entregas</TableHead>
                          <TableHead className="text-right">Valor Bruto</TableHead>
                          <TableHead className="text-right">Valor Líquido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamsProduction.map((team) => (
                          <TableRow key={team.key}>
                            <TableCell className="font-medium">
                              <span className="font-bold text-foreground">{team.driverName}</span>
                              {team.assistantNames.length > 0 && (
                                <span className="text-muted-foreground"> + {team.assistantNames.join(" + ")}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">{team.ordersCount}</TableCell>
                            <TableCell className="text-right">{formatCurrency(team.totalValue)}</TableCell>
                            <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(team.netValue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Pagamentos Individuais */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Pagamentos Individuais
                  </h3>
                  <div className="rounded-md border">
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
                            <TableCell className="text-right font-semibold text-primary">{formatCurrency(result.amountToReceive)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                       <TableFooter>
                          <TableRow className="text-lg font-bold">
                              <TableCell colSpan={3} className="text-right">Total Distribuído</TableCell>
                              <TableCell className="text-right text-emerald-600">{formatCurrency(teamPaymentResults.reduce((sum, r) => sum + r.amountToReceive, 0))}</TableCell>
                          </TableRow>
                       </TableFooter>
                    </Table>
                  </div>
                </div>
              </div>
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
