
"use client";

import * as React from "react";
import {
  PlusCircle,
  MoreHorizontal,
  Trash2,
  Loader2,
  Pencil,
  AlertTriangle,
  Target,
  Medal,
  Trophy,
  Award,
  Gem,
  User as UserIcon,
  BriefcaseBusiness,
  GitFork,
  Globe,
  BellRing,
  Check,
  Search,
  Zap,
  ChevronDown,
  Save,
  Info,
} from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
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
  DropdownMenuCheckboxItem,
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { GoalAlert, GoalType, GoalLevelTargets, GoalAlertTriggerType, User, Branch, Role, GoalAlertTargetType } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { errorEmitter, FirestorePermissionError } from "@/lib/firebase-error-handler";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const levelIcons: Record<keyof GoalLevelTargets, React.ReactNode> = {
    Bronze: <Medal className="h-4 w-4 text-orange-600" />,
    Prata: <Trophy className="h-4 w-4 text-slate-500" />,
    Ouro: <Award className="h-4 w-4 text-yellow-500" />,
    Diamante: <Gem className="h-4 w-4 text-sky-400" />,
};

const orderedLevels = Object.keys(levelIcons) as Array<keyof GoalLevelTargets>;


export default function GoalAlertsPage() {
  const { toast } = useToast();
  const [alerts, setAlerts] = React.useState<GoalAlert[]>([]);
  const [goalTypes, setGoalTypes] = React.useState<GoalType[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currentAlert, setCurrentAlert] = React.useState<Partial<GoalAlert>>({
    goalTypeIds: [],
    targetType: 'general',
    triggerType: 'percentage',
    triggerValue: undefined,
    showOnLogin: true,
  });
  const [alertToDelete, setAlertToDelete] = React.useState<GoalAlert | null>(null);

  const isEditing = !!currentAlert.id;

  const alertsByPercentage = React.useMemo(() => alerts.filter(a => a.triggerType === 'percentage'), [alerts]);
  const alertsByLevel = React.useMemo(() => alerts.filter(a => a.triggerType === 'level'), [alerts]);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [alertsSnap, goalTypesSnap, usersSnap, branchesSnap, rolesSnap] = await Promise.all([
        getDocs(query(collection(db, "goalAlerts"), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "goaltypes"), orderBy("order"))),
        getDocs(query(collection(db, "users"), orderBy("name"))),
        getDocs(query(collection(db, "branches"), orderBy("name"))),
        getDocs(query(collection(db, "roles"), orderBy("name"))),
      ]);
      setAlerts(alertsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GoalAlert)));
      setGoalTypes(goalTypesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GoalType)));
      setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as User)));
      setBranches(branchesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Branch)));
      setRoles(rolesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Role)));

    } catch (error: any) {
       if (error.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError(error, {
            operation: 'read',
            path: error.customData?.path || 'goalAlerts/goaltypes', 
        }));
      } else {
        toast({
          title: "Erro ao buscar dados",
          description: "Não foi possível carregar os alertas.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (alert?: GoalAlert) => {
    setCurrentAlert(
      alert
        ? JSON.parse(JSON.stringify(alert))
        : {
            name: "",
            goalTypeIds: [],
            targetType: 'general',
            triggerType: 'percentage',
            triggerValue: undefined,
            message: "",
            showOnLogin: true,
            userIds: [],
            branchIds: [],
            roleIds: [],
          }
    );
    setOpen(true);
  };
  
  const handleTargetTypeChange = (type: GoalAlertTargetType) => {
    setCurrentAlert(p => ({
        ...p,
        targetType: type,
        userIds: [],
        branchIds: [],
        roleIds: [],
    }));
  };

  const handleCloseDialog = () => {
    setCurrentAlert({ goalTypeIds: [], targetType: 'general', triggerType: 'percentage', triggerValue: undefined, showOnLogin: true });
    setOpen(false);
  };

  const handleMultiSelect = (field: 'userIds' | 'branchIds' | 'roleIds', id: string) => {
    setCurrentAlert((prev: any) => {
        const currentIds = prev[field] || [];
        const newIds = [...currentIds];
        const index = newIds.indexOf(id);

        if (index > -1) {
            newIds.splice(index, 1);
        } else {
            newIds.push(id);
        }
        return { ...prev, [field]: newIds };
    });
  };

  const handleSubmit = async () => {
    if (
      !currentAlert.name ||
      currentAlert.name.trim() === "" ||
      !currentAlert.message ||
      currentAlert.message.trim() === "" ||
      currentAlert.triggerValue === undefined
    ) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome, mensagem, e valor do gatilho são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    
    const dataToSave: Partial<Omit<GoalAlert, "id" | "createdAt">> = {
        name: currentAlert.name.trim(),
        message: currentAlert.message.trim(),
        goalTypeIds: currentAlert.goalTypeIds || [],
        targetType: currentAlert.targetType,
        userIds: currentAlert.targetType === 'user' ? currentAlert.userIds : [],
        branchIds: currentAlert.targetType === 'branch' ? currentAlert.branchIds : [],
        roleIds: currentAlert.targetType === 'role' ? currentAlert.roleIds : [],
        triggerType: currentAlert.triggerType,
        triggerValue: currentAlert.triggerType === 'percentage' ? Number(currentAlert.triggerValue) : currentAlert.triggerValue,
    };
    
    if (isEditing) {
        dataToSave.showOnLogin = currentAlert.showOnLogin;
    } else {
        dataToSave.showOnLogin = currentAlert.showOnLogin === undefined ? true : currentAlert.showOnLogin;
    }

    try {
      if (isEditing) {
        const docRef = doc(db, "goalAlerts", currentAlert.id!);
        await updateDoc(docRef, dataToSave as any);
        toast({ title: "Alerta Atualizado!", description: "O alerta foi atualizado com sucesso." });
      } else {
        await addDoc(collection(db, "goalAlerts"), {
          ...dataToSave,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Alerta Criado!", description: "O novo alerta foi cadastrado com sucesso." });
      }
      handleCloseDialog();
      fetchData();
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError(error, {
                operation: 'write',
                path: 'goalAlerts',
                resource: dataToSave,
            }));
        } else {
            toast({
                title: isEditing ? "Erro ao atualizar" : "Erro ao cadastrar",
                description: "Não foi possível salvar o alerta.",
                variant: "destructive",
            });
        }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!alertToDelete) return;
    try {
      await deleteDoc(doc(db, "goalAlerts", alertToDelete.id));
      toast({
        title: "Alerta Deletado",
        description: "O registro foi removido com sucesso.",
        variant: "destructive",
      });
      fetchData();
    } catch (error: any) {
       if (error.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError(error, {
                operation: 'delete',
                path: `goalAlerts/${alertToDelete.id}`,
            }));
        } else {
            toast({
                title: "Erro ao deletar",
                description: "Não foi possível remover o registro.",
                variant: "destructive",
            });
        }
    } finally {
      setAlertToDelete(null);
    }
  };

  const getGoalTypeNames = (ids?: string[]) => {
    if (!ids || ids.length === 0) return "Todos";
    if (ids.length > 2) return `${ids.length} tipos`;
    return ids
      .map((id) => goalTypes.find((gt) => gt.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  };
  
  const getTargetName = (alert: GoalAlert) => {
    switch(alert.targetType){
        case 'user':
            return getEntityNames(alert.userIds, users);
        case 'branch':
             return getEntityNames(alert.branchIds, branches);
        case 'role':
            return getEntityNames(alert.roleIds, roles);
        default:
            return "Geral";
    }
  };

  const getEntityNames = (ids: string[] | undefined, entities: {id: string, name: string}[]) => {
    if (!ids || ids.length === 0) return "Todos";
    if (ids.length > 2) return `${ids.length} selecionados`;
    return ids
      .map((id) => entities.find((e) => e.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  };
  
  const getTargetIcon = (alert: GoalAlert) => {
     switch(alert.targetType){
        case 'user': return <UserIcon className="h-3 w-3" />;
        case 'branch': return <GitFork className="h-3 w-3" />;
        case 'role': return <BriefcaseBusiness className="h-3 w-3" />;
        default: return <Globe className="h-3 w-3" />;
    }
  }

  const renderAlertsTable = (alerts: GoalAlert[]) => (
    <AlertDialog>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/10">
            <TableRow className="border-border/10">
              <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground py-4">Informações do Alerta</TableHead>
              <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground py-4">Direcionamento Alvo</TableHead>
              <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground py-4">Gatilho / Condição</TableHead>
              <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground py-4">Vínculos de Meta</TableHead>
              <TableHead className="w-20 text-right pr-8">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((alert) => (
              <TableRow key={alert.id} className="border-border/5 hover:bg-primary/5 transition-colors group">
                <TableCell className="py-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground/90">{alert.name}</span>
                    <span className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{alert.message}</span>
                  </div>
                </TableCell>
                <TableCell className="py-4">
                  <Badge variant="secondary" className="gap-2 bg-background/50 border-border/10 font-medium py-1 px-3 rounded-xl shadow-sm">
                    {getTargetIcon(alert)}
                    {getTargetName(alert)}
                  </Badge>
                </TableCell>
                <TableCell className="py-4">
                  {alert.triggerType === 'level' ? (
                    <Badge variant="outline" className="gap-2 border-primary/20 bg-primary/5 text-primary font-bold py-1 px-3 rounded-xl">
                      {levelIcons[alert.triggerValue as keyof GoalLevelTargets]}
                      {alert.triggerValue}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-sky-500/20 bg-sky-500/5 text-sky-500 font-mono font-bold py-1 px-4 rounded-xl text-sm">
                      <Zap className="h-3 w-3 mr-1.5" /> {alert.triggerValue}%
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {alert.goalTypeIds && alert.goalTypeIds.length > 0 ? (
                      getGoalTypeNames(alert.goalTypeIds)
                        .split(", ")
                        .map((name) => (
                          <Badge key={name} variant="outline" className="text-[9px] font-bold uppercase tracking-wider py-0 px-2 h-5 rounded-md border-border/40 text-muted-foreground">{name}</Badge>
                        ))
                    ) : (
                      <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider py-0 px-2 h-5 rounded-md bg-muted/20 border-border/10 text-muted-foreground/50 italic">Global</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right py-4 pr-8">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary opacity-0 group-hover:opacity-100 transition-all">
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl shadow-glass border-border/20">
                      <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Gerenciar Registro</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleOpenDialog(alert)} className="rounded-lg font-medium">
                        <Pencil className="mr-2 h-4 w-4 text-primary" /> Editar Configurações
                      </DropdownMenuItem>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          className="text-red-500 focus:text-red-500 focus:bg-red-500/10 rounded-lg font-medium"
                          onSelect={(e) => {
                            e.preventDefault();
                            setAlertToDelete(alert);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Remover Alerta
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {alertToDelete && (
        <AlertDialogContent className="rounded-3xl border-border/20 shadow-glass">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-headline">Excluir gatilho de alerta?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Ao confirmar, a mensagem <strong className="text-foreground/90 mx-1 underline decoration-primary/40 underline-offset-4 font-bold">"{alertToDelete.name}"</strong> deixará de ser disparada para os vendedores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAlertToDelete(null)} className="rounded-xl">Manter Alerta</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 rounded-xl transition-all font-bold">Sim, remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold font-headline tracking-tight flex items-center gap-3">
            <BellRing className="h-10 w-10 text-primary" />
            Alertas de Metas
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Configure mensagens motivacionais automáticas para sua equipe.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              size="lg"
              className="gap-2 rounded-2xl shadow-glass hover:scale-105 transition-transform"
              onClick={() => handleOpenDialog()}
            >
              <PlusCircle className="h-5 w-5" />
              <span>Novo Alerta</span>
            </Button>
          </DialogTrigger>
          <DialogContent
            className="sm:max-w-[550px] rounded-3xl bg-background/95 backdrop-blur-xl border-border/20 shadow-glass"
            onCloseAutoFocus={handleCloseDialog}
          >
            <DialogHeader>
              <DialogTitle className="text-2xl font-headline flex items-center gap-2">
                {isEditing ? <Pencil className="h-6 w-6 text-primary" /> : <PlusCircle className="h-6 w-6 text-primary" />}
                {isEditing ? "Editar Alerta" : "Novo Alerta de Meta"}
              </DialogTitle>
              <DialogDescription className="text-base">
                Configure os gatilhos e a mensagem que os vendedores receberão.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Nome do Alerta</Label>
                <Input
                  id="name"
                  value={currentAlert.name || ""}
                  onChange={(e) =>
                    setCurrentAlert((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Ex: Quase lá! Meta de 80%"
                  className="rounded-xl bg-background/50 border-border/40 h-11 focus-visible:ring-primary/30"
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="targetType" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Direcionamento</Label>
                    <Select value={currentAlert.targetType} onValueChange={(v) => handleTargetTypeChange(v as GoalAlertTargetType)} disabled={isSubmitting}>
                       <SelectTrigger className="rounded-xl bg-background/50 border-border/40 h-11">
                          <SelectValue placeholder="Selecione" />
                       </SelectTrigger>
                       <SelectContent className="rounded-xl">
                          <SelectItem value="general">Geral (Todos)</SelectItem>
                          <SelectItem value="role">Por Função</SelectItem>
                          <SelectItem value="branch">Por Filial</SelectItem>
                          <SelectItem value="user">Por Vendedor</SelectItem>
                       </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tipo de Gatilho</Label>
                    <RadioGroup 
                        value={currentAlert.triggerType} 
                        onValueChange={(v) => setCurrentAlert(p => ({...p, triggerType: v as GoalAlertTriggerType, triggerValue: v === 'percentage' ? undefined : 'Bronze'}))}
                        className="flex items-center gap-4 h-11"
                        disabled={isSubmitting}
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="percentage" id="type-percentage" className="border-primary text-primary" />
                            <Label htmlFor="type-percentage" className="font-semibold cursor-pointer text-sm">Porcentagem</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="level" id="type-level" className="border-primary text-primary" />
                            <Label htmlFor="type-level" className="font-semibold cursor-pointer text-sm">Nível</Label>
                        </div>
                    </RadioGroup>
                 </div>
              </div>
              
              {currentAlert.targetType !== 'general' && (
                <div className="space-y-2 p-4 bg-muted/20 border border-border/10 rounded-2xl">
                   <Label htmlFor="entities" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-2">
                    {getTargetIcon(currentAlert as any)} Selecionar {currentAlert.targetType === 'role' ? 'Funções' : currentAlert.targetType === 'branch' ? 'Filiais' : 'Vendedores'}
                   </Label>
                   <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-medium rounded-xl border-border/40 hover:bg-background/80 transition-colors">
                            <span className="truncate">{getEntityNames(currentAlert[currentAlert.targetType === 'role' ? 'roleIds' : currentAlert.targetType === 'branch' ? 'branchIds' : 'userIds'] || [], currentAlert.targetType === 'role' ? roles : currentAlert.targetType === 'branch' ? branches : users)}</span>
                            <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] rounded-xl max-h-60 overflow-y-auto">
                       {(currentAlert.targetType === 'role' ? roles : currentAlert.targetType === 'branch' ? branches : users).map(entity => (
                          <DropdownMenuCheckboxItem
                              key={entity.id}
                              checked={(currentAlert[currentAlert.targetType === 'role' ? 'roleIds' : currentAlert.targetType === 'branch' ? 'branchIds' : 'userIds'] || []).includes(entity.id)}
                              onSelect={(e) => e.preventDefault()}
                              onCheckedChange={() => handleMultiSelect(currentAlert.targetType === 'role' ? 'roleIds' : currentAlert.targetType === 'branch' ? 'branchIds' : 'userIds' as any, entity.id)}
                              className="rounded-lg"
                          >
                              {entity.name}
                          </DropdownMenuCheckboxItem>
                       ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              {currentAlert.triggerType === 'percentage' ? (
                   <div className="space-y-2">
                      <Label htmlFor="percentage" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Valor do Gatilho (%)</Label>
                      <div className="relative">
                        <Zap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                        <Input
                            id="percentage"
                            type="number"
                            value={(currentAlert.triggerValue as number) || ''}
                            onChange={(e) => setCurrentAlert(p => ({ ...p, triggerValue: parseInt(e.target.value, 10) || undefined }))}
                            placeholder="Ex: 80"
                            className="rounded-xl bg-background/50 border-border/40 h-11 pl-10 font-mono text-lg font-bold"
                            disabled={isSubmitting}
                        />
                      </div>
                  </div>
              ) : (
                  <div className="space-y-2">
                      <Label htmlFor="level" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Selecionar Nível Alvo</Label>
                      <Select
                        value={currentAlert.triggerValue as string}
                        onValueChange={(v) => setCurrentAlert(p => ({...p, triggerValue: v as keyof GoalLevelTargets}))}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger className="rounded-xl bg-background/50 border-border/40 h-11">
                          <SelectValue placeholder="Selecionar nível..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {orderedLevels.map(level => (
                              <SelectItem key={level} value={level} className="rounded-lg">
                                  <div className="flex items-center gap-2 font-semibold">{levelIcons[level]} {level}</div>
                              </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                  </div>
              )}

              <div className="space-y-2">
                  <Label htmlFor="goalTypeId" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Vincular a Tipos de Meta (Opcional)</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-medium rounded-xl border-border/40 h-11">
                            <span className="truncate">
                              {currentAlert.goalTypeIds && currentAlert.goalTypeIds.length > 0 
                               ? getGoalTypeNames(currentAlert.goalTypeIds)
                               : "Válido para todas as metas"
                              }
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] rounded-xl max-h-60 overflow-y-auto">
                       <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Filtrar por Tipo</DropdownMenuLabel>
                       {goalTypes.map(gt => (
                          <DropdownMenuCheckboxItem
                              key={gt.id}
                              checked={currentAlert.goalTypeIds?.includes(gt.id)}
                              onSelect={(e) => e.preventDefault()}
                              onCheckedChange={() => handleMultiSelect('goalTypeIds' as any, gt.id)}
                              className="rounded-lg"
                          >
                              {gt.name}
                          </DropdownMenuCheckboxItem>
                       ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
               </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mensagem Gamificada</Label>
                <Textarea
                  id="message"
                  value={currentAlert.message || ""}
                  onChange={(e) =>
                    setCurrentAlert((p) => ({
                      ...p,
                      message: e.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Ex: Incrível! Você atingiu {{level}}% da sua meta! Faltam apenas alguns passos para o próximo nível. 🚀"
                  className="rounded-2xl bg-background/50 border-border/40 focus-visible:ring-primary/30 resize-none font-medium leading-relaxed p-4"
                  disabled={isSubmitting}
                />
                {currentAlert.triggerType === 'level' && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-2 italic">
                    <Info className="h-3 w-3" />
                    Utilize a tag <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-mono font-bold">{'{{level}}'}</code> para exibir o patamar alcançado.
                  </p>
                )}
              </div>
              
              <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                  <div className="space-y-1">
                    <Label htmlFor="showOnLogin" className="font-bold text-sm">Persistente no Login</Label>
                    <p className="text-xs text-muted-foreground">O alerta reaparecerá a cada login do vendedor.</p>
                  </div>
                  <Switch id="showOnLogin" checked={currentAlert.showOnLogin} onCheckedChange={(checked) => setCurrentAlert(p => ({...p, showOnLogin: checked }))} className="data-[state=checked]:bg-primary" />
              </div>
            </div>
            <DialogFooter className="border-t border-border/10 pt-4 mt-2">
              <Button
                variant="ghost"
                onClick={handleCloseDialog}
                className="rounded-xl hover:bg-muted/50"
                disabled={isSubmitting}
              >
                Descartar
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="rounded-xl px-8 shadow-glass bg-primary hover:scale-105 transition-transform">
                {isSubmitting ? (
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Finalizar Alerta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
          <Card className="border-none shadow-glass bg-card/40 backdrop-blur-xl rounded-3xl overflow-hidden group">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total de Gatilhos</CardDescription>
              <CardTitle className="text-4xl font-mono font-bold tracking-tight flex items-end gap-2">
                {alerts.length} <span className="text-sm font-sans font-medium text-muted-foreground mb-1">registros</span>
              </CardTitle>
            </CardHeader>
            <div className="absolute top-4 right-4 h-10 w-10 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <BellRing className="h-5 w-5 text-primary" />
            </div>
          </Card>
          
          <Card className="border-none shadow-glass bg-card/40 backdrop-blur-xl rounded-3xl overflow-hidden group">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-sky-500">Porcentagem</CardDescription>
              <CardTitle className="text-4xl font-mono font-bold tracking-tight">
                {alertsByPercentage.length}
              </CardTitle>
            </CardHeader>
            <div className="absolute top-4 right-4 h-10 w-10 bg-sky-500/10 rounded-2xl flex items-center justify-center group-hover:bg-sky-500/20 transition-colors">
              <Zap className="h-5 w-5 text-sky-500" />
            </div>
          </Card>

          <Card className="border-none shadow-glass bg-card/40 backdrop-blur-xl rounded-3xl overflow-hidden group">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-orange-500">Por Nível</CardDescription>
              <CardTitle className="text-4xl font-mono font-bold tracking-tight">
                {alertsByLevel.length}
              </CardTitle>
            </CardHeader>
            <div className="absolute top-4 right-4 h-10 w-10 bg-orange-500/10 rounded-2xl flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
              <Trophy className="h-5 w-5 text-orange-500" />
            </div>
          </Card>
      </div>

      <Card className="border-none shadow-glass bg-card/60 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-8 pb-4 border-b border-border/10 bg-muted/5 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-headline font-bold">Configurações de Notificação</CardTitle>
            <CardDescription className="text-base">Gerencie quando e como sua equipe será motivada.</CardDescription>
          </div>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-background/50 rounded-2xl border border-border/10">
            <Info className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Fila de Disparo</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-80 gap-4">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              </div>
              <p className="animate-pulse text-muted-foreground font-medium">Sincronizando alertas...</p>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full" defaultValue={['percentage', 'level']}>
              <AccordionItem value="percentage" className="border-none">
                <AccordionTrigger className="px-8 py-6 hover:no-underline hover:bg-muted/10 transition-colors text-xl font-headline font-bold">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-2xl bg-sky-500/10 flex items-center justify-center">
                       <Zap className="h-5 w-5 text-sky-500" />
                    </div>
                    <span>Gatilhos por Desempenho (%)</span>
                    <Badge variant="outline" className="ml-4 bg-sky-500/5 text-sky-500 border-sky-500/20 rounded-lg">{alertsByPercentage.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-8 pb-8 pt-2">
                  <div className="rounded-3xl border border-border/10 overflow-hidden bg-background/20 shadow-soft">
                    {alertsByPercentage.length > 0 ? (
                      renderAlertsTable(alertsByPercentage)
                    ) : (
                      <div className="text-center py-20 flex flex-col items-center gap-4 text-muted-foreground">
                        <AlertTriangle className="h-10 w-10 opacity-20" />
                        <p className="font-medium">Nenhum alerta de porcentagem configurado ainda.</p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="level" className="border-none">
                <AccordionTrigger className="px-8 py-6 hover:no-underline hover:bg-muted/10 transition-colors text-xl font-headline font-bold">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                       <Trophy className="h-5 w-5 text-orange-500" />
                    </div>
                    <span>Gatilhos por Patamar de Meta</span>
                    <Badge variant="outline" className="ml-4 bg-orange-500/5 text-orange-500 border-orange-500/20 rounded-lg">{alertsByLevel.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-8 pb-8 pt-2">
                  <div className="rounded-3xl border border-border/10 overflow-hidden bg-background/20 shadow-soft">
                    {alertsByLevel.length > 0 ? (
                      renderAlertsTable(alertsByLevel)
                    ) : (
                      <div className="text-center py-20 flex flex-col items-center gap-4 text-muted-foreground">
                        <AlertTriangle className="h-10 w-10 opacity-20" />
                        <p className="font-medium">Nenhum alerta por patamar configurado ainda.</p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </CardContent>
      </Card>
      <div className="h-10" />
    </div>
  );
}
