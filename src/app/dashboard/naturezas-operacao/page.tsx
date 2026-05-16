"use client";

import * as React from "react";
import { 
  Plus,
  PlusCircle, 
  Loader2, 
  Trash2, 
  Pencil, 
  Edit2,
  Save, 
  X, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  Info,
  ArrowLeftRight,
  Calculator,
  FileText,
  AlertCircle,
  Box
} from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy as firestoreOrderBy,
  where,
  serverTimestamp,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { NaturezaOperacao, RegraICMS, RegraIPI, RegraPIS, RegraCOFINS, RegraII, RegraISSQN, RegraIS, RegraCBS, RegraIBS, Branch } from "../../../lib/definitions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// --- Constants ---
const TIPO_OPERACOES = ["Entrada", "Saída"];
const REGIMES_TRIBUTARIOS = [
  "Simples nacional",
  "Simples nacional - Excesso de sublimite de receita bruta",
  "Regime normal",
  "MEI"
];
const INDICADORES_PRESENCA = [
  "0 - Não se aplica",
  "1 - Operação presencial",
  "2 - Operação não presencial, pela Internet",
  "3 - Operação não presencial, Teleatendimento",
  "4 - NFC-e em operação com entrega a domicílio",
  "5 - Operação presencial, fora do estabelecimento",
  "9 - Operação não presencial, outros"
];
const SITUACOES_TRIBUTARIAS_ICMS = [
  { code: "10", label: "Tributada e com cobrança do ICMS por substituição tributária" },
  { code: "15", label: "Tributação monofásica própria e com responsabilidade pela retenção sobre combustíveis" },
  { code: "20", label: "Com redução de base de cálculo" },
  { code: "30", label: "Isenta ou não tributada e com cobrança do ICMS por substituição tributária" },
  { code: "40", label: "Isenta" },
  { code: "41", label: "Não tributada" },
  { code: "50", label: "Suspensão" },
  { code: "51", label: "Diferimento" },
  { code: "53", label: "Tributação monofásica sobre combustíveis com recolhimento diferido" },
  { code: "60", label: "ICMS cobrado anteriormente por substituição tributária" },
  { code: "61", label: "Tributação monofásica sobre combustíveis cobrada anteriormente" },
  { code: "70", label: "Com redução de base de cálculo e cobrança do ICMS por substituição tributária" },
  { code: "90", label: "Outras" },
  { code: "00", label: "Tributada integralmente" },
  { code: "02", label: "Tributação monofásica própria sobre combustíveis" },
];

const SITUACOES_TRIBUTARIAS_IPI = [
  { code: "Sem IPI", label: "Sem IPI" },
  { code: "50", label: "Saída tributada" },
  { code: "51", label: "Saída tributada com alíquota zero" },
  { code: "52", label: "Saída isenta" },
  { code: "53", label: "Saída não-tributada" },
  { code: "54", label: "Saída imune" },
  { code: "55", label: "Saída com suspensão" },
  { code: "99", label: "Outras saídas" }
];

const SITUACOES_TRIBUTARIAS_PIS = [
  { code: "01", label: "Operação Tributável com Alíquota Básica" },
  { code: "02", label: "Operação Tributável com Alíquota Diferenciada" },
  { code: "03", label: "Operação Tributável com Alíquota por Unidade de Medida de Produto" },
  { code: "04", label: "Operação Tributável com Alíquota Zero" },
  { code: "05", label: "Operação Tributável por Substituição Tributária" },
  { code: "06", label: "Operação Tributável a Alíquota Zero" },
  { code: "07", label: "Operação Isenta da Contribuição" },
  { code: "08", label: "Operação sem Incidência da Contribuição" },
  { code: "09", label: "Operação com Suspensão da Contribuição" },
  { code: "49", label: "Outras Operações de Saída" },
  { code: "50", label: "Operação com Direito a Crédito - Vinculada Exclusivamente a Receita Tributada no Mercado Interno" },
  { code: "51", label: "Operação com Direito a Crédito - Vinculada Exclusivamente a Receita Tributada no Mercado Externo" },
  { code: "52", label: "Operação com Direito a Crédito - Vinculada a Receitas Tributadas no Mercado Interno e Externo" },
  { code: "53", label: "Operação com Direito a Crédito - Vinculada a Receitas Isentas ou Não Tributadas no Mercado Interno" },
  { code: "54", label: "Operação com Direito a Crédito - Vinculada a Receitas Isentas ou Não Tributadas no Mercado Externo" },
  { code: "55", label: "Operação com Direito a Crédito - Vinculada a Receitas Isentas ou Não Tributadas no Mercado Interno e Externo" },
  { code: "56", label: "Operação com Direito a Crédito - Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno" },
  { code: "60", label: "Crédito Presumido - Operação de Aquisição Vinculada Exclusivamente a Receita Tributada no Mercado Interno" },
  { code: "61", label: "Crédito Presumido - Operação de Aquisição Vinculada Exclusivamente a Receita Tributada no Mercado Externo" },
  { code: "62", label: "Crédito Presumido - Operação de Aquisição Vinculada a Receitas Tributadas no Mercado Interno e Externo" },
  { code: "63", label: "Crédito Presumido - Operação de Aquisição Vinculada a Receitas Isentas ou Não Tributadas no Mercado Interno" },
  { code: "64", label: "Crédito Presumido - Operação de Aquisição Vinculada a Receitas Isentas ou Não Tributadas no Mercado Externo" },
  { code: "65", label: "Crédito Presumido - Operação de Aquisição Vinculada a Receitas Isentas ou Não Tributadas no Mercado Interno e Externo" },
  { code: "66", label: "Crédito Presumido - Operação de Aquisição Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno" },
  { code: "67", label: "Crédito Presumido - Outras Operações" },
  { code: "70", label: "Operação de Aquisição sem Direito a Crédito" },
  { code: "71", label: "Operação de Aquisição com Isenção" },
  { code: "72", label: "Operação de Aquisição com Suspensão" },
  { code: "73", label: "Operação de Aquisição a Alíquota Zero" },
  { code: "74", label: "Operação de Aquisição sem Incidência da Contribuição" },
  { code: "75", label: "Operação de Aquisição por Substituição Tributária" },
  { code: "98", label: "Outras Operações de Entrada" },
  { code: "99", label: "Outras Operações" }
];

const SITUACOES_TRIBUTARIAS_COFINS = SITUACOES_TRIBUTARIAS_PIS;

const CODIGOS_ENQUADRAMENTO_IPI = [
  "999", "601", "602", "603", "604", "605", "606", "607", "608"
];

const MODALIDADES_BC = [
  "Margem Valor Agregado (%)",
  "Pauta (valor)",
  "Preço Tabelado Máx. (valor)",
  "Valor da operação"
];

const MOTIVOS_DESONERACAO = [
  "Nenhum",
  "1 - Taxi",
  "3 - Produtor Agropecuário",
  "4 - Frotista/Locadora",
  "5 - Diplomático/Consular",
  "6 - Utilitários e Motocicletas da Amazônia Ocidental e Áreas de Livre Comércio",
  "7 - SUFRAMA",
  "8 - Venda a Órgão Público",
  "9 - Outros",
  "10 - Deficiente Condutor",
  "11 - Deficiente Não Condutor",
  "90 - Solicitado pelo Fisco"
];

const SITUACOES_TRIBUTARIAS_II = [
  { code: "Tributado", label: "Tributado" },
  { code: "Não tributado", label: "Não tributado" }
];

const SITUACOES_TRIBUTARIAS_ISSQN = [
  { code: "tributado", label: "tributado" },
  { code: "isento", label: "isento" },
  { code: "outra situação", label: "outra situação" }
];

const MODALIDADES_BC_ST = [
  "Preço tabelado ou máximo sugerido",
  "Lista Negativa (valor)",
  "Lista Positiva (valor)",
  "Lista Neutra (valor)",
  "Margem Valor Agregado (%)",
  "Pauta (valor)",
  "Valor da Operação"
];

const ESTADOS_BRASIL = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "EX", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"
];

const SITUACOES_TRIBUTARIAS_IS = [
  { value: "01", label: "01 - Operação tributável com alíquota ad valorem" },
  { value: "02", label: "02 - Operação tributável com alíquota específica" },
  { value: "03", label: "03 - Operação tributável com alíquota ad valorem e específica" },
  { value: "04", label: "04 - Operação isenta" },
  { value: "05", label: "05 - Operação com suspensão" },
  { value: "09", label: "09 - Outras operações" },
];

