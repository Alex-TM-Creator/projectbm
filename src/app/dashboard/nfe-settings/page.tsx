"use client";

import * as React from "react";
import { 
  FileText, 
  Settings, 
  FileEdit, 
  Hash, 
  Printer, 
  Mail, 
  Save, 
  Loader2 
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Info, TriangleAlert, ExternalLink, X, Trash2, PlusCircle, BadgeCheck, Lock, CheckCircle2, UploadCloud } from "lucide-react";
import { collection, getDocs, query, orderBy, doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { CompanyBranch } from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";

interface NfeSettings {
  // Emissão
  versaoLayout: string;
  ambiente: string;
  
  // Gerais
  buscaAutomaticaAtiva: boolean;
  buscaAutomaticaBranchesIds: string[];
  exibirTotais: boolean;
  lancarEstoqueEmitir: boolean;
  lancarContasEmitir: boolean;
  marcarEnvioEmail: boolean;
  lancarGnreDare: boolean;
  armazenarDare: boolean;
  considerarDataVenda: boolean;
  considerarDataOs: boolean;
  emissaoAutomaticaLote: string;
  consultarRecibo: boolean;
  bloquearEdicaoEstoque: boolean;
  bloquearEdicaoConta: boolean;
  automacaoContasPagar: boolean;
  lancarEstoqueCheckin: boolean;
  desabilitarReforma: boolean;

  // Preenchimento
  fretePadrão: string;
  markupPreço: string;
  especiePadrao: string;
  marcaPadrao: string;
  modeloPadrao: string;
  autorizados: Array<{ id: string; contato: string; cpfCnpj: string }>;
  
  // Switches preenchimento
  cobrarIpi: boolean;
  cobrarIcmsSt: boolean;
  considerarTotalNota: boolean;
  mostrarCodigoRastreio: boolean;
  somarPeso: boolean;
  calcularVolume: boolean;
  informarDesconto: boolean;
  adicionarNumeroOs: boolean;
  adicionarDadosEndereco: boolean;
  exibirCombustiveis: boolean;
  exibirArmamento: boolean;
  exibirVeiculos: boolean;
  exibirBebidas: boolean;
  exibirRetencao: boolean;
  preencherManualmenteDestino: boolean;
  incluirTransportadoraAutorizada: boolean;
  
  descontarIpiBaseIcms: boolean;
  incluirFreteBaseIcms: boolean;
  exibirCstIcms: boolean;
  preencherObsFisco: boolean;
  preencherInfoAdic: boolean;
  habilitarCbenef: boolean;
  bloquearSemCbenef: boolean;
  removerZerosMatriz: boolean;
  atualizarPrecoVenda: boolean;
  descontarIcmsBasePisCofins: boolean;
  desprezarIcmsDesonerado: boolean;
  valorIpiBasePisCofins: boolean;
  informarImpostoDevolvido: boolean;
  informarPesoLiquido: boolean;
  somarFreteValorTotal: boolean;
  somarDespesasValorTotal: boolean;
  somarSeguroValorTotal: boolean;

  // Auto atualização
  autoNcm: boolean;
  autoGtin: boolean;
  autoCest: boolean;
  autoDescricao: boolean;

  // Numeração
  numeracoes: Array<{ id: string; branchId: string; serie: string; proximoNumero: string }>;

  // Impressão
  danfeItensPagina: string;
  danfeItensOutrasPaginas: string;
  danfeListarProdutosSimplificado: boolean;
  danfeExibirTotalSimplificado: boolean;
  danfeExibirCanhoto: boolean;
  danfeExibirDataHora: boolean;
  danfeExibirObsFisco: boolean;
  danfeImprimirSimplificada: boolean;
  danfeImprimirResumida: boolean;
  danfeImprimirVias: string;

  // Email
  emailCopiaTransportadora: boolean;
  emailEnviarBoleto: boolean;
  emailAssuntoPadrão: string;
  emailCopiaPadrao: string;
  emailRemetentePadrao: string;
  emailRespostaPadrao: string;
}

const defaultSettings: NfeSettings = {
  versaoLayout: "4.00",
  ambiente: "1",
  buscaAutomaticaAtiva: true,
  buscaAutomaticaBranchesIds: [],
  exibirTotais: true,
  lancarEstoqueEmitir: true,
  lancarContasEmitir: true,
  marcarEnvioEmail: true,
  lancarGnreDare: false,
  armazenarDare: false,
  considerarDataVenda: true,
  considerarDataOs: false,
  emissaoAutomaticaLote: "nao-emitir",
  consultarRecibo: true,
  bloquearEdicaoEstoque: false,
  bloquearEdicaoConta: false,
  automacaoContasPagar: true,
  lancarEstoqueCheckin: false,
  desabilitarReforma: false,
  fretePadrão: "0",
  markupPreço: "0,00",
  especiePadrao: "volume",
  marcaPadrao: "",
  modeloPadrao: "",
  autorizados: [],
  cobrarIpi: false,
  cobrarIcmsSt: false,
  considerarTotalNota: false,
  mostrarCodigoRastreio: true,
  somarPeso: false,
  calcularVolume: true,
  informarDesconto: false,
  adicionarNumeroOs: false,
  adicionarDadosEndereco: false,
  exibirCombustiveis: false,
  exibirArmamento: false,
  exibirVeiculos: false,
  exibirBebidas: false,
  exibirRetencao: true,
  preencherManualmenteDestino: false,
  incluirTransportadoraAutorizada: false,
  descontarIpiBaseIcms: false,
  incluirFreteBaseIcms: false,
  exibirCstIcms: false,
  preencherObsFisco: false,
  preencherInfoAdic: false,
  habilitarCbenef: false,
  bloquearSemCbenef: false,
  removerZerosMatriz: false,
  atualizarPrecoVenda: false,
  descontarIcmsBasePisCofins: false,
  desprezarIcmsDesonerado: false,
  valorIpiBasePisCofins: false,
  informarImpostoDevolvido: false,
  informarPesoLiquido: false,
  somarFreteValorTotal: false,
  somarDespesasValorTotal: false,
  somarSeguroValorTotal: false,
  autoNcm: true,
  autoGtin: true,
  autoCest: true,
  autoDescricao: true,
  numeracoes: [],
  danfeItensPagina: "7",
  danfeItensOutrasPaginas: "47",
  danfeListarProdutosSimplificado: true,
  danfeExibirTotalSimplificado: true,
  danfeExibirCanhoto: true,
  danfeExibirDataHora: true,
  danfeExibirObsFisco: true,
  danfeImprimirSimplificada: false,
  danfeImprimirResumida: false,
  danfeImprimirVias: "1",
  emailCopiaTransportadora: false,
  emailEnviarBoleto: true,
  emailAssuntoPadrão: "DANFE",
  emailCopiaPadrao: "",
  emailRemetentePadrao: "",
  emailRespostaPadrao: "",
};

export default function NfeSettingsPage() {
  const { toast } = useToast();
  // Configurações unificadas
  const [settings, setSettings] = React.useState<NfeSettings>(defaultSettings);
  const [branches, setBranches] = React.useState<CompanyBranch[]>([]);
  
  const [isSaving, setIsSaving] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("certificado");
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>("");
  const [serie, setSerie] = React.useState("001");
  const [nextNumber, setNextNumber] = React.useState("1");

  const [selectedBuscaBranchId, setSelectedBuscaBranchId] = React.useState<string>("");

  const [selectedCertBranchId, setSelectedCertBranchId] = React.useState<string>("");
  const [isUploadingCert, setIsUploadingCert] = React.useState(false);
  const certFileInputRef = React.useRef<HTMLInputElement>(null);

  const [autorizadoContato, setAutorizadoContato] = React.useState("");
  const [autorizadoCpfCnpj, setAutorizadoCpfCnpj] = React.useState("");

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCertBranchId) return;

    setIsUploadingCert(true);
    try {
      const storageRef = ref(storage, `certificates/${selectedCertBranchId}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      const branchRef = doc(db, "companyBranches", selectedCertBranchId);
      await updateDoc(branchRef, {
        certificateUrl: downloadURL,
        certificateFileName: file.name,
        certificateUpdatedAt: new Date().toISOString(),
        // Em um cenário real, a data de expiração seria extraída do PFX via lib ou cloud function
        certificateExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), 
      });

      toast({ title: "Certificado enviado com sucesso!" });
      fetchData(); // Recarrega os dados para mostrar o certificado atualizado
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao enviar certificado", variant: "destructive" });
    } finally {
      setIsUploadingCert(false);
      if (certFileInputRef.current) certFileInputRef.current.value = "";
    }
  };

  const fetchData = async () => {
    try {
      const branchesSnap = await getDocs(query(collection(db, "companyBranches"), orderBy("razao_social")));
      const branchesData = branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as CompanyBranch));
      setBranches(branchesData);

      const settingsSnap = await getDoc(doc(db, "settings", "nfe_settings"));
      if (settingsSnap.exists()) {
        setSettings({ ...defaultSettings, ...settingsSnap.data() });
      }
    } catch (e) {
      console.error("Erro ao carregar dados", e);
      toast({ title: "Erro ao carregar configurações", variant: "destructive" });
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const updateSetting = (key: keyof NfeSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleAddNumeration = () => {
    if (!selectedBranchId || !serie || !nextNumber) return;
    
    const newNum = { 
      id: Date.now().toString(), 
      branchId: selectedBranchId, 
      serie, 
      proximoNumero: nextNumber 
    };

    updateSetting("numeracoes", [...settings.numeracoes, newNum]);
    setSelectedBranchId("");
    setSerie("001");
    setNextNumber("1");
  };

  const handleRemoveNumeration = (id: string) => {
    updateSetting("numeracoes", settings.numeracoes.filter(c => c.id !== id));
  };

  const handleAddBuscaBranch = () => {
    if (!selectedBuscaBranchId) return;
    if (settings.buscaAutomaticaBranchesIds.includes(selectedBuscaBranchId)) return;

    updateSetting("buscaAutomaticaBranchesIds", [...settings.buscaAutomaticaBranchesIds, selectedBuscaBranchId]);
    setSelectedBuscaBranchId("");
  };

  const handleRemoveBuscaBranch = (id: string) => {
    updateSetting("buscaAutomaticaBranchesIds", settings.buscaAutomaticaBranchesIds.filter(bid => bid !== id));
  };

  const handleAddAutorizado = () => {
    if (!autorizadoCpfCnpj || !autorizadoContato) return;
    const newAuth = { id: Date.now().toString(), contato: autorizadoContato, cpfCnpj: autorizadoCpfCnpj };
    updateSetting("autorizados", [...settings.autorizados, newAuth]);
    setAutorizadoCpfCnpj("");
    setAutorizadoContato("");
  };

  const handleRemoveAutorizado = (id: string) => {
    updateSetting("autorizados", settings.autorizados.filter(a => a.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "settings", "nfe_settings"), settings);
      toast({ title: "Configurações salvas com sucesso!" });
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const sections = [
    { id: "certificado", title: "Configurações de certificado", icon: <BadgeCheck className="h-4 w-4" /> },
    { id: "emissao", title: "Configurações de emissão", icon: <FileText className="h-4 w-4" /> },
    { id: "gerais", title: "Configurações gerais", icon: <Settings className="h-4 w-4" /> },
    { id: "preenchimento", title: "Configurações de preenchimento", icon: <FileEdit className="h-4 w-4" /> },
    { id: "numeracao", title: "Controle de numeração", icon: <Hash className="h-4 w-4" /> },
    { id: "impressao", title: "Configurações de impressão", icon: <Printer className="h-4 w-4" /> },
    { id: "email", title: "Configurações de email", icon: <Mail className="h-4 w-4" /> },
  ];

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight text-zinc-900 dark:text-zinc-50">Configuração de NF-e</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie todas as preferências e regras de emissão de Notas Fiscais Eletrônicas.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start w-full">
        <Tabs 
            orientation="vertical" 
            value={activeTab} 
            onValueChange={setActiveTab} 
            className="flex flex-col md:flex-row gap-6 w-full"
        >
          {/* Navegação lateral */}
          <div className="flex flex-col gap-6 w-full md:w-72 shrink-0">
            <Card className="border-none shadow-sm bg-muted/30">
              <CardContent className="p-2">
                <TabsList className="flex flex-col h-auto bg-transparent items-stretch w-full gap-1 p-0">
                    {sections.map((section) => (
                      <TabsTrigger 
                          key={section.id} 
                          value={section.id}
                          className={cn(
                              "flex items-center justify-start gap-3 w-full px-4 py-3 cursor-pointer text-sm font-medium rounded-xl transition-all",
                              "data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=active]:border-primary border border-transparent",
                              "hover:bg-muted"
                          )}
                      >
                          <div className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                              activeTab === section.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          )}>
                              {section.icon}
                          </div>
                          <span className="text-left font-semibold">{section.title}</span>
                      </TabsTrigger>
                    ))}
                </TabsList>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4 px-2">
              <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50">
                <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                <AlertTitle className="text-amber-800 dark:text-amber-400 font-bold mb-1">Importante</AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-500/90 text-xs">
                  Antes de alterar as configurações entre em contato com o seu contador.
                </AlertDescription>
              </Alert>
            </div>
          </div>

          {/* Área de conteúdo */}
          <div className="flex-1 w-full min-w-0">
             <Card className="border-none shadow-lg border-primary/5 min-h-[500px] flex flex-col">
                <CardHeader className="pb-4 border-b border-border/50 bg-card">
                  <div className="flex items-center gap-3">
                     <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                         {sections.find(s => s.id === activeTab)?.icon}
                     </div>
                     <div>
                         <CardTitle className="text-2xl font-bold">
                             {sections.find(s => s.id === activeTab)?.title}
                         </CardTitle>
                         <CardDescription>
                             Ajuste os parâmetros específicos desta seção.
                         </CardDescription>
                     </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 p-6 relative">
                  <ScrollArea className="h-full">
                    <TabsContent value="certificado" className="m-0 focus-visible:outline-none">
                        <div className="flex flex-col gap-6 pb-4">
                            
                            {/* Seleção de Filial Focus */}
                            <div className="flex flex-col md:flex-row md:items-end gap-4 p-4 bg-muted/20 border border-border/50 rounded-lg">
                               <div className="flex flex-col gap-2 flex-1 max-w-sm">
                                  <Label className="text-sm font-semibold flex items-center gap-2">
                                     Empresa Filial para o Certificado
                                  </Label>
                                  <Select value={selectedCertBranchId} onValueChange={setSelectedCertBranchId}>
                                    <SelectTrigger className="bg-background">
                                       <SelectValue placeholder="Selecione a filial..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {branches.length === 0 && <div className="p-2 text-sm text-center">Nenhuma filial...</div>}
                                        {branches.map(b => (
                                           <SelectItem key={b.id} value={b.id!}>{b.razao_social}</SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                               </div>
                               {!selectedCertBranchId && (
                                  <div className="text-sm text-muted-foreground flex items-center h-10">
                                      Por favor, selecione uma filial para gerenciar o certificado digital.
                                  </div>
                               )}
                            </div>

                            {selectedCertBranchId && (() => {
                                const branch = branches.find(b => b.id === selectedCertBranchId);
                                const hasCert = !!branch?.certificateUrl;
                                const certDate = branch?.certificateExpiresAt ? new Date(branch.certificateExpiresAt).toLocaleDateString('pt-BR') : 'Data não definida';
                                const certName = branch?.certificateFileName || `Certificado Padrão`;
                                
                                return (
                                    <>
                                        {/* Header Toggles */}
                                        <div className="flex flex-col gap-2 transition-all mt-2">
                                           <Label className="text-muted-foreground font-semibold text-sm">Tipos de certificados</Label>
                                           <div className="flex flex-wrap items-center gap-2 mt-1">
                                              <div className="py-2.5 px-6 rounded-md border-2 border-[#10b981] text-[#10b981] font-bold text-sm bg-[#10b981]/5 cursor-pointer shadow-sm">
                                                  A1 - Servidor
                                              </div>
                                              <div className="py-2.5 px-6 rounded-md border border-border text-foreground font-semibold text-sm hover:bg-muted cursor-pointer transition-colors">
                                                  A1 - Máquina do cliente
                                              </div>
                                              <div className="py-2.5 px-6 rounded-md border border-border text-foreground font-semibold text-sm hover:bg-muted cursor-pointer transition-colors">
                                                  A3
                                              </div>
                                              <div className="py-2.5 px-6 rounded-md border border-border text-foreground font-semibold text-sm hover:bg-muted cursor-pointer transition-colors">
                                                  Gerenciador do Windows
                                              </div>
                                           </div>
                                        </div>

                                        {/* Info Box Top */}
                                        <Alert className="bg-[#e8f4fd] border-[#bce8f1]">
                                           <div className="flex items-start gap-4">
                                              <div className="mt-1 h-8 w-8 rounded-full bg-[#00a7e1] flex items-center justify-center shrink-0">
                                                  <Info className="h-4 w-4 text-white" />
                                              </div>
                                              <div className="flex flex-col">
                                                 <AlertTitle className="text-[#005a8f] font-bold text-[15px] mb-1 leading-none">Indicações de uso</AlertTitle>
                                                 <AlertDescription className="text-[#005a8f] text-sm">
                                                    A utilização do certificado diretamente em nosso servidor permite que você emita notas fiscais em qualquer dispositivo.<br />
                                                    Extensões aceitas: pfx e p12.
                                                 </AlertDescription>
                                              </div>
                                           </div>
                                        </Alert>

                                        <input type="file" ref={certFileInputRef} onChange={handleCertUpload} className="hidden" accept=".pfx,.p12,application/x-pkcs12" />

                                        {/* Certificado Válido Card ou Aviso de Ausência */}
                                        <div className="border border-border/50 rounded-sm">
                                           {hasCert ? (
                                              <div className="bg-[#e6f2e6] dark:bg-[#10b981]/10 p-8 flex flex-col md:flex-row items-center md:items-start gap-12">
                                                 <div className="relative shrink-0 md:ml-12">
                                                     <div className="h-32 w-32 rounded-full border-4 border-[#34a853] flex items-center justify-center relative">
                                                         <div className="absolute top-0 right-0 h-8 w-8 bg-[#34a853] rounded-full flex items-center justify-center translate-x-2 -translate-y-1 shadow-sm">
                                                            <CheckCircle2 className="h-5 w-5 text-white" />
                                                         </div>
                                                         <Lock className="h-14 w-14 text-[#34a853]" />
                                                     </div>
                                                 </div>

                                                 <div className="flex flex-col gap-4 max-w-lg">
                                                    <h3 className="text-xl font-bold text-[#34a853]">Certificado válido até : {certDate}</h3>
                                                    <div className="text-sm text-[#4d5156] dark:text-muted-foreground leading-snug">
                                                       <p className="font-semibold mb-1">Estrutura do arquivo:</p>
                                                       <ul className="list-disc pl-5 space-y-0.5">
                                                          <li><span className="font-semibold text-foreground">Certificado:</span> {certName} ({branch?.cnpj})</li>
                                                          <li><span className="font-semibold text-foreground">AC nível 2:</span> AC BR RFB G4</li>
                                                          <li><span className="font-semibold text-foreground">AC nível 1:</span> AC Secretaria da Receita Federal do Brasil v4</li>
                                                          <li><span className="font-semibold text-foreground">Raiz:</span> Autoridade Certificadora Raiz Brasileira v5</li>
                                                       </ul>
                                                    </div>
                                                    <div className="mb-2 mt-2">
                                                       <Button 
                                                           onClick={() => certFileInputRef.current?.click()} 
                                                           disabled={isUploadingCert}
                                                           className="bg-[#34a853] hover:bg-[#2e964a] text-white font-bold rounded-sm px-6 h-10 shadow-sm border border-[#2e964a]/30"
                                                       >
                                                          {isUploadingCert ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                                          Atualizar certificado
                                                       </Button>
                                                    </div>
                                                 </div>
                                              </div>
                                           ) : (
                                              <div className="bg-muted/10 p-8 flex flex-col md:flex-row items-center md:items-start gap-12">
                                                 <div className="relative shrink-0 md:ml-12">
                                                     <div className="h-32 w-32 rounded-full border-4 border-muted-foreground/30 flex items-center justify-center relative">
                                                         <UploadCloud className="h-14 w-14 text-muted-foreground/50" />
                                                     </div>
                                                 </div>

                                                 <div className="flex flex-col gap-4 max-w-lg justify-center h-32">
                                                    <h3 className="text-xl font-bold text-foreground">Nenhum certificado cadastrado</h3>
                                                    <p className="text-sm text-muted-foreground">Esta filial precisa de um certificado A1 para iniciar a emissão ou busca de notas em nosso servidor.</p>
                                                    <div className="mb-2 mt-2">
                                                       <Button 
                                                           onClick={() => certFileInputRef.current?.click()} 
                                                           disabled={isUploadingCert}
                                                           className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-sm px-6 h-10 shadow-sm"
                                                       >
                                                          {isUploadingCert ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                                          Incluir certificado .pfx
                                                       </Button>
                                                    </div>
                                                 </div>
                                              </div>
                                           )}
                                        </div>

                                        {/* Warning Box Bottom */}
                                        <Alert className="bg-[#e8f4fd] border-[#bce8f1] mb-2">
                                           <div className="flex items-start gap-4">
                                              <div className="mt-1 h-8 w-8 rounded-full bg-[#00a7e1] flex items-center justify-center shrink-0">
                                                  <Info className="h-4 w-4 text-white" />
                                              </div>
                                              <div className="flex flex-col">
                                                 <AlertTitle className="text-[#005a8f] font-bold text-[15px] mb-1 leading-none">Atenção!</AlertTitle>
                                                 <AlertDescription className="text-[#005a8f] text-sm">
                                                    <ul className="list-disc pl-4 space-y-0.5">
                                                        <li>O usuário é responsável pelo armazenamento de uma cópia do certificado em sua máquina.</li>
                                                        <li>Somente o administrador da conta pode extrair o certificado do sistema.</li>
                                                        <li>Caso você inclua um novo certificado, os certificados anteriores serão excluídos do sistema.</li>
                                                    </ul>
                                                 </AlertDescription>
                                              </div>
                                           </div>
                                        </Alert>
                                    </>
                                );
                            })()}
                            
                        </div>
                    </TabsContent>

                    <TabsContent value="emissao" className="m-0 focus-visible:outline-none">
                        <div className="flex flex-col gap-8">
                          <Alert className="bg-[#e6f7fa] dark:bg-sky-950/30 border-[#bce8f1] dark:border-sky-900/50">
                            <Info className="h-5 w-5 text-[#31708f] dark:text-sky-400" />
                            <AlertTitle className="text-[#31708f] dark:text-sky-400 font-bold ml-2">Escolha o ambiente para a emissão da nota fiscal</AlertTitle>
                            <AlertDescription className="text-[#31708f] dark:text-sky-300 ml-2 mt-2">
                              <ul className="list-disc pl-4 space-y-1">
                                <li>Produção com valor fiscal</li>
                                <li>Homologação para fazer teste, não tem valor fiscal</li>
                              </ul>
                            </AlertDescription>
                          </Alert>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <div className="flex items-center gap-1">
                                <Label htmlFor="versao">Versão do layout</Label>
                                <Info className="h-3.5 w-3.5 text-[#00a7e1]" />
                              </div>
                              <Select value={settings.versaoLayout} onValueChange={(v) => updateSetting("versaoLayout", v)}>
                                <SelectTrigger id="versao">
                                  <SelectValue placeholder="Selecione a versão" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="4.00">4.00</SelectItem>
                                  <SelectItem value="3.10">3.10</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center gap-1">
                                <Label htmlFor="ambiente">Tipo de ambiente de NF-e</Label>
                                <Info className="h-3.5 w-3.5 text-[#00a7e1]" />
                              </div>
                              <Select value={settings.ambiente} onValueChange={(v) => updateSetting("ambiente", v)}>
                                <SelectTrigger id="ambiente" className={cn(
                                   "font-semibold border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/20",
                                   settings.ambiente === "1" ? "text-green-700 dark:text-green-500" : "text-amber-700 dark:text-amber-500"
                                )}>
                                  <SelectValue placeholder="Selecione o ambiente" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1 - Produção</SelectItem>
                                  <SelectItem value="2">2 - Homologação</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <Card className="border shadow-none">
                            <CardContent className="flex flex-col items-center justify-center p-6 gap-4">
                              <p className="text-sm font-medium text-foreground">Disponibilidade dos ambientes da SEFAZ PR</p>
                              <Button className="bg-[#10b981] hover:bg-[#059669] text-white px-8 rounded-lg shadow-sm">
                                Testar comunicação
                              </Button>
                            </CardContent>
                          </Card>
                        </div>
                    </TabsContent>
                    <TabsContent value="gerais" className="m-0 focus-visible:outline-none">
                        <div className="flex flex-col gap-8 pb-4">
                          {/* Setting: Ativar busca automática */}
                          <div className="flex flex-col gap-3 pb-6 border-b border-border/40">
                             <div className="flex flex-col gap-1">
                               <Label className="text-sm font-medium">Ativar busca automática de NF-es recebidas na SEFAZ</Label>
                               <div className="flex flex-col sm:flex-row sm:items-end gap-3 mt-2">
                                  <div className="flex-1 max-w-sm">
                                      <Select value={selectedBuscaBranchId} onValueChange={setSelectedBuscaBranchId}>
                                        <SelectTrigger className="w-full bg-background border-border">
                                            <SelectValue placeholder="Selecione a filial para incluir..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {branches.length === 0 && <div className="p-2 text-sm text-center">Nenhuma filial...</div>}
                                            {branches.map(b => (
                                                <SelectItem key={b.id} value={b.id!}>{b.razao_social}</SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                  </div>
                                  <Button variant="outline" className="text-primary border-primary hover:bg-primary/10 shrink-0" onClick={handleAddBuscaBranch} disabled={!selectedBuscaBranchId}>
                                      <PlusCircle className="mr-2 h-4 w-4" /> Incluir Filial
                                  </Button>
                               </div>
                               
                               <div className="flex items-center gap-2 mt-4 pt-1 border-t border-border/10">
                                 <Switch 
                                    checked={settings.buscaAutomaticaAtiva} 
                                    onCheckedChange={(v) => updateSetting("buscaAutomaticaAtiva", v)}
                                    id="busca-automatica" 
                                    className="data-[state=checked]:bg-[#10b981]" 
                                 />
                                 <Label htmlFor="busca-automatica" className="text-xs text-muted-foreground font-normal">
                                    Ativar/Desativar para as filiais vinculadas
                                 </Label>
                               </div>
                             </div>
                             
                             {/* Mostra as badges/filiais incluídas */}
                             {settings.buscaAutomaticaBranchesIds.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 mt-1 p-3 bg-muted/20 rounded-md border border-border/40">
                                  {settings.buscaAutomaticaBranchesIds.map(branchId => {
                                      const branch = branches.find(b => b.id === branchId);
                                      if (!branch) return null;
                                      return (
                                          <Badge key={branchId} variant="outline" className="text-xs font-normal bg-background flex items-center pr-1 gap-1 border-primary/20 shadow-sm">
                                            {branch.nome_fantasia || branch.razao_social}
                                            <div onClick={() => handleRemoveBuscaBranch(branchId)} className="hover:bg-destructive/10 text-destructive rounded-full p-0.5 cursor-pointer ml-1 transition-colors">
                                                <X className="h-3.5 w-3.5" />
                                            </div>
                                          </Badge>
                                      );
                                  })}
                                </div>
                             )}
                          </div>

                          {/* Grupos de settings booleanos padrão */}
                          <div className="flex flex-col gap-5 pb-6 border-b border-border/40">
                            {[
                               { id: "exibirTotais", label: "Exibir totais em listas de Notas Fiscais" },
                               { id: "lancarEstoqueEmitir", label: "Lançar estoque ao emitir ou cancelar nota" },
                               { id: "lancarContasEmitir", label: "Lançar contas ao emitir ou cancelar nota" },
                               { id: "marcarEnvioEmail", label: "Marcar envio de e-mail ao emitir nota manualmente" },
                               { id: "lancarGnreDare", label: "Lançar GNRE e DARE-SP ao emitir nota" },
                               { id: "armazenarDare", label: "Armazenar guias DARE-SP emitidas", info: true },
                               { id: "considerarDataVenda", label: "Considerar a data da venda nas parcelas da nota fiscal" },
                               { id: "considerarDataOs", label: "Considerar a data da ordem de serviço nas parcelas da nota fiscal" },
                            ].map((setting) => (
                               <div key={setting.id} className="flex flex-col gap-1.5">
                                 <span className="flex items-center gap-1.5 text-sm font-medium">
                                   {setting.label}
                                   {setting.info && <Info className="h-3.5 w-3.5 text-[#00a7e1]" />}
                                 </span>
                                 <div className="flex items-center gap-2">
                                   <Switch 
                                      checked={settings[setting.id as keyof NfeSettings] as boolean} 
                                      onCheckedChange={(v) => updateSetting(setting.id as keyof NfeSettings, v)}
                                      id={setting.id} 
                                      className="data-[state=checked]:bg-[#10b981]" 
                                   />
                                   <Label htmlFor={setting.id} className="text-xs text-muted-foreground font-normal">
                                     {(settings[setting.id as keyof NfeSettings] as boolean) ? 'Ativado' : 'Desativado'}
                                   </Label>
                                 </div>
                               </div>
                            ))}
                          </div>

                          {/* Setting Select para emissão automática */}
                          <div className="flex flex-col gap-2 pb-6 border-b border-border/40">
                             <Label className="text-sm font-medium">Emitir NFe automaticamente após geração em lote (Somente Certificado A1)</Label>
                             <Select value={settings.emissaoAutomaticaLote} onValueChange={(v) => updateSetting("emissaoAutomaticaLote", v)}>
                                <SelectTrigger className="w-full mt-1 border-primary outline-none focus:ring-1 focus:ring-primary shadow-sm">
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="nao-emitir">Não Emitir automaticamente</SelectItem>
                                  <SelectItem value="emitir-todas">Emitir para todas as NF-e</SelectItem>
                                </SelectContent>
                             </Select>
                          </div>

                          {/* Últimos grupos de settings booleanos */}
                          <div className="flex flex-col gap-5">
                            {[
                               { id: "consultarRecibo", label: "Consultar automaticamente notas em situação de consulta recibo/protocolo", info: true },
                               { id: "bloquearEdicaoEstoque", label: "Bloquear edição da nota quando o estoque tiver sido lançado pela venda" },
                               { id: "bloquearEdicaoConta", label: "Bloquear edição da nota quando a conta tiver sido lançada pela venda" },
                               { id: "automacaoContasPagar", label: "Automação lançamento de contas pagar ao criar nova Nota Fiscal de Entrada" },
                               { id: "lancarEstoqueCheckin", label: "Lançar estoque ao finalizar Check-in na Nota Fiscal de Entrada" },
                               { id: "desabilitarReforma", label: "Desabilitar Reforma Tributária" },
                            ].map((setting) => (
                               <div key={setting.id} className="flex flex-col gap-1.5">
                                 <span className="flex items-center gap-1.5 text-sm font-medium">
                                   {setting.label}
                                   {setting.info && <Info className="h-3.5 w-3.5 text-[#00a7e1]" />}
                                 </span>
                                 <div className="flex items-center gap-2">
                                   <Switch 
                                      checked={settings[setting.id as keyof NfeSettings] as boolean} 
                                      onCheckedChange={(v) => updateSetting(setting.id as keyof NfeSettings, v)}
                                      id={setting.id} 
                                      className="data-[state=checked]:bg-[#10b981]" 
                                   />
                                   <Label htmlFor={setting.id} className="text-xs text-muted-foreground font-normal">
                                     {(settings[setting.id as keyof NfeSettings] as boolean) ? 'Ativado' : 'Desativado'}
                                   </Label>
                                 </div>
                               </div>
                            ))}
                          </div>
                        </div>
                    </TabsContent>
                     <TabsContent value="preenchimento" className="m-0 focus-visible:outline-none">
                        <div className="flex flex-col gap-8 pb-4">
                          
                          {/* Top Selects and Inputs */}
                          <div className="flex flex-col gap-6">
                             <div className="flex flex-col gap-2">
                               <Label className="text-sm font-medium">Padrão do campo "frete por conta" nas notas fiscais, pedidos de vendas e propostas comerciais</Label>
                               <Select value={settings.fretePadrão} onValueChange={(v) => updateSetting("fretePadrão", v)}>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Selecione..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="0">0 - Contratação do Frete por conta do Remetente (CIF)</SelectItem>
                                    <SelectItem value="1">1 - Contratação do Frete por conta do Destinatário (FOB)</SelectItem>
                                    <SelectItem value="2">2 - Contratação do Frete por conta de Terceiros</SelectItem>
                                    <SelectItem value="3">3 - Transporte Próprio por conta do Remetente</SelectItem>
                                    <SelectItem value="4">4 - Transporte Próprio por conta do Destinatário</SelectItem>
                                    <SelectItem value="9">9 - Sem Ocorrência de Transporte</SelectItem>
                                  </SelectContent>
                               </Select>
                             </div>

                             <div className="flex flex-col gap-2">
                               <Label className="text-sm font-medium text-muted-foreground">Markup para formação do preço de venda</Label>
                               <Input value={settings.markupPreço} onChange={(e) => updateSetting("markupPreço", e.target.value)} className="w-[300px]" />
                             </div>

                             <div className="flex flex-col gap-2">
                               <Label className="text-sm font-medium text-muted-foreground">Informação padrão para o campo Espécie na Nota Fiscal</Label>
                               <Select value={settings.especiePadrao} onValueChange={(v) => updateSetting("especiePadrao", v)}>
                                  <SelectTrigger className="w-[300px] border-[#10b981] hover:border-[#059669] focus:ring-[#10b981] text-foreground shadow-sm">
                                    <SelectValue placeholder="Selecione..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="selecione">Selecione uma opção</SelectItem>
                                    <SelectItem value="outros">Outros(s)</SelectItem>
                                    <SelectItem value="volume">Volume(s)</SelectItem>
                                    <SelectItem value="unidade">Unidade(s)</SelectItem>
                                    <SelectItem value="caixa">Caixa(s)</SelectItem>
                                    <SelectItem value="pacote">Pacote(s)</SelectItem>
                                    <SelectItem value="envelope">Envelope(s)</SelectItem>
                                  </SelectContent>
                               </Select>
                             </div>
                          </div>

                          {/* Preenchimento Switches */}
                          <div className="flex flex-col gap-5">
                            {[
                              { id: "cobrarIpi", label: "Cobrar IPI na primeira parcela das notas fiscais de saída e vendas" },
                              { id: "cobrarIcmsSt", label: "Cobrar ICMS ST na primeira parcela das notas fiscais de saída e vendas" },
                              { id: "considerarTotalNota", label: "Considerar total da nota como base de comissão (incluir IPI, ICMS ST, desconto e frete)" },
                              { id: "mostrarCodigoRastreio", label: "Mostrar código de rastreio nas informações complementares" },
                              { id: "somarPeso", label: "Somar peso dos produtos nas notas fiscais" },
                              { id: "calcularVolume", label: "Calcular volume dos produtos nas notas fiscais" },
                              { id: "informarDesconto", label: "Informar desconto individualmente nos itens" },
                              { id: "adicionarNumeroOs", label: "Adicionar número da ordem de compra/pedido loja virtual nas informações complementares da nota fiscal" },
                              { id: "adicionarDadosEndereco", label: "Adicionar dados do endereço da etiqueta nas informações complementares da nota fiscal" },
                              { id: "exibirCombustiveis", label: "Exibir grupo de informações referentes a combustíveis na nota" },
                              { id: "exibirArmamento", label: "Exibir grupo de informações referentes a armamento na nota" },
                              { id: "exibirVeiculos", label: "Exibir grupo de informações referentes a veículos na nota" },
                              { id: "exibirBebidas", label: "Exibir grupo de informações referentes a bebidas na nota" },
                              { id: "exibirRetencao", label: "Exibir grupo e configurações de retenção de impostos" },
                              { id: "preencherManualmenteDestino", label: "Preencher manualmente campo de Destino da Operação", info: true },
                            ].map((setting) => (
                              <div key={setting.id} className="flex flex-col gap-1.5">
                                <span className="flex items-center gap-1.5 text-sm font-medium">
                                  {setting.label}
                                  {setting.info && <Info className="h-3.5 w-3.5 text-[#00a7e1]" />}
                                </span>
                                <div className="flex items-center gap-2">
                                  <Switch 
                                    checked={settings[setting.id as keyof NfeSettings] as boolean} 
                                    onCheckedChange={(v) => updateSetting(setting.id as keyof NfeSettings, v)}
                                    id={setting.id} 
                                    className="data-[state=checked]:bg-[#10b981]" 
                                  />
                                  <Label htmlFor={setting.id} className="text-xs text-muted-foreground font-normal">
                                    {(settings[setting.id as keyof NfeSettings] as boolean) ? 'Ativado' : 'Desativado'}
                                  </Label>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Novos Switches Adicionais baseados na Interface */}
                          <div className="flex flex-col gap-5 pt-4 border-t border-border/40">
                             {[
                                { id: "descontarIpiBaseIcms", label: "Descontar IPI da base do ICMS" },
                                { id: "incluirFreteBaseIcms", label: "Incluir Frete na base do ICMS" },
                                { id: "exibirCstIcms", label: "Exibir CST do ICMS na nota" },
                                { id: "preencherObsFisco", label: "Preencher observações do Fisco automaticamente" },
                                { id: "preencherInfoAdic", label: "Preencher informações adicionais automaticamente" },
                                { id: "habilitarCbenef", label: "Habilitar campo cBenef" },
                                { id: "bloquearSemCbenef", label: "Bloquear emissão sem cBenef preenchido" },
                                { id: "removerZerosMatriz", label: "Remover zeros à esquerda do código da matriz" },
                                { id: "atualizarPrecoVenda", label: "Atualizar preço de venda após emissão" },
                                { id: "descontarIcmsBasePisCofins", label: "Descontar ICMS da base do PIS/COFINS" },
                                { id: "desprezarIcmsDesonerado", label: "Desprezar Valor do ICMS Desonerado no Total da NF-e" },
                                { id: "valorIpiBasePisCofins", label: "Considerar valor do IPI na base de cálculo do PIS e COFINS" },
                                { id: "informarImpostoDevolvido", label: "Informar IPI Devolvido em notas de devolução de compra" },
                                { id: "informarPesoLiquido", label: "Informar peso líquido automaticamente" },
                                { id: "somarFreteValorTotal", label: "Somar valor do frete ao valor total da nota" },
                                { id: "somarDespesasValorTotal", label: "Somar outras despesas ao valor total da nota" },
                                { id: "somarSeguroValorTotal", label: "Somar valor do seguro ao valor total da nota" }
                             ].map((setting) => (
                               <div key={setting.id} className="flex flex-col gap-1.5">
                                 <span className="flex items-center gap-1.5 text-sm font-medium">
                                   {setting.label}
                                 </span>
                                 <div className="flex items-center gap-2">
                                   <Switch 
                                      checked={settings[setting.id as keyof NfeSettings] as boolean} 
                                      onCheckedChange={(v) => updateSetting(setting.id as keyof NfeSettings, v)}
                                      id={setting.id} 
                                      className="data-[state=checked]:bg-[#10b981]" 
                                   />
                                   <Label htmlFor={setting.id} className="text-xs text-muted-foreground font-normal">
                                     {(settings[setting.id as keyof NfeSettings] as boolean) ? 'Ativado' : 'Desativado'}
                                   </Label>
                                 </div>
                               </div>
                             ))}
                          </div>

                          {/* Campos com Validação Opcional */}
                          <div className="flex flex-col gap-2 pb-6 border-b border-border/40 mt-4">
                            <Label className="text-sm font-medium">Campos com validação opcional</Label>
                            <Input placeholder="Adicione um campo de validação opcional" className="w-full" />
                          </div>

                          {/* Pessoas Autorizadas */}
                          <div className="flex flex-col gap-5 pb-6 border-b border-border/40">
                             <h3 className="text-lg font-bold">Pessoas autorizadas a acessar o XML da nota</h3>
                             
                             <div className="flex flex-col gap-1.5">
                                <span className="flex items-center gap-1.5 text-sm font-medium">
                                  Incluir transportadora como pessoa autorizada
                                </span>
                                <div className="flex items-center gap-2">
                                  <Switch 
                                    checked={settings.incluirTransportadoraAutorizada} 
                                    onCheckedChange={(v) => updateSetting("incluirTransportadoraAutorizada", v)}
                                    id="incluir-transportadora" 
                                    className="data-[state=checked]:bg-[#10b981]" 
                                  />
                                  <Label htmlFor="incluir-transportadora" className="text-xs text-muted-foreground font-normal">
                                    {settings.incluirTransportadoraAutorizada ? 'Ativado' : 'Desativado'}
                                  </Label>
                                </div>
                             </div>

                             <div className="flex flex-col gap-2 w-full mt-2">
                                <div className="flex w-full">
                                    <div className="w-[40px]"></div>
                                    <Label className="flex-1 text-xs text-muted-foreground flex items-center gap-1 ml-2">Contato <Info className="h-3 w-3 text-[#00a7e1]" /></Label>
                                    <Label className="w-[150px] md:w-[250px] text-xs text-muted-foreground ml-2">CPF/CNPJ</Label>
                                    <div className="w-10"></div>
                                </div>
                                
                                {settings.autorizados.map((auth, index) => (
                                    <div key={auth.id} className="flex items-center w-full shadow-sm rounded-md border border-input h-10 overflow-hidden">
                                        <div className="w-[40px] bg-muted/50 text-muted-foreground flex items-center justify-center text-xs font-bold border-r border-input h-full">{index + 1}</div>
                                        <div className="flex-1 px-3 text-sm">{auth.contato}</div>
                                        <div className="w-[150px] md:w-[250px] border-l border-input px-3 text-sm flex items-center h-full bg-muted/5 tracking-wider">{auth.cpfCnpj}</div>
                                        <div className="w-10 flex items-center justify-center border-l border-input h-full">
                                            <button onClick={() => handleRemoveAutorizado(auth.id)} className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 p-1 rounded transition-colors">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <div className="flex items-center w-full shadow-sm rounded-md border border-primary/30 mt-2 bg-primary/5">
                                    <div className="w-[40px] bg-primary/10 text-primary flex items-center justify-center text-xs font-bold border-r border-primary/30 h-10">+</div>
                                    <input 
                                        type="text" 
                                        placeholder="Nome do contato..."
                                        value={autorizadoContato}
                                        onChange={(e) => setAutorizadoContato(e.target.value)}
                                        className="flex-1 bg-transparent border-none outline-none px-3 h-10 text-sm" 
                                    />
                                    <div className="w-[150px] md:w-[250px] border-l border-primary/30 flex items-center h-10">
                                        <input 
                                            type="text" 
                                            placeholder="CPF/CNPJ..."
                                            value={autorizadoCpfCnpj}
                                            onChange={(e) => setAutorizadoCpfCnpj(e.target.value)}
                                            className="w-full h-full bg-transparent border-none outline-none px-3 text-sm" 
                                        />
                                    </div>
                                    <div className="w-10 flex items-center justify-center border-l border-primary/30 h-10">
                                        <button onClick={handleAddAutorizado} className="text-primary hover:bg-primary/20 p-1.5 rounded transition-colors">
                                           <PlusCircle className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                             </div>
                          </div>

                          {/* Automatização */}
                          <div className="flex flex-col gap-5">
                             <h3 className="text-lg font-bold">Automatização de atualização de dados</h3>
                             <p className="text-sm text-foreground">Os dados que forem ativados serão atualizados no cadastro, conforme as informações fornecidas na nota fiscal.</p>
                             
                             <Alert className="bg-[#fff3cd] border-[#ffeeba] text-[#856404] dark:bg-amber-950/30 dark:border-amber-900/50">
                               <TriangleAlert className="h-5 w-5 text-[#856404]" />
                               <AlertTitle className="text-[#856404] font-bold">Atenção</AlertTitle>
                               <AlertDescription className="text-[#856404] mt-1">
                                 A atualização automática de dados pode gerar erros ao emitir a nota fiscal.
                               </AlertDescription>
                             </Alert>

                             <div className="flex flex-col gap-4 mt-2">
                                {[
                                  { id: "autoNcm", label: "NCM" },
                                  { id: "autoGtin", label: "GTIN", info: true },
                                  { id: "autoCest", label: "CEST" },
                                  { id: "autoDescricao", label: "Descrição do fornecedor" },
                                ].map((setting) => (
                                  <div key={setting.id} className="flex flex-col gap-1.5">
                                    <span className="flex items-center gap-1.5 text-sm font-medium">
                                      {setting.label}
                                      {setting.info && <Info className="h-3.5 w-3.5 text-[#00a7e1]" />}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <Switch 
                                        checked={settings[setting.id as keyof NfeSettings] as boolean} 
                                        onCheckedChange={(v) => updateSetting(setting.id as keyof NfeSettings, v)}
                                        id={setting.id} 
                                        className="data-[state=checked]:bg-[#10b981]" 
                                      />
                                      <Label htmlFor={setting.id} className="text-xs text-muted-foreground font-normal">
                                        {(settings[setting.id as keyof NfeSettings] as boolean) ? 'Ativado' : 'Desativado'}
                                      </Label>
                                    </div>
                                  </div>
                                ))}
                             </div>
                          </div>

                        </div>
                    </TabsContent>
                    <TabsContent value="numeracao" className="m-0 focus-visible:outline-none">
                        <div className="flex flex-col gap-6 pb-4">
                            
                            {/* Formulário de inclusão */}
                            <div className="grid grid-cols-1 md:grid-cols-4 items-end gap-4 bg-muted/20 p-4 rounded-xl border border-border/50">
                                <div className="flex flex-col gap-2 md:col-span-2">
                                   <Label htmlFor="branch" className="text-sm font-semibold">Empresa Filial</Label>
                                   <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                                      <SelectTrigger id="branch" className="bg-background">
                                        <SelectValue placeholder="Selecione a filial..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {branches.length === 0 ? (
                                            <div className="p-2 text-sm text-muted-foreground text-center">Nenhuma filial cadastrada</div>
                                        ) : (
                                            branches.map(b => (
                                              <SelectItem key={b.id} value={b.id!}>{b.razao_social} - {b.cnpj}</SelectItem>
                                            ))
                                        )}
                                      </SelectContent>
                                   </Select>
                                </div>
                                <div className="flex flex-col gap-2">
                                   <Label htmlFor="serie" className="text-sm font-semibold">Série</Label>
                                   <Input id="serie" value={serie} onChange={(e) => setSerie(e.target.value)} className="bg-background" placeholder="Ex: 001" />
                                </div>
                                <div className="flex flex-col gap-2">
                                   <Label htmlFor="nextNumber" className="text-sm font-semibold">Próximo número</Label>
                                   <Input id="nextNumber" type="number" value={nextNumber} onChange={(e) => setNextNumber(e.target.value)} className="bg-background" placeholder="Ex: 1" />
                                </div>
                                <div className="md:col-span-4 flex justify-end mt-2">
                                   <Button onClick={handleAddNumeration} disabled={!selectedBranchId || !serie || !nextNumber} className="bg-[#10b981] hover:bg-[#059669] text-white">
                                      <PlusCircle className="mr-2 h-4 w-4" /> Incluir Configuração
                                   </Button>
                                </div>
                            </div>

                            {/* Tabela de Numerações */}
                            <div className="rounded-md border border-border/50 overflow-hidden shadow-sm mt-2">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-[#f8fafc] dark:bg-muted text-muted-foreground font-semibold border-b border-border/50">
                                        <tr>
                                            <th className="px-5 py-3 min-w-[250px]">Empresa Filial (Razão Social)</th>
                                            <th className="px-5 py-3 min-w-[180px]">CNPJ</th>
                                            <th className="px-5 py-3 min-w-[100px]">Série</th>
                                            <th className="px-5 py-3">Próximo número</th>
                                            <th className="px-5 py-3 text-right">Ação</th>
                                        </tr>
                                    </thead>
                                     <tbody className="divide-y divide-border/50">
                                        {settings.numeracoes.map((config) => {
                                            const branch = branches.find(b => b.id === config.branchId);
                                            return (
                                                <tr key={config.id} className="bg-card hover:bg-muted/30 transition-colors">
                                                    <td className="px-5 py-3 text-foreground text-xs md:text-sm font-medium text-primary">
                                                        {branch?.razao_social || 'Filial não encontrada'}
                                                    </td>
                                                    <td className="px-5 py-3 text-foreground text-xs md:text-sm text-muted-foreground">
                                                        {branch?.cnpj || '-'}
                                                    </td>
                                                    <td className="px-5 py-3 text-foreground text-xs md:text-sm">{config.serie}</td>
                                                    <td className="px-5 py-3 text-foreground text-xs md:text-sm font-bold">{config.proximoNumero}</td>
                                                    <td className="px-5 py-3 text-right flex justify-end">
                                                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-8 w-8" onClick={() => handleRemoveNumeration(config.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {settings.numeracoes.length === 0 && (
                                    <div className="w-full p-4 text-center text-sm text-muted-foreground bg-card">
                                        As configurações inseridas acima aparecerão aqui.
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                    <TabsContent value="impressao" className="m-0 focus-visible:outline-none">
                        <div className="flex flex-col gap-6 pb-4">
                            
                            {/* Inputs de Impressão */}
                            <div className="flex flex-col gap-4">
                               <div className="flex flex-col gap-2">
                                  <Label className="text-sm font-medium">Nro de itens impressos na primeira página</Label>
                                  <Input 
                                      value={settings.danfeItensPagina} 
                                      onChange={(e) => updateSetting("danfeItensPagina", e.target.value)}
                                      className="w-[300px]" type="number" 
                                  />
                               </div>
                               <div className="flex flex-col gap-2">
                                  <Label className="text-sm font-medium">Nro de itens impressos nas demais páginas</Label>
                                  <Input 
                                      value={settings.danfeItensOutrasPaginas} 
                                      onChange={(e) => updateSetting("danfeItensOutrasPaginas", e.target.value)}
                                      className="w-[300px]" type="number" 
                                  />
                               </div>
                            </div>

                            {/* Switches de Impressão */}
                            <div className="flex flex-col gap-5 pt-4">
                               {[
                                  { id: "danfeListarProdutosSimplificado", label: "Listar produtos no DANFE Simplificado" },
                                  { id: "danfeExibirTotalSimplificado", label: "Exibir valor total da nota no DANFE Simplificado" },
                                  { id: "danfeExibirCanhoto", label: "Exibir canhoto da nota fiscal" },
                                  { id: "danfeExibirDataHora", label: "Exibir data e hora de impressão" },
                                  { id: "danfeExibirObsFisco", label: "Exibir observações do Fisco" },
                                  { id: "danfeImprimirSimplificada", label: "Imprimir DANFE Simplificada por padrão" },
                                  { id: "danfeImprimirResumida", label: "Imprimir DANFE Resumida por padrão" },
                               ].map((setting) => (
                                  <div key={setting.id} className="flex flex-col gap-1.5">
                                    <span className="flex items-center gap-1.5 text-sm font-medium">
                                      {setting.label}
                                    </span>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Switch 
                                         checked={settings[setting.id as keyof NfeSettings] as boolean} 
                                         onCheckedChange={(v) => updateSetting(setting.id as keyof NfeSettings, v)}
                                         id={setting.id} 
                                         className="data-[state=checked]:bg-[#10b981]" 
                                      />
                                      <Label htmlFor={setting.id} className="text-xs text-muted-foreground font-normal">
                                        {(settings[setting.id as keyof NfeSettings] as boolean) ? 'Ativado' : 'Desativado'}
                                      </Label>
                                    </div>
                                  </div>
                               ))}
                            </div>

                        </div>
                    </TabsContent>
                    <TabsContent value="email" className="m-0 focus-visible:outline-none">
                        <div className="flex flex-col gap-6 pb-4">
                            
                            {/* Switches de E-mail */}
                            <div className="flex flex-col gap-5">
                                {[
                                   { id: "emailCopiaTransportadora", label: "Enviar e-mail de cópia para a transportadora" },
                                   { id: "emailEnviarBoleto", label: "Enviar junto com a DANFE o boleto das contas lançadas", info: true },
                                ].map((setting) => (
                                   <div key={setting.id} className="flex flex-col gap-1.5">
                                     <span className="flex items-center gap-1.5 text-sm font-medium">
                                       {setting.label}
                                       {setting.info && <Info className="h-3.5 w-3.5 text-[#00a7e1]" />}
                                     </span>
                                     <div className="flex items-center gap-2 mt-1">
                                       <Switch 
                                          checked={settings[setting.id as keyof NfeSettings] as boolean} 
                                          onCheckedChange={(v) => updateSetting(setting.id as keyof NfeSettings, v)}
                                          id={setting.id} 
                                          className="data-[state=checked]:bg-[#10b981]" 
                                       />
                                       <Label htmlFor={setting.id} className="text-xs text-muted-foreground font-normal">
                                         {(settings[setting.id as keyof NfeSettings] as boolean) ? 'Ativado' : 'Desativado'}
                                       </Label>
                                     </div>
                                   </div>
                                ))}
                             </div>

                             {/* Inputs de Configuração */}
                             <div className="flex flex-col gap-4 mt-2">
                                <div className="flex flex-col gap-2">
                                   <Label className="text-sm font-medium text-muted-foreground">Assunto padrão para envio da DANFE</Label>
                                   <Input 
                                      value={settings.emailAssuntoPadrão} 
                                      onChange={(e) => updateSetting("emailAssuntoPadrão", e.target.value)}
                                      className="w-[500px] max-w-full" 
                                   />
                                </div>
                                <div className="flex flex-col gap-2">
                                   <Label className="text-sm font-medium text-muted-foreground">E-mail padrão como cópia para o envio das notas fiscais</Label>
                                   <Input 
                                      value={settings.emailCopiaPadrao} 
                                      onChange={(e) => updateSetting("emailCopiaPadrao", e.target.value)}
                                      className="w-[500px] max-w-full" 
                                   />
                                </div>
                                <div className="flex flex-col gap-2">
                                   <Label className="text-sm font-medium text-muted-foreground">Nome padrão do remetente para o envio da DANFE</Label>
                                   <Input 
                                      value={settings.emailRemetentePadrao} 
                                      onChange={(e) => updateSetting("emailRemetentePadrao", e.target.value)}
                                      className="w-[500px] max-w-full" 
                                   />
                                </div>
                                <div className="flex flex-col gap-2">
                                   <Label className="text-sm font-medium text-muted-foreground">Email padrão de resposta para o envio da DANFE</Label>
                                   <Input 
                                      value={settings.emailRespostaPadrao} 
                                      onChange={(e) => updateSetting("emailRespostaPadrao", e.target.value)}
                                      className="w-[500px] max-w-full" 
                                   />
                                </div>
                             </div>

                            {/* Alerta de Template Bloqueado */}
                            <div className="pt-4">
                               <Alert className="bg-[#fff3cd] border-[#ffeeba] text-[#856404] dark:bg-amber-950/30 dark:border-amber-900/50 flex py-2 px-3 items-center">
                                 <AlertDescription className="text-[#856404] text-xs font-medium flex items-center gap-2">
                                   <div className="bg-[#856404] text-[#fff3cd] p-0.5 rounded-sm">
                                      <TriangleAlert className="h-3 w-3" />
                                   </div>
                                   A edição deste template está temporariamente desabilitada
                                 </AlertDescription>
                               </Alert>
                            </div>

                            {/* Preview do Template */}
                            <div className="border border-border/50 rounded-md bg-white dark:bg-muted/10 h-64 overflow-y-auto w-full relative">
                                <div className="absolute top-0 left-0 right-0 h-4 bg-[#ccc]"></div>
                                <div className="mt-8 mx-auto w-[80%] min-h-[150px] border border-dashed border-[#bbb] p-6 text-sm text-black dark:text-foreground">
                                    <p className="font-semibold text-muted-foreground mb-8">[LOGO_EMPRESA]</p>
                                    <p className="font-bold mb-1">Olá [NOME_DESTINATARIO]!</p>
                                    <p>Segue link para acesso à DANFE online.</p>
                                    <div className="w-1/2 h-2 bg-[#10b981] mt-10 mx-auto rounded-full"></div>
                                </div>
                            </div>

                        </div>
                    </TabsContent>
                  </ScrollArea>
                </CardContent>

                <CardFooter className="pt-6 border-t bg-muted/10 flex justify-end">
                   <Button onClick={handleSave} disabled={isSaving} size="lg" className="min-w-32 shadow-md hover:shadow-xl transition-all">
                       {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                       Salvar Definições
                   </Button>
                </CardFooter>
             </Card>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
