
"use client";

import * as React from "react";
import { Loader2, Save, Home } from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Role, NavigationItem, RoleAccess } from "@/lib/definitions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSafePath } from "@/lib/navigation-helpers";

type AccessState = {
  [roleId: string]: {
    allowedNavIds: Set<string>;
    homePagePath?: string;
  };
};

export default function AccessControlPage() {
  const { toast } = useToast();
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [navItems, setNavItems] = React.useState<NavigationItem[]>([]);
  const [accessState, setAccessState] = React.useState<AccessState>({});
  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState<string | null>(null);

  const getSubItems = React.useCallback((parentId: string | null) => {
    return navItems.filter(item => item.parentId === parentId).sort((a, b) => a.order - b.order);
  }, [navItems]);
  
  const getParentItems = React.useCallback((itemId: string): NavigationItem[] => {
    const parentTrail: NavigationItem[] = [];
    let currentItem = navItems.find(it => it.id === itemId);
    while (currentItem && currentItem.parentId) {
      const parent = navItems.find(it => it.id === currentItem!.parentId);
      if (parent) {
        parentTrail.push(parent);
        currentItem = parent;
      } else {
        break;
      }
    }
    return parentTrail;
  }, [navItems]);

  const getAllSubItems = React.useCallback((parentId: string): NavigationItem[] => {
    let children: NavigationItem[] = [];
    const directSubItems = getSubItems(parentId);
    children = [...children, ...directSubItems];
    directSubItems.forEach(child => {
        children = [...children, ...getAllSubItems(child.id)];
    });
    return children;
}, [getSubItems]);


  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [rolesSnap, navSnap] = await Promise.all([
        getDocs(query(collection(db, "roles"), orderBy("name"))),
        getDocs(query(collection(db, "navigation"), orderBy("order"))),
      ]);

      const rolesList = rolesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Role));
      const navItemsList = navSnap.docs.map(d => ({ id: d.id, ...d.data() } as NavigationItem));

      setRoles(rolesList);
      setNavItems(navItemsList);

      const initialAccessState: AccessState = {};
      for (const role of rolesList) {
        const roleAccessDoc = await getDoc(doc(db, "roleAccess", role.id));
        if (roleAccessDoc.exists()) {
          const data = roleAccessDoc.data() as RoleAccess;
          initialAccessState[role.id] = { 
            allowedNavIds: new Set(data.allowedNavIds),
            homePagePath: data.homePagePath,
          };
        } else {
          initialAccessState[role.id] = { allowedNavIds: new Set(), homePagePath: '/dashboard' };
        }
      }
      setAccessState(initialAccessState);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar as configurações de acesso.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCheckboxChange = (roleId: string, navId: string, checked: boolean) => {
    setAccessState(prev => {
      const newAllowedIds = new Set(prev[roleId]?.allowedNavIds);
      const allDescendants = getAllSubItems(navId);

      if (checked) {
        newAllowedIds.add(navId);
        // Also check all parents
        const parents = getParentItems(navId);
        parents.forEach(parent => newAllowedIds.add(parent.id));
        // And check all descendants
        allDescendants.forEach(desc => newAllowedIds.add(desc.id));
      } else {
        newAllowedIds.delete(navId);
        // And uncheck all descendants
        allDescendants.forEach(desc => newAllowedIds.delete(desc.id));
      }
      
      // Check if current home page is still allowed, if not, reset it
      let newHomePagePath = prev[roleId].homePagePath;
      if (newHomePagePath) {
        const homePageItem = navItems.find(item => getSafePath(item.path) === newHomePagePath);
        if (homePageItem && !newAllowedIds.has(homePageItem.id)) {
            newHomePagePath = '/dashboard'; // Reset to default
        }
      }

      return {
        ...prev,
        [roleId]: {
          ...prev[roleId],
          allowedNavIds: newAllowedIds,
          homePagePath: newHomePagePath,
        },
      };
    });
  };

  const handleHomePageChange = (roleId: string, path: string) => {
    setAccessState(prev => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        homePagePath: path,
      }
    }));
  };

  const handleSave = async (roleId: string) => {
    setIsSaving(roleId);
    try {
      const roleAccessData = accessState[roleId];
      const dataToSave: RoleAccess = {
        id: roleId,
        roleId: roleId,
        allowedNavIds: Array.from(roleAccessData.allowedNavIds),
        homePagePath: roleAccessData.homePagePath || '/dashboard',
      }
      const roleAccessRef = doc(db, "roleAccess", roleId);
      await setDoc(roleAccessRef, dataToSave);

      toast({
        title: "Permissões Salvas!",
        description: `As permissões para a função ${roles.find(r => r.id === roleId)?.name} foram atualizadas.`,
      });
    } catch (error) {
      console.error("Error saving access rights:", error);
      toast({
        title: "Erro ao Salvar",
        description: "Não foi possível salvar as permissões.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(null);
    }
  };

  const renderNavItems = (items: NavigationItem[], roleId: string, level = 0) => {
    return items.map(item => {
      const subItems = getSubItems(item.id);
      const allSubItems = getAllSubItems(item.id);
      const isChecked = accessState[roleId]?.allowedNavIds.has(item.id);
      const someSubChecked = allSubItems.some(sub => accessState[roleId]?.allowedNavIds.has(sub.id));
      const checkboxState = isChecked ? true : (someSubChecked ? "indeterminate" : false);

      return (
        <div key={item.id} className="space-y-2">
            <div className="flex items-center space-x-3 bg-muted/50 p-2 rounded-md" style={{ marginLeft: `${level * 1.5}rem`}}>
                <Checkbox
                    id={`${roleId}-${item.id}`}
                    checked={checkboxState}
                    onCheckedChange={(checked) => handleCheckboxChange(roleId, item.id, !!checked)}
                />
                <Label htmlFor={`${roleId}-${item.id}`} className="font-semibold text-base flex-1 cursor-pointer">
                    {item.title}
                </Label>
            </div>
            {subItems.length > 0 && (
                <div className="space-y-2">
                    {renderNavItems(subItems, roleId, level + 1)}
                </div>
            )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Definir Acesso</h1>
          <p className="text-muted-foreground">
            Gerencie quais seções do menu cada função pode visualizar e qual a página inicial.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Controle de Acesso por Função</CardTitle>
          <CardDescription>
            Marque as caixas para conceder acesso e selecione a página inicial para cada função.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full space-y-4">
            {roles.map(role => {
              const roleAccess = accessState[role.id];
              if (!roleAccess) return null;

              const { allowedNavIds, homePagePath } = roleAccess;
              const allowedItems = navItems.filter(item => allowedNavIds.has(item.id) && item.path);

              return (
                <AccordionItem value={role.id} key={role.id} className="border rounded-lg">
                  <AccordionTrigger className="p-4 hover:no-underline text-lg">
                    <div className="flex items-center justify-between w-full">
                        <span>{role.name}</span>
                        <Badge variant="secondary" className="mr-4">{allowedNavIds.size} / {navItems.length} permitidos</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 pt-0">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-grow space-y-2 rounded-md border p-4">
                        {renderNavItems(getSubItems(null), role.id, 0)}
                      </div>
                       <div className="md:w-1/3">
                          <Card className="sticky top-4">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2"><Home className="h-4 w-4"/> Página Inicial</CardTitle>
                            </CardHeader>
                            <CardContent>
                               <Label>Redirecionar após login</Label>
                               <Select value={homePagePath} onValueChange={(value) => handleHomePageChange(role.id, value)}>
                                  <SelectTrigger>
                                      <SelectValue placeholder="Selecione uma página" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {allowedItems.map(item => (
                                          <SelectItem key={item.id} value={getSafePath(item.path)}>
                                              {item.title}
                                          </SelectItem>
                                      ))}
                                      {allowedItems.length === 0 && (
                                        <div className="p-2 text-sm text-muted-foreground text-center">
                                          Nenhuma página acessível.
                                        </div>
                                      )}
                                  </SelectContent>
                               </Select>
                            </CardContent>
                          </Card>
                       </div>
                    </div>
                    <div className="flex justify-end mt-4">
                      <Button onClick={() => handleSave(role.id)} disabled={isSaving === role.id}>
                        {isSaving === role.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Salvar Permissões para {role.name}
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
