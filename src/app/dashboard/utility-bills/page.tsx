"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  DollarSign,
  TrendingUp,
  FileText,
  Loader2,
  Filter,
  ArrowRight,
  MoreVertical,
  Clock,
  ExternalLink,
  ChevronRight,
  LayoutGrid,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  where,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format, isBefore, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UtilityBill {
  id: string;
  categoria: string;
  valor: number;
  vencimento: Timestamp;
  referencia: string;
  codigoBarras?: string;
  status: 'pendente' | 'pago';
  createdAt: any;
  createdBy: string;
}

interface CategoryConfig {
  id: string;
  name: string;
}

export default function UtilityBillsPage() {
  const { toast } = useToast();
  const [user] = useAuthState(auth);
  
  const [bills, setBills] = React.useState<UtilityBill[]>([]);
  const [categories, setCategories] = React.useState<CategoryConfig[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  // Filtros
  const [monthFilter, setMonthFilter] = React.useState<string>(format(new Date(), "MM/yyyy"));
  const [statusFilter, setStatusFilter] = React.useState<string>("todos");

  // Form State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [formData, setFormData] = React.useState({
    categoria: "",
    novaCategoria: "",
    valor: "",
    vencimento: format(new Date(), "yyyy-MM-dd"),
    codigoBarras: "",
  });

  const defaultCategories = ["Luz", "Água", "Internet", "Telefone", "Aluguel", "Condomínio", "IPTU", "Seguro"];

  // Fetch Categories and Bills
  React.useEffect(() => {
    if (!user) return;

    const qBills = query(collection(db, "contas_consumo"), orderBy("vencimento", "asc"));
    const unsubscribeBills = onSnapshot(qBills, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UtilityBill));
      setBills(data);
      setLoading(false);
    });

    const qCats = query(collection(db, "config_categorias"), orderBy("name", "asc"));
    const unsubscribeCats = onSnapshot(qCats, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CategoryConfig));
      setCategories(data);
    });

    return () => {
      unsubscribeBills();
      unsubscribeCats();
    };
  }, [user]);

  const allCategories = React.useMemo(() => {
    const custom = categories.map(c => c.name);
    return [...new Set([...defaultCategories, ...custom])].sort();
  }, [categories]);

  const filteredBills = React.useMemo(() => {
    return bills.filter(bill => {
      const matchesMonth = bill.referencia === monthFilter;
      const matchesStatus = statusFilter === "todos" || bill.status === statusFilter;
      return matchesMonth && matchesStatus;
    });
  }, [bills, monthFilter, statusFilter]);

  const stats = React.useMemo(() => {
    const pendenteMês = bills
      .filter(b => b.referencia === monthFilter && b.status === 'pendente')
      .reduce((acc, curr) => acc + curr.valor, 0);
    
    const pagoMês = bills
      .filter(b => b.referencia === monthFilter && b.status === 'pago')
      .reduce((acc, curr) => acc + curr.valor, 0);

    const totaisGerais = bills.filter(b => b.referencia === monthFilter).length;

    return { pendenteMês, pagoMês, totaisGerais };
  }, [bills, monthFilter]);

  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.categoria || !formData.valor || !formData.vencimento) {
        toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    try {
      const finalCategory = formData.categoria === "outros" ? formData.novaCategoria : formData.categoria;
      
      // Se for nova categoria, salvar em config_categorias
      if (formData.categoria === "outros" && !categories.some(c => c.name === formData.novaCategoria)) {
          await addDoc(collection(db, "config_categorias"), {
              name: formData.novaCategoria,
              createdAt: serverTimestamp()
          });
      }

      const vencimentoDate = new Date(formData.vencimento + "T12:00:00");
      const referencia = format(vencimentoDate, "MM/yyyy");

      await addDoc(collection(db, "contas_consumo"), {
        categoria: finalCategory,
        valor: parseFloat(formData.valor),
        vencimento: Timestamp.fromDate(vencimentoDate),
        referencia,
        codigoBarras: formData.codigoBarras,
        status: 'pendente',
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });

      toast({ title: "Conta lançada com sucesso!" });
      setIsModalOpen(false);
      setFormData({ categoria: "", novaCategoria: "", valor: "", vencimento: format(new Date(), "yyyy-MM-dd"), codigoBarras: "" });
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (bill: UtilityBill) => {
    try {
      const newStatus = bill.status === 'pago' ? 'pendente' : 'pago';
      await updateDoc(doc(db, "contas_consumo", bill.id), { status: newStatus });
      toast({ title: `Conta marcada como ${newStatus}` });
    } catch (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
      if (!confirm("Tem certeza que deseja excluir esta conta?")) return;
      try {
        await deleteDoc(doc(db, "contas_consumo", id));
        toast({ title: "Conta excluída" });
      } catch (error) {
        toast({ title: "Erro ao excluir", variant: "destructive" });
      }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (!user && !loading) return <div className="p-8 text-center">Acesso negado. Faça login.</div>;

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* HEADER & DASHBOARD */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black font-headline tracking-tight flex items-center gap-3">
            <LayoutGrid className="text-primary h-8 w-8" />
            Contas de Consumo
          </h1>
          <p className="text-muted-foreground text-lg">Gerenciamento de despesas fixas e recorrentes.</p>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
                <Button size="lg" className="h-14 px-8 rounded-2xl shadow-xl shadow-primary/20 font-bold transition-all hover:scale-105">
                    <Plus className="mr-2 h-5 w-5" /> Novo Lançamento
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSaveBill}>
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">Lançar Nova Conta</DialogTitle>
                        <DialogDescription>Insira os detalhes da conta para acompanhamento.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-6">
                        <div className="space-y-2">
                            <Label>Categoria</Label>
                            <Select 
                                value={formData.categoria} 
                                onValueChange={(v) => setFormData({...formData, categoria: v})}
                            >
                                <SelectTrigger className="h-11 shadow-sm">
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {allCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                    <SelectItem value="outros" className="font-bold text-primary">+ Nova Categoria</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {formData.categoria === "outros" && (
                            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                                <Label>Nome da Nova Categoria</Label>
                                <Input 
                                    placeholder="Ex: Manutenção Filtro" 
                                    className="h-11"
                                    value={formData.novaCategoria}
                                    onChange={e => setFormData({...formData, novaCategoria: e.target.value})}
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Valor (R$)</Label>
                                <Input 
                                    type="number" 
                                    step="0.01" 
                                    placeholder="0,00" 
                                    className="h-11"
                                    value={formData.valor}
                                    onChange={e => setFormData({...formData, valor: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Vencimento</Label>
                                <Input 
                                    type="date" 
                                    className="h-11"
                                    value={formData.vencimento}
                                    onChange={e => setFormData({...formData, vencimento: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Código de Barras (Opcional)</Label>
                            <Input 
                                placeholder="Linha digitável ou link" 
                                className="h-11"
                                value={formData.codigoBarras}
                                onChange={e => setFormData({...formData, codigoBarras: e.target.value})}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" className="w-full h-12 text-base font-bold" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "Salvar Lançamento"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      </div>

      {/* DASHBOARD CARS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-lg bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm overflow-hidden group">
              <div className="absolute top-0 left-0 w-2 h-full bg-amber-500 opacity-80" />
              <CardContent className="p-8">
                  <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-1">A Pagar no Mês</p>
                        <h3 className="text-4xl font-black font-headline tracking-tighter text-amber-600">{formatCurrency(stats.pendenteMês)}</h3>
                    </div>
                    <div className="p-3 rounded-2xl bg-amber-50 shadow-inner group-hover:scale-110 transition-transform">
                        <Clock className="h-8 w-8 text-amber-500" />
                    </div>
                  </div>
              </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm overflow-hidden group">
              <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500 opacity-80" />
              <CardContent className="p-8">
                  <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-1">Pago no Mês</p>
                        <h3 className="text-4xl font-black font-headline tracking-tighter text-emerald-600">{formatCurrency(stats.pagoMês)}</h3>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-50 shadow-inner group-hover:scale-110 transition-transform">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                    </div>
                  </div>
              </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-zinc-900 text-white overflow-hidden group">
              <CardContent className="p-8 flex flex-col justify-center h-full relative">
                  <TrendingUp className="absolute right-[-20px] bottom-[-20px] h-40 w-40 opacity-5 group-hover:opacity-10 transition-opacity" />
                  <p className="text-sm font-black text-white/50 uppercase tracking-widest mb-1">Total de Lançamentos</p>
                  <h3 className="text-5xl font-black font-headline tracking-tighter">{stats.totaisGerais} <span className="text-lg font-normal opacity-50 ml-2">contas</span></h3>
              </CardContent>
          </Card>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl shadow-sm border flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-2xl">
              <Filter className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Filtros Ra?pidos</span>
          </div>

          <div className="flex flex-1 items-center gap-3">
              <div className="w-48">
                  <Input 
                    type="text" 
                    placeholder="MM/YYYY" 
                    value={monthFilter}
                    onChange={e => setMonthFilter(e.target.value)}
                    className="h-10 rounded-xl rounded-tr-none rounded-br-none border-r-0 focus-visible:ring-0"
                  />
              </div>
              <div className="w-48">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 rounded-xl rounded-tl-none rounded-bl-none shadow-none">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos os Status</SelectItem>
                        <SelectItem value="pendente">Pendentes</SelectItem>
                        <SelectItem value="pago">Pagos</SelectItem>
                    </SelectContent>
                </Select>
              </div>
          </div>
      </div>

      {/* TABLE */}
      <Card className="border-none shadow-xl overflow-hidden rounded-3xl bg-white dark:bg-zinc-900">
        <Table>
          <TableHeader className="bg-zinc-50 dark:bg-zinc-800/50">
            <TableRow className="border-none">
              <TableHead className="pl-8 py-4 uppercase text-[10px] font-black tracking-[0.2em] text-muted-foreground/50">Categoria</TableHead>
              <TableHead className="py-4 uppercase text-[10px] font-black tracking-[0.2em] text-muted-foreground/50">Referência</TableHead>
              <TableHead className="py-4 uppercase text-[10px] font-black tracking-[0.2em] text-muted-foreground/50">Vencimento</TableHead>
              <TableHead className="py-4 uppercase text-[10px] font-black tracking-[0.2em] text-muted-foreground/50">Valor</TableHead>
              <TableHead className="py-4 uppercase text-[10px] font-black tracking-[0.2em] text-muted-foreground/50">Status</TableHead>
              <TableHead className="pr-8 py-4 text-right uppercase text-[10px] font-black tracking-[0.2em] text-muted-foreground/50">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
                <TableRow><TableCell colSpan={6} className="h-64 text-center"><Loader2 className="animate-spin inline mr-2" /> Carregando lançamentos...</TableCell></TableRow>
            ) : filteredBills.length > 0 ? (
                filteredBills.map((bill) => {
                    const isOverdue = bill.status === 'pendente' && isBefore(bill.vencimento.toDate(), startOfMonth(new Date()));
                    const vencimentoFormatado = format(bill.vencimento.toDate(), "dd/MM/yyyy");
                    
                    return (
                        <TableRow key={bill.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/20 border-zinc-50 dark:border-zinc-800 transition-all">
                            <TableCell className="pl-8 py-6">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "p-2.5 rounded-xl",
                                        bill.status === 'pago' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                    )}>
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">{bill.categoria}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-sm font-medium opacity-60 font-mono italic">{bill.referencia}</TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-0.5">
                                    <span className={cn("text-sm font-bold", isOverdue && "text-destructive")}>{vencimentoFormatado}</span>
                                    {isOverdue && <span className="text-[10px] font-black text-destructive uppercase tracking-tighter">Vencida</span>}
                                </div>
                            </TableCell>
                            <TableCell className="text-lg font-black tracking-tight">{formatCurrency(bill.valor)}</TableCell>
                            <TableCell>
                                <Badge className={cn(
                                    "px-3 py-1 rounded-lg border-2 font-black uppercase text-[10px] shadow-sm",
                                    bill.status === 'pago' 
                                        ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                                        : isOverdue
                                            ? "bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:border-red-500/20"
                                            : "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20"
                                )}>
                                    {bill.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="pr-8 text-right">
                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className={cn(
                                            "h-9 px-4 rounded-xl border-2 font-bold",
                                            bill.status === 'pago' ? "hover:text-amber-600 hover:border-amber-100" : "hover:text-emerald-600 hover:border-emerald-100"
                                        )}
                                        onClick={() => handleToggleStatus(bill)}
                                    >
                                        {bill.status === 'pago' ? "Estornar" : "Baixar"}
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-9 w-9 rounded-xl text-zinc-400 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                        onClick={() => handleDelete(bill.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    );
                })
            ) : (
                <TableRow>
                   <TableCell colSpan={6} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center opacity-20 grayscale">
                            <Calendar className="h-16 w-16 mb-4" />
                            <p className="text-lg font-black uppercase italic">Sem lançamentos para este filtro.</p>
                        </div>
                   </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
