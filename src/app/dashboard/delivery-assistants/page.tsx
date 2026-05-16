

"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, Power, PowerOff, Link, User as UserIcon } from "lucide-react";
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
import type { DeliveryAssistant, User } from "@/lib/definitions";
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

export default function DeliveryAssistantsPage() {
  const { toast } = useToast();
  const [assistants, setAssistants] = React.useState<DeliveryAssistant[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currentAssistant, setCurrentAssistant] = React.useState<Partial<DeliveryAssistant>>({ isActive: true });
  const [assistantToDelete, setAssistantToDelete] = React.useState<DeliveryAssistant | null>(null);

  const isEditing = !!currentAssistant.id;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [assistantsSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, "deliveryAssistants"), orderBy("name"))),
        getDocs(query(collection(db, "users"))),
      ]);
      const fetchedAssistants = assistantsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DeliveryAssistant));

      // Migration for old data
      const needsMigration = fetchedAssistants.some(a => typeof a.isActive !== 'boolean');
      if (needsMigration) {
        const batch = writeBatch(db);
        fetchedAssistants.forEach(assistant => {
          if (typeof assistant.isActive !== 'boolean') {
            const docRef = doc(db, "deliveryAssistants", assistant.id);
            batch.update(docRef, { isActive: true });
          }
        });
        await batch.commit();
        const refreshedSnapshot = await getDocs(query(collection(db, "deliveryAssistants"), orderBy("name")));
        setAssistants(refreshedSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DeliveryAssistant)));
      } else {
        setAssistants(fetchedAssistants);
      }
      setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      
    } catch (error) {
      toast({
        title: "Erro ao buscar ajudantes",
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
  
  const handleUserSelection = (userId: string) => {
    if (userId === "none") {
      setCurrentAssistant(prev => ({
          ...prev,
          userId: null,
          name: isEditing ? prev.name : "",
          phone: isEditing ? prev.phone : "",
      }));
    } else {
        const selectedUser = users.find(u => u.id === userId);
        if (selectedUser) {
            setCurrentAssistant(prev => ({
                ...prev,
                userId: userId,
                name: selectedUser.name,
                phone: selectedUser.phones && selectedUser.phones.length > 0 ? selectedUser.phones[0].number : '',
            }));
        }
    }
  }

  const handleOpenDialog = (assistant?: DeliveryAssistant) => {
    setCurrentAssistant(assistant || { name: "", phone: "", isActive: true });
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentAssistant({ name: "", phone: "", isActive: true });
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!currentAssistant.name || currentAssistant.name.trim() === "" || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const dataToSave: Partial<Omit<DeliveryAssistant, 'id'>> = {
        name: currentAssistant.name.trim(),
        phone: currentAssistant.phone || "",
        isActive: currentAssistant.isActive === undefined ? true : currentAssistant.isActive,
        userId: currentAssistant.userId || null,
      };

      if (isEditing) {
        const docRef = doc(db, "deliveryAssistants", currentAssistant.id!);
        await updateDoc(docRef, dataToSave);
        toast({ title: "Ajudante Atualizado!" });
      } else {
        await addDoc(collection(db, "deliveryAssistants"), dataToSave);
        toast({ title: "Ajudante Cadastrado!" });
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
    if (!assistantToDelete) return;
    try {
      await deleteDoc(doc(db, "deliveryAssistants", assistantToDelete.id));
      toast({ title: "Ajudante Deletado", variant: "destructive" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    } finally {
      setAssistantToDelete(null);
    }
  };
  
  const handleToggleActive = async (assistant: DeliveryAssistant) => {
    try {
        const docRef = doc(db, "deliveryAssistants", assistant.id);
        await updateDoc(docRef, { isActive: !assistant.isActive });
        toast({ title: `Ajudante ${!assistant.isActive ? 'ativado' : 'inativado'}`});
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
            <h1 className="text-3xl font-bold font-headline tracking-tight">
              Ajudantes de Entrega
            </h1>
            <p className="text-muted-foreground">
              Gerencie os ajudantes de entrega.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Novo Ajudante</span>
              </Button>
            </DialogTrigger>
            <DialogContent onCloseAutoFocus={handleCloseDialog}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Ajudante' : 'Cadastrar Novo Ajudante'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                 <div className="space-y-2">
                    <Label htmlFor="userId">Vincular ao Usuário (Opcional)</Label>
                    <Select value={currentAssistant.userId || 'none'} onValueChange={handleUserSelection}>
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
                    value={currentAssistant.name || ""}
                    onChange={(e) => setCurrentAssistant({ ...currentAssistant, name: e.target.value })}
                    placeholder="Nome do ajudante"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formatPhone(currentAssistant.phone || "")}
                    onChange={(e) => setCurrentAssistant({ ...currentAssistant, phone: e.target.value.replace(/\D/g, '') })}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    disabled={isSubmitting}
                  />
                </div>
                 <div className="flex items-center space-x-2">
                  <Switch
                      id="isActive"
                      checked={currentAssistant.isActive}
                      onCheckedChange={(checked) => setCurrentAssistant(p => ({...p, isActive: checked }))}
                      disabled={isSubmitting}
                  />
                  <Label htmlFor="isActive">{currentAssistant.isActive ? 'Ativo' : 'Inativo'}</Label>
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
            <CardTitle>Lista de Ajudantes</CardTitle>
            <CardDescription>
              Total de {assistants.length} ajudantes cadastrados.
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
                  {assistants.map((assistant) => (
                    <TableRow key={assistant.id} className={!assistant.isActive ? "text-muted-foreground" : ""}>
                      <TableCell className="font-medium">{assistant.name}</TableCell>
                      <TableCell>{formatPhone(assistant.phone || "")}</TableCell>
                       <TableCell>
                        {assistant.userId ? (
                            <Badge variant="outline" className="gap-1.5"><Link className="h-3 w-3"/>{getUserName(assistant.userId)}</Badge>
                        ) : (
                            <span className="text-xs text-muted-foreground">Nenhum</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={assistant.isActive ? "default" : "outline"}>{assistant.isActive ? "Ativo" : "Inativo"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDialog(assistant)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                            <DropdownMenuSeparator/>
                             <DropdownMenuItem onClick={() => handleToggleActive(assistant)}>
                                {assistant.isActive ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
                                {assistant.isActive ? 'Desativar' : 'Ativar'}
                             </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-red-600" onSelect={(e) => { e.preventDefault(); setAssistantToDelete(assistant);}}><Trash2 className="mr-2 h-4 w-4" />Deletar</DropdownMenuItem>
                            </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {assistantToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita e irá excluir o ajudante <strong className="mx-1">{assistantToDelete.name}</strong>.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setAssistantToDelete(null)}>Cancelar</AlertDialogCancel>
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
