
"use client";

import * as React from "react";
import { 
  Download, 
  Upload, 
  Loader2, 
  Save, 
  ShieldAlert, 
  RefreshCcw,
  CheckCircle2,
  FileJson
} from "lucide-react";
import { 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  setDoc,
  deleteDoc,
  query,
  getDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Lista de todas as coleções que devem ser incluídas no backup
const COLLECTIONS_TO_BACKUP = [
  "users",
  "roles",
  "companies",
  "branches",
  "companyBranches",
  "navigation",
  "goaltypes",
  "awardtypes",
  "periodgroups",
  "goals",
  "pegaPixGoals",
  "pegaPixAwards",
  "campaigns",
  "notifications",
  "products",
  "productCategories",
  "productTypes",
  "brands",
  "productModalities",
  "markups",
  "stockingLocations",
  "productStock",
  "stockMovements",
  "suppliers",
  "customers",
  "customerCredits",
  "services",
  "saleTypes",
  "deliveryTypes",
  "paymentMethods",
  "salesOrders",
  "astec",
  "astecLaudos",
  "reversalRequests",
  "discountApprovals",
  "discountLimits",
  "caixas",
  "caixaContas",
  "caixaClosingAuthorizations",
  "deliveryAssistants",
  "drivers",
  "teams",
  "fiscalObligations",
  "freightCepRanges",
  "cleaningProducts",
  "cleaningRequests",
  "statuses",
  "purchaseOrders",
  "transferOrders",
  "deliveryPaymentOrders",
  "deliveryTeamPaymentOrders",
  "assemblyClosings",
  "montadores",
  "labelTemplates",
  "notificationReads",
  "accessLogs",
  "roleAccess",
  "goalAlerts",
  "userRoles",
  "paymentHistory"
];

// Documentos específicos na coleção settings
const SETTINGS_DOCS = [
  "priceColumnConfig",
  "salesPermissions",
  "loginConfiguration"
];

export default function BackupPage() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [showImportDialog, setShowImportDialog] = React.useState(false);
  const [importData, setImportData] = React.useState<any>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);
    const backup: { [key: string]: any[] } = {};
    const totalTasks = COLLECTIONS_TO_BACKUP.length + 1; // +1 for settings
    let completedTasks = 0;

    try {
      // Backup general collections
      for (const colName of COLLECTIONS_TO_BACKUP) {
        const snap = await getDocs(collection(db, colName));
        backup[colName] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        completedTasks++;
        setProgress(Math.round((completedTasks / totalTasks) * 100));
      }

      // Backup settings docs
      backup["settings"] = [];
      for (const docId of SETTINGS_DOCS) {
        const docSnap = await getDoc(doc(db, "settings", docId));
        if (docSnap.exists()) {
          backup["settings"].push({ id: docSnap.id, ...docSnap.data() });
        }
      }
      completedTasks++;
      setProgress(100);

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `conecta_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Exportação Concluída!",
        description: "O arquivo de backup foi gerado com sucesso.",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Erro na Exportação",
        description: "Não foi possível gerar o backup dos dados.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setImportData(data);
        setShowImportDialog(true);
      } catch (error) {
        toast({
          title: "Arquivo Inválido",
          description: "O arquivo selecionado não é um JSON de backup válido.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    if (!importData) return;
    setIsImporting(true);
    setProgress(0);
    setShowImportDialog(false);

    const collections = Object.keys(importData);
    const totalCollections = collections.length;
    let completedCollections = 0;

    try {
      for (const colName of collections) {
        const docsArray = importData[colName];
        if (!Array.isArray(docsArray)) {
          completedCollections++;
          continue;
        }

        // Process in batches of 400 (Firebase limit is 500)
        for (let i = 0; i < docsArray.length; i += 400) {
          const batch = writeBatch(db);
          const chunk = docsArray.slice(i, i + 400);

          chunk.forEach((data) => {
            const { id, ...rest } = data;
            if (id) {
              const docRef = doc(db, colName, id);
              batch.set(docRef, rest);
            }
          });

          await batch.commit();
        }
        
        completedCollections++;
        setProgress(Math.round((completedCollections / totalCollections) * 100));
      }

      toast({
        title: "Restauração Concluída!",
        description: "Todos os dados foram importados com sucesso.",
      });
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Erro na Restauração",
        description: "Ocorreu um erro ao tentar restaurar os dados.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setImportData(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <Save /> Backup do Sistema
          </h1>
          <p className="text-muted-foreground">
            Exporte ou restaure toda a base de dados do sistema Conecta.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" /> Exportar Dados
            </CardTitle>
            <CardDescription>
              Baixe um arquivo contendo todas as informações cadastradas no sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Este arquivo incluirá usuários, produtos, vendas, metas, configurações de acesso, logs, alertas e histórico de pagamentos. 
              Recomendamos realizar este procedimento periodicamente.
            </p>
            {isExporting && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-center text-xs text-muted-foreground">{progress}% processado</p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              onClick={handleExport} 
              disabled={isExporting || isImporting}
            >
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Gerar Backup Geral
            </Button>
          </CardFooter>
        </Card>

        {/* Import Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-amber-600" /> Restaurar Sistema
            </CardTitle>
            <CardDescription>
              Carregue um arquivo de backup para restaurar a base de dados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>ATENÇÃO:</strong> Restaurar um backup irá sobrescrever dados existentes que possuam o mesmo ID. 
                Certifique-se de que o arquivo é recente e confiável.
              </p>
            </div>
            {isImporting && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-center text-xs text-muted-foreground">{progress}% restaurado</p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              className="w-full border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-900/20"
              onClick={() => fileInputRef.current?.click()}
              disabled={isExporting || isImporting}
            >
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileJson className="mr-2 h-4 w-4" />}
              Selecionar Arquivo de Backup
            </Button>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".json" 
              className="hidden" 
              onChange={handleFileChange}
            />
          </CardFooter>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Informações Técnicas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>Formato: JSON</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>Coleções incluídas: {COLLECTIONS_TO_BACKUP.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>Processamento: Assíncrono</span>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Restauração Geral?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Você está prestes a restaurar a base de dados a partir de um arquivo externo. 
                Isso afetará todas as tabelas do sistema.
              </p>
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-xs font-semibold">
                Esta ação pode causar inconsistências se o backup não for compatível com a versão atual do sistema.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setImportData(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleImport}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Sim, Restaurar Dados
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
