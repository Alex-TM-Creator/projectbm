
"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, Car, Power, PowerOff, Percent, DollarSign, X, Link, User as UserIcon } from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  writeBatch,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Driver, DriverDiscount, User } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const formatPhone = (value: string) => {
    if (!value) return "";
    value = value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 10) {
      return value.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    } else if (value.length > 6) {
      return value.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    } else if (value.length > 2) {
      return value.replace(/(\d{2})(\d{0,5})/, "($1) $2");
    }
    return value.replace(/^(\d*)/, "($1");
};

export default function DriversPage() {
  const { toast } = useToast();
  const [drivers, setDrivers] = React.useState<Driver[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currentDriver, setCurrentDriver] = React.useState<Partial<Driver>>({ isActive: true, discounts: [] });
  const [driverToDelete, setDriverToDelete] = React.useState<Driver | null>(null);

  const isEditing = !!currentDriver.id;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [driversSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, "drivers"), orderBy("name"))),
        getDocs(query(collection(db, "users"))),
      ]);
      const fetchedDrivers = driversSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Driver));
      setDrivers(fetchedDrivers);
      setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      
    } catch (error) {
      toast({
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar a lista.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const formatCurrencyForInput = (value?: number) => {
    if (value === undefined || value === null || isNaN(value)) return '';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(value);
  }

  const handleDiscountChange = (index: number, field: keyof DriverDiscount, value: string | number) => {
    const newDiscounts = [...(currentDriver.discounts || [])];
    const discountToUpdate = { ...newDiscounts[index]};
    
    if (field === 'value') {
        const rawValue = typeof value === 'string' ? value.replace(/\D/g, '') : value.toString();
        const numericValue = rawValue ? parseInt(rawValue, 10) / 100 : 0;
        (discountToUpdate as any)[field] = numericValue;
    } else {
       (discountToUpdate as any)[field] = value;
    }

    newDiscounts[index] = discountToUpdate;
    setCurrentDriver(prev => ({...prev, discounts: newDiscounts}));
  }

  const handleAddDiscount = () => {
    const newDiscount: DriverDiscount = { id: `discount-${Date.now()}`, name: "", type: 'fixed', value: 0 };
    setCurrentDriver(prev => ({...prev, discounts: [...(prev.discounts || []), newDiscount]}));
  }

  const handleRemoveDiscount = (id: string) => {
    setCurrentDriver(prev => ({...prev, discounts: prev.discounts?.filter(d => d.id !== id)}));
  }

  const handleOpenDialog = (driver?: Driver) => {
    const driverData = driver ? JSON.parse(JSON.stringify(driver)) : { name: "", phone: "", isActive: true, discounts: [], userId: null };
    if (!driverData.discounts) {
      driverData.discounts = [];
    }
    setCurrentDriver(driverData);
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentDriver({ name: "", phone: "", isActive: true, discounts: [] });
    setOpen(false);
  };
  
  const handleUserSelection = (userId: string) => {
    const selectedUser = users.find(u => u.id === userId);
    if (selectedUser) {
        setCurrentDriver(prev => ({
            ...prev,
            userId: userId,
            name: selectedUser.name,
            phone: selectedUser.phones && selectedUser.phones.length > 0 ? selectedUser.phones[0].number : '',
        }));
    } else {
        setCurrentDriver(prev => ({ ...prev, userId: null }));
    }
  }

  const handleSubmit = async () => {
    if (!currentDriver.name || currentDriver.name.trim() === "" || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const dataToSave: Partial<Omit<Driver, 'id'>> = {
        name: currentDriver.name.trim(),
        phone: currentDriver.phone || "",
        isActive: currentDriver.isActive === undefined ? true : currentDriver.isActive,
        discounts: currentDriver.discounts?.filter(d => d.name.trim() !== "") || [],
        userId: currentDriver.userId || null,
      };

      if (isEditing) {
        const docRef = doc(db, "drivers", currentDriver.id!);
        await updateDoc(docRef, dataToSave);
        toast({ title: "Motorista Atualizado!" });
      } else {
        await addDoc(collection(db, "drivers"), { ...dataToSave, createdAt: serverTimestamp() });
        toast({ title: "Motorista Cadastrado!" });
      }

      // Sync name back to user if linked
      if (currentDriver.userId) {
          const userDocRef = doc(db, "users", currentDriver.userId);
          const userDocSnap = await getDoc(userDocRef);
          if(userDocSnap.exists()){
              await updateDoc(userDocRef, { name: currentDriver.name.trim() });
          }
      }

      handleCloseDialog();
      fetchData();
    } catch (error) {
      toast({ title: isEditing ? "Erro ao atualizar" : "Erro ao cadastrar", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!driverToDelete) return;
    try {
      await deleteDoc(doc(db, "drivers", driverToDelete.id));
      toast({ title: "Motorista Deletado", variant: "destructive" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    } finally {
      setDriverToDelete(null);
    }
  };
  
  const handleToggleActive = async (driver: Driver) => {
    try {
        const docRef = doc(db, "drivers", driver.id);
        await updateDoc(docRef, { isActive: !driver.isActive });
        toast({ title: `Motorista ${!driver.isActive ? 'ativado' : 'inativado'}`});
        fetchData();
    } catch(error) {
        toast({ title: "Erro ao alterar status", variant: "destructive" });
    }
  }

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || "N/A";

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
              <Car /> Motoristas
            </h1>
            <p className="text-muted-foreground">
              Gerencie os motoristas de entrega.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Novo Motorista</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl" onCloseAutoFocus={handleCloseDialog}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Motorista' : 'Cadastrar Novo Motorista'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="space-y-2">
                    <Label htmlFor="userId">Vincular ao Usuário (Opcional)</Label>
                    <Select value={currentDriver.userId || ''} onValueChange={handleUserSelection}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione um usuário para vincular"/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Nenhum usuário vinculado</SelectItem>
                            {users.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={currentDriver.name || ""}
                    onChange={(e) => setCurrentDriver({ ...currentDriver, name: e.target.value })}
                    placeholder="Nome do motorista"
                    disabled={isSubmitting}
                  />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formatPhone(currentDriver.phone || "")}
                    onChange={(e) => setCurrentDriver({ ...currentDriver, phone: e.target.value.replace(/\D/g, '') })}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    disabled={isSubmitting}
                  />
                </div>
                
                 <Card>
                    <CardHeader>
                        <CardTitle>Descontos Padrão</CardTitle>
                        <CardDescription>Adicione descontos a serem aplicados ao pagamento do motorista.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {currentDriver.discounts?.map((discount, index) => (
                          <div key={discount.id} className="grid grid-cols-12 items-end gap-2 p-3 rounded-md bg-muted/50">
                            <div className="col-span-5 space-y-1">
                              <Label htmlFor={`d-name-${index}`}>Nome do Desconto</Label>
                              <Input id={`d-name-${index}`} value={discount.name} onChange={e => handleDiscountChange(index, 'name', e.target.value)} placeholder="Ex: Adiantamento"/>
                            </div>
                            <div className="col-span-3 space-y-1">
                              <Label htmlFor={`d-type-${index}`}>Tipo</Label>
                              <Select value={discount.type} onValueChange={(v) => handleDiscountChange(index, 'type', v)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                             <div className="col-span-3 space-y-1">
                              <Label htmlFor={`d-value-${index}`}>Valor</Label>
                              <Input id={`d-value-${index}`} type="text" value={formatCurrencyForInput(discount.value)} onChange={e => handleDiscountChange(index, 'value', e.target.value)}/>
                            </div>
                            <div className="col-span-1">
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveDiscount(discount.id)}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                          </div>
                        ))}
                         <Button variant="outline" size="sm" onClick={handleAddDiscount}><PlusCircle className="mr-2 h-4 w-4"/>Adicionar Desconto</Button>
                    </CardContent>
                 </Card>

                 <div className="flex items-center space-x-2">
                  <Switch
                      id="isActive"
                      checked={currentDriver.isActive}
                      onCheckedChange={(checked) => setCurrentDriver(p => ({...p, isActive: checked }))}
                      disabled={isSubmitting}
                  />
                  <Label htmlFor="isActive">{currentDriver.isActive ? 'Ativo' : 'Inativo'}</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>Cancelar</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Motoristas</CardTitle>
            <CardDescription>
              Total de {drivers.length} motoristas cadastrados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
            <AlertDialog>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Usuário Vinculado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20 text-right"><span className="sr-only">Ações</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((driver) => (
                    <TableRow key={driver.id} className={!driver.isActive ? "text-muted-foreground" : ""}>
                      <TableCell className="font-medium">{driver.name}</TableCell>
                      <TableCell>{formatPhone(driver.phone || "")}</TableCell>
                      <TableCell>
                        {driver.userId ? (
                            <Badge variant="outline" className="gap-1.5"><Link className="h-3 w-3"/>{getUserName(driver.userId)}</Badge>
                        ) : (
                            <span className="text-xs text-muted-foreground">Nenhum</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={driver.isActive ? "default" : "outline"}>{driver.isActive ? "Ativo" : "Inativo"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDialog(driver)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                            <DropdownMenuSeparator/>
                             <DropdownMenuItem onClick={() => handleToggleActive(driver)}>
                                {driver.isActive ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
                                {driver.isActive ? 'Desativar' : 'Ativar'}
                             </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-red-600" onSelect={(e) => { e.preventDefault(); setDriverToDelete(driver);}}><Trash2 className="mr-2 h-4 w-4" />Deletar</DropdownMenuItem>
                            </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {driverToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita e irá excluir o motorista <strong className="mx-1">{driverToDelete.name}</strong>.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDriverToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Sim, deletar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
                )}
            </AlertDialog>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
