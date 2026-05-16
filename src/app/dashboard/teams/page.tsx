
"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, Users, Car, User } from "lucide-react";
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
import type { Team, Driver, DeliveryAssistant } from "@/lib/definitions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export default function TeamsPage() {
  const { toast } = useToast();
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [drivers, setDrivers] = React.useState<Driver[]>([]);
  const [assistants, setAssistants] = React.useState<DeliveryAssistant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currentTeam, setCurrentTeam] = React.useState<Partial<Team>>({ assistantIds: [] });
  const [teamToDelete, setTeamToDelete] = React.useState<Team | null>(null);

  const isEditing = !!currentTeam.id;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [teamsSnap, driversSnap, assistantsSnap] = await Promise.all([
        getDocs(query(collection(db, "teams"), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "drivers"))),
        getDocs(query(collection(db, "deliveryAssistants"))),
      ]);
      setTeams(teamsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Team)));
      
      const allDrivers = driversSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Driver));
      const allAssistants = assistantsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DeliveryAssistant));

      setDrivers(allDrivers.filter(d => d.isActive));
      setAssistants(allAssistants.filter(a => a.isActive));

    } catch (error) {
      console.error(error);
      toast({
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar as equipes, motoristas ou ajudantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (team?: Team) => {
    setCurrentTeam(team || { assistantIds: [] });
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentTeam({ assistantIds: [] });
    setOpen(false);
  };

  const handleAssistantSelection = (assistantId: string) => {
    setCurrentTeam(prev => {
        const newAssistantIds = [...(prev?.assistantIds || [])];
        const index = newAssistantIds.indexOf(assistantId);
        if(index > -1) {
            newAssistantIds.splice(index, 1);
        } else {
            newAssistantIds.push(assistantId);
        }
        return {...prev, assistantIds: newAssistantIds};
    });
  }

  const handleSubmit = async () => {
    if (!currentTeam.name || !currentTeam.driverId) {
      toast({ title: "Campos obrigatórios", description: "Nome da equipe e motorista são obrigatórios.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const driver = drivers.find(d => d.id === currentTeam.driverId);
      const assistantNames = (currentTeam.assistantIds || []).map(id => assistants.find(a => a.id === id)?.name || '');

      const dataToSave = {
        name: currentTeam.name,
        driverId: currentTeam.driverId,
        driverName: driver?.name || 'N/A', // Save driver name
        assistantIds: currentTeam.assistantIds || [],
        assistantNames: assistantNames, // Save assistant names
      };

      if (isEditing) {
        const docRef = doc(db, "teams", currentTeam.id!);
        await updateDoc(docRef, dataToSave as any);
        toast({ title: "Equipe Atualizada!" });
      } else {
        await addDoc(collection(db, "teams"), { ...dataToSave, createdAt: serverTimestamp() });
        toast({ title: "Equipe Criada!" });
      }
      handleCloseDialog();
      fetchData();
    } catch (error) {
      toast({ title: isEditing ? "Erro ao atualizar" : "Erro ao criar equipe", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!teamToDelete) return;
    try {
      await deleteDoc(doc(db, "teams", teamToDelete.id));
      toast({ title: "Equipe Deletada", variant: "destructive" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    } finally {
      setTeamToDelete(null);
    }
  };
  
  const getDriverName = (id: string) => drivers.find(d => d.id === id)?.name || "N/A";
  const getAssistantName = (id: string) => assistants.find(d => d.id === id)?.name || "N/A";

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
              <Users /> Equipes
            </h1>
            <p className="text-muted-foreground">
              Gerencie suas equipes de entrega vinculando motoristas e ajudantes.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Nova Equipe</span>
              </Button>
            </DialogTrigger>
            <DialogContent onCloseAutoFocus={handleCloseDialog}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Equipe' : 'Nova Equipe'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                 <div className="space-y-2">
                  <Label htmlFor="name">Nome da Equipe</Label>
                  <Input
                    id="name"
                    value={currentTeam.name || ""}
                    onChange={(e) => setCurrentTeam({...currentTeam, name: e.target.value})}
                    placeholder="Ex: Equipe Alpha"
                    disabled={isSubmitting}
                  />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="driverId">Motorista</Label>
                  <Select value={currentTeam.driverId} onValueChange={(v) => setCurrentTeam(p => ({...p, driverId: v}))}>
                    <SelectTrigger><SelectValue placeholder="Selecione um motorista" /></SelectTrigger>
                    <SelectContent>
                        {drivers.map(driver => <SelectItem key={driver.id} value={driver.id}>{driver.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                    <Label>Ajudantes</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-start font-normal">
                              {currentTeam.assistantIds && currentTeam.assistantIds.length > 0 
                               ? `${currentTeam.assistantIds.length} selecionado(s)`
                               : "Selecione os ajudantes"
                              }
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-64 max-h-60 overflow-y-auto">
                         <DropdownMenuLabel>Ajudantes Disponíveis</DropdownMenuLabel>
                         <DropdownMenuSeparator />
                         {assistants.map(at => (
                            <DropdownMenuCheckboxItem
                                key={at.id}
                                checked={currentTeam.assistantIds?.includes(at.id)}
                                onSelect={(e) => e.preventDefault()}
                                onCheckedChange={() => handleAssistantSelection(at.id)}
                            >
                                {at.name}
                            </DropdownMenuCheckboxItem>
                         ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
            <CardTitle>Lista de Equipes</CardTitle>
            <CardDescription>
              Total de {teams.length} equipes cadastradas.
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
                    <TableHead>Nome da Equipe</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Ajudantes</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1.5">
                            <Car className="h-3 w-3" />
                            {getDriverName(team.driverId)}
                        </Badge>
                      </TableCell>
                       <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {team.assistantIds.map(id => (
                            <Badge key={id} variant="secondary" className="gap-1.5">
                                <User className="h-3 w-3" />
                                {getAssistantName(id)}
                            </Badge>
                          ))}
                           {team.assistantIds.length === 0 && <span className="text-xs text-muted-foreground">Nenhum</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDialog(team)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-red-600" onSelect={(e) => { e.preventDefault(); setTeamToDelete(team);}}><Trash2 className="mr-2 h-4 w-4" />Deletar</DropdownMenuItem>
                            </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {teamToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação irá deletar permanentemente a equipe <strong className="mx-1">{teamToDelete.name}</strong>.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setTeamToDelete(null)}>Cancelar</AlertDialogCancel>
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
