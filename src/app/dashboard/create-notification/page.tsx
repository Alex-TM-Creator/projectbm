
"use client";

import * as React from "react";
import { Loader2, Send, CalendarIcon, BriefcaseBusiness, Link as LinkIcon, RefreshCw } from "lucide-react";
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Role, NavigationItem } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSafePath } from "@/lib/navigation-helpers";
import { Switch } from "@/components/ui/switch";


export default function CreateNotificationPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [text, setText] = React.useState("");
  const [startDate, setStartDate] = React.useState<Date | undefined>();
  const [endDate, setEndDate] = React.useState<Date | undefined>();
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [targetRoleIds, setTargetRoleIds] = React.useState<string[]>([]);
  const [link, setLink] = React.useState<string | undefined>();
  const [navItems, setNavItems] = React.useState<NavigationItem[]>([]);
  const [showOnEveryLogin, setShowOnEveryLogin] = React.useState(false);
  const [callToAction, setCallToAction] = React.useState("Clique aqui e saiba mais.");

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [rolesSnap, navSnap] = await Promise.all([
            getDocs(collection(db, "roles")),
            getDocs(query(collection(db, "navigation"), orderBy("order")))
        ]);
        setRoles(rolesSnap.docs.map(d => ({id: d.id, ...d.data()} as Role)));
        setNavItems(navSnap.docs.map(d => ({id: d.id, ...d.data()} as NavigationItem)).filter(item => item.path));
      } catch (error) {
        toast({ title: "Erro ao buscar dados", variant: "destructive" });
      }
    };
    fetchData();
  }, [toast]);

  const resetForm = () => {
    setTitle("");
    setText("");
    setStartDate(undefined);
    setEndDate(undefined);
    setTargetRoleIds([]);
    setLink(undefined);
    setShowOnEveryLogin(false);
    setCallToAction("Clique aqui e saiba mais.");
  };

  const handleRoleSelection = (roleId: string) => {
    setTargetRoleIds(prev => {
      if (roleId === 'all') {
        return prev.length === roles.length ? [] : roles.map(r => r.id);
      }
      const newSelection = [...prev];
      const index = newSelection.indexOf(roleId);
      if (index > -1) {
        newSelection.splice(index, 1);
      } else {
        newSelection.push(roleId);
      }
      return newSelection;
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !text.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Título e texto da notificação são necessários.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const notificationsCollection = collection(db, "notifications");
      await addDoc(notificationsCollection, {
        title,
        text,
        createdAt: serverTimestamp(),
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
        targetRoleIds: targetRoleIds,
        link: link || null,
        showOnEveryLogin: showOnEveryLogin,
        callToAction: showOnEveryLogin ? callToAction : null,
      });

      toast({
        title: "Notificação Criada!",
        description: "Sua nova notificação foi salva e está pronta para ser visualizada.",
      });

      resetForm();
    } catch (error) {
      console.error("Error creating notification: ", error);
      toast({
        title: "Erro ao criar notificação",
        description: "Não foi possível salvar a notificação.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const selectedRolesText = React.useMemo(() => {
    if (targetRoleIds.length === 0) return "Para todos";
    if (targetRoleIds.length === roles.length) return "Para todos";
    if (targetRoleIds.length === 1) return roles.find(r => r.id === targetRoleIds[0])?.name;
    return `${targetRoleIds.length} funções selecionadas`;
  }, [targetRoleIds, roles]);

  return (
    <div className="flex flex-col gap-6">
       <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Criar Notificação</h1>
        <p className="text-muted-foreground">Escreva uma mensagem para enviar aos usuários.</p>
      </div>
      <form onSubmit={handleSubmit}>
        <Card className="mx-auto max-w-3xl">
          <CardHeader>
            <CardTitle>Nova Notificação</CardTitle>
            <CardDescription>
              Preencha os detalhes abaixo para publicar uma nova notificação no feed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base">Título da Notificação</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Manutenção Agendada" disabled={isSubmitting} />
            </div>

            <div className="space-y-2">
                <Label className="text-base">Direcionamento</Label>
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
                            checked={targetRoleIds.length === roles.length && roles.length > 0}
                            onCheckedChange={() => handleRoleSelection('all')}
                        >
                            Todos
                        </DropdownMenuCheckboxItem>
                         <DropdownMenuSeparator />
                        {roles.map(role => (
                            <DropdownMenuCheckboxItem
                                key={role.id}
                                checked={targetRoleIds.includes(role.id)}
                                onCheckedChange={() => handleRoleSelection(role.id)}
                            >
                                {role.name}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="startDate">Data de Início (Opcional)</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                            "w-full justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                            )}
                            disabled={isSubmitting}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, "dd 'de' MMMM, yyyy", { locale: ptBR }) : <span>Sempre ativa</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus
                            locale={ptBR}
                        />
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="space-y-2">
                     <Label htmlFor="endDate">Data de Fim (Opcional)</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                            )}
                            disabled={isSubmitting}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "dd 'de' MMMM, yyyy", { locale: ptBR }) : <span>Sem data final</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus
                            locale={ptBR}
                            disabled={{ before: startDate }}
                        />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="text" className="text-base">Texto da Notificação</Label>
              <Textarea id="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva sua notificação aqui..." rows={8} disabled={isSubmitting} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="link" className="text-base">Link (Opcional)</Label>
              <Select value={link} onValueChange={setLink}>
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
               <p className="text-xs text-muted-foreground">Redireciona o usuário para uma página ao clicar na notificação.</p>
            </div>
            
            <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="showOnEveryLogin" className="text-base">Mostrar a cada login</Label>
                        <p className="text-xs text-muted-foreground">
                        Se ativado, este pop-up aparecerá toda vez que o usuário entrar.
                        </p>
                    </div>
                    <Switch
                        id="showOnEveryLogin"
                        checked={showOnEveryLogin}
                        onCheckedChange={setShowOnEveryLogin}
                        disabled={isSubmitting}
                    />
                </div>
                {showOnEveryLogin && (
                    <div className="space-y-2 pt-2 border-t border-dashed">
                        <Label htmlFor="callToAction">Texto da Chamada para Ação</Label>
                        <Input 
                            id="callToAction"
                            value={callToAction}
                            onChange={(e) => setCallToAction(e.target.value)}
                            placeholder="Clique aqui para saber mais"
                            disabled={isSubmitting}
                        />
                    </div>
                )}
            </div>
            
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isSubmitting} size="lg">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Publicar Notificação
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