const SITUACOES_TRIBUTARIAS_CBS = [
  { value: "000", label: "000 - Tributação integral" },
  { value: "200", label: "200 - Alíquota reduzida" },
  { value: "410", label: "410 - Imunidade e não incidência" },
  { value: "510", label: "510 - Diferimento" },
  { value: "515", label: "515 - Diferimento com redução de alíquota" },
  { value: "550", label: "550 - Suspensão" },
  { value: "620", label: "620 - Tributação monofásica" },
  { value: "800", label: "800 - Transferência de crédito" },
  { value: "810", label: "810 - Ajuste de IBS na ZFM" },
  { value: "811", label: "811 - Ajustes" },
  { value: "830", label: "830 - Exclusão de base de cálculo" },
];
const CODIGOS_CLASSIFICACAO_CBS: Record<string, {value: string, label: string}[]> = {
  "000": [
    { value: "000001", label: "000001 - Situações tributadas integralmente pelo IBS e CBS." },
    { value: "000003", label: "000003 - Regime automotivo - projetos incentivados, observado o art. 311 da Lei Complementar nº 214, de 2025." },
    { value: "000004", label: "000004 - Regime automotivo - projetos incentivados, observado o art. 312 da Lei Complementar nº 214, de 2025." },
  ],
  "200": [
    { value: "200001", label: "200001 - Aquisições de máquinas, de aparelhos, de instrumentos, de equipamentos, de matérias-primas, de produtos intermediários e de materiais de embalagem rea..." },
    { value: "200002", label: "200002 - Fornecimento ou importação de tratores, máquinas e implementos agrícolas, destinados a produtor rural não contribuinte, e de veículos de transporte de car..." },
    { value: "200003", label: "200003 - Vendas de produtos destinados à alimentação humana relacionados no Anexo I da Lei Complementar nº 214, de 2025, com a especificação das respectivas..." },
    { value: "200004", label: "200004 - Venda de dispositivos médicos com a especificação das respectivas classificações da NCM/SH previstas no Anexo XII da Lei Complementar nº 214, de 202..." },
    { value: "200005", label: "200005 - Venda de dispositivos médicos com a especificação das respectivas classificações da NCM/SH previstas no Anexo IV da Lei Complementar nº 214, de 202..." },
    { value: "200006", label: "200006 - Situação de emergência de saúde pública reconhecida pelo Poder Legislativo federal, estadual, distrital ou municipal competente, ato conjunto do Ministro d..." },
    { value: "200007", label: "200007 - Fornecimento dos dispositivos de acessibilidade próprios para pessoas com deficiência relacionados no Anexo XIII da Lei Complementar nº 214, de 2025, co..." },
    { value: "200008", label: "200008 - Fornecimento dos dispositivos de acessibilidade próprios para pessoas com deficiência relacionados no Anexo V da Lei Complementar nº 214, de 2025, con..." },
    { value: "200009", label: "200009 - Fornecimento dos medicamentos relacionados no Anexo XIV da Lei Complementar nº 214, de 2025, com a especificação das respectivas classificações da ..." },
    { value: "200010", label: "200010 - Fornecimento dos medicamentos registrados na Anvisa, quando adquiridos por órgãos da administração pública direta, autarquias, fundações públicas e ent..." },
    { value: "200011", label: "200011 - Fornecimento das composições para nutrição enteral e parenteral, composições especiais e fórmulas nutricionais destinadas às pessoas com erros inatos d..." },
    { value: "200012", label: "200012 - Situação de emergência de saúde pública reconhecida pelo Poder Legislativo federal, estadual, distrital ou municipal competente, ato conjunto do Ministro d..." },
    { value: "200013", label: "200013 - Fornecimento de tampões higiênicos, absorventes higiênicos internos ou externos, descartáveis ou reutilizáveis, calcinhas absorventes e coletores menstrua..." },
    { value: "200014", label: "200014 - Fornecimento dos produtos hortícolas, frutas e ovos, relacionados no Anexo XV da Lei Complementar nº 214, de 2025, com a especificação das respectiva..." },
    { value: "200015", label: "200015 - Venda de automóveis de passageiros de fabricação nacional de, no mínimo, 4 (quatro) portas, inclusive a de acesso ao bagageiro, quando adquiridos por m..." },
    { value: "200020", label: "200020 - Operação praticada por sociedades cooperativas optantes por regime específico do IBS e CBS, quando o associado destinar bem ou serviço à cooperativa ..." },
    { value: "200022", label: "200022 - Operação originada fora da Zona Franca de Manaus que destine bem material industrializado de origem nacional a contribuinte estabelecido na Zona Franca..." },
    { value: "200023", label: "200023 - Operação realizada por indústria incentivada que destine bem material intermediário para outra indústria incentivada na Zona Franca de Manaus, desde que..." },
    { value: "200024", label: "200024 - Operação originada fora das Áreas de Livre Comércio que destine bem material industrializado de origem nacional a contribuinte estabelecido nas Áreas de ..." },
  ],
  "410": [
    { value: "410001", label: "410001 - Fornecimento de bonificações quando constem do respectivo documento fiscal e que não dependam de evento posterior, observado o art. 5º da Lei Complementar nº 214, de 2025." },
    { value: "410002", label: "410002 - Transferências entre estabelecimentos pertencentes ao mesmo contribuinte, observado o art. 6º da Lei Complementar nº 214, de 2025." },
    { value: "410003", label: "410003 - Doações que não tenham por objeto bens ou serviços que tenham permitido a apropriação de créditos pelo doador, observado o art. 6º da Lei Complementar nº 214, de 2025." },
    { value: "410004", label: "410004 - Exportações de bens e serviços, observado o art. 8º da Lei Complementar nº 214, de 2025." },
    { value: "410005", label: "410005 - Fornecimentos realizados pela União, pelos Estados, pelo Distrito Federal e pelos Municípios, observado o art. 9º da Lei Complementar nº 214, de 2025." },
    { value: "410006", label: "410006 - Fornecimentos realizados por entidades religiosas e templos de qualquer culto, inclusive suas organizações assistenciais e beneficentes, observado o art. 9º da Lei Complementar nº 214, de 2025." },
    { value: "410007", label: "410007 - Fornecimentos realizados por partidos políticos, inclusive suas fundações, entidades sindicais dos trabalhadores e instituições de educação e de assistência social, sem fins lucrativos, observado o art. 9º da Lei Complementar nº 214, de 2025." },
    { value: "410008", label: "410008 - Fornecimento de livros, jornais, periódicos e do papel destinado a sua impressão, observado o art. 9º da Lei Complementar nº 214, de 2025." },
    { value: "410009", label: "410009 - Fornecimentos de fonogramas e videofonogramas musicais produzidos no Brasil contendo obras musicais ou literomusicais de autores brasileiros e/ou obras em geral interpretadas por artistas brasileiros, bem como os suportes materiais ou arquivos digitais que os contenham, salvo n..." },
    { value: "410012", label: "410012 - Fornecimento de condomínio edilício não optante pelo regime regular, observado o art. 26 da Lei Complementar nº 214, de 2025." },
    { value: "410013", label: "410013 - Exportações de combustíveis, observado o art. 98 da Lei Complementar nº 214, de 2025." },
    { value: "410014", label: "410014 - Fornecimento de produtor rural não contribuinte, observado o art. 164 da Lei Complementar nº 214, de 2025." },
    { value: "410016", label: "410016 - Fornecimento ou aquisição de resíduos sólidos, observado o art. 170 da Lei Complementar nº 214, de 2025." },
    { value: "410017", label: "410017 - Aquisição de bem móvel com crédito presumido sob condição de revenda realizada, observado o art. 171 da Lei Complementar nº 214, de 2025." },
    { value: "410019", label: "410019 - Exclusão da gorjeta na base de cálculo no fornecimento de alimentação, observado o art. 274 da Lei Complementar nº 214, de 2025." },
    { value: "410020", label: "410020 - Exclusão do valor de intermediação na base de cálculo no fornecimento de alimentação, observado o art. 274 da Lei Complementar nº 214, de 2025." },
    { value: "410026", label: "410026 - Doação com anulação de crédito" },
    { value: "410029", label: "410029 - Operações acobertadas somente pelo ICMS." },
    { value: "410030", label: "410030 - Estorno de crédito de bens perecidos, deteriorados, roubados, furtados ou extraviados." },
  ],
  "510": [
    { value: "510001", label: "510001 - Operações, sujeitas a diferimento, com energia elétrica ou com direitos a ela relacionados, relativas à geração, comercialização, distribuição e transmissão, observado o art. 28 da Lei Complementar nº 214, de 2025." },
  ],
  "515": [
    { value: "515001", label: "515001 - Operações, sujeitas a diferimento, com insumos agropecuários e aquícolas destinados a produtor rural não contribuinte, observado o art. 138 da Lei Complementar nº 214, de 2025." },
  ],
  "550": [
    { value: "550001", label: "550001 - Exportações de bens materiais, observado o art. 82 da Lei Complementar nº 214, de 2025." },
    { value: "550002", label: "550002 - Regime de Trânsito, observado o art. 84 da Lei Complementar nº 214, de 2025." },
    { value: "550003", label: "550003 - Regimes de Depósito, observado o art. 85 da Lei Complementar nº 214, de 2025." },
    { value: "550004", label: "550004 - Regimes de Depósito, observado o art. 87 da Lei Complementar nº 214, de 2025." },
    { value: "550005", label: "550005 - Regimes de Depósito, observado o art. 87 da Lei Complementar nº 214, de 2025." },
    { value: "550006", label: "550006 - Regimes de Permanência Temporária, observado o art. 88 da Lei Complementar nº 214, de 2025." },
    { value: "550007", label: "550007 - Regimes de Aperfeiçoamento, observado o art. 90 da Lei Complementar nº 214, de 2025." },
    { value: "550008", label: "550008 - Importação de bens para o Regime de Repetro-Temporário, de que tratam o inciso I do art. 93 da Lei Complementar nº 214, de 2025." },
    { value: "550009", label: "550009 - GNL-Temporário, de que trata o inciso II do art. 93 da Lei Complementar nº 214, de 2025." },
    { value: "550010", label: "550010 - Repetro-Permanente, de que trata o inciso III do art. 93 da Lei Complementar nº 214, de 2025." },
    { value: "550011", label: "550011 - Repetro-Industrialização, de que trata o inciso IV do art. 93 da Lei Complementar nº 214, de 2025." },
    { value: "550012", label: "550012 - Repetro-Nacional, de que trata o inciso V do art. 93 da Lei Complementar nº 214, de 2025." },
    { value: "550013", label: "550013 - Repetro-Entreposto, de que trata o inciso VI do art. 93 da Lei Complementar nº 214, de 2025." },
    { value: "550014", label: "550014 - Zona de Processamento de Exportação, observado os arts. 99, 100 e 102 da Lei Complementar nº 214, de 2025." },
    { value: "550015", label: "550015 - Regime Tributário para Incentivo à Modernização e à Ampliação da Estrutura Portuária - Reporto, observado o art. 105 da Lei Complementar nº 214, de 2025." },
    { value: "550016", label: "550016 - Regime Especial de Incentivos para o Desenvolvimento da Infraestrutura - Reidi, observado o art. 106 da Lei Complementar nº 214, de 2025." },
    { value: "550017", label: "550017 - Regime Tributário para Incentivo à Atividade Econômica Naval - Renaval, observado o art. 107 da Lei Complementar nº 214, de 2025." },
    { value: "550018", label: "550018 - Desoneração da aquisição de bens de capital, observado o art. 109 da Lei Complementar nº 214, de 2025." },
    { value: "550019", label: "550019 - Importação de bem material por indústria incentivada para utilização na Zona Franca de Manaus, observado o art. 443 da Lei Complementar nº 214, de 2025." },
    { value: "550020", label: "550020 - Áreas de livre comércio, observado o art. 461 da Lei Complementar nº 214, de 2025." },
    { value: "550021", label: "550021 - Fornecimento de produtos agropecuários in natura para contribuinte do regime regular que promova industrialização destinada a exportação, observado o art. 82 da Lei Complementar nº 214, de 2025." },
    { value: "550022", label: "550022 - Regime Especial de Incentivos para a Produção de Hidrogênio de Baixa Emissão de Carbono (Rehidro)" },
    { value: "550023", label: "550023 - Operações com hidrocarbonetos líquidos derivados de petróleo não combustíveis ou de gás natural, inclusive nafta" },
  ],
  "620": [
    { value: "620001", label: "620001 - Tributação monofásica sobre combustíveis, observados os art. 172 e art. 179 I da Lei Complementar nº 214, de 2025." },
    { value: "620002", label: "620002 - Tributação monofásica com responsabilidade pela retenção sobre combustíveis, observado o art. 178 da Lei Complementar nº 214, de 2025." },
    { value: "620003", label: "620003 - Tributação monofásica com tributos retidos por responsabilidade sobre combustíveis, observado o art. 178 da Lei Complementar nº 214, de 2025." },
    { value: "620004", label: "620004 - Tributação monofásica sobre mistura de EAC com gasolina A em percentual superior ou inferior ao obrigatório, observado o art. 179 da Lei Complementar nº 214, de 2025." },
    { value: "620005", label: "620005 - Tributação monofásica sobre mistura de EAC com gasolina A em percentual superior ou inferior ao obrigatório, observado o art. 179 da Lei Complementar nº 214, de 2025." },
    { value: "620006", label: "620006 - Tributação monofásica sobre combustíveis cobrada anteriormente, observado o art. 180 da Lei Complementar nº 214, de 2025." },
  ],
  "800": [
    { value: "800001", label: "800001 - Fusão, cisão ou incorporação, observado o art. 55 da Lei Complementar nº 214, de 2025." },
    { value: "800002", label: "800002 - Transferência de crédito do associado, inclusive as cooperativas singulares, para cooperativa de que participa das operações antecedentes às operações em que fornece bens e serviços e os créditos presumidos, observado o art. 272 da Lei Complementar nº 214, de 2025." },
  ],
  "810": [
    { value: "810001", label: "810001 - Crédito presumido de IBS sobre o valor apurado nos fornecimentos a partir da Zona Franca de Manaus, observado o art. 450 da Lei Complementar nº 214, de 2025." },
  ],
  "811": [
    { value: "811001", label: "811001 - Anulação de crédito proporcional ao valor das operações imunes e isentas, observado o art. 51 da Lei Complementar nº 214, de 2025." },
    { value: "811002", label: "811002 - Débitos de notas fiscais não processadas na apuração, observado o art. 45 da Lei Complementar nº 214, de 2025." },
    { value: "811003", label: "811003 - Débitos apurados após o desenquadramento do regime Simples Nacional, observado o art. 41 da Lei Complementar nº 214, de 2025." },
  ],
  "830": [
    { value: "830001", label: "830001 - Documento com exclusão da base de cálculo da CBS e do IBS referente à energia elétrica fornecida pela distribuidora à unidade consumidora, conforme Art 28, parágrafos 3º e 4º." },
  ]
};

const initialICMSRule: Omit<RegraICMS, 'id'> = {
  estados: [],
  produtos: [{ tipo: "NCM", valor: "" }],
  cfop: "",
  aliquota: 0,
  base: 100,
  situacaoTributaria: "00",
  modalidadeBC: "Margem Valor Agregado (%)",
  presumido: 0,
  fcp: 0,
  motivoDesoneracao: "Nenhum",
  deducaoDesonerado: false,
};

const initialIPIRule: Omit<RegraIPI, 'id'> = {
  estados: [],
  produtos: [{ tipo: "NCM", valor: "" }],
  situacaoTributaria: "Sem IPI",
  cfop: "",
  aliquota: 0,
  base: 100,
  codEnquadramento: "999",
  infoComplementares: "",
  infoFisco: "",
};

const initialPISRule: Omit<RegraPIS, 'id'> = {
  estados: [],
  produtos: [{ tipo: "NCM", valor: "" }],
  cfop: "",
  situacaoTributaria: "01",
  aliquota: 0,
  base: 100,
  infoComplementares: "",
  infoFisco: "",
};

const initialCOFINSRule: Omit<RegraCOFINS, 'id'> = {
  estados: [],
  produtos: [{ tipo: "NCM", valor: "" }],
  cfop: "",
  situacaoTributaria: "01",
  aliquota: 0,
  base: 100,
  infoComplementares: "",
  infoFisco: "",
};

