"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil } from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
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
import type { Role } from "@/lib/definitions";

export default function RolesPage() {
  const { toast } = useToast();
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currentRole, setCurrentRole] = React.useState<Partial<Role>>({});
  const [roleToDelete, setRoleToDelete] = React.useState<Role | null>(null);

  const isEditing = !!currentRole.id;

  const fetchRoles = React.useCallback(async () => {
    try {
      setLoading(true);
      const rolesCollection = collection(db, "roles");
      const roleSnapshot = await getDocs(rolesCollection);
      const rolesList = roleSnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Role)
      );
      setRoles(rolesList);
    } catch (error) {
      toast({
        title: "Erro ao buscar funções",
        description: "Não foi possível carregar a lista de funções.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);
  
  const handleOpenDialog = (role?: Role) => {
    setCurrentRole(role || {});
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setCurrentRole({});
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!currentRole.name || currentRole.name.trim() === "" || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (isEditing) {
        const roleDoc = doc(db, "roles", currentRole.id!);
        await updateDoc(roleDoc, { name: currentRole.name.trim() });
        toast({
          title: "Função Atualizada!",
          description: "A função foi atualizada com sucesso.",
        });
      } else {
        const rolesCollection = collection(db, "roles");
        await addDoc(rolesCollection, { name: currentRole.name.trim() });
        toast({
          title: "Função Cadastrada!",
          description: "A nova função foi adicionada com sucesso.",
        });
      }
      handleCloseDialog();
      fetchRoles(); // Refresh the list
    } catch (error) {
      toast({
        title: isEditing ? "Erro ao atualizar" : "Erro ao cadastrar",
        description: `Não foi possível salvar a função.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      const roleDoc = doc(db, "roles", roleToDelete.id);
      await deleteDoc(roleDoc);
      toast({
        title: "Função Deletada",
        description: "A função foi removida com sucesso.",
        variant: "destructive",
      });
      fetchRoles(); // Refresh the list
    } catch (error) {
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível remover a função.",
        variant: "destructive",
      });
    } finally {
      setRoleToDelete(null);
    }
  };


  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Funções</h1>
            <p className="text-muted-foreground">Gerencie as funções de usuário no sistema.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Cadastrar Função
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent onCloseAutoFocus={() => handleCloseDialog()}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Função' : 'Cadastrar Nova Função'}</DialogTitle>
                <DialogDescription>
                  {isEditing ? 'Altere o nome da função.' : 'Insira o nome da nova função para adicioná-la ao sistema.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Nome
                  </Label>
                  <Input
                    id="name"
                    value={currentRole.name || ""}
                    onChange={(e) => setCurrentRole({ ...currentRole, name: e.target.value })}
                    className="col-span-3"
                    placeholder="Ex: Desenvolvedor Pleno"
                    disabled={isSubmitting}
                  />
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
            <CardTitle>Lista de Funções</CardTitle>
            <CardDescription>
              Total de {roles.length} funções cadastradas.
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
                    <TableHead>Nome da Função</TableHead>
                    <TableHead>
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDialog(role)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-600"
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setRoleToDelete(role);
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
              {roleToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Essa ação não pode ser desfeita. Isso irá deletar permanentemente a função
                        <strong className="mx-1">{roleToDelete.name}</strong>
                        do sistema.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setRoleToDelete(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteRole}>
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
