
"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, UserPlus, X, BriefcaseBusiness } from "lucide-react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  setDoc,
  deleteDoc,
  where,
  addDoc,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { User, Role, Seller } from "@/lib/definitions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

export default function SellersPage() {
  const { toast } = useToast();
  const [users, setUsers] = React.useState<User[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [usersWithRoles, setUsersWithRoles] = React.useState<Seller[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [selectedUserId, setSelectedUserId] = React.useState<string>("");
  const [selectedRoleId, setSelectedRoleId] = React.useState<string>("");
  const [userToUnlink, setUserToUnlink] = React.useState<Seller | null>(null);

  const usersWithoutRoles = React.useMemo(() => {
    const usersWithRolesIds = usersWithRoles.map(s => s.id);
    return users.filter(u => !usersWithRolesIds.includes(u.id));
  }, [users, usersWithRoles]);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [usersSnap, rolesSnap] = await Promise.all([
        getDocs(query(collection(db, "users"))),
        getDocs(query(collection(db, "roles"))),
      ]);

      const usersList = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      const rolesList = rolesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role));
      
      setUsers(usersList);
      setRoles(rolesList);

      const usersWithAssignedRoles = usersList
        .filter(u => u.roleId) // Filter users that have a role
        .map(u => ({...u, roleName: rolesList.find(r => r.id === u.roleId)?.name || 'N/A' }));
      setUsersWithRoles(usersWithAssignedRoles);

    } catch (error) {
       console.error("Error fetching data: ", error);
       toast({
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar as informações do sistema.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = () => {
    setSelectedUserId("");
    setSelectedRoleId("");
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setOpen(false);
  };

  const handleLinkUser = async () => {
    if (isSubmitting || !selectedUserId || !selectedRoleId) {
      toast({
        title: "Seleção inválida",
        description: "Por favor, selecione um usuário e uma função.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const userToLink = users.find(u => u.id === selectedUserId);
      if (!userToLink) {
        throw new Error("Usuário não encontrado.");
      }

      // Update the user's roleId in the 'users' collection for consistency
      const userDoc = doc(db, "users", selectedUserId);
      await updateDoc(userDoc, { roleId: selectedRoleId });
      
      // Create a document in the new `userRoles` collection
      const userRolesCollection = collection(db, "userRoles");
      await addDoc(userRolesCollection, {
        userId: selectedUserId,
        roleId: selectedRoleId,
        userName: userToLink.name,
        linkedAt: new Date().toISOString(),
      });

      toast({
        title: "Função Atribuída!",
        description: "A nova função foi atribuída ao usuário com sucesso.",
      });
      handleCloseDialog();
      fetchData();
    } catch (error) {
      console.error("Error linking user:", error);
      toast({ title: "Erro ao vincular", description: "Não foi possível atribuir a função ao usuário.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleUnlinkUser = async () => {
    if (!userToUnlink) return;
    
    try {
        // Remove the user's roleId in the 'users' collection
        const userDoc = doc(db, "users", userToUnlink.id);
        await updateDoc(userDoc, { roleId: "" }); 
        
        // Find and delete the link in the `userRoles` collection
        const q = query(collection(db, "userRoles"), where("userId", "==", userToUnlink.id));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docToDelete = querySnapshot.docs[0];
          await deleteDoc(doc(db, "userRoles", docToDelete.id));
        }

         toast({
            title: "Função Removida",
            description: "O usuário não possui mais a função específica.",
            variant: "destructive",
        });
        fetchData();
    } catch(error) {
         toast({ title: "Erro ao remover função", description: "Não foi possível remover a função do usuário.", variant: "destructive" });
    } finally {
        setUserToUnlink(null);
    }
  };
  
  const getRoleName = (roleId?: string) => {
    if(!roleId) return "Sem função";
    return roles.find(r => r.id === roleId)?.name || 'N/A';
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Atribuir Funções</h1>
            <p className="text-muted-foreground">Gerencie as funções dos usuários do sistema.</p>
          </div>
           <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={handleOpenDialog}>
                <UserPlus className="h-4 w-4" />
                <span>Atribuir Função</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]" onCloseAutoFocus={handleCloseDialog}>
              <DialogHeader>
                <DialogTitle>Atribuir Função ao Usuário</DialogTitle>
                <DialogDescription>
                  Selecione um usuário e a função que deseja atribuir a ele.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={isSubmitting}>
                      <SelectTrigger>
                          <SelectValue placeholder="Selecione um usuário" />
                      </SelectTrigger>
                      <SelectContent>
                          {usersWithoutRoles.length > 0 ? usersWithoutRoles.map(u => (
                              <SelectItem key={u.id} value={u.id}>
                                  <div className="flex items-center gap-2">
                                      <Avatar className="h-6 w-6">
                                          <AvatarImage src={u.avatarUrl} alt={u.name} />
                                          <AvatarFallback>{u.name?.charAt(0) ?? 'U'}</AvatarFallback>
                                      </Avatar>
                                      <span>{u.name}</span>
                                  </div>
                              </SelectItem>
                          )) : (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum usuário sem função.</div>
                          )}
                      </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Função</Label>
                   <Select value={selectedRoleId} onValueChange={setSelectedRoleId} disabled={isSubmitting}>
                      <SelectTrigger>
                          <SelectValue placeholder="Selecione uma função" />
                      </SelectTrigger>
                      <SelectContent>
                          {roles.length > 0 ? roles.map(r => (
                              <SelectItem key={r.id} value={r.id}>
                                  <div className="flex items-center gap-2">
                                    <BriefcaseBusiness className="h-4 w-4" />
                                    <span>{r.name}</span>
                                  </div>
                              </SelectItem>
                          )) : (
                             <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhuma função cadastrada.</div>
                          )}
                      </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>Cancelar</Button>
                <Button onClick={handleLinkUser} disabled={isSubmitting || !selectedUserId || !selectedRoleId}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Usuários com Funções</CardTitle>
            <CardDescription>
              Total de {usersWithRoles.length} usuários com funções atribuídas.
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
                    <TableHead>Email</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersWithRoles.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.avatarUrl} alt={user.name} />
                            <AvatarFallback>{user.name?.charAt(0) || 'U'}</AvatarFallback>
                          </Avatar>
                          <div className="font-medium">{user.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </TableCell>
                       <TableCell>
                          <div className="text-sm">{getRoleName(user.roleId)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" onClick={() => setUserToUnlink(user)}>
                                <X className="h-4 w-4 mr-2" />
                                Remover Vínculo
                            </Button>
                        </AlertDialogTrigger>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {userToUnlink && (
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação removerá a função do usuário <strong className="mx-1">{userToUnlink.name}</strong>. Ele não será excluído, mas o vínculo com a função será desfeito.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setUserToUnlink(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleUnlinkUser}>
                      Sim, remover vínculo
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

    