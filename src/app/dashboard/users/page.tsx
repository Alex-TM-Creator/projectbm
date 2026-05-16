
"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, ShieldCheck, ShieldOff, Loader2, Pencil, ShieldAlert, Shield, Mail } from "lucide-react";
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, query } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, updateProfile as updateAuthProfile, sendPasswordResetEmail } from "firebase/auth";
import { db, auth as mainAuth } from "@/lib/firebase";
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
  DropdownMenuSeparator
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { User, CompanyBranch, Branch, Role } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

const secondaryFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: `secondary-app-${Date.now()}`
};


export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = React.useState<User[]>([]);
  const [companyBranches, setCompanyBranches] = React.useState<CompanyBranch[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currentUser, setCurrentUser] = React.useState<Partial<User> & { password?: string }>({});
  const [userToDelete, setUserToDelete] = React.useState<User | null>(null);
  const [userToToggleBlock, setUserToToggleBlock] = React.useState<User | null>(null);
  const [userToResetPassword, setUserToResetPassword] = React.useState<User | null>(null);

  const isEditing = !!currentUser.id;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [usersSnap, companyBranchesSnap, branchesSnap, rolesSnap] = await Promise.all([
        getDocs(query(collection(db, "users"))),
        getDocs(query(collection(db, "companyBranches"))),
        getDocs(query(collection(db, "branches"))),
        getDocs(query(collection(db, "roles"))),
      ]);

      const usersList = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      const companyBranchesList = companyBranchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompanyBranch));
      const branchesList = branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
      const rolesList = rolesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role));

      setUsers(usersList);
      setCompanyBranches(companyBranchesList);
      setBranches(branchesList);
      setRoles(rolesList);

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

  const handleOpenDialog = (user?: User) => {
    setCurrentUser(user ? {...user} : { isAdmin: false, disabled: false });
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentUser({});
    setOpen(false);
  };
  
  const handleInputChange = (field: keyof Partial<User & {password?: string}>, value: any) => {
    setCurrentUser(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const requiredFields: (keyof typeof currentUser)[] = ['name', 'email', 'companyBranchId', 'branchId', 'roleId'];
    if (!isEditing) requiredFields.push('password');

    const hasMissingField = requiredFields.some(field => !currentUser[field]);

    if (hasMissingField) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos necessários.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    if (isEditing) {
      try {
        const companyBranch = companyBranches.find(cb => cb.id === currentUser.companyBranchId);
        const companyId = branches.find(b => b.id === companyBranch?.branchId)?.companyId || null;

        const userDoc = doc(db, "users", currentUser.id!);
        await updateDoc(userDoc, {
          name: currentUser.name,
          companyBranchId: currentUser.companyBranchId,
          branchId: currentUser.branchId,
          roleId: currentUser.roleId,
          companyId: companyId,
          isAdmin: currentUser.isAdmin,
          disabled: currentUser.disabled || false,
        });

        const mainAuthCurrentUser = mainAuth.currentUser;
        if(mainAuthCurrentUser && mainAuthCurrentUser.uid === currentUser.id && mainAuthCurrentUser.displayName !== currentUser.name) {
           await updateAuthProfile(mainAuthCurrentUser, { displayName: currentUser.name });
        }
        
        toast({
          title: "Usuário Atualizado!",
          description: "O usuário foi atualizado com sucesso.",
        });
        handleCloseDialog();
        fetchData();
      } catch (error: any) {
        console.error("Error updating user:", error);
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      }

    } else {
      const secondaryApp = initializeApp(secondaryFirebaseConfig, `secondary-app-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      
      try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, currentUser.email!, currentUser.password!);
        const newUser = userCredential.user;
        await updateAuthProfile(newUser, { displayName: currentUser.name });

        const companyBranch = companyBranches.find(cb => cb.id === currentUser.companyBranchId);
        const branch = branches.find(b => b.id === companyBranch?.branchId);
        const companyId = branch?.companyId || null;
        
        await setDoc(doc(db, "users", newUser.uid), {
          id: newUser.uid,
          name: currentUser.name,
          email: currentUser.email,
          companyBranchId: currentUser.companyBranchId,
          branchId: currentUser.branchId,
          roleId: currentUser.roleId,
          companyId: companyId,
          isAdmin: currentUser.isAdmin || false,
          disabled: currentUser.disabled || false,
          avatarUrl: `https://picsum.photos/seed/${newUser.uid}/100/100`,
        });

        toast({ title: "Usuário Criado!", description: "O novo usuário foi cadastrado com sucesso." });
        handleCloseDialog();
        fetchData();
      } catch (error: any) {
        console.error("Error creating user:", error);
        let errorMessage = "Ocorreu um erro desconhecido.";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = "Este e-mail já está sendo utilizado.";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "A senha deve ter no mínimo 6 caracteres.";
        }
        toast({ title: "Erro ao criar usuário", description: errorMessage, variant: "destructive" });
      } finally {
        await deleteApp(secondaryApp);
      }
    }

    setIsSubmitting(false);
  };
  
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteDoc(doc(db, "users", userToDelete.id));
      toast({
        title: "Usuário Deletado",
        description: "Os dados do usuário foram removidos do Firestore.",
        variant: "destructive",
      });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao deletar", description: "Não foi possível remover o usuário.", variant: "destructive" });
    } finally {
      setUserToDelete(null);
    }
  };

  const handleToggleBlock = async () => {
    if (!userToToggleBlock) return;
    
    // This is a placeholder for a secure backend function call.
    // In a real application, this would trigger a Cloud Function.
    setIsSubmitting(true);
    try {
      const newDisabledState = !userToToggleBlock.disabled;
      const userDoc = doc(db, "users", userToToggleBlock.id);
      await updateDoc(userDoc, { disabled: newDisabledState });
      
      toast({
        title: `Usuário ${newDisabledState ? 'Bloqueado' : 'Desbloqueado'}`,
        description: `O acesso de ${userToToggleBlock.name} foi ${newDisabledState ? 'restringido' : 'restaurado'}.`,
      });
      fetchData();
    } catch (error) {
       toast({ title: "Erro ao alterar status", description: "Não foi possível atualizar o status do usuário.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setUserToToggleBlock(null);
    }
  };

  const handleResetPassword = async () => {
    if (!userToResetPassword) return;
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(mainAuth, userToResetPassword.email);
      toast({
        title: "E-mail de redefinição enviado!",
        description: `Um link para redefinir a senha foi enviado para ${userToResetPassword.email}.`
      });
    } catch (error) {
      toast({
        title: "Erro ao enviar e-mail",
        description: "Não foi possível enviar o e-mail de redefinição de senha.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
      setUserToResetPassword(null);
    }
  };
  
  const getCompanyBranchName = (id: string) => companyBranches.find(c => c.id === id)?.nome_fantasia || "N/A";
  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name || "N/A";
  const getRoleName = (id:string) => roles.find(r => r.id === id)?.name || "N/A";

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Usuários</h1>
            <p className="text-muted-foreground">Gerencie os usuários e suas permissões.</p>
          </div>
           <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Cadastrar Usuário
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]" onCloseAutoFocus={handleCloseDialog}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Usuário' : 'Cadastrar Novo Usuário'}</DialogTitle>
                <DialogDescription>
                  {isEditing ? "Atualize os dados do usuário." : "Preencha os dados para criar um novo usuário."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Nome</Label>
                  <Input id="name" value={currentUser.name || ""} onChange={e => handleInputChange('name', e.target.value)} className="col-span-3" placeholder="Nome completo" disabled={isSubmitting}/>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">Email</Label>
                  <Input id="email" type="email" value={currentUser.email || ""} onChange={e => handleInputChange('email', e.target.value)} className="col-span-3" placeholder="email@dominio.com" disabled={isSubmitting || isEditing} />
                </div>
                 {!isEditing && (
                   <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="password" className="text-right">Senha</Label>
                      <Input id="password" type="password" value={currentUser.password || ""} onChange={e => handleInputChange('password', e.target.value)} className="col-span-3" placeholder="Mínimo 6 caracteres" disabled={isSubmitting}/>
                   </div>
                 )}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Empresa Filial</Label>
                  <Select value={currentUser.companyBranchId} onValueChange={value => handleInputChange('companyBranchId', value)} disabled={isSubmitting}>
                    <SelectTrigger className="col-span-3"><SelectValue placeholder="Selecione a empresa filial" /></SelectTrigger>
                    <SelectContent>{companyBranches.map(c => <SelectItem key={c.id} value={c.id}>{c.nome_fantasia}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Filial</Label>
                  <Select value={currentUser.branchId} onValueChange={value => handleInputChange('branchId', value)} disabled={isSubmitting}>
                    <SelectTrigger className="col-span-3"><SelectValue placeholder="Selecione a filial" /></SelectTrigger>
                    <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Função</Label>
                  <Select value={currentUser.roleId} onValueChange={value => handleInputChange('roleId', value)} disabled={isSubmitting}>
                    <SelectTrigger className="col-span-3"><SelectValue placeholder="Selecione a função" /></SelectTrigger>
                    <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="isAdmin" className="text-right">Admin</Label>
                    <Switch id="isAdmin" checked={currentUser.isAdmin} onCheckedChange={checked => handleInputChange('isAdmin', checked)} disabled={isSubmitting}/>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="disabled" className="text-right">Bloqueado</Label>
                    <Switch id="disabled" checked={currentUser.disabled} onCheckedChange={checked => handleInputChange('disabled', checked)} disabled={isSubmitting}/>
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
            <CardTitle>Lista de Usuários</CardTitle>
            <CardDescription>
              Total de {users.length} usuários cadastrados.
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
                    <TableHead>Usuário</TableHead>
                    <TableHead>Filial / Função</TableHead>
                    <TableHead>Permissão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead><span className="sr-only">Ações</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className={user.disabled ? 'bg-muted/50 text-muted-foreground' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint="people avatar"/>
                            <AvatarFallback>{user.name?.charAt(0) || 'U'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{getBranchName(user.branchId)}</div>
                        <div className="text-sm text-muted-foreground">{getRoleName(user.roleId)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isAdmin ? "default" : "secondary"} className={user.disabled ? 'border' : ''}>
                          {user.isAdmin ? <ShieldCheck className="mr-1 h-3.5 w-3.5" /> : <ShieldOff className="mr-1 h-3.5 w-3.5" />}
                          {user.isAdmin ? "Admin" : "Usuário"}
                        </Badge>
                      </TableCell>
                       <TableCell>
                        <Badge variant={user.disabled ? "destructive" : "outline"} className={user.disabled ? '' : 'text-green-600 border-green-600/50'}>
                          {user.disabled ? <ShieldAlert className="mr-1 h-3.5 w-3.5" /> : <Shield className="mr-1 h-3.5 w-3.5" />}
                          {user.disabled ? "Bloqueado" : "Ativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDialog(user)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                             <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setUserToResetPassword(user);}}>
                                    <Mail className="mr-2 h-4 w-4" />
                                    Enviar redefinição de senha
                                </DropdownMenuItem>
                             </AlertDialogTrigger>
                            <DropdownMenuSeparator />
                             <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setUserToToggleBlock(user); }}>
                                    {user.disabled ? <Shield className="mr-2 h-4 w-4" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
                                    {user.disabled ? 'Desbloquear' : 'Bloquear'}
                                </DropdownMenuItem>
                             </AlertDialogTrigger>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-600"
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setUserToDelete(user);
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
              {userToDelete && (
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita e removerá o usuário <strong className="mx-1">{userToDelete.name}</strong> do banco de dados. A conta de autenticação permanecerá ativa por segurança e deve ser removida manually no Console do Firebase.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteUser}>
                      Sim, deletar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              )}
               {userToToggleBlock && (
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Ação</AlertDialogTitle>
                    <AlertDialogDescription>
                      Você tem certeza que deseja <strong className="mx-1">{userToToggleBlock.disabled ? 'desbloquear' : 'bloquear'}</strong> o usuário <strong className="mx-1">{userToToggleBlock.name}</strong>?
                      {userToToggleBlock.disabled ? ' Isso restaurará seu acesso ao sistema.' : ' Isso impedirá que ele faça login.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setUserToToggleBlock(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleToggleBlock}>
                      Sim, {userToToggleBlock.disabled ? 'Desbloquear' : 'Bloquear'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              )}
              {userToResetPassword && (
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Redefinir Senha</AlertDialogTitle>
                    <AlertDialogDescription>
                      Você tem certeza que deseja enviar um e-mail de redefinição de senha para <strong className="mx-1">{userToResetPassword.email}</strong>?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setUserToResetPassword(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetPassword} disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                      Sim, enviar e-mail
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
