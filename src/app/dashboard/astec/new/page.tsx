
"use client";

import * as React from "react";
import {
  Loader2,
  Search,
  Wrench,
  Send,
  Package,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
  orderBy,
  doc,
  getDoc,
  limit,
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
import { useToast } from "@/hooks/use-toast";
import type { Customer, SalesOrder, AssistanceRequestItem, User, Branch, Address } from "@/lib/definitions";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function NewAssistancePage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  const [userData, setUserData] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [customerSearch, setCustomerSearch] = React.useState("");
  const [filteredCustomers, setFilteredCustomers] = React.useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null);

  const [customerOrders, setCustomerOrders] = React.useState<SalesOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = React.useState<SalesOrder | null>(null);
  
  const [selectedItems, setSelectedItems] = React.useState<AssistanceRequestItem[]>([]);
  const [problemDescription, setProblemDescription] = React.useState("");
  const [scheduledDate, setScheduledDate] = React.useState<Date | undefined>();
  const [lastAssistanceNumber, setLastAssistanceNumber] = React.useState(0);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [customersSnap, userSnap, astecSnap, branchesSnap] = await Promise.all([
          getDocs(collection(db, "customers")),
          user ? getDoc(doc(db, "users", user.uid)) : null,
          getDocs(query(collection(db, "astec"), orderBy("assistanceNumber", "desc"), limit(1))),
          getDocs(collection(db, "branches")),
        ]);
        setCustomers(customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
        setBranches(branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));

        if (userSnap && userSnap.exists()) {
          setUserData(userSnap.data() as User);
        }
        if (!astecSnap.empty) {
            const highestNumber = astecSnap.docs[0].data().assistanceNumber || 0;
            setLastAssistanceNumber(highestNumber);
        } else {
            setLastAssistanceNumber(0);
        }
      } catch (error) {
        toast({ title: "Erro ao carregar dados", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchData();
    }
  }, [toast, user]);

  React.useEffect(() => {
    if (customerSearch.length > 2) {
      const term = customerSearch.toLowerCase();
      setFilteredCustomers(
        customers.filter(c => c.name.toLowerCase().includes(term) || c.cpf?.includes(term) || c.cnpj?.includes(term))
      );
    } else {
      setFilteredCustomers([]);
    }
  }, [customerSearch, customers]);

  const selectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch("");
    setFilteredCustomers([]);
    try {
      const ordersQuery = query(collection(db, "salesOrders"), where("customerId", "==", customer.id), where("status", "==", "billed"));
      const ordersSnap = await getDocs(ordersQuery);
      setCustomerOrders(ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as SalesOrder)).sort((a, b) => b.orderNumber - a.orderNumber));
    } catch (error) {
      toast({ title: "Erro ao buscar pedidos do cliente", variant: "destructive" });
    }
  };

  const handleItemSelection = (productId: string, productName: string, isChecked: boolean) => {
    setSelectedItems(prev => {
      if (isChecked) {
        return [...prev, { productId, productName }];
      } else {
        return prev.filter(item => item.productId !== productId);
      }
    });
  };

  const handleSubmit = async () => {
    if (!selectedOrder || selectedItems.length === 0 || !problemDescription.trim() || !scheduledDate) {
      toast({ title: "Campos obrigatórios", description: "Selecione um pedido, itens, data e descreva o problema.", variant: "destructive" });
      return;
    }
    if (!user || !userData) {
       toast({ title: "Usuário não autenticado.", variant: "destructive" });
       return;
    }

    setIsSubmitting(true);
    const newAssistanceNumber = lastAssistanceNumber + 1;
    
    // Find the branch name from the selected order's companyBranchId
    const branchName = branches.find(b => b.id === userData.branchId)?.name || 'N/A';

    try {
      await addDoc(collection(db, "astec"), {
        assistanceNumber: newAssistanceNumber,
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.orderNumber,
        customerId: selectedCustomer!.id,
        customerName: selectedCustomer!.name,
        branchName: branchName,
        deliveryAddress: selectedOrder.deliveryAddress || null,
        items: selectedItems,
        problemDescription: problemDescription.trim(),
        scheduledDate: scheduledDate.toISOString(),
        status: 'pending',
        createdAt: serverTimestamp(),
        createdByUserId: user.uid,
        createdByUserName: userData.name,
        freightValue: selectedOrder.freightValue || 0, // Add freight value
      });

      setLastAssistanceNumber(newAssistanceNumber);
      toast({ title: "Chamado de assistência aberto!", description: `Nº do Atendimento: ${newAssistanceNumber}` });
      // Reset form
      setSelectedCustomer(null);
      setCustomerOrders([]);
      setSelectedOrder(null);
      setSelectedItems([]);
      setProblemDescription("");
      setScheduledDate(undefined);

    } catch (error) {
      console.error("Error creating assistance request:", error);
      toast({ title: "Erro ao abrir chamado", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  }

  return (
    <div className="space-y-6">
      <CardHeader className="p-0">
        <CardTitle className="text-3xl font-bold font-headline flex items-center gap-3">
          <Wrench /> Abrir Chamado ASTEC
        </CardTitle>
        <CardDescription>Crie uma nova solicitação de assistência técnica para um cliente.</CardDescription>
      </CardHeader>

      <Card>
        <CardHeader><CardTitle>1. Selecionar Cliente</CardTitle></CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou CPF/CNPJ..." className="pl-10" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
            {filteredCustomers.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-card border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredCustomers.map(c => <div key={c.id} className="p-2 hover:bg-muted cursor-pointer" onClick={() => selectCustomer(c)}>{c.name}</div>)}
              </div>
            )}
          </div>
          {selectedCustomer && (
            <div className="mt-4 p-4 border rounded-lg bg-muted">
              <p className="font-semibold">{selectedCustomer.name}</p>
              <p className="text-sm text-muted-foreground">{selectedCustomer.cpf || selectedCustomer.cnpj}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCustomer && (
        <Card>
          <CardHeader><CardTitle>2. Selecionar Pedido e Itens</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select onValueChange={(orderId) => setSelectedOrder(customerOrders.find(o => o.id === orderId) || null)}>
              <SelectTrigger><SelectValue placeholder="Selecione um pedido de venda..." /></SelectTrigger>
              <SelectContent>
                {customerOrders.map(o => <SelectItem key={o.id} value={o.id}>Pedido #{o.orderNumber}</SelectItem>)}
              </SelectContent>
            </Select>

            {selectedOrder && (
              <div className="space-y-3">
                <Label>Itens do Pedido</Label>
                <div className="space-y-2 rounded-md border p-4 max-h-60 overflow-y-auto">
                  {selectedOrder.items.map((item, index) => (
                    <div key={`${item.productId}-${index}`} className="flex items-center space-x-3">
                      <Checkbox
                        id={`item-${item.productId}-${index}`}
                        onCheckedChange={(checked) => handleItemSelection(item.productId, item.productName, !!checked)}
                      />
                      <Label htmlFor={`item-${item.productId}-${index}`} className="flex items-center gap-2 cursor-pointer">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        {item.productName}
                        <Badge variant="outline">Qtd: {item.quantity}</Badge>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedOrder && selectedItems.length > 0 && (
         <Card>
          <CardHeader><CardTitle>3. Agendamento</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="scheduledDate">Data da Visita</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !scheduledDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? format(scheduledDate, "dd 'de' MMMM, yyyy", { locale: ptBR }) : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={setScheduledDate}
                  initialFocus
                  locale={ptBR}
                  disabled={(date) => date < startOfToday()}
                />
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>
      )}

      {scheduledDate && (
        <Card>
          <CardHeader><CardTitle>4. Descrição do Problema</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              placeholder="Descreva o problema ou defeito reclamado pelo cliente..."
              rows={5}
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
            />
          </CardContent>
          <CardFooter>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <Send className="mr-2"/>}
              Abrir Chamado
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