const initialIIRule: Omit<RegraII, 'id'> = {
  estados: [],
  produtos: [{ tipo: "NCM", valor: "" }],
  situacaoTributaria: "Tributado",
  aliquota: 0,
  base: 100,
  infoComplementares: "",
  infoFisco: "",
};

const initialISSQNRule: Omit<RegraISSQN, 'id'> = {
  estados: [],
  produtos: [{ tipo: "NCM", valor: "" }],
  situacaoTributaria: "isento",
  aliquota: 0,
  base: 100,
  descontarISS: false,
  reterISS: false,
  infoComplementares: "",
  infoFisco: "",
};

const initialISRule: any = {
  estados: [],
  produtos: [{ tipo: "NCM", valor: "" }],
  situacaoTributaria: "01",
  aliquota: 0,
  base: 100,
  unidadeMedida: "",
  aliqUnidade: 0,
  infoComplementares: "",
  infoFisco: "",
};

const SITUACOES_TRIBUTARIAS_IBS = SITUACOES_TRIBUTARIAS_CBS;
const CODIGOS_CLASSIFICACAO_IBS = CODIGOS_CLASSIFICACAO_CBS;

const initialCBSRule: any = {
  estados: [],
  produtos: [{ tipo: "NCM", valor: "" }],
  situacaoTributaria: "000",
  aliquota: 0,
  base: 100,
  infoComplementares: "",
  infoFisco: "",
};

const initialIBSRule: any = {
  estados: [],
  produtos: [{ tipo: "NCM", valor: "" }],
  situacaoTributaria: "000",
  aliquota: 0,
  aliqIBSUF: 0,
  aliqIBSMun: 0,
  redAliqIBSUF: 0,
  aliqEfetIBSUF: 0,
  redAliqIBSMun: 0,
  aliqEfetIBSMun: 0,
  percDifIBSUF: 0,
  percDifIBSMun: 0,
  base: 100,
  infoComplementares: "",
  infoFisco: "",
};

const initialNatureza: Omit<NaturezaOperacao, 'id' | 'createdAt'> = {
  descricao: "",
  serie: "1",
  tipo: "Saída",
  regimeTributario: "Regime normal",
  indicadorPresenca: "9 - Operação não presencial, outros",
  isFaturada: true,
  isConsumidorFinal: false,
  isDevolucao: false,
  atualizarPrecoCompra: false,
  regrasICMS: [],
  regrasIPI: [],
  regrasPIS: [],
  regrasCOFINS: [],
  regrasII: [],
  regrasISSQN: [],
  regrasIS: [],
  regrasCBS: [],
  regrasIBS: [],
  incluirFreteBaseIPI: false,
  presumidoPisCofins: false,
  somarIcms: false,
  somarOutrasDespesas: false,
  aliqFunrural: 0,
  compraProdutorRural: false,
  descontarFunrural: false,
  tipoAproxTrib: 'Alíquota Tabela',
  tipoDesconto: 'Condicional',
  possuiCSRF: false,
  aliqCSRF: 0,
  possuiIR: false,
  aliqIR: 0,
  infoComplementares: "",
  infoFisco: "",
  branchId: "",
};

