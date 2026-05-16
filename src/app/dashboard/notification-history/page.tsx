

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, PlusCircle, MoreHorizontal, Pencil, Trash2, X, CalendarIcon, BriefcaseBusiness, Repeat, Repeat1 } from "lucide-react";
import { collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Notification, Role, NavigationItem } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format, isBefore, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSafePath } from "@/lib/navigation-helpers";
import { Switch } from "@/components/ui/switch";

type NotificationStatus = "active" | "scheduled" | "finished";
type StatusVariant = "default" | "secondary" | "outline";

const getNotificationStatus = (notification: Notification): { text: string; variant: StatusVariant; status: NotificationStatus } => {
  const now = new Date();
  if (notification.startDate) {
    const startDate = parseISO(notification.startDate);
    if (isAfter(startDate, now)) {
      return { text: "Agendada", variant: "outline", status: "scheduled" };
    }
  }
  if (notification.endDate) {
    const endDate = parseISO(notification.endDate);
    if (isBefore(endDate, now)) {
      return { text: "Encerrada", variant: "secondary", status: "finished" };
    }
  }
  return { text: "Ativa", variant: "default", status: "active" };
};


export default function NotificationHistoryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [navItems, setNavItems] = React.useState<NavigationItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // State for editing
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editingNotification, setEditingNotification] = React.useState<Notification | null>(null);

  // State for deleting
  const [notificationToDelete, setNotificationToDelete] = React.useState<Notification | null>(null);
  
  // State for filtering
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [yearFilter, setYearFilter] = React.useState<string>("all");
  const [monthFilter, setMonthFilter] = React.useState<string>("all");


  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [notificationsSnap, rolesSnap, navSnap] = await Promise.all([
        getDocs(query(collection(db, "notifications"), orderBy("createdAt", "desc"))),
        getDocs(collection(db, "roles")),
        getDocs(query(collection(db, "navigation"), orderBy("order"))),
      ]);
      
      setNotifications(notificationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
      setRoles(rolesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role)));
      setNavItems(navSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as NavigationItem)).filter(item => item.path));

    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast({
        title: "Erro ao buscar notificações",
        description: "Não foi possível carregar o histórico de notificações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { years, months } = React.useMemo(() => {
    const years = new Set<string>();
    const months = new Set<string>();
    notifications.forEach(c => {
      if (c.createdAt?.toDate) {
        const date = c.createdAt.toDate();
        years.add(date.getFullYear().toString());
        months.add((date.getMonth() + 1).toString().padStart(2, '0'));
      }
    });
    return {
      years: Array.from(years).sort((a, b) => b.localeCompare(a)),
      months: Array.from(months).sort()
    };
  }, [notifications]);

  const filteredNotifications = React.useMemo(() => {
    return notifications.filter(notification => {
      const status = getNotificationStatus(notification).status;
      const createdAtDate = notification.createdAt?.toDate();

      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }
      if (yearFilter !== "all" && createdAtDate?.getFullYear().toString() !== yearFilter) {
        return false;
      }
      if (monthFilter !== "all" && (createdAtDate?.getMonth() + 1).toString().padStart(2, '0') !== monthFilter) {
        return false;
      }
      return true;
    });
  }, [notifications, statusFilter, yearFilter, monthFilter]);


  const formatDateOnly = (dateString?: string) => {
     if (!dateString) return "N/D";
     return format(parseISO(dateString), "dd/MM/yyyy");
  }

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return "N/D";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : parseISO(timestamp);
      return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return "Data inválida";
    }
  };

  const handleOpenEditDialog = (notification: Notification) => {
    const deepCopy = JSON.parse(JSON.stringify(notification));
    if (deepCopy.showOnEveryLogin && !deepCopy.callToAction) {
        deepCopy.callToAction = "Clique aqui e saiba mais.";
    }
    setEditingNotification(deepCopy);
    setIsEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingNotification(null);
  };

  const handleRoleSelectionInEdit = (roleId: string) => {
    if (!editingNotification) return;
    const currentRoles = editingNotification.targetRoleIds || [];
    let newSelection: string[];

    if (roleId === 'all') {
      newSelection = currentRoles.length === roles.length ? [] : roles.map(r => r.id);
    } else {
      newSelection = [...currentRoles];
      const index = newSelection.indexOf(roleId);
      if (index > -1) {
        newSelection.splice(index, 1);
      } else {
        newSelection.push(roleId);
      }
    }
    setEditingNotification({...editingNotification, targetRoleIds: newSelection});
  }
  
  const handleUpdateNotification = async () => {
    if (!editingNotification || !editingNotification.title.trim() || !editingNotification.text.trim()) {
      toast({ title: "Campos obrigatórios", description: "Título e texto são necessários.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const notificationDocRef = doc(db, "notifications", editingNotification.id);
      await updateDoc(notificationDocRef, {
        title: editingNotification.title,
        text: editingNotification.text,
        startDate: editingNotification.startDate || null,
        endDate: editingNotification.endDate || null,
        targetRoleIds: editingNotification.targetRoleIds || [],
        link: editingNotification.link || null,
        showOnEveryLogin: editingNotification.showOnEveryLogin || false,
        callToAction: editingNotification.showOnEveryLogin ? editingNotification.callToAction : null,
      });

      toast({ title: "Notificação Atualizada!", description: "As alterações foram salvas com sucesso." });
      handleCloseEditDialog();
      fetchData();
    } catch(error) {
      console.error("Error updating notification:", error);
      toast({ title: "Erro ao atualizar", description: "Não foi possível salvar as alterações.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNotification = async () => {
    if (!notificationToDelete) return;
    try {
      await deleteDoc(doc(db, "notifications", notificationToDelete.id));
      
      toast({ title: "Notificação Excluída", description: "A notificação foi removida com sucesso.", variant: "destructive" });
      fetchData();
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast({ title: "Erro ao excluir", description: "Não foi possível remover a notificação.", variant: "destructive" });
    } finally {
      setNotificationToDelete(null);
    }
  }

  const getTargetRolesText = (targetRoleIds?: string[]) => {
    if (!targetRoleIds || targetRoleIds.length === 0 || targetRoleIds.length === roles.length) {
      return "Todos";
    }
    if (targetRoleIds.length > 2) {
      return `${targetRoleIds.length} funções`;
    }
    return targetRoleIds.map(id => roles.find(r => r.id === id)?.name).filter(Boolean).join(', ');
  }
  
  const getLinkText = (link?: string) => {
    if (!link) return "Nenhum";
    const navItem = navItems.find(item => getSafePath(item.path) === link);
    return navItem?.title || link;
  };

  const selectedRolesText = React.useMemo(() => {
    if (!editingNotification?.targetRoleIds || editingNotification.targetRoleIds.length === 0) return "Para todos";
    if (editingNotification.targetRoleIds.length === roles.length) return "Para todos";
    if (editingNotification.targetRoleIds.length === 1) return roles.find(r => r.id === editingNotification.targetRoleIds?.[0])?.name;
    return `${editingNotification.targetRoleIds.length} funções selecionadas`;
  }, [editingNotification, roles]);


  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            Gerenciar Notificações
          </h1>
          <p className="text-muted-foreground">
            Gerencie todas as notificações já publicadas.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
                <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
            </Button>
            <Button onClick={() => router.push('/dashboard/create-notification')}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Criar Notificação
            </Button>
        </div>
      </div>

    <Card>
        <CardHeader>
            <CardTitle>Notificações Publicadas</CardTitle>
            <CardDescription>
                Filtre e gerencie a lista de todas as notificações criadas. 
                Mostrando {filteredNotifications.length} de {notifications.length} notificações.
            </CardDescription>
             <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue placeholder="Filtrar por status..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Status</SelectItem>
                        <SelectItem value="active">Ativa</SelectItem>
                        <SelectItem value="scheduled">Agendada</SelectItem>
                        <SelectItem value="finished">Encerrada</SelectItem>
                    </SelectContent>
                </Select>
                 <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger><SelectValue placeholder="Filtrar por ano..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Anos</SelectItem>
                        {years.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                    </SelectContent>
                </Select>
                 <Select value={monthFilter} onValueChange={setMonthFilter}>
                    <SelectTrigger><SelectValue placeholder="Filtrar por mês..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Meses</SelectItem>
                        {months.map(month => (
                          <SelectItem key={month} value={month}>
                            {format(new Date(2000, parseInt(month) - 1, 1), "MMMM", { locale: ptBR })}
                          </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </CardHeader>
        <CardContent>
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
             <AlertDialog>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Data de Criação</TableHead>
                            <TableHead>Período</TableHead>
                            <TableHead>Direcionamento</TableHead>
                            <TableHead>Recorrência</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredNotifications.map((notification) => {
                            const status = getNotificationStatus(notification);
                            return (
                            <TableRow key={notification.id}>
                                <TableCell className="font-medium">{notification.title}</TableCell>
                                <TableCell>{formatDateTime(notification.createdAt)}</TableCell>
                                <TableCell>
                                    {notification.startDate || notification.endDate ? (
                                        `${formatDateOnly(notification.startDate)} - ${formatDateOnly(notification.endDate)}`
                                    ): (
                                        <span className="text-muted-foreground">Sempre Ativa</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{getTargetRolesText(notification.targetRoleIds)}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="gap-1.5">
                                    {notification.showOnEveryLogin ? <Repeat className="h-3 w-3"/> : <Repeat1 className="h-3 w-3" />}
                                    {notification.showOnEveryLogin ? "Sempre" : "Uma vez"}
                                  </Badge>
                                </TableCell>
                                 <TableCell>
                                  <Badge variant={status.variant} className={status.status === 'active' ? 'bg-green-600 text-white' : ''}>
                                    {status.text}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleOpenEditDialog(notification)}>
                                          <Pencil className="mr-2 h-4 w-4" /> Editar
                                        </DropdownMenuItem>
                                        <AlertDialogTrigger asChild>
                                          <DropdownMenuItem className="text-destructive" onSelect={e => {e.preventDefault(); setNotificationToDelete(notification)}}>
                                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                          </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        )})}
                    </TableBody>
                </Table>
                {notificationToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso irá excluir permanentemente a notificação "{notificationToDelete.title}".
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setNotificationToDelete(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteNotification}>Sim, excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
                )}
             </AlertDialog>
            )}
        </CardContent>
    </Card>

      {/* Edit Dialog */}
      {editingNotification && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-3xl" onInteractOutside={(e) => e.preventDefault()} onCloseAutoFocus={handleCloseEditDialog}>
            <DialogHeader>
              <DialogTitle>Editar Notificação</DialogTitle>
              <DialogDescription>Faça as alterações na sua notificação e salve.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Título</Label>
                <Input id="edit-title" value={editingNotification.title} onChange={e => setEditingNotification({...editingNotification, title: e.target.value})} disabled={isSubmitting}/>
              </div>

               <div className="space-y-2">
                  <Label>Direcionamento</Label>
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-start font-normal">
                              <BriefcaseBusiness className="mr-2 h-4 w-4" />
                              {selectedRolesText}
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56">
                          <DropdownMenuLabel>Direcionar para</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuCheckboxItem
                              checked={editingNotification.targetRoleIds?.length === roles.length && roles.length > 0}
                              onCheckedChange={() => handleRoleSelectionInEdit('all')}
                          >
                              Todos
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuSeparator />
                          {roles.map(role => (
                              <DropdownMenuCheckboxItem
                                  key={role.id}
                                  checked={editingNotification.targetRoleIds?.includes(role.id)}
                                  onCheckedChange={() => handleRoleSelectionInEdit(role.id)}
                              >
                                  {role.name}
                              </DropdownMenuCheckboxItem>
                          ))}
                      </DropdownMenuContent>
                  </DropdownMenu>
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="startDate">Data de Início</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn("w-full justify-start text-left font-normal", !editingNotification.startDate && "text-muted-foreground")}
                            disabled={isSubmitting}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editingNotification.startDate ? format(parseISO(editingNotification.startDate), "dd 'de' MMMM, yyyy", { locale: ptBR }) : <span>Selecione uma data</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={editingNotification.startDate ? parseISO(editingNotification.startDate) : undefined}
                            onSelect={(date) => setEditingNotification({...editingNotification, startDate: date?.toISOString()})}
                            initialFocus
                            locale={ptBR}
                        />
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="space-y-2">
                     <Label htmlFor="endDate">Data de Fim</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn("w-full justify-start text-left font-normal", !editingNotification.endDate && "text-muted-foreground")}
                            disabled={isSubmitting}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editingNotification.endDate ? format(parseISO(editingNotification.endDate), "dd 'de' MMMM, yyyy", { locale: ptBR }) : <span>Selecione uma data</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={editingNotification.endDate ? parseISO(editingNotification.endDate) : undefined}
                            onSelect={(date) => setEditingNotification({...editingNotification, endDate: date?.toISOString()})}
                            initialFocus
                            locale={ptBR}
                            disabled={{ before: editingNotification.startDate ? parseISO(editingNotification.startDate) : undefined }}
                        />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

              <div className="space-y-2">
                <Label htmlFor="edit-text">Texto</Label>
                <Textarea id="edit-text" value={editingNotification.text} onChange={e => setEditingNotification({...editingNotification, text: e.target.value})} rows={6} disabled={isSubmitting}/>
              </div>

               <div className="space-y-2">
                <Label htmlFor="link" className="text-base">Link (Opcional)</Label>
                <Select value={editingNotification.link || "none"} onValueChange={(value) => setEditingNotification({...editingNotification, link: value === "none" ? undefined : value})}>
                    <SelectTrigger>
                        <SelectValue placeholder="Vincular a uma página..."/>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Nenhum link</SelectItem>
                        {navItems.map(item => (
                            <SelectItem key={item.id} value={getSafePath(item.path)}>{item.title}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                </div>

                <div className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="editShowOnEveryLogin" className="text-base">Mostrar a cada login</Label>
                            <p className="text-xs text-muted-foreground">
                            Se ativado, este pop-up aparecerá toda vez que o usuário entrar.
                            </p>
                        </div>
                        <Switch
                            id="editShowOnEveryLogin"
                            checked={editingNotification.showOnEveryLogin}
                            onCheckedChange={(checked) => setEditingNotification({...editingNotification!, showOnEveryLogin: checked})}
                            disabled={isSubmitting}
                        />
                    </div>
                     {editingNotification.showOnEveryLogin && (
                        <div className="space-y-2 pt-2 border-t border-dashed">
                            <Label htmlFor="editCallToAction">Texto da Chamada para Ação</Label>
                            <Input 
                                id="editCallToAction"
                                value={editingNotification.callToAction || ""}
                                onChange={(e) => setEditingNotification({...editingNotification!, callToAction: e.target.value})}
                                placeholder="Clique aqui para saber mais"
                                disabled={isSubmitting}
                            />
                        </div>
                    )}
                </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseEditDialog} disabled={isSubmitting}>Cancelar</Button>
              <Button onClick={handleUpdateNotification} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
