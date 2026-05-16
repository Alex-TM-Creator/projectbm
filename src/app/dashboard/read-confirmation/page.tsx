
"use client";

import * as React from "react";
import { Loader2, User, Clock, MailCheck, RefreshCw, ChevronDown } from "lucide-react";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { Notification, NotificationRead } from "@/lib/definitions";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ReadDetail = {
  notification: Notification;
  reads: NotificationRead[];
};

export default function ReadConfirmationPage() {
  const { toast } = useToast();
  const [readDetails, setReadDetails] = React.useState<ReadDetail[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);

      const [notificationsSnap, readsSnap] = await Promise.all([
        getDocs(query(collection(db, "notifications"), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "notificationReads"), orderBy("readAt", "desc")))
      ]);
      
      const notifications = notificationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      const reads = readsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotificationRead));

      const details = notifications.map(notification => {
        const notificationReads = reads.filter(read => read.notificationId === notification.id);
        return {
          notification,
          reads: notificationReads
        };
      });

      setReadDetails(details);

    } catch (error) {
      console.error("Error fetching read confirmations:", error);
      toast({
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar as confirmações de leitura.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Data indisponível";
    const date = timestamp.toDate ? timestamp.toDate() : parseISO(timestamp);
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };


  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            Confirmação de Leitura
          </h1>
          <p className="text-muted-foreground">
            Acompanhe quais usuários visualizaram cada notificação.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leituras por Notificação</CardTitle>
          <CardDescription>
            Lista de notificações e os usuários que as visualizaram.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : readDetails.length === 0 ? (
             <div className="text-center text-muted-foreground py-10">Nenhuma notificação encontrada.</div>
          ) : (
            <Accordion type="multiple" className="w-full space-y-2">
              {readDetails.map(({ notification, reads }) => (
                <AccordionItem value={notification.id} key={notification.id} className="border rounded-lg">
                  <AccordionTrigger className="p-4 hover:no-underline">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex flex-col text-left">
                            <span className="font-medium">{notification.title}</span>
                             <span className="text-xs text-muted-foreground">
                                Publicada em: {formatDate(notification.createdAt)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mr-4">
                            <User className="h-4 w-4"/>
                            <span>{reads.length} leituras</span>
                        </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 pt-0">
                    {reads.length > 0 ? (
                        <ul className="space-y-3">
                            {reads.map(read => (
                                <li key={read.id} className="flex items-center justify-between rounded-md bg-muted/50 p-3">
                                    <div className="flex items-center gap-3">
                                        <span className="font-medium">{read.userName}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3"/>
                                        <span>{formatDate(read.readAt)}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-sm text-muted-foreground py-4">Nenhuma leitura registrada para esta notificação.</p>
                    )}
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