export default function NaturezasOperacaoPage() {
  const { toast } = useToast();
  
  // States
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [view, setView] = React.useState<'list' | 'form'>('list');
  const [searchTerm, setSearchTerm] = React.useState("");
  
  // Data
  const [naturezas, setNaturezas] = React.useState<NaturezaOperacao[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>("all");
  
  // Form State
  const [currentNatureza, setCurrentNatureza] = React.useState<NaturezaOperacao | null>(null);
  const [naturezaToDelete, setNaturezaToDelete] = React.useState<NaturezaOperacao | null>(null);

  // Rule Modal State
  const [isRuleDialogOpen, setIsRuleDialogOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<any>(null);
  const [editingTaxType, setEditingTaxType] = React.useState<'icms' | 'ipi' | 'pis' | 'cofins' | 'ii' | 'issqn' | 'is' | 'cbs' | 'ibs'>('icms');
  
  const showBaseField = currentNatureza?.regimeTributario === "Regime normal" || 
                       currentNatureza?.regimeTributario === "Simples nacional - Excesso de sublimite de receita bruta";

  // Load Data
  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [naturezasSnap, branchesSnap] = await Promise.all([
        getDocs(query(collection(db, "naturezas_operacao"), firestoreOrderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "branches"), firestoreOrderBy("name")))
      ]);
      
      setNaturezas(naturezasSnap.docs.map(d => ({ id: d.id, ...d.data() }) as NaturezaOperacao));
      setBranches(branchesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Branch));
      
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar as naturezas de operação.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Actions
  const handleAdd = () => {
    setCurrentNatureza({ ...initialNatureza, id: '', createdAt: null } as NaturezaOperacao);
    setView('form');
  };

  const handleEdit = (natureza: NaturezaOperacao) => {
    setCurrentNatureza({ ...natureza });
    setView('form');
  };

  const handleCancel = () => {
    setCurrentNatureza(null);
    setView('list');
  };

  const handleSave = async () => {
    if (!currentNatureza || !currentNatureza.descricao || !currentNatureza.branchId) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha a descrição e selecione a filial.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (currentNatureza.id) {
        const docRef = doc(db, "naturezas_operacao", currentNatureza.id);
        const { id, ...data } = currentNatureza;
        await updateDoc(docRef, data);
        toast({ title: "Natureza atualizada!", description: "As alterações foram salvas com sucesso." });
      } else {
        const { id, ...data } = currentNatureza;
        await addDoc(collection(db, "naturezas_operacao"), {
          ...data,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Natureza criada!", description: "A nova natureza de operação foi cadastrada." });
      }
      fetchData();
      setView('list');
      setCurrentNatureza(null);
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a natureza de operação.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!naturezaToDelete) return;
    try {
      await deleteDoc(doc(db, "naturezas_operacao", naturezaToDelete.id));
      toast({ title: "Removido!", description: "Natureza de operação excluída com sucesso.", variant: "destructive" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } finally {
      setNaturezaToDelete(null);
    }
  };

  // Rule Helpers
  const openAddRule = (taxType: 'icms' | 'ipi' | 'pis' | 'cofins' | 'ii' | 'issqn' | 'is' | 'cbs' | 'ibs' = 'icms') => {
    setEditingTaxType(taxType);
    
    const taxKey = taxType === 'icms' ? 'regrasICMS' : 
                   taxType === 'ipi' ? 'regrasIPI' : 
                   taxType === 'pis' ? 'regrasPIS' : 
                   taxType === 'ii' ? 'regrasII' : 
                   taxType === 'issqn' ? 'regrasISSQN' : 
                   taxType === 'is' ? 'regrasIS' : 
                   taxType === 'cbs' ? 'regrasCBS' : 
                   taxType === 'ibs' ? 'regrasIBS' : 'regrasCOFINS';
    
    const regrasList = (currentNatureza as any)?.[taxKey] || [];
    const lastRule = regrasList.length > 0 ? regrasList[regrasList.length - 1] : null;
    const initial = taxType === 'icms' ? initialICMSRule : 
                    taxType === 'ipi' ? initialIPIRule :
                    taxType === 'pis' ? initialPISRule : 
                    taxType === 'ii' ? initialIIRule : 
                    taxType === 'issqn' ? initialISSQNRule : 
                    taxType === 'is' ? initialISRule : 
                    taxType === 'cbs' ? initialCBSRule : 
                    taxType === 'ibs' ? initialIBSRule : initialCOFINSRule;

    setEditingRule({
      ...initial,
      estados: lastRule?.estados || initial.estados,
      produtos: lastRule?.produtos || initial.produtos,
      id: Math.random().toString(36).substr(2, 9),
    } as any);
    setIsRuleDialogOpen(true);
  };

  const openEditRule = (rule: any, taxType: 'icms' | 'ipi' | 'pis' | 'cofins' | 'ii' | 'issqn' | 'is' | 'cbs' | 'ibs' = 'icms') => {
    setEditingTaxType(taxType);
    setEditingRule({ ...rule });
    setIsRuleDialogOpen(true);
  };

  const saveRule = () => {
    if (!currentNatureza || !editingRule) return;
    
    const taxKey = editingTaxType === 'icms' ? 'regrasICMS' : 
                   editingTaxType === 'ipi' ? 'regrasIPI' : 
                   editingTaxType === 'pis' ? 'regrasPIS' : 
                   editingTaxType === 'ii' ? 'regrasII' : 
                   editingTaxType === 'issqn' ? 'regrasISSQN' : 
                   editingTaxType === 'is' ? 'regrasIS' : 
                   editingTaxType === 'cbs' ? 'regrasCBS' : 
                   editingTaxType === 'ibs' ? 'regrasIBS' : 'regrasCOFINS';
    
    const regrasList = (currentNatureza as any)[taxKey] || [];
    const existingIndex = regrasList.findIndex((r: any) => r.id === editingRule.id);
    let newRegras = [...regrasList];
    
    if (existingIndex > -1) {
      newRegras[existingIndex] = editingRule;
    } else {
      newRegras.push(editingRule);
    }
    
    setCurrentNatureza({
      ...currentNatureza,
      [taxKey]: newRegras
    });
    setIsRuleDialogOpen(false);
    setEditingRule(null);
  };

  const removeRule = (id: string, taxType: 'icms' | 'ipi' | 'pis' | 'cofins' | 'ii' | 'issqn' | 'is' | 'cbs' | 'ibs' = 'icms') => {
    if (!currentNatureza) return;
    const taxKey = taxType === 'icms' ? 'regrasICMS' : 
                   taxType === 'ipi' ? 'regrasIPI' : 
                   taxType === 'pis' ? 'regrasPIS' : 
                   taxType === 'ii' ? 'regrasII' : 
                   taxType === 'issqn' ? 'regrasISSQN' : 
                   taxType === 'is' ? 'regrasIS' : 
                   taxType === 'cbs' ? 'regrasCBS' : 
                   taxType === 'ibs' ? 'regrasIBS' : 'regrasCOFINS';
                   
    setCurrentNatureza({
      ...currentNatureza,
      [taxKey]: ((currentNatureza as any)[taxKey] || []).filter((r: any) => r.id !== id)
    });
  };

  const filteredNaturezas = naturezas.filter(n => {
    const matchesSearch = n.descricao.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBranch = selectedBranchId === "all" || n.branchId === selectedBranchId;
    return matchesSearch && matchesBranch;
  });

  if (loading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (view === 'form' && currentNatureza) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleCancel}>
              <X className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold font-headline tracking-tight">Natureza da operação</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleCancel} disabled={isSubmitting} className="rounded-xl px-8">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting} className="rounded-xl px-8 shadow-md hover:shadow-xl transition-all">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>

        <Card className="border-none shadow-premium bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Dados gerais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input 
                id="descricao" 
                value={currentNatureza.descricao} 
                onChange={e => setCurrentNatureza({...currentNatureza, descricao: e.target.value})}
                placeholder="Ex: COMPRA DE MERCADORIA"
                className="bg-white/50 dark:bg-zinc-800/50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filial">Filial</Label>
                <Select value={currentNatureza.branchId} onValueChange={v => setCurrentNatureza({...currentNatureza, branchId: v})}>
                  <SelectTrigger className="bg-white/50 dark:bg-zinc-800/50">
                    <SelectValue placeholder="Selecione a filial" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serie">Série</Label>
                <Input 
                  id="serie" 
                  value={currentNatureza.serie} 
                  onChange={e => setCurrentNatureza({...currentNatureza, serie: e.target.value})}
                  className="bg-white/50 dark:bg-zinc-800/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select value={currentNatureza.tipo} onValueChange={(v: any) => setCurrentNatureza({...currentNatureza, tipo: v})}>
                  <SelectTrigger className="bg-white/50 dark:bg-zinc-800/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_OPERACOES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="regime">Código de regime tributário</Label>
                <Select value={currentNatureza.regimeTributario} onValueChange={v => setCurrentNatureza({...currentNatureza, regimeTributario: v})}>
                  <SelectTrigger className="bg-white/50 dark:bg-zinc-800/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIMES_TRIBUTARIOS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="presenca">Indicador de presença</Label>
                <Select value={currentNatureza.indicadorPresenca} onValueChange={v => setCurrentNatureza({...currentNatureza, indicadorPresenca: v})}>
                  <SelectTrigger className="bg-white/50 dark:bg-zinc-800/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDICADORES_PRESENCA.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
              <div className="flex items-center space-x-3 bg-muted/20 p-3 rounded-xl border border-border/50">
                <Switch 
                  id="faturada" 
                  checked={currentNatureza.isFaturada} 
                  onCheckedChange={v => setCurrentNatureza({...currentNatureza, isFaturada: v})} 
                />
                <Label htmlFor="faturada" className="cursor-pointer">Faturada</Label>
              </div>
              <div className="flex items-center space-x-3 bg-muted/20 p-3 rounded-xl border border-border/50">
                <Switch 
                  id="consumidor" 
                  checked={currentNatureza.isConsumidorFinal} 
                  onCheckedChange={v => setCurrentNatureza({...currentNatureza, isConsumidorFinal: v})} 
                />
                <Label htmlFor="consumidor" className="cursor-pointer">Consumidor final</Label>
              </div>
              <div className="flex items-center space-x-3 bg-muted/20 p-3 rounded-xl border border-border/50">
                <Switch 
                  id="devolucao" 
                  checked={currentNatureza.isDevolucao} 
                  onCheckedChange={v => setCurrentNatureza({...currentNatureza, isDevolucao: v})} 
                />
                <Label htmlFor="devolucao" className="cursor-pointer">Operação de devolução</Label>
              </div>
              <div className="flex items-center space-x-3 bg-muted/20 p-3 rounded-xl border border-border/50 col-span-1 md:col-span-2 lg:col-span-1">
                <Switch 
                  id="atualizarPreco" 
                  checked={currentNatureza.atualizarPrecoCompra} 
                  onCheckedChange={v => setCurrentNatureza({...currentNatureza, atualizarPrecoCompra: v})} 
                />
                <div className="flex items-center gap-1">
                  <Label htmlFor="atualizarPreco" className="cursor-pointer">Atualizar preço de última compra do produto</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-sky-500 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="bg-zinc-800 text-white border-zinc-700 max-w-[300px]">
                        <p className="text-xs">Caso esteja desabilitado, não é considerado em relatórios baseados no último preço de compra.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-premium bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Regras de Tributação
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="icms" className="w-full">
              <div className="px-6 border-b bg-muted/20">
                <TabsList className="h-12 bg-transparent gap-4 overflow-x-auto justify-start no-scrollbar">
                  {["ICMS", "IPI", "PIS", "COFINS", "II", "ISSQN", "Outros", "Retenções", "IS", "CBS", "IBS"]
                    .filter(tab => tab !== "II" || currentNatureza.tipo === "Entrada")
                    .map(tab => (
                      <TabsTrigger 
                        key={tab} 
                        value={tab.toLowerCase()}
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 font-bold text-xs uppercase tracking-wider"
                      >
                        {tab}
                      </TabsTrigger>
                    ))}
                </TabsList>
              </div>
              
              <TabsContent value="icms" className="p-6 focus-visible:outline-none">
                <div className="rounded-xl border border-border/50 overflow-hidden bg-white/30 dark:bg-zinc-800/30">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Estado(s)</TableHead>
                        <TableHead>Produto / Filtro</TableHead>
                        <TableHead>CFOP</TableHead>
                        <TableHead>Aliq. %</TableHead>
                        {showBaseField && <TableHead>Base %</TableHead>}
                        <TableHead>Situação tributária</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentNatureza.regrasICMS.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={showBaseField ? 8 : 7} className="text-center py-10 text-muted-foreground">
                            Nenhuma regra de ICMS definida.
                          </TableCell>
                        </TableRow>
                      ) : (
                        currentNatureza.regrasICMS.map((regra, idx) => (
                          <TableRow key={regra.id}>
                            <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-bold text-primary">
                              {regra.estados.length === 0 ? "Todos" : (
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {regra.estados.map(uf => <Badge key={uf} variant="secondary" className="text-[10px] px-1 h-4">{uf}</Badge>)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                {((regra.produtos.length > 1) || (regra.produtos[0]?.valor)) && (
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                    {regra.produtos.length > 1 ? `${regra.produtos.length} Itens` : regra.produtos[0]?.tipo}
                                  </span>
                                )}
                                <span className="text-sm truncate max-w-[150px]">
                                  {regra.produtos[0]?.valor || "Qualquer"}
                                  {regra.produtos.length > 1 && <span className="ml-1 text-sky-500 font-bold">+{regra.produtos.length - 1}</span>}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell><Badge variant="outline">{regra.cfop || '---'}</Badge></TableCell>
                            <TableCell>{regra.aliquota}%</TableCell>
                            {showBaseField && <TableCell>{regra.base}%</TableCell>}
                            <TableCell className="text-xs">
                              {(() => {
                                const sit = SITUACOES_TRIBUTARIAS_ICMS.find(s => s.code === regra.situacaoTributaria);
                                return sit ? `${sit.code} - ${sit.label}` : regra.situacaoTributaria;
                              })()}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRule(regra, 'icms')}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRule(regra.id, 'icms')}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end mt-4">
                  <Button variant="outline" size="sm" onClick={() => openAddRule('icms')} className="gap-2 text-primary border-primary/20 hover:bg-primary/5 rounded-xl px-4">
                    <PlusCircle className="h-4 w-4" />
                    Adicionar regra
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="ipi" className="p-6 focus-visible:outline-none">
                <div className="rounded-xl border border-border/50 overflow-hidden bg-white/30 dark:bg-zinc-800/30">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Destino(s)</TableHead>
                        <TableHead>Produto / Filtro</TableHead>
                        <TableHead>Aliq. %</TableHead>
                        {showBaseField && <TableHead>Base %</TableHead>}
                        <TableHead>Situação tributária</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(currentNatureza.regrasIPI || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={showBaseField ? 7 : 6} className="text-center py-10 text-muted-foreground">
                            Nenhuma regra de IPI definida.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (currentNatureza.regrasIPI || []).map((regra, idx) => (
                          <TableRow key={regra.id}>
                            <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-bold text-primary">
                              {regra.estados.length === 0 ? "Todos" : (
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {regra.estados.map(uf => <Badge key={uf} variant="secondary" className="text-[10px] px-1 h-4">{uf}</Badge>)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                {((regra.produtos.length > 1) || (regra.produtos[0]?.valor)) && (
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                    {regra.produtos.length > 1 ? `${regra.produtos.length} Itens` : regra.produtos[0]?.tipo}
                                  </span>
                                )}
                                <span className="text-sm truncate max-w-[150px]">
                                  {regra.produtos[0]?.valor || "Qualquer"}
                                  {regra.produtos.length > 1 && <span className="ml-1 text-sky-500 font-bold">+{regra.produtos.length - 1}</span>}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{regra.aliquota}%</TableCell>
                            {showBaseField && <TableCell>{regra.base}%</TableCell>}
                            <TableCell className="text-xs">
                              {(() => {
                                const sit = SITUACOES_TRIBUTARIAS_IPI.find(s => s.code === regra.situacaoTributaria);
                                return sit ? `${sit.code} - ${sit.label}` : regra.situacaoTributaria;
                              })()}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRule(regra, 'ipi')}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRule(regra.id, 'ipi')}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="freteIpi" 
                      checked={!!currentNatureza.incluirFreteBaseIPI} 
                      onCheckedChange={(checked) => setCurrentNatureza({...currentNatureza, incluirFreteBaseIPI: !!checked})} 
                    />
                    <Label htmlFor="freteIpi" className="text-sm font-medium cursor-pointer">Incluir frete na base do IPI</Label>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openAddRule('ipi')} className="gap-2 text-primary border-primary/20 hover:bg-primary/5 rounded-xl px-4">
                    <PlusCircle className="h-4 w-4" />
                    Adicionar regra
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="pis" className="p-6 focus-visible:outline-none">
                <div className="rounded-xl border border-border/50 overflow-hidden bg-white/30 dark:bg-zinc-800/30">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Destino(s)</TableHead>
                        <TableHead>Produto / Filtro</TableHead>
                        <TableHead>Aliq. %</TableHead>
                        {showBaseField && <TableHead>Base %</TableHead>}
                        <TableHead>Situação tributária</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(currentNatureza.regrasPIS || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={showBaseField ? 7 : 6} className="text-center py-10 text-muted-foreground">
                            Nenhuma regra de PIS definida.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (currentNatureza.regrasPIS || []).map((regra, idx) => (
                          <TableRow key={regra.id}>
                            <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-bold text-primary">
                              {regra.estados.length === 0 ? "Todos" : (
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {regra.estados.map(uf => <Badge key={uf} variant="secondary" className="text-[10px] px-1 h-4">{uf}</Badge>)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                {((regra.produtos.length > 1) || (regra.produtos[0]?.valor)) && (
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                    {regra.produtos.length > 1 ? `${regra.produtos.length} Itens` : regra.produtos[0]?.tipo}
                                  </span>
                                )}
                                <span className="text-sm truncate max-w-[150px]">
                                  {regra.produtos[0]?.valor || "Qualquer"}
                                  {regra.produtos.length > 1 && <span className="ml-1 text-sky-500 font-bold">+{regra.produtos.length - 1}</span>}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{regra.aliquota}%</TableCell>
                            {showBaseField && <TableCell>{regra.base}%</TableCell>}
                            <TableCell className="text-xs">
                              {(() => {
                                const sit = SITUACOES_TRIBUTARIAS_PIS.find(s => s.code === regra.situacaoTributaria);
                                return sit ? `${sit.code} - ${sit.label}` : regra.situacaoTributaria;
                              })()}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRule(regra, 'pis')}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRule(regra.id, 'pis')}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end mt-4">
                  <Button variant="outline" size="sm" onClick={() => openAddRule('pis')} className="gap-2 text-primary border-primary/20 hover:bg-primary/5 rounded-xl px-4">
                    <PlusCircle className="h-4 w-4" />
                    Adicionar regra
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="cofins" className="p-6 focus-visible:outline-none">
                <div className="rounded-xl border border-border/50 overflow-hidden bg-white/30 dark:bg-zinc-800/30">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Destino(s)</TableHead>
                        <TableHead>Produto / Filtro</TableHead>
                        <TableHead>Aliq. %</TableHead>
                        {showBaseField && <TableHead>Base %</TableHead>}
                        <TableHead>Situação tributária</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(currentNatureza.regrasCOFINS || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={showBaseField ? 7 : 6} className="text-center py-10 text-muted-foreground">
                            Nenhuma regra de COFINS definida.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (currentNatureza.regrasCOFINS || []).map((regra, idx) => (
                          <TableRow key={regra.id}>
                            <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-bold text-primary">
                              {regra.estados.length === 0 ? "Todos" : (
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {regra.estados.map(uf => <Badge key={uf} variant="secondary" className="text-[10px] px-1 h-4">{uf}</Badge>)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                {((regra.produtos.length > 1) || (regra.produtos[0]?.valor)) && (
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                    {regra.produtos.length > 1 ? `${regra.produtos.length} Itens` : regra.produtos[0]?.tipo}
                                  </span>
                                )}
                                <span className="text-sm truncate max-w-[150px]">
                                  {regra.produtos[0]?.valor || "Qualquer"}
                                  {regra.produtos.length > 1 && <span className="ml-1 text-sky-500 font-bold">+{regra.produtos.length - 1}</span>}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{regra.aliquota}%</TableCell>
                            {showBaseField && <TableCell>{regra.base}%</TableCell>}
                            <TableCell className="text-xs">
                              {(() => {
                                const sit = SITUACOES_TRIBUTARIAS_COFINS.find(s => s.code === regra.situacaoTributaria);
                                return sit ? `${sit.code} - ${sit.label}` : regra.situacaoTributaria;
                              })()}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRule(regra, 'cofins')}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRule(regra.id, 'cofins')}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end mt-4">
                  <Button variant="outline" size="sm" onClick={() => openAddRule('cofins')} className="gap-2 text-primary border-primary/20 hover:bg-primary/5 rounded-xl px-4">
                    <PlusCircle className="h-4 w-4" />
                    Adicionar regra
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="ii" className="p-6 focus-visible:outline-none">
                <div className="rounded-xl border border-border/50 overflow-hidden bg-white/30 dark:bg-zinc-800/30">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Destino(s)</TableHead>
                        <TableHead>Produto(s)</TableHead>
                        <TableHead>Aliq. %</TableHead>
                        {showBaseField && <TableHead>Base %</TableHead>}
                        <TableHead>Situação tributária</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(currentNatureza.regrasII || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={showBaseField ? 7 : 6} className="text-center py-10 text-muted-foreground">
                            Nenhuma regra de II definida.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (currentNatureza.regrasII || []).map((regra, idx) => (
                          <TableRow key={regra.id}>
                            <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-bold text-primary">
                              {regra.estados.length === 0 ? "Todos" : (
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {regra.estados.map(uf => <Badge key={uf} variant="secondary" className="text-[10px] px-1 h-4">{uf}</Badge>)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                {((regra.produtos.length > 1) || (regra.produtos[0]?.valor)) && (
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                    {regra.produtos.length > 1 ? `${regra.produtos.length} Itens` : regra.produtos[0]?.tipo}
                                  </span>
                                )}
                                <span className="text-sm truncate max-w-[150px]">
                                  {regra.produtos[0]?.valor || "Qualquer"}
                                  {regra.produtos.length > 1 && <span className="ml-1 text-sky-500 font-bold">+{regra.produtos.length - 1}</span>}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{parseFloat((regra.aliquota || 0).toFixed(4)).toString().replace('.', ',')}%</TableCell>
                            {showBaseField && <TableCell>{parseFloat((regra.base || 0).toFixed(4)).toString().replace('.', ',')}%</TableCell>}
                            <TableCell className="text-xs">
                              {regra.situacaoTributaria}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRule(regra, 'ii')}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRule(regra.id, 'ii')}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end mt-4">
                  <Button variant="outline" size="sm" onClick={() => openAddRule('ii')} className="gap-2 text-primary border-primary/20 hover:bg-primary/5 rounded-xl px-4">
                    <PlusCircle className="h-4 w-4" />
                    Adicionar regra
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="issqn" className="p-6 focus-visible:outline-none">
                <div className="rounded-xl border border-border/50 overflow-hidden bg-white/30 dark:bg-zinc-800/30">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Destino(s)</TableHead>
                        <TableHead>Produto(s)</TableHead>
                        <TableHead>Aliq. %</TableHead>
                        {showBaseField && <TableHead>Base %</TableHead>}
                        <TableHead>Situação tributária</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(currentNatureza.regrasISSQN || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={showBaseField ? 7 : 6} className="text-center py-10 text-muted-foreground">
                            Nenhuma regra de ISSQN definida.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (currentNatureza.regrasISSQN || []).map((regra, idx) => (
                          <TableRow key={regra.id}>
                            <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-bold text-primary">
                              {regra.estados.length === 0 ? "Todos" : (
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {regra.estados.map(uf => <Badge key={uf} variant="secondary" className="text-[10px] px-1 h-4">{uf}</Badge>)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                {((regra.produtos.length > 1) || (regra.produtos[0]?.valor)) && (
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                    {regra.produtos.length > 1 ? `${regra.produtos.length} Itens` : regra.produtos[0]?.tipo}
                                  </span>
                                )}
                                <span className="text-sm truncate max-w-[150px]">
                                  {regra.produtos[0]?.valor || "Qualquer"}
                                  {regra.produtos.length > 1 && <span className="ml-1 text-sky-500 font-bold">+{regra.produtos.length - 1}</span>}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{parseFloat((regra.aliquota || 0).toFixed(4)).toString().replace('.', ',')}%</TableCell>
                            {showBaseField && <TableCell>{parseFloat((regra.base || 0).toFixed(4)).toString().replace('.', ',')}%</TableCell>}
                            <TableCell className="text-xs">
                              {regra.situacaoTributaria}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRule(regra, 'issqn')}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRule(regra.id, 'issqn')}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end mt-4">
                  <Button variant="outline" size="sm" onClick={() => openAddRule('issqn')} className="gap-2 text-primary border-primary/20 hover:bg-primary/5 rounded-xl px-4">
                    <PlusCircle className="h-4 w-4" />
                    Adicionar regra
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="outros" className="p-8 focus-visible:outline-none">
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 min-h-[2rem]">Presumido no cálculo do PIS/COFINS</Label>
                      <Select 
                        value={currentNatureza.presumidoPisCofins ? "Sim" : "Não"} 
                        onValueChange={v => setCurrentNatureza({...currentNatureza, presumidoPisCofins: v === "Sim"})}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-white/50 dark:bg-zinc-800/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Não">Não</SelectItem>
                          <SelectItem value="Sim">Sim</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 min-h-[2rem]">
                        Somar ICMS
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-sky-500 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-zinc-800 text-white border-zinc-700 max-w-[400px]">
                              <p className="text-xs">Somar ICMS ao total da nota. Se aplica somente a operações de importação (CFOP iniciado por 3) e com veículos novos (Tipo de operação 2 - Faturamento direto para consumidor final)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Select 
                        value={currentNatureza.somarIcms ? "Sim" : "Não"} 
                        onValueChange={v => setCurrentNatureza({...currentNatureza, somarIcms: v === "Sim"})}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-white/50 dark:bg-zinc-800/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Não">Não</SelectItem>
                          <SelectItem value="Sim">Sim</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 min-h-[2rem]">
                        Somar outras despesas
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-sky-500 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-zinc-800 text-white border-zinc-700 max-w-[400px]">
                              <p className="text-xs">Somar PIS, COFINS e despesas aduaneiras ao total da nota. Se aplica somente a operações de importação (CFOP iniciado por 3) e com veículos novos (Tipo de operação 2 - Faturamento direto para consumidor final)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Select 
                        value={currentNatureza.somarOutrasDespesas ? "Sim" : "Não"} 
                        onValueChange={v => setCurrentNatureza({...currentNatureza, somarOutrasDespesas: v === "Sim"})}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-white/50 dark:bg-zinc-800/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Não">Não</SelectItem>
                          <SelectItem value="Sim">Sim</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 min-h-[2rem]">Alíquota funrural (%)</Label>
                      <Input 
                        type="number" 
                        value={currentNatureza.aliqFunrural} 
                        onChange={e => setCurrentNatureza({...currentNatureza, aliqFunrural: parseFloat(e.target.value) || 0})}
                        className="h-11 rounded-xl bg-white/50 dark:bg-zinc-800/50"
                        placeholder="0,00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 min-h-[2rem]">Compra de produtor rural</Label>
                      <Select 
                        value={currentNatureza.compraProdutorRural ? "Sim" : "Não"} 
                        onValueChange={v => setCurrentNatureza({...currentNatureza, compraProdutorRural: v === "Sim"})}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-white/50 dark:bg-zinc-800/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Não">Não</SelectItem>
                          <SelectItem value="Sim">Sim</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div /> {/* Empty space */}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-border/50">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 min-h-[2rem]">Descontar funrural do total faturado</Label>
                      <Select 
                        value={currentNatureza.descontarFunrural ? "Sim" : "Não"} 
                        onValueChange={v => setCurrentNatureza({...currentNatureza, descontarFunrural: v === "Sim"})}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-white/50 dark:bg-zinc-800/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Não">Não</SelectItem>
                          <SelectItem value="Sim">Sim</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 min-h-[2rem]">
                        Tipo % Aprox. Trib.
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-sky-500 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-zinc-800 text-white border-zinc-700 max-w-[300px]">
                              <p className="text-xs">Lei da Transparência, nº 12.741 torna obrigatório nas notas fiscais o valor total de tributos aproximados</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Select 
                        value={currentNatureza.tipoAproxTrib} 
                        onValueChange={v => setCurrentNatureza({...currentNatureza, tipoAproxTrib: v as any})}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-white/50 dark:bg-zinc-800/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Alíquota Tabela">Alíquota Tabela</SelectItem>
                          <SelectItem value="Alíquota fixa">Alíquota fixa</SelectItem>
                          <SelectItem value="Alíquota no produto">Alíquota no produto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 min-h-[2rem]">
                        Tipo desconto
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-sky-500 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-zinc-800 text-white border-zinc-700 max-w-[300px]">
                              <p className="text-xs">Desconto incondicional é descontado na base de cálculo do ICMS ST e do IPI</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Select 
                        value={currentNatureza.tipoDesconto} 
                        onValueChange={v => setCurrentNatureza({...currentNatureza, tipoDesconto: v as any})}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-white/50 dark:bg-zinc-800/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Condicional">Condicional</SelectItem>
                          <SelectItem value="Incondicional">Incondicional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="retenções" className="p-8 focus-visible:outline-none">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 min-h-[2rem]">
                        Possui retenção de CSRF
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-sky-500 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-zinc-800 text-white border-zinc-700 max-w-[300px]">
                              <p className="text-xs">CSRF engloba as retenções de PIS, COFINS e CSLL (Contribuição Social sobre o Lucro Líquido).</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Select 
                        value={currentNatureza.possuiCSRF ? "Sim" : "Não"} 
                        onValueChange={v => setCurrentNatureza({...currentNatureza, possuiCSRF: v === "Sim"})}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-white/50 dark:bg-zinc-800/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Não">Não</SelectItem>
                          <SelectItem value="Sim">Sim</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 min-h-[2rem]">Possui retenção de IR</Label>
                      <Select 
                        value={currentNatureza.possuiIR ? "Sim" : "Não"} 
                        onValueChange={v => setCurrentNatureza({...currentNatureza, possuiIR: v === "Sim"})}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-white/50 dark:bg-zinc-800/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Não">Não</SelectItem>
                          <SelectItem value="Sim">Sim</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 min-h-[2rem]">Alíquota CSRF retido %</Label>
                      <Input 
                        type="number" 
                        step="0.0001"
                        value={currentNatureza.aliqCSRF} 
                        onChange={e => setCurrentNatureza({...currentNatureza, aliqCSRF: parseFloat(e.target.value) || 0})}
                        className="h-11 rounded-xl bg-white/50 dark:bg-zinc-800/50"
                        placeholder="0,0000"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 min-h-[2rem]">Alíquota IR retido %</Label>
                      <Input 
                        type="number" 
                        step="0.0001"
                        value={currentNatureza.aliqIR} 
                        onChange={e => setCurrentNatureza({...currentNatureza, aliqIR: parseFloat(e.target.value) || 0})}
                        className="h-11 rounded-xl bg-white/50 dark:bg-zinc-800/50"
                        placeholder="0,0000"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="is" className="p-6 focus-visible:outline-none">
                <div className="rounded-xl border border-border/50 overflow-hidden bg-white/30 dark:bg-zinc-800/30">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead className="w-[200px]">Destino(s)</TableHead>
                        <TableHead>Produto(s)</TableHead>
                        <TableHead>Aliq. %</TableHead>
                        <TableHead>Base %</TableHead>
                        <TableHead>Situação tributária</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(currentNatureza.regrasIS || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                            Nenhuma regra de IS definida.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (currentNatureza.regrasIS || []).map((regra, idx) => (
                          <TableRow key={regra.id}>
                            <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-bold text-primary">
                              {regra.estados.length === 0 ? "Todos" : (
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {regra.estados.map(uf => <Badge key={uf} variant="secondary" className="text-[10px] px-1 h-4">{uf}</Badge>)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                {((regra.produtos.length > 1) || (regra.produtos[0]?.valor)) && (
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                    {regra.produtos.length > 1 ? `${regra.produtos.length} Itens` : regra.produtos[0]?.tipo}
                                  </span>
                                )}
                                <span className="text-sm truncate max-w-[150px]">
                                  {regra.produtos[0]?.valor || "Qualquer"}
                                  {regra.produtos.length > 1 && <span className="ml-1 text-sky-500 font-bold">+{regra.produtos.length - 1}</span>}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{regra.aliquota}%</TableCell>
                            <TableCell>100%</TableCell>
                            <TableCell className="text-xs">
                              {(() => {
                                const sit = SITUACOES_TRIBUTARIAS_IS.find(s => s.value === regra.situacaoTributaria);
                                return sit ? `${sit.value} - ${sit.label}` : regra.situacaoTributaria;
                              })()}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRule(regra, 'is')}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRule(regra.id, 'is')}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end mt-4">
                  <Button variant="outline" size="sm" onClick={() => openAddRule('is')} className="gap-2 text-primary border-primary/20 hover:bg-primary/5 rounded-xl px-4">
                    <PlusCircle className="h-4 w-4" />
                    Adicionar regra
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="cbs" className="p-6 focus-visible:outline-none">
                <div className="rounded-xl border border-border/50 overflow-hidden bg-white/30 dark:bg-zinc-800/30">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead className="w-[200px]">Destino(s)</TableHead>
                        <TableHead>Produto(s)</TableHead>
                        <TableHead>Aliq. %</TableHead>
                        <TableHead>Base %</TableHead>
                        <TableHead>Situação tributária</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(currentNatureza.regrasCBS || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                            Nenhuma regra de CBS definida.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (currentNatureza.regrasCBS || []).map((regra, idx) => (
                          <TableRow key={regra.id}>
                            <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-bold text-primary">
                              {regra.estados.length === 0 ? "Todos" : (
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {regra.estados.map(uf => <Badge key={uf} variant="secondary" className="text-[10px] px-1 h-4">{uf}</Badge>)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                {((regra.produtos.length > 1) || (regra.produtos[0]?.valor)) && (
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                    {regra.produtos.length > 1 ? `${regra.produtos.length} Itens` : regra.produtos[0]?.tipo}
                                  </span>
                                )}
                                <span className="text-sm truncate max-w-[150px]">
                                  {regra.produtos[0]?.valor || "Qualquer"}
                                  {regra.produtos.length > 1 && <span className="ml-1 text-sky-500 font-bold">+{regra.produtos.length - 1}</span>}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{parseFloat((regra.aliquota || 0).toFixed(4)).toString().replace('.', ',')}%</TableCell>
                            <TableCell>{parseFloat((regra.base || 0).toFixed(4)).toString().replace('.', ',')}%</TableCell>
                            <TableCell className="text-xs">
                              {(() => {
                                const sit = SITUACOES_TRIBUTARIAS_CBS.find(s => s.value === regra.situacaoTributaria);
                                return sit ? sit.label : regra.situacaoTributaria;
                              })()}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRule(regra, 'cbs')}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRule(regra.id, 'cbs')}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end mt-4">
                  <Button variant="outline" size="sm" onClick={() => openAddRule('cbs')} className="gap-2 text-primary border-primary/20 hover:bg-primary/5 rounded-xl px-4">
                    <PlusCircle className="h-4 w-4" />
                    Adicionar regra
                  </Button>
                </div>
              </TabsContent>

               <TabsContent value="ibs" className="p-6 focus-visible:outline-none">
                <div className="rounded-xl border border-border/50 overflow-hidden bg-white/30 dark:bg-zinc-800/30">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead className="w-[200px]">Destino(s)</TableHead>
                        <TableHead>Produto(s)</TableHead>
                        <TableHead>Aliq. %</TableHead>
                        <TableHead>Base %</TableHead>
                        <TableHead>Situação tributária</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(currentNatureza.regrasIBS || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                            Nenhuma regra de IBS definida.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (currentNatureza.regrasIBS || []).map((regra, idx) => (
                          <TableRow key={regra.id}>
                            <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-bold text-primary">
                              {regra.estados.length === 0 ? "Todos" : (
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {regra.estados.map(uf => <Badge key={uf} variant="secondary" className="text-[10px] px-1 h-4">{uf}</Badge>)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                {((regra.produtos.length > 1) || (regra.produtos[0]?.valor)) && (
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                    {regra.produtos.length > 1 ? `${regra.produtos.length} Itens` : regra.produtos[0]?.tipo}
                                  </span>
                                )}
                                <span className="text-sm truncate max-w-[150px]">
                                  {regra.produtos[0]?.valor || "Qualquer"}
                                  {regra.produtos.length > 1 && <span className="ml-1 text-sky-500 font-bold">+{regra.produtos.length - 1}</span>}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{parseFloat((regra.aliquota || 0).toFixed(4)).toString().replace('.', ',')}%</TableCell>
                            <TableCell>{parseFloat((regra.base || 0).toFixed(4)).toString().replace('.', ',')}%</TableCell>
                            <TableCell className="text-xs">
                              {(() => {
                                const sit = SITUACOES_TRIBUTARIAS_IBS.find((s: any) => s.value === regra.situacaoTributaria);
                                return sit ? sit.label : regra.situacaoTributaria;
                              })()}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRule(regra, 'ibs')}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRule(regra.id, 'ibs')}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end mt-4">
                  <Button variant="outline" size="sm" onClick={() => openAddRule('ibs')} className="gap-2 text-primary border-primary/20 hover:bg-primary/5 rounded-xl px-4">
                    <PlusCircle className="h-4 w-4" />
                    Adicionar regra
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="border-none shadow-premium bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Informações adicionais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="complementares">Informações complementares</Label>
              <Textarea 
                id="complementares" 
                value={currentNatureza.infoComplementares} 
                onChange={e => setCurrentNatureza({...currentNatureza, infoComplementares: e.target.value})}
                placeholder="Dados adicionais que aparecerão no corpo da nota"
                className="min-h-[100px] bg-white/50 dark:bg-zinc-800/50"
              />
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Variáveis que podem ser utilizadas nas informações complementares</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="fisco">Informações adicionais de interesse do fisco</Label>
              <Textarea 
                id="fisco" 
                value={currentNatureza.infoFisco} 
                onChange={e => setCurrentNatureza({...currentNatureza, infoFisco: e.target.value})}
                placeholder="Dados obrigatórios para o fisco"
                className="min-h-[80px] bg-white/50 dark:bg-zinc-800/50"
              />
            </div>
          </CardContent>
        </Card>

        <RuleDialog 
          open={isRuleDialogOpen} 
          onOpenChange={setIsRuleDialogOpen}
          rule={editingRule}
          taxType={editingTaxType}
          showBaseField={showBaseField}
          onChange={setEditingRule}
          onSave={saveRule}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Naturezas de Operação</h1>
          <p className="text-muted-foreground">Gerencie as naturezas de operação e regras tributárias de cada filial.</p>
        </div>
        <Button onClick={handleAdd} className="rounded-xl shadow-lg hover:shadow-xl transition-all gap-2">
          <PlusCircle className="h-4 w-4" />
          Incluir Natureza
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <Card className="md:col-span-3 border-none shadow-premium bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md h-fit">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Filtrar por Filial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
             <Button 
              variant={selectedBranchId === 'all' ? 'default' : 'ghost'} 
              className="w-full justify-start rounded-xl"
              onClick={() => setSelectedBranchId('all')}
            >
              Todas as Filiais
            </Button>
            {branches.map(branch => (
              <Button 
                key={branch.id} 
                variant={selectedBranchId === branch.id ? 'default' : 'ghost'} 
                className="w-full justify-start rounded-xl"
                onClick={() => setSelectedBranchId(branch.id)}
              >
                {branch.name}
              </Button>
            ))}
          </CardContent>
        </Card>

        <div className="md:col-span-9 space-y-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar natureza..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border-none shadow-md"
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredNaturezas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-3xl border-2 border-dashed gap-4">
                <AlertCircle className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-muted-foreground">Nenhuma natureza de operação encontrada.</p>
              </div>
            ) : (
              filteredNaturezas.map(natureza => (
                <Card key={natureza.id} className="border-none shadow-md hover:shadow-lg transition-all bg-white/60 dark:bg-zinc-800/60 group overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex items-center p-4 gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                        <ArrowLeftRight className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold truncate">{natureza.descricao}</h3>
                          <Badge variant="outline" className="text-[10px] py-0">{natureza.tipo}</Badge>
                          {natureza.isDevolucao && <Badge variant="secondary" className="text-[10px] py-0 bg-orange-100 text-orange-700 border-orange-200">Devolução</Badge>}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <PlusCircle className="h-3 w-3" />
                            Filial: {branches.find(b => b.id === natureza.branchId)?.name || "N/A"}
                          </span>
                          <span>Regime: {natureza.regimeTributario}</span>
                          <span>Série: {natureza.serie}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(natureza)} className="rounded-xl hover:bg-primary/10 hover:text-primary">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setNaturezaToDelete(natureza)} className="rounded-xl hover:bg-destructive/10 hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Natureza?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação removerá permanentemente a natureza de operação <strong>{natureza.descricao}</strong>.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Confirmar Exclusão</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <ChevronRight className="h-5 w-5 text-muted-foreground opacity-20 group-hover:opacity-100 transition-all" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
        <RuleDialog 
          open={isRuleDialogOpen} 
          onOpenChange={setIsRuleDialogOpen}
          rule={editingRule}
          taxType={editingTaxType}
          showBaseField={showBaseField}
          onChange={setEditingRule}
          onSave={saveRule}
        />
      </div>
    </div>
  );
}

// Componente separado para evitar re-renderizações e perda de foco no modal
function RuleDialog({ open, onOpenChange, rule, taxType, showBaseField, onChange, onSave }: { 
  open: boolean, 
  onOpenChange: (open: boolean) => void, 
  rule: RegraICMS | RegraIPI | RegraPIS | RegraII | RegraISSQN | RegraCBS | RegraIBS | RegraIS | null, 
  taxType: 'icms' | 'ipi' | 'pis' | 'cofins' | 'ii' | 'issqn' | 'cbs' | 'ibs' | 'is',
  showBaseField: boolean,
  onChange: (rule: any) => void,
  onSave: () => void 
}) {
  if (!rule) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-0 gap-0 border-none bg-background/95 backdrop-blur-xl">
        <DialogHeader className="p-6 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Regras do imposto
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-8 space-y-8">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Quando for para</span>
                <span className="text-sm font-bold text-sky-500 italic">
                  {rule.estados.length === 0 ? "Qualquer estado" : rule.estados.join(", ")}
                </span>
              </div>
              <div className="grid grid-cols-4 md:grid-cols-7 gap-2 p-4 rounded-2xl border bg-muted/20">
                {ESTADOS_BRASIL.map(uf => (
                  <div key={uf} className="flex items-center gap-2">
                    <Switch 
                      checked={rule.estados.includes(uf)} 
                      onCheckedChange={checked => {
                        const newStates = checked 
                          ? [...rule.estados, uf]
                          : rule.estados.filter((s: string) => s !== uf);
                        onChange({...rule, estados: newStates});
                      }}
                      className="scale-75"
                    />
                    <span className="text-xs font-bold">{uf}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Quando for</span>
                <span className="text-sm font-bold text-sky-500 italic">
                  {rule.produtos.length > 1 ? "Algum destes produtos" : (rule.produtos[0]?.valor || "Qualquer produto")}
                </span>
              </div>
              
              <div className="space-y-2 p-4 rounded-2xl border bg-muted/20">
                {rule.produtos.map((prod: any, pIdx: number) => (
                  <div key={pIdx} className="flex gap-2 mb-2">
                    <Select 
                      value={prod.tipo} 
                      onValueChange={(v: any) => {
                        const newProds = [...rule.produtos];
                        newProds[pIdx].tipo = v;
                        onChange({...rule, produtos: newProds});
                      }}
                    >
                      <SelectTrigger className="w-[180px] rounded-xl bg-background border-none shadow-sm h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NCM">NCM</SelectItem>
                        <SelectItem value="Produto">Produto</SelectItem>
                        <SelectItem value="Grupo de Produtos">Grupo de Produtos</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                      <Input 
                        value={prod.valor} 
                        onChange={e => {
                          const newProds = [...rule.produtos];
                          newProds[pIdx].valor = e.target.value;
                          onChange({...rule, produtos: newProds});
                        }}
                        className="rounded-xl bg-background border-none shadow-sm h-11 pr-10"
                        placeholder="Qualquer produto"
                      />
                      <button 
                        onClick={() => {
                          if (rule.produtos.length > 1) {
                            onChange({
                              ...rule,
                              produtos: rule.produtos.filter((_, i) => i !== pIdx)
                            });
                          } else {
                            const newProds = [...rule.produtos];
                            newProds[0].valor = '';
                            onChange({...rule, produtos: newProds});
                          }
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <button 
                  onClick={() => onChange({
                    ...rule, 
                    produtos: [...rule.produtos, { tipo: 'NCM', valor: '' }]
                  })}
                  className="text-xs font-bold text-sky-500 hover:underline px-1 mt-1"
                >
                  Adicionar outro item
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Usar a seguinte regra de tributação</h3>
            
            {taxType === 'icms' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Situação tributária:</Label>
                    <Select value={rule.situacaoTributaria} onValueChange={v => onChange({...rule, situacaoTributaria: v})}>
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SITUACOES_TRIBUTARIAS_ICMS.map(s => <SelectItem key={s.code} value={s.code}>{s.code} - {s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-end">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">CFOP</Label>
                    <div className="relative">
                      <Input value={(rule as RegraICMS).cfop} onChange={e => onChange({...rule, cfop: e.target.value})} className="rounded-xl h-11" />
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Alíquota %</Label>
                    <Input type="number" value={rule.aliquota} onChange={e => onChange({...rule, aliquota: parseFloat(e.target.value)})} className="rounded-xl h-11" />
                  </div>
                  {showBaseField && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Base %</Label>
                      <Input type="number" value={rule.base} onChange={e => onChange({...rule, base: parseFloat(e.target.value)})} className="rounded-xl h-11" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Presumido %</Label>
                    <Input type="number" value={(rule as RegraICMS).presumido} onChange={e => onChange({...rule, presumido: parseFloat(e.target.value)})} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold flex items-center gap-1">
                      % FCP 
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-sky-500 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-zinc-800 text-white border-zinc-700 max-w-[300px]">
                            <p className="text-xs">Esta alíquota destina-se a operações com contribuintes. Para informar o FCP do DIFAL utilizar grupo de partilha abaixo.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input type="number" value={(rule as RegraICMS).fcp} onChange={e => onChange({...rule, fcp: parseFloat(e.target.value)})} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Modalidade BC</Label>
                    <Select value={(rule as RegraICMS).modalidadeBC} onValueChange={v => onChange({...rule, modalidadeBC: v})}>
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODALIDADES_BC.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold flex items-baseline justify-between">
                      <span>Cód. benef. na UF</span>
                      <a 
                        href="https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=/NJarYc9nus=" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-sky-500 text-[10px] hover:underline"
                      >
                        Consultar
                      </a>
                    </Label>
                    <Input value={(rule as RegraICMS).codBeneficioUF} onChange={e => onChange({...rule, codBeneficioUF: e.target.value})} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold flex items-baseline justify-between">
                      <span>Cód. créd. presumido</span>
                      <a 
                        href="https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=/NJarYc9nus=" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-sky-500 text-[10px] hover:underline"
                      >
                        Consultar
                      </a>
                    </Label>
                    <Input value={(rule as RegraICMS).codCreditoPresumido} onChange={e => onChange({...rule, codCreditoPresumido: e.target.value})} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Cód. benef. RBC</Label>
                    <Input value={(rule as RegraICMS).codBeneficioRBC} onChange={e => onChange({...rule, codBeneficioRBC: e.target.value})} className="rounded-xl h-11" />
                  </div>
                </div>
              </>
            ) : taxType === 'ipi' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Situação tributária:</Label>
                    <Select value={rule.situacaoTributaria} onValueChange={v => onChange({...rule, situacaoTributaria: v})}>
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SITUACOES_TRIBUTARIAS_IPI.map(s => <SelectItem key={s.code} value={s.code}>{s.code} - {s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Alíquota %</Label>
                    <Input type="number" value={rule.aliquota} onChange={e => onChange({...rule, aliquota: parseFloat(e.target.value)})} className="rounded-xl h-11" />
                  </div>
                  {showBaseField && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Base %</Label>
                      <Input type="number" value={rule.base} onChange={e => onChange({...rule, base: parseFloat(e.target.value)})} className="rounded-xl h-11" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Cód. de enquadramento</Label>
                    <Select value={(rule as RegraIPI).codEnquadramento} onValueChange={v => onChange({...rule, codEnquadramento: v})}>
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CODIGOS_ENQUADRAMENTO_IPI.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            ) : (taxType === 'pis' || taxType === 'cofins') ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Situação tributária:</Label>
                  <Select value={rule.situacaoTributaria} onValueChange={v => onChange({...rule, situacaoTributaria: v})}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(taxType === 'pis' ? SITUACOES_TRIBUTARIAS_PIS : SITUACOES_TRIBUTARIAS_COFINS).map(s => (
                        <SelectItem key={s.code} value={s.code}>{s.code} - {s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Alíquota %</Label>
                    <Input type="number" value={rule.aliquota} onChange={e => onChange({...rule, aliquota: parseFloat(e.target.value)})} className="h-11 rounded-xl" />
                  </div>
                  {showBaseField && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Base %</Label>
                      <Input type="number" value={rule.base} onChange={e => onChange({...rule, base: parseFloat(e.target.value)})} className="h-11 rounded-xl" />
                    </div>
                  )}
                </div>
              </div>
            ) : taxType === 'ii' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Situação tributária:</Label>
                  <Select value={rule.situacaoTributaria} onValueChange={v => onChange({...rule, situacaoTributaria: v})}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {SITUACOES_TRIBUTARIAS_II.map(s => (
                        <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Alíquota %</Label>
                    <Input 
                      type="number" 
                      step="0.0001"
                      value={rule.aliquota} 
                      onChange={e => onChange({...rule, aliquota: parseFloat(e.target.value)})} 
                      className="h-11 rounded-xl" 
                    />
                  </div>
                  {showBaseField && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Base %</Label>
                      <Input 
                        type="number" 
                        step="0.0001"
                        value={rule.base} 
                        onChange={e => onChange({...rule, base: parseFloat(e.target.value)})} 
                        className="h-11 rounded-xl" 
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : taxType === 'is' ? (
              <div className="space-y-6">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/50">
                  <div className="h-10 w-10 rounded-full bg-sky-500 flex items-center justify-center shrink-0">
                    <Info className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sky-900 dark:text-sky-300">IS aguardando definições</h4>
                    <p className="text-sm text-sky-700 dark:text-sky-400">Os campos de IS estão aguardando publicação oficial</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold">Código de situação tributária – Imposto Seletivo (IS)</Label>
                  <Select 
                    value={rule.situacaoTributaria} 
                    onValueChange={v => onChange({...rule, situacaoTributaria: v})}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-white dark:bg-zinc-800">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {SITUACOES_TRIBUTARIAS_IS.map(st => (
                        <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div className="space-y-2 md:col-span-1">
                    <Label className="text-xs font-bold">Alíquota IS %</Label>
                    <Input 
                      type="number" 
                      value={rule.aliquota} 
                      onChange={e => onChange({...rule, aliquota: parseFloat(e.target.value) || 0})}
                      className="h-11 rounded-xl bg-white dark:bg-zinc-800"
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label className="text-xs font-bold">Unidade de medida tributável</Label>
                    <Input 
                      value={(rule as any).unidadeMedida || ""} 
                      onChange={e => onChange({...rule, unidadeMedida: e.target.value})}
                      className="h-11 rounded-xl bg-white dark:bg-zinc-800"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-xs font-bold">Alíq. Por unidade de medida %</Label>
                    <Input 
                      type="number" 
                      value={(rule as any).aliqUnidade || 0} 
                      onChange={e => onChange({...rule, aliqUnidade: parseFloat(e.target.value) || 0})}
                      className="h-11 rounded-xl bg-white dark:bg-zinc-800"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>
            ) : taxType === 'cbs' || taxType === 'ibs' ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Código de situação tributária – {taxType === 'cbs' ? 'CBS' : 'IBS'}</Label>
                  <Select 
                    value={rule.situacaoTributaria} 
                    onValueChange={v => onChange({...rule, situacaoTributaria: v})}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-white dark:bg-zinc-800">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(taxType === 'cbs' ? SITUACOES_TRIBUTARIAS_CBS : SITUACOES_TRIBUTARIAS_IBS).map(st => (
                        <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(taxType === 'cbs' ? CODIGOS_CLASSIFICACAO_CBS : CODIGOS_CLASSIFICACAO_IBS)[rule.situacaoTributaria] && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <Label className="text-xs font-bold text-sky-700 dark:text-sky-300">Código de Classificação Tributária do {taxType === 'cbs' ? 'CBS' : 'IBS'}</Label>
                    <Select 
                      value={(rule as any).codClassificacao || ""} 
                      onValueChange={v => onChange({...rule, codClassificacao: v})}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800/50">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {(taxType === 'cbs' ? CODIGOS_CLASSIFICACAO_CBS : CODIGOS_CLASSIFICACAO_IBS)[rule.situacaoTributaria].map(st => (
                          <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
                  {(!["410", "620", "800", "810", "811"].includes(rule.situacaoTributaria) || (taxType === 'ibs' && ["510", "515"].includes(rule.situacaoTributaria))) && (
                    <>
                      {taxType === 'ibs' ? (
                        <div className="md:col-span-6 space-y-4">
                          {/* Row for UF */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-bold">Alíq. IBS/UF %</Label>
                              <Input 
                                type="number" 
                                step="0.0001"
                                value={(rule as any).aliqIBSUF || 0} 
                                onChange={e => {
                                  const uf = parseFloat(e.target.value) || 0;
                                  const red = (rule as any).redAliqIBSUF || 0;
                                  const efet = uf * (1 - red / 100);
                                  const mun = (rule as any).aliqIBSMun || 0;
                                  const efetMun = (rule as any).aliqEfetIBSMun || 0;
                                  onChange({...rule, aliqIBSUF: uf, aliqEfetIBSUF: efet, aliquota: uf + mun, aliqEfet: efet + efetMun});
                                }}
                                className="h-11 rounded-xl bg-white dark:bg-zinc-800"
                                placeholder="0,00"
                              />
                            </div>
                            {(rule.situacaoTributaria === "200" || rule.situacaoTributaria === "515") && (
                              <>
                                <div className="space-y-2">
                                  <Label className="text-xs font-bold">Red. Alíq. IBS/UF %</Label>
                                  <Input 
                                    type="number" 
                                    step="0.0001"
                                    value={(rule as any).redAliqIBSUF || 0} 
                                    onChange={e => {
                                      const red = parseFloat(e.target.value) || 0;
                                      const uf = (rule as any).aliqIBSUF || 0;
                                      const efet = uf * (1 - red / 100);
                                      const efetMun = (rule as any).aliqEfetIBSMun || 0;
                                      onChange({...rule, redAliqIBSUF: red, aliqEfetIBSUF: efet, aliqEfet: efet + efetMun});
                                    }}
                                    className="h-11 rounded-xl bg-white dark:bg-zinc-800"
                                    placeholder="0,00"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs font-bold">Alíq. Efet. IBS/UF %</Label>
                                  <Input 
                                    type="number" 
                                    step="0.0001"
                                    value={(rule as any).aliqEfetIBSUF || 0} 
                                    readOnly
                                    className="h-11 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-muted-foreground border-zinc-200 dark:border-zinc-800 cursor-not-allowed"
                                    placeholder="0,00"
                                  />
                                </div>
                              </>
                            )}
                            {(rule.situacaoTributaria === "510" || rule.situacaoTributaria === "515") && (
                              <div className="space-y-2">
                                <Label className="text-xs font-bold">% Dif. IBS/UF</Label>
                                <Input 
                                  type="number" 
                                  step="0.0001"
                                  value={(rule as any).percDifIBSUF || 0} 
                                  onChange={e => onChange({...rule, percDifIBSUF: parseFloat(e.target.value) || 0})}
                                  className="h-11 rounded-xl bg-white dark:bg-zinc-800"
                                  placeholder="0,00"
                                />
                              </div>
                            )}
                          </div>

                          {/* Row for Municipal */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-bold">Alíq. IBS/Mun %</Label>
                              <Input 
                                type="number" 
                                step="0.0001"
                                value={(rule as any).aliqIBSMun || 0} 
                                onChange={e => {
                                  const mun = parseFloat(e.target.value) || 0;
                                  const red = (rule as any).redAliqIBSMun || 0;
                                  const efet = mun * (1 - red / 100);
                                  const uf = (rule as any).aliqIBSUF || 0;
                                  const efetUF = (rule as any).aliqEfetIBSUF || 0;
                                  onChange({...rule, aliqIBSMun: mun, aliqEfetIBSMun: efet, aliquota: uf + mun, aliqEfet: efet + efetUF});
                                }}
                                className="h-11 rounded-xl bg-white dark:bg-zinc-800"
                                placeholder="0,00"
                              />
                            </div>
                            {(rule.situacaoTributaria === "200" || rule.situacaoTributaria === "515") && (
                              <>
                                <div className="space-y-2">
                                  <Label className="text-xs font-bold">Red. Alíq. IBS/Mun %</Label>
                                  <Input 
                                    type="number" 
                                    step="0.0001"
                                    value={(rule as any).redAliqIBSMun || 0} 
                                    onChange={e => {
                                      const red = parseFloat(e.target.value) || 0;
                                      const mun = (rule as any).aliqIBSMun || 0;
                                      const efet = mun * (1 - red / 100);
                                      const efetUF = (rule as any).aliqEfetIBSUF || 0;
                                      onChange({...rule, redAliqIBSMun: red, aliqEfetIBSMun: efet, aliqEfet: efet + efetUF});
                                    }}
                                    className="h-11 rounded-xl bg-white dark:bg-zinc-800"
                                    placeholder="0,00"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs font-bold">Alíq. Efet. IBS/Mun %</Label>
                                  <Input 
                                    type="number" 
                                    step="0.0001"
                                    value={(rule as any).aliqEfetIBSMun || 0} 
                                    readOnly
                                    className="h-11 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-muted-foreground border-zinc-200 dark:border-zinc-800 cursor-not-allowed"
                                    placeholder="0,00"
                                  />
                                </div>
                              </>
                            )}
                            {(rule.situacaoTributaria === "510" || rule.situacaoTributaria === "515") && (
                              <div className="space-y-2">
                                <Label className="text-xs font-bold">% Dif. IBS/Mun</Label>
                                <Input 
                                  type="number" 
                                  step="0.0001"
                                  value={(rule as any).percDifIBSMun || 0} 
                                  onChange={e => onChange({...rule, percDifIBSMun: parseFloat(e.target.value) || 0})}
                                  className="h-11 rounded-xl bg-white dark:bg-zinc-800"
                                  placeholder="0,00"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2 md:col-span-1">
                            <Label className="text-xs font-bold">Alíq. {taxType === 'cbs' ? 'CBS' : 'IBS'} %</Label>
                            <Input 
                              type="number" 
                              step="0.0001"
                              value={rule.aliquota} 
                              onChange={e => {
                                const aliq = parseFloat(e.target.value) || 0;
                                const red = (rule as any).redAliq || 0;
                                const efet = aliq * (1 - red / 100);
                                onChange({...rule, aliquota: aliq, aliqEfet: efet});
                              }}
                              className="h-11 rounded-xl bg-white dark:bg-zinc-800"
                              placeholder="0,00"
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {rule.situacaoTributaria === "620" && (
                    <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold whitespace-nowrap">Alíq. ad rem {taxType === 'cbs' ? 'CBS' : 'IBS'}</Label>
                        <Input 
                          type="number" 
                          step="0.0001"
                          value={(rule as any).aliqAdRem || 0} 
                          onChange={e => onChange({...rule, aliqAdRem: parseFloat(e.target.value) || 0})}
                          className="h-11 rounded-xl bg-white dark:bg-zinc-800"
                          placeholder="0,00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold whitespace-nowrap">Alíq. ad rem {taxType === 'cbs' ? 'CBS' : 'IBS'} Retenção</Label>
                        <Input 
                          type="number" 
                          step="0.0001"
                          value={(rule as any).aliqAdRemRet || 0} 
                          onChange={e => onChange({...rule, aliqAdRemRet: parseFloat(e.target.value) || 0})}
                          className="h-11 rounded-xl bg-white dark:bg-zinc-800"
                          placeholder="0,00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold whitespace-nowrap">Alíq. ad rem {taxType === 'cbs' ? 'CBS' : 'IBS'} Retido Ant.</Label>
                        <Input 
                          type="number" 
                          step="0.0001"
                          value={(rule as any).aliqAdRemRetAnt || 0} 
                          onChange={e => onChange({...rule, aliqAdRemRetAnt: parseFloat(e.target.value) || 0})}
                          className="h-11 rounded-xl bg-white dark:bg-zinc-800"
                          placeholder="0,00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold whitespace-nowrap">% Dif. {taxType === 'cbs' ? 'CBS' : 'IBS'} Monofásico</Label>
                        <Input 
                          type="number" 
                          step="0.0001"
                          value={(rule as any).percDifMonofasico || 0} 
                          onChange={e => onChange({...rule, percDifMonofasico: parseFloat(e.target.value) || 0})}
                          className="h-11 rounded-xl bg-white dark:bg-zinc-800"
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  )}

                  {(rule.situacaoTributaria === "200" || rule.situacaoTributaria === "515") && taxType !== 'ibs' && (
                    <>
                      <div className="space-y-2 md:col-span-1">
                        <Label className="text-xs font-bold">% Red. Alíq. {taxType === 'cbs' ? 'CBS' : 'IBS'}</Label>
                        <Input 
                          type="number" 
                          step="0.0001"
                          value={(rule as any).redAliq || 0} 
                          onChange={e => {
                            const red = parseFloat(e.target.value) || 0;
                            const aliq = rule.aliquota || 0;
                            const efet = aliq * (1 - red / 100);
                            onChange({...rule, redAliq: red, aliqEfet: efet});
                          }}
                          className="h-11 rounded-xl bg-white dark:bg-zinc-800"
                          placeholder="0,00"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-1">
                        <Label className="text-xs font-bold">Alíq. Efet. {taxType === 'cbs' ? 'CBS' : 'IBS'} %</Label>
                        <Input 
                          type="number" 
                          step="0.0001"
                          value={(rule as any).aliqEfet || 0} 
                          readOnly
                          className="h-11 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-muted-foreground border-zinc-200 dark:border-zinc-800 cursor-not-allowed"
                          placeholder="0,00"
                        />
                      </div>
                    </>
                  )}

                  {(rule.situacaoTributaria === "510" || rule.situacaoTributaria === "515") && taxType !== 'ibs' && (
                    <div className="space-y-2 md:col-span-1">
                      <Label className="text-xs font-bold">% Diferimento {taxType === 'cbs' ? 'CBS' : 'IBS'}</Label>
                      <Input 
                        type="number" 
                        step="0.0001"
                        value={(rule as any).percDiferimento || 0} 
                        onChange={e => onChange({...rule, percDiferimento: parseFloat(e.target.value) || 0})}
                        className="h-11 rounded-xl bg-white dark:bg-zinc-800"
                        placeholder="0,00"
                      />
                    </div>
                  )}

                  {taxType !== 'ibs' && !["410", "510", "515", "550", "620", "800", "810", "811"].includes(rule.situacaoTributaria) && (
                    <div className="space-y-2 md:col-span-1">
                      <Label className="text-xs font-bold">Base %</Label>
                      <Input 
                        type="number" 
                        step="0.0001"
                        value={rule.base} 
                        onChange={e => onChange({...rule, base: parseFloat(e.target.value) || 0})}
                        className="h-11 rounded-xl bg-white dark:bg-zinc-800"
                        placeholder="100,00"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : taxType === 'issqn' ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Situação tributária:</Label>
                  <Select value={rule.situacaoTributaria} onValueChange={v => onChange({...rule, situacaoTributaria: v})}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {SITUACOES_TRIBUTARIAS_ISSQN.map(s => (
                        <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Alíquota %</Label>
                    <Input 
                      type="number" 
                      step="0.0001"
                      value={rule.aliquota} 
                      onChange={e => onChange({...rule, aliquota: parseFloat(e.target.value)})} 
                      className="h-11 rounded-xl" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Base %</Label>
                    <Input 
                      type="number" 
                      step="0.0001"
                      value={rule.base} 
                      onChange={e => onChange({...rule, base: parseFloat(e.target.value)})} 
                      className="h-11 rounded-xl" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Descontar ISS do total da nota</Label>
                    <Select 
                      value={(rule as any).descontarISS ? "Sim" : "Não"} 
                      onValueChange={v => onChange({...rule, descontarISS: v === "Sim"})}
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Não">Não</SelectItem>
                        <SelectItem value="Sim">Sim</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Reter ISS</Label>
                    <Select 
                      value={(rule as any).reterISS ? "Sim" : "Não"} 
                      onValueChange={v => onChange({...rule, reterISS: v === "Sim"})}
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Não">Não</SelectItem>
                        <SelectItem value="Sim">Sim</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            {taxType === 'icms' && (
              <>
                <Card className="border-none shadow-sm bg-muted/20 rounded-3xl overflow-hidden">
                  <CardHeader className="pb-3 bg-muted/30">
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Motivo desoneração
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <Select value={(rule as RegraICMS).motivoDesoneracao} onValueChange={v => onChange({...rule, motivoDesoneracao: v})}>
                      <SelectTrigger className="rounded-xl h-11 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MOTIVOS_DESONERACAO.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-background/50">
                      <Switch checked={(rule as RegraICMS).deducaoDesonerado} onCheckedChange={v => onChange({...rule, deducaoDesonerado: v})} />
                      <Label className="text-sm cursor-pointer">Dedução do ICMS desonerado</Label>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-muted/20 rounded-3xl overflow-hidden">
                  <CardHeader className="pb-3 bg-muted/30">
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Substituição tributária
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-4 gap-4 items-end">
                      <div className="space-y-2 col-span-1">
                        <Label className="text-xs font-bold">Modalidade BC</Label>
                        <Select value={(rule as RegraICMS).modalidadeBCST} onValueChange={v => onChange({...rule, modalidadeBCST: v})}>
                          <SelectTrigger className="rounded-xl h-11 bg-background">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {MODALIDADES_BC_ST.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Alíq. ICMS %</Label>
                        <Input type="number" value={(rule as RegraICMS).aliquotaST} onChange={e => onChange({...rule, aliquotaST: parseFloat(e.target.value)})} className="h-11 rounded-xl bg-background" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Base %</Label>
                        <Input type="number" value={(rule as RegraICMS).baseST} onChange={e => onChange({...rule, baseST: parseFloat(e.target.value)})} className="h-11 rounded-xl bg-background" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">MVA %</Label>
                        <Input type="number" value={(rule as RegraICMS).mvaST} onChange={e => onChange({...rule, mvaST: parseFloat(e.target.value)})} className="h-11 rounded-xl bg-background" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">PIS %</Label>
                        <Input type="number" value={(rule as RegraICMS).pisST} onChange={e => onChange({...rule, pisST: parseFloat(e.target.value)})} className="h-11 rounded-xl bg-background" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">COFINS %</Label>
                        <Input type="number" value={(rule as RegraICMS).cofinsST} onChange={e => onChange({...rule, cofinsST: parseFloat(e.target.value)})} className="h-11 rounded-xl bg-background" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-muted/20 rounded-3xl overflow-hidden">
                  <CardHeader className="pb-3 bg-muted/30">
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      ST retida anteriormente
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Alíquota ICMS Retido %</Label>
                      <Input type="number" value={(rule as RegraICMS).aliquotaRetida} onChange={e => onChange({...rule, aliquotaRetida: parseFloat(e.target.value)})} className="h-11 rounded-xl bg-background" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-muted/20 rounded-3xl overflow-hidden">
                  <CardHeader className="pb-3 bg-muted/30">
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <ArrowLeftRight className="h-4 w-4" />
                      ICMS partilha
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Tipo de tributação</Label>
                        <Select value={(rule as RegraICMS).partilhaTipo} onValueChange={v => onChange({...rule, partilhaTipo: v})}>
                          <SelectTrigger className="rounded-xl h-11 bg-background">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Normal">Normal</SelectItem>
                            <SelectItem value="Isento">Isento</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-3 gap-4 items-end">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Base de cálculo (%)</Label>
                          <Input type="number" value={(rule as RegraICMS).partilhaBase} onChange={e => onChange({...rule, partilhaBase: parseFloat(e.target.value)})} className="h-11 rounded-xl bg-background" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Alíquota Interna UF de destino (%)</Label>
                          <Input type="number" value={(rule as RegraICMS).partilhaAliqDestino} onChange={e => onChange({...rule, partilhaAliqDestino: parseFloat(e.target.value)})} className="h-11 rounded-xl bg-background" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold flex items-center gap-1">
                            Alíquota do FCP (%) 
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3 w-3 text-sky-500 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="bg-zinc-800 text-white border-zinc-700 max-w-[250px]">
                                  <p className="text-xs">Alíquota do Fundo de Combate a Pobreza (FCP, FEM, FECOP, etc.).</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Label>
                          <Input type="number" value={(rule as RegraICMS).partilhaAliqFCP} onChange={e => onChange({...rule, partilhaAliqFCP: parseFloat(e.target.value)})} className="h-11 rounded-xl bg-background" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold">Informações complementares</Label>
              <Textarea 
                value={rule.infoComplementares} 
                onChange={e => onChange({...rule, infoComplementares: e.target.value})}
                className="min-h-[80px] rounded-2xl bg-muted/20 border-none shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">Informações adicionais de interesse do fisco</Label>
              <Input 
                value={rule.infoFisco} 
                onChange={e => onChange({...rule, infoFisco: e.target.value})} 
                className="h-11 rounded-xl bg-muted/20 border-none shadow-sm" 
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl px-8">Cancelar</Button>
            <Button onClick={onSave} className="rounded-xl px-8 shadow-md bg-emerald-600 hover:bg-emerald-700 text-white">Confirmar Regra</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
