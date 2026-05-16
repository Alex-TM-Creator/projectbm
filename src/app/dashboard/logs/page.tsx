
"use client";

import * as React from "react";
import { Loader2, User, Clock, FileText, Calendar, Filter, RefreshCw, ChevronDown } from "lucide-react";
import { collection, getDocs, query, orderBy as firestoreOrderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { AccessLog, NavigationItem } from "@/lib/definitions";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type PageAccessDetail = {
  count: number;
  title: string;
  timestamps: Date[];
};

type AggregatedLog = {
  userId: string;
  userName: string;
  userAvatar: string;
  totalAccesses: number;
  lastAccess: Date;
  pageAccesses: {
    [path: string]: PageAccessDetail;
  };
};

export default function LogsPage() {
  const { toast } = useToast();
  const [logs, setLogs] = React.useState<AggregatedLog[]>([]);
  const [navItems, setNavItems] = React.useState<Map<string, string>>(new Map());
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);

      const [logsSnap, navSnap] = await Promise.all([
        getDocs(query(collection(db, "accessLogs"), firestoreOrderBy("timestamp", "desc"), limit(2000))),
        getDocs(collection(db, "navigation"))
      ]);
      
      const navItemsMap = new Map<string, string>();
      navSnap.docs.forEach(doc => {
          const item = doc.data() as NavigationItem;
          const safePath = item.path?.startsWith('/') ? item.path : `/dashboard/${item.path}`;
          if(item.path) {
            navItemsMap.set(safePath, item.title);
          }
      });
      navItemsMap.set('/dashboard', 'Painel de Controle');
      setNavItems(navItemsMap);
      
      const rawLogs = logsSnap.docs.map(doc => doc.data() as AccessLog);

      const aggregated: { [userId: string]: AggregatedLog } = {};

      rawLogs.forEach(log => {
        if (!log.timestamp) {
            return; // Skip logs without a timestamp
        }

        if (!aggregated[log.userId]) {
          aggregated[log.userId] = {
            userId: log.userId,
            userName: log.userName,
            userAvatar: log.userAvatar,
            totalAccesses: 0,
            lastAccess: new Date(0),
            pageAccesses: {},
          };
        }

        const userLog = aggregated[log.userId];
        userLog.totalAccesses += 1;
        
        const accessTime = log.timestamp.toDate();
        if (accessTime > userLog.lastAccess) {
          userLog.lastAccess = accessTime;
        }

        if (!userLog.pageAccesses[log.path]) {
          userLog.pageAccesses[log.path] = {
            count: 0,
            title: navItemsMap.get(log.path) || log.path.split('/').pop() || 'Início',
            timestamps: [],
          };
        }
        userLog.pageAccesses[log.path].count += 1;
        userLog.pageAccesses[log.path].timestamps.push(accessTime);
      });

      const sortedLogs = Object.values(aggregated).sort((a, b) => b.lastAccess.getTime() - a.lastAccess.getTime());
      setLogs(sortedLogs);

    } catch (error) {
      console.error("Error fetching logs:", error);
      toast({
        title: "Erro ao buscar logs",
        description: "Não foi possível carregar os registros de acesso.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalLogins = React.useMemo(() => logs.reduce((sum, log) => sum + log.totalAccesses, 0), [logs]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            Log de Acessos
          </h1>
          <p className="text-muted-foreground">
            Monitore a atividade dos usuários no sistema.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
        </Button>
      </div>

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
            <p className="text-xs text-muted-foreground">Usuários com atividade recente</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Acessos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLogins}</div>
            <p className="text-xs text-muted-foreground">Visualizações de página registradas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Atividade dos Usuários</CardTitle>
          <CardDescription>
            Detalhes dos acessos por usuário, ordenados pelo mais recente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {logs.map((log) => (
                <AccordionItem value={log.userId} key={log.userId}>
                  <AccordionTrigger>
                    <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                            <Avatar>
                                <AvatarImage src={log.userAvatar} />
                                <AvatarFallback>{log.userName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{log.userName}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <FileText className="h-4 w-4"/>
                                <span>{log.totalAccesses} acessos</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4"/>
                                <span>Último acesso {formatDistanceToNow(log.lastAccess, { addSuffix: true, locale: ptBR })}</span>
                            </div>
                        </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="p-2 space-y-2">
                        {Object.entries(log.pageAccesses)
                            .sort(([, a], [, b]) => b.count - a.count)
                            .map(([path, data]) => (
                            <Collapsible key={path} className="space-y-2">
                                <div className="flex items-center justify-between rounded-md bg-muted/50 p-2 text-sm">
                                    <CollapsibleTrigger asChild>
                                        <div className="flex flex-1 items-center cursor-pointer">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-muted-foreground">{data.title}</span>
                                                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                                            </div>
                                        </div>
                                    </CollapsibleTrigger>
                                     <Badge variant="secondary">{data.count} {data.count > 1 ? 'visitas' : 'visita'}</Badge>
                                </div>
                                <CollapsibleContent className="space-y-1 pl-4">
                                  {data.timestamps
                                    .sort((a,b) => b.getTime() - a.getTime())
                                    .map((ts, index) => (
                                      <div key={index} className="text-xs text-muted-foreground font-mono ml-4 border-l pl-4 py-1">
                                        {format(ts, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                                      </div>
                                  ))}
                                </CollapsibleContent>
                            </Collapsible>
                        ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
