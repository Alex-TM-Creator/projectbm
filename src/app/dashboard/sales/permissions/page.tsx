

"use client";

import * as React from "react";
import { Loader2, Save, Users, GitFork, User, Shield, Undo2, Percent, DollarSign, History, ShoppingCart, Eye, Pencil, BadgePercent } from "lucide-react";
import { collection, doc, getDoc, setDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { Role, User as UserType, SalesPermissions, Branch } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

export default function SalesPermissionsPage() {
  const { toast } = useToast();
  const [permissions, setPermissions] = React.useState<SalesPermissions>({});
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [users, setUsers] = React.useState<UserType[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [permsSnap, rolesSnap, usersSnap, branchesSnap] = await Promise.all([
          getDoc(doc(db, "settings", "salesPermissions")),
          getDocs(collection(db, "roles")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "branches")),
        ]);

        if (permsSnap.exists()) {
          const data = permsSnap.data() as SalesPermissions;
          data.viewBranchOrders = data.viewBranchOrders || { users: {}, roles: {} };
          data.canViewOwnOrders = data.canViewOwnOrders || { userIds: [], roleIds: [], allowEditingOwn: false };
          setPermissions(data);
        } else {
          setPermissions({ viewBranchOrders: { users: {}, roles: {} }, canViewOwnOrders: { userIds: [], roleIds: [], allowEditingOwn: false } });
        }
        setRoles(rolesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Role)));
        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserType)));
        setBranches(branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));

      } catch (error) {
        toast({ title: "Erro ao carregar dados", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast]);

  const handleSelection = (
    level: keyof Omit<SalesPermissions, 'viewBranchOrders' | 'canViewOwnOrders' | 'canApplyGeneralDiscount'>,
    type: "userIds" | "roleIds",
    id: string
  ) => {
    setPermissions(prev => {
      const newPermissions = JSON.parse(JSON.stringify(prev));
      const permissionLevel = newPermissions[level] || { userIds: [], roleIds: [] };
      const currentIds: string[] = permissionLevel[type] || [];
      const index = currentIds.indexOf(id);

      if (index > -1) {
        currentIds.splice(index, 1);
      } else {
        currentIds.push(id);
      }
      
      permissionLevel[type] = currentIds;
      newPermissions[level] = permissionLevel;
      
      return newPermissions;
    });
  };
  
   const handleGeneralDiscountSelection = (type: "userIds" | "roleIds", id: string) => {
    setPermissions(prev => {
      const newPermissions = JSON.parse(JSON.stringify(prev));
      const discountPermission = newPermissions.canApplyGeneralDiscount || { userIds: [], roleIds: [] };
      const currentIds: string[] = discountPermission[type] || [];
      const index = currentIds.indexOf(id);
  
      if (index > -1) {
        currentIds.splice(index, 1);
      } else {
        currentIds.push(id);
      }
      
      discountPermission[type] = currentIds;
      newPermissions.canApplyGeneralDiscount = discountPermission;
      
      return newPermissions;
    });
  };

  const handleToggleAllowEditing = () => {
    setPermissions(prev => ({
        ...prev,
        canViewOwnOrders: {
            ...(prev.canViewOwnOrders || { userIds: [], roleIds: [] }),
            allowEditingOwn: !prev.canViewOwnOrders?.allowEditingOwn,
        }
    }));
  };
  
  const handleBranchSelection = (
    entityType: 'users' | 'roles',
    entityId: string,
    branchId: string,
  ) => {
    setPermissions(prev => {
        const newPermissions = JSON.parse(JSON.stringify(prev));
        const branchOrders = newPermissions.viewBranchOrders || { users: {}, roles: {} };
        
        const entityPermissions = branchOrders[entityType] || {};
        const assignedBranches = entityPermissions[entityId] || [];
        
        const index = assignedBranches.indexOf(branchId);
        if (index > -1) {
            assignedBranches.splice(index, 1);
        } else {
            assignedBranches.push(branchId);
        }
        
        entityPermissions[entityId] = assignedBranches;
        branchOrders[entityType] = entityPermissions;
        newPermissions.viewBranchOrders = branchOrders;

        return newPermissions;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "settings", "salesPermissions"), permissions, { merge: true });
      toast({ title: "Permissões salvas!", description: "As regras de visualização e liberação foram atualizadas." });
    } catch (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  const getSelectedNames = (ids: string[], source: { id: string, name: string }[]) => {
      if (!ids || ids.length === 0) return "Nenhum";
      if (ids.length > 2) return `${ids.length} selecionados`;
      return ids.map(id => source.find(item => item.id === id)?.name).filter(Boolean).join(', ');
  }

  const renderPermissionSelector = (
    level: keyof Omit<SalesPermissions, 'viewBranchOrders' | 'canViewOwnOrders' | 'canApplyGeneralDiscount'>, 
    title: string, 
    description: string, 
    icon: React.ReactNode
   ) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{icon} {title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Funções</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-start font-normal">
                {getSelectedNames(permissions[level]?.roleIds || [], roles)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              {roles.map(role => (
                <DropdownMenuCheckboxItem key={role.id} checked={permissions[level]?.roleIds?.includes(role.id)} onCheckedChange={() => handleSelection(level, 'roleIds', role.id)}>
                  {role.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="space-y-2">
          <Label>Usuários Específicos</Label>
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-start font-normal">
                {getSelectedNames(permissions[level]?.userIds || [], users)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              {users.map(user => (
                <DropdownMenuCheckboxItem key={user.id} checked={permissions[level]?.userIds?.includes(user.id)} onCheckedChange={() => handleSelection(level, 'userIds', user.id)}>
                  {user.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
  
  const renderBranchPermissionSelector = () => (
     <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><GitFork className="text-primary"/> Ver Pedidos da Filial</CardTitle>
        <CardDescription>Atribua a usuários ou funções a permissão de ver todos os pedidos de filiais específicas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Accordion type="single" collapsible className="w-full space-y-4">
          <AccordionItem value="roles" className="border rounded-md px-4">
            <AccordionTrigger>Por Função</AccordionTrigger>
            <AccordionContent className="pt-2">
              <div className="space-y-2 mt-2">
                {roles.map(role => (
                  <DropdownMenu key={role.id}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        <span>{role.name}</span>
                        <span>{getSelectedNames(permissions.viewBranchOrders?.roles?.[role.id] || [], branches)}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Selecione as filiais para {role.name}</DropdownMenuLabel>
                      <DropdownMenuSeparator/>
                      {branches.map(branch => (
                        <DropdownMenuCheckboxItem
                            key={branch.id}
                            checked={permissions.viewBranchOrders?.roles?.[role.id]?.includes(branch.id)}
                            onCheckedChange={() => handleBranchSelection('roles', role.id, branch.id)}
                            onSelect={(e) => e.preventDefault()}
                        >
                          {branch.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="users" className="border rounded-md px-4">
            <AccordionTrigger>Por Usuário</AccordionTrigger>
            <AccordionContent className="pt-2">
              <div className="space-y-2 mt-2">
                {users.map(user => (
                  <DropdownMenu key={user.id}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        <span>{user.name}</span>
                        <span>{getSelectedNames(permissions.viewBranchOrders?.users?.[user.id] || [], branches)}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Selecione as filiais para {user.name}</DropdownMenuLabel>
                      <DropdownMenuSeparator/>
                      {branches.map(branch => (
                        <DropdownMenuCheckboxItem
                            key={branch.id}
                            checked={permissions.viewBranchOrders?.users?.[user.id]?.includes(branch.id)}
                            onCheckedChange={() => handleBranchSelection('users', user.id, branch.id)}
                            onSelect={(e) => e.preventDefault()}
                        >
                          {branch.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Permissões de Venda</h1>
          <p className="text-muted-foreground">
            Defina quem pode visualizar pedidos ou liberar descontos.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar Alterações
        </Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary"/>
        </div>
      ) : (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Eye className="text-muted-foreground"/> Permissões de Visualização de Pedidos</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card>
                      <CardHeader>
                          <CardTitle className="flex items-center gap-2"><User className="text-primary"/> Ver Próprios Pedidos</CardTitle>
                          <CardDescription>Usuários/Funções com acesso apenas aos seus próprios pedidos.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                          <div className="space-y-2">
                          <Label>Funções</Label>
                          <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-start font-normal">{getSelectedNames(permissions.canViewOwnOrders?.roleIds || [], roles)}</Button></DropdownMenuTrigger>
                              <DropdownMenuContent className="w-64">{roles.map(role => (<DropdownMenuCheckboxItem key={role.id} checked={permissions.canViewOwnOrders?.roleIds?.includes(role.id)} onCheckedChange={() => handleSelection('canViewOwnOrders', 'roleIds', role.id)}>{role.name}</DropdownMenuCheckboxItem>))}</DropdownMenuContent>
                          </DropdownMenu>
                          </div>
                          <div className="space-y-2">
                          <Label>Usuários Específicos</Label>
                          <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-start font-normal">{getSelectedNames(permissions.canViewOwnOrders?.userIds || [], users)}</Button></DropdownMenuTrigger>
                              <DropdownMenuContent className="w-64">{users.map(user => (<DropdownMenuCheckboxItem key={user.id} checked={permissions.canViewOwnOrders?.userIds?.includes(user.id)} onCheckedChange={() => handleSelection('canViewOwnOrders', 'userIds', user.id)}>{user.name}</DropdownMenuCheckboxItem>))}</DropdownMenuContent>
                          </DropdownMenu>
                          </div>
                           <div className="flex items-center space-x-2 pt-4 border-t">
                            <Switch id="allowEditingOwn" checked={permissions.canViewOwnOrders?.allowEditingOwn} onCheckedChange={handleToggleAllowEditing} />
                            <Label htmlFor="allowEditingOwn" className="flex items-center gap-2 cursor-pointer"><Pencil className="h-4 w-4"/> Permitir editar os próprios pedidos</Label>
                          </div>
                      </CardContent>
                    </Card>
                    {renderBranchPermissionSelector()}
                    {renderPermissionSelector(
                        "viewAllOrders", 
                        "Ver Todos os Pedidos", 
                        "Usuários e funções que podem ver pedidos de TODAS as filiais.", 
                        <Users className="text-primary"/>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><History className="text-muted-foreground"/> Permissões de Visualização de Recebimentos</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderPermissionSelector(
                        "viewBranchPayments", 
                        "Ver Recebimentos da Filial", 
                        "Permite ver o histórico de recebimentos apenas da própria filial.", 
                        <GitFork className="text-primary"/>
                    )}
                    {renderPermissionSelector(
                        "viewAllPayments", 
                        "Ver Todos os Recebimentos", 
                        "Permite ver o histórico de recebimentos de TODAS as filiais.", 
                        <DollarSign className="text-primary"/>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Shield className="text-muted-foreground"/> Permissões de Liberação</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderPermissionSelector(
                        "canReleaseDiscount", 
                        "Liberar Descontos", 
                        "Usuários e funções que podem aprovar pedidos com desconto acima do limite.", 
                        <Percent className="text-primary"/>
                      )}
                       {renderPermissionSelector(
                        "canReleaseReversal",
                        "Liberar Estornos",
                        "Usuários e funções que podem aprovar ou negar solicitações de estorno de pagamento.",
                        <Undo2 className="text-primary"/>
                      )}
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BadgePercent className="text-muted-foreground"/> Controle de Desconto Geral</CardTitle>
                    <CardDescription>Defina quem pode visualizar e aplicar o campo "Desconto Geral" no pedido de venda.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Funções com Acesso</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-start font-normal">
                            {getSelectedNames(permissions.canApplyGeneralDiscount?.roleIds || [], roles)}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64">
                          {roles.map(role => (
                            <DropdownMenuCheckboxItem key={role.id} checked={permissions.canApplyGeneralDiscount?.roleIds?.includes(role.id)} onCheckedChange={() => handleGeneralDiscountSelection('roleIds', role.id)}>
                              {role.name}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-2">
                      <Label>Usuários Específicos</Label>
                       <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-start font-normal">
                            {getSelectedNames(permissions.canApplyGeneralDiscount?.userIds || [], users)}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64">
                          {users.map(user => (
                            <DropdownMenuCheckboxItem key={user.id} checked={permissions.canApplyGeneralDiscount?.userIds?.includes(user.id)} onCheckedChange={() => handleGeneralDiscountSelection('userIds', user.id)}>
                              {user.name}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
}
