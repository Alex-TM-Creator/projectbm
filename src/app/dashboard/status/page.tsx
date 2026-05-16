

"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, Tags, Bell } from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
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
import type { Status } from "@/lib/definitions";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function StatusPage() {
  const { toast } = useToast();
  const [statuses, setStatuses] = React.useState<Status[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currentStatus, setCurrentStatus] = React.useState<Partial<Status>>({ color: '#888888', shouldNotify: false });
  const [statusToDelete, setStatusToDelete] = React.useState<Status | null>(null);

  const isEditing = !!currentStatus.id;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const dataCollection = collection(db, "statuses");
      const q = query(dataCollection, orderBy("name"));
      const dataSnapshot = await getDocs(q);
      const fetchedStatuses = dataSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Status));

      // Add a default status if none exists
      if (fetchedStatuses.length === 0) {
        await addDoc(collection(db, "statuses"), {
          name: "Aguardando Transferência",
          color: "#fbbf24", // amber-400
          shouldNotify: false,
        });
        // Refetch after adding the default
        const newDataSnapshot = await getDocs(q);
        setStatuses(newDataSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Status)));
      } else {
        setStatuses(fetchedStatuses);
      }
      
    } catch (error) {
      toast({
        title: "Erro ao buscar status",
        description: "Não foi possível carregar a lista de status.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);


  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (status?: Status) => {
    setCurrentStatus(status || { color: '#888888', shouldNotify: false });
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentStatus({ color: '#888888', shouldNotify: false });
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!currentStatus.name || currentStatus.name.trim() === "" || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const dataToSave = {
        name: currentStatus.name.trim(),
        color: currentStatus.color || '#888888',
        shouldNotify: currentStatus.shouldNotify || false,
      };

      if (isEditing) {
        const docRef = doc(db, "statuses", currentStatus.id!);
        await updateDoc(docRef, dataToSave);
        toast({
          title: "Status Atualizado!",
          description: "O status foi atualizado com sucesso.",
        });
      } else {
        await addDoc(collection(db, "statuses"), dataToSave);
        toast({
          title: "Status Cadastrado!",
          description: "O novo status foi adicionado com sucesso.",
        });
      }
      handleCloseDialog();
      fetchData(); 
    } catch (error) {
      toast({
        title: isEditing ? "Erro ao atualizar" : "Erro ao cadastrar",
        description: `Não foi possível salvar o status.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!statusToDelete) return;
    try {
      await deleteDoc(doc(db, "statuses", statusToDelete.id));
      toast({
        title: "Status Deletado",
        description: "O status foi removido com sucesso.",
        variant: "destructive",
      });
      fetchData();
    } catch (error) {
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível remover o status.",
        variant: "destructive",
      });
    } finally {
      setStatusToDelete(null);
    }
  };
  

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
              <Tags /> Status de Pedidos
            </h1>
            <p className="text-muted-foreground">
              Gerencie os status para os pedidos de materiais de limpeza.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Novo Status</span>
              </Button>
            </DialogTrigger>
            <DialogContent onCloseAutoFocus={() => handleCloseDialog()}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Status' : 'Cadastrar Novo Status'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Nome
                  </Label>
                  <Input
                    id="name"
                    value={currentStatus.name || ""}
                    onChange={(e) => setCurrentStatus({...currentStatus, name: e.target.value})}
                    className="col-span-3"
                    placeholder="Ex: Em separação"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="color" className="text-right">
                    Cor
                  </Label>
                  <Input
                    id="color"
                    type="color"
                    value={currentStatus.color || "#888888"}
                    onChange={(e) => setCurrentStatus({...currentStatus, color: e.target.value})}
                    className="col-span-3 h-10 p-1"
                    disabled={isSubmitting}
                  />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="shouldNotify" className="text-right">
                    Notificar
                  </Label>
                   <Switch
                      id="shouldNotify"
                      checked={currentStatus.shouldNotify}
                      onCheckedChange={(checked) => setCurrentStatus({...currentStatus, shouldNotify: checked})}
                      disabled={isSubmitting}
                    />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Status</CardTitle>
            <CardDescription>
              Total de {statuses.length} status cadastrados.
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
                    <TableHead>Nome do Status</TableHead>
                    <TableHead>Notificação</TableHead>
                    <TableHead>
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statuses.map((status) => (
                    <TableRow key={status.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full" style={{ backgroundColor: status.color || '#888888' }} />
                            <span>{status.name}</span>
                        </div>
                      </TableCell>
                       <TableCell>
                        <Badge variant={status.shouldNotify ? "default" : "outline"} className="gap-1.5">
                          <Bell className="h-3 w-3" />
                          {status.shouldNotify ? "Ativada" : "Desativada"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-haspopup="true"
                              size="icon"
                              variant="ghost"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDialog(status)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-600"
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setStatusToDelete(status);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Deletar
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {statusToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Essa ação não pode ser desfeita. Isso irá deletar permanentemente o status
                        <strong className="mx-1">{statusToDelete.name}</strong>.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setStatusToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>
                            Sim, deletar
                        </AlertDialogAction>
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
