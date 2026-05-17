
"use client";

import * as React from "react";
import {
  X,
  Plus,
  Trash2,
  Search,
  HelpCircle,
  Calendar as CalendarIcon,
  Info
} from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SalesOrder,
  SalesOrderItem,
  NaturezaOperacao,
  CompanyBranch,
  Customer
} from "@/lib/definitions";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const BRAZILIAN_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

interface IssueNfeModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: SalesOrder | null;
  naturezas: NaturezaOperacao[];
  branches: CompanyBranch[];
}

export function IssueNfeModal({
  isOpen,
  onClose,
  order,
  naturezas,
  branches
}: IssueNfeModalProps) {
  const [formData, setFormData] = React.useState<any>({
    tipoSaida: "Emissão Própria",
    serie: "1",
    numero: "",
    loja: "all",
    unidadeNegocio: "Nenhuma unidade",
    naturezaOperacaoId: "",
    dataEmissao: format(new Date(), "yyyy-MM-dd"),
    horaEmissao: format(new Date(), "HH:mm"),
    dataSaida: format(new Date(), "yyyy-MM-dd"),
    horaSaida: format(new Date(), "HH:mm"),
    regimeTributario: "Regime normal",
    finalidade: "NF-e normal",
    indicadorPresenca: "1 - Operação presencial",

    // Destinatário
    nomeContato: "",
    tipoPessoa: "Jurídica",
    cnpj: "",
    vendedor: "",
    compraGovernamental: "Não",
    consumidorFinal: false,
    cep: "",
    uf: "",
    municipio: "",
    bairro: "",
    endereco: "",
    destNumero: "",
    complemento: "",
    foneFax: "",
    email: "",

    // Itens
    items: [] as any[],

    // Impostos
    totalProdutos: 0,
    valorFrete: 0,
    valorSeguro: 0,
    outrasDespesas: 0,
    desconto: 0,
    totalNota: 0,
    baseIcms: 0,
    valorIcms: 0,
    baseIcmsSt: 0,
    valorIcmsSt: 0,
    valorIpi: 0,
    totalIs: 0,
    totalIbs: 0,
    totalCbs: 0,
    totalServicos: 0,
    valorIssqn: 0,
    valorFunrural: 0,
    totalFaturado: 0,
    totalAtributos: 0,
    calculoAutomatico: true,

    // Transporte
    transporte: "Não haverá transporte",
    fretePorConta: "0 - Contratação do Frete por conta do Re...",
    transportadoraNome: "",
    transportadoraCnpj: "",
    transportadoraIE: "",
    transportadoraPlaca: "",
    transportadoraUFVeiculo: "",
    transportadoraRNTC: "",
    transportadoraUF: "",
    transportadoraMunicipio: "",
    transportadoraEndereco: "",

    // Volume
    volumeQuantidade: "",
    volumePesoBruto: "",
    volumePesoLiquido: "",
    volumeNumeracao: "",
    volumeEspecie: "Volume(s)",
    volumeMarca: "",

    // Pagamento
    condicaoPagamento: "",
    categoria: "Vendas de produtos",

    // Pessoas Autorizadas
    autorizados: [] as { contato: string; cpfCnpj: string }[],

    // Informações Adicionais
    informacoesComplementares: "",
    informacoesFisco: "",
    intermediador: "0 - Operação sem intermediador",
  });

  React.useEffect(() => {
    if (!order) return;

    // 1. Fill basic order fields
    const baseItems = order.items?.map((item: SalesOrderItem) => ({
      produto: item.productName,
      codigo: item.productId, // will be replaced after product fetch
      un: "UN",
      quantidade: item.quantity,
      precoUn: item.unitPrice,
      precoTotal: item.total,
      ncm: "" // will be replaced after product fetch
    })) || [];

    const subtotalCalc = order.subtotal || order.items?.reduce((acc: number, item: any) => acc + (item.total || 0), 0) || 0;
    const servicesCalc = (order as any).servicesTotal || order.services?.reduce((acc: number, srv: any) => acc + (srv.total || 0), 0) || 0;
    const discountCalc = order.generalDiscountType === 'percentage' 
      ? (subtotalCalc * (order.generalDiscountValue || 0) / 100) 
      : (order.generalDiscountValue || 0);

    let condPagamento = "";
    if (order.payments && order.payments.length > 0) {
      condPagamento = order.payments.map((p: any) => {
        const parcelas = Array.isArray(p.installments) ? p.installments.length : (p.installments || 1);
        return parcelas > 1 ? `${p.methodName} (${parcelas}x)` : p.methodName;
      }).join(" + ");
    }

    setFormData((prev: any) => ({
      ...prev,
      numero: (order as any).nfeNumber?.toString() || order.orderNumber?.toString() || "",
      nomeContato: order.customerName || "",
      totalProdutos: subtotalCalc,
      totalServicos: servicesCalc,
      valorFrete: order.freightValue || 0,
      desconto: discountCalc,
      totalNota: order.total || 0,
      totalFaturado: order.total || 0,
      condicaoPagamento: condPagamento,
      items: baseItems,
    }));

    // 2. Fetch product data (internalCode, NCM) for each item
    const fetchProducts = async () => {
      if (!order.items?.length) return;
      try {
        const productSnaps = await Promise.all(
          order.items.map((item: SalesOrderItem) => getDoc(doc(db, "products", item.productId)))
        );
        const enrichedItems = order.items.map((item: SalesOrderItem, idx: number) => {
          const pSnap = productSnaps[idx];
          const pData = pSnap.exists() ? pSnap.data() : null;
          return {
            produto: pData?.name || item.productName,
            codigo: pData?.internalCode || item.productId,
            un: pData?.unitOfMeasure || "UN",
            quantidade: item.quantity,
            precoUn: item.unitPrice,
            precoTotal: item.total,
            ncm: pData?.ncm || "",
          };
        });
        setFormData((prev: any) => ({ ...prev, items: enrichedItems }));
      } catch (e) {
        console.error("Error fetching product data for NF-e items:", e);
      }
    };
    fetchProducts();

    // 2. Fetch full customer data and fill Destinatário fields
    if (!order.customerId) return;
    const fetchCustomer = async () => {
      try {
        const snap = await getDoc(doc(db, "customers", order.customerId));
        if (!snap.exists()) return;
        const customer = { id: snap.id, ...snap.data() } as Customer;

        // Pick address: prefer delivery address from order, fallback to customer's first address
        const addr = order.deliveryAddress || customer.addresses?.[0];
        const phone = order.deliveryPhone || customer.phones?.[0];

        setFormData((prev: any) => ({
          ...prev,
          nomeContato: customer.razaoSocial || customer.name || prev.nomeContato,
          tipoPessoa: customer.type === 'juridica' ? 'Jurídica' : 'Física',
          cnpj: customer.type === 'juridica' ? (customer.cnpj || '') : (customer.cpf || ''),
          consumidorFinal: customer.type === 'fisica',
          cep: addr?.cep || '',
          uf: addr?.state || '',
          municipio: addr?.city || '',
          bairro: addr?.neighborhood || '',
          endereco: addr?.address || '',
          destNumero: addr?.number || '',
          complemento: addr?.complement || '',
          foneFax: phone?.number || '',
          email: customer.email || '',
        }));
      } catch (e) {
        console.error('Error fetching customer for NF-e modal:', e);
      }
    };
    fetchCustomer();
  }, [order]);

  // ─── Tax Calculation Engine ────────────────────────────────────────────────
  const calculateTaxes = React.useCallback((naturezaId: string, items: any[], uf: string, baseTotals: { totalProdutos: number; valorFrete: number; valorSeguro: number; outrasDespesas: number; desconto: number; totalServicos?: number }) => {
    const nat = naturezas.find(n => n.id === naturezaId);
    if (!nat || !items.length) return null;

    const totalProdutos = baseTotals.totalProdutos || items.reduce((s, i) => s + (i.precoTotal || 0), 0);
    const isRegimeNormal = nat.regimeTributario === 'Regime normal' || nat.regimeTributario === 'Simples nacional - Excesso de sublimite de receita bruta';

    // Helper: find matching rule for an item from a rule list
    const findRule = (rules: any[], itemNcm: string) => {
      if (!rules || !rules.length) return null;
      // Try to find a rule that matches UF + product/NCM first, then just UF, then default
      const stateMatch = (r: any) => r.estados.length === 0 || r.estados.includes(uf);
      const ncmMatch = (r: any) => r.produtos.some((p: any) => !p.valor || (itemNcm && itemNcm.startsWith(p.valor.replace(/\D/g, ''))));
      return rules.find(r => stateMatch(r) && ncmMatch(r)) ||
        rules.find(r => stateMatch(r) && r.produtos.every((p: any) => !p.valor)) ||
        rules.find(r => stateMatch(r)) ||
        null;
    };

    let baseIcms = 0, valorIcms = 0, baseIcmsSt = 0, valorIcmsSt = 0;
    let valorIpi = 0;
    let valorPis = 0, valorCofins = 0;
    let valorIssqn = 0;
    let totalIs = 0, totalCbs = 0, totalIbs = 0;

    items.forEach(item => {
      const itemTotal = item.precoTotal || 0;
      const itemNcm = (item.ncm || '').replace(/\D/g, '');

      // ICMS
      const icmsRule = findRule(nat.regrasICMS || [], itemNcm);
      if (icmsRule) {
        const base = isRegimeNormal ? (itemTotal * (icmsRule.base / 100)) : itemTotal;
        baseIcms += base;
        valorIcms += base * (icmsRule.aliquota / 100);
      }

      // IPI
      const ipiRule = findRule(nat.regrasIPI || [], itemNcm);
      if (ipiRule && ipiRule.situacaoTributaria !== 'Sem IPI') {
        const baseIpi = isRegimeNormal ? (itemTotal * ((ipiRule.base || 100) / 100)) : itemTotal;
        const freightAdd = nat.incluirFreteBaseIPI ? (baseTotals.valorFrete || 0) / items.length : 0;
        valorIpi += (baseIpi + freightAdd) * (ipiRule.aliquota / 100);
      }

      // PIS
      const pisRule = findRule(nat.regrasPIS || [], itemNcm);
      if (pisRule) {
        const basePis = isRegimeNormal ? (itemTotal * ((pisRule.base || 100) / 100)) : itemTotal;
        valorPis += basePis * (pisRule.aliquota / 100);
      }

      // COFINS
      const cofinsRule = findRule(nat.regrasCOFINS || [], itemNcm);
      if (cofinsRule) {
        const baseCofins = isRegimeNormal ? (itemTotal * ((cofinsRule.base || 100) / 100)) : itemTotal;
        valorCofins += baseCofins * (cofinsRule.aliquota / 100);
      }

      // ISSQN
      const issqnRule = findRule(nat.regrasISSQN || [], itemNcm);
      if (issqnRule && issqnRule.situacaoTributaria !== 'isento') {
        const baseIssqn = isRegimeNormal ? (itemTotal * ((issqnRule.base || 100) / 100)) : itemTotal;
        valorIssqn += baseIssqn * (issqnRule.aliquota / 100);
      }

      // IS
      const isRule = findRule((nat as any).regrasIS || [], itemNcm);
      if (isRule) {
        totalIs += itemTotal * (isRule.aliquota / 100);
      }

      // CBS
      const cbsRule = findRule((nat as any).regrasCBS || [], itemNcm);
      if (cbsRule && !['410', '810', '811', '830'].includes(cbsRule.situacaoTributaria)) {
        totalCbs += itemTotal * (cbsRule.aliquota / 100);
      }

      // IBS
      const ibsRule = findRule((nat as any).regrasIBS || [], itemNcm);
      if (ibsRule && !['410', '810', '811', '830'].includes(ibsRule.situacaoTributaria)) {
        totalIbs += itemTotal * ((ibsRule.aliquota || 0) / 100);
      }
    });

    // Funrural
    const valorFunrural = (nat.aliqFunrural || 0) > 0 ? totalProdutos * ((nat.aliqFunrural || 0) / 100) : 0;

    // Base ICMS ST (simplified placeholder — full ST requires MVA data per product)
    const totalImposto = valorIcms + valorIpi + valorPis + valorCofins + valorIssqn;
    const totalNota = totalProdutos + (baseTotals.totalServicos || 0) + (baseTotals.valorFrete || 0) + (baseTotals.valorSeguro || 0) + (baseTotals.outrasDespesas || 0) - (baseTotals.desconto || 0) + (nat.somarIcms ? valorIcms : 0) + (nat.somarOutrasDespesas ? valorPis + valorCofins : 0);
    const totalFaturado = totalNota - valorFunrural;
    const totalAtributos = totalImposto;

    return {
      baseIcms: parseFloat(baseIcms.toFixed(2)),
      valorIcms: parseFloat(valorIcms.toFixed(2)),
      baseIcmsSt: parseFloat(baseIcmsSt.toFixed(2)),
      valorIcmsSt: parseFloat(valorIcmsSt.toFixed(2)),
      valorIpi: parseFloat(valorIpi.toFixed(2)),
      totalIs: parseFloat(totalIs.toFixed(2)),
      totalCbs: parseFloat(totalCbs.toFixed(2)),
      totalIbs: parseFloat(totalIbs.toFixed(2)),
      valorIssqn: parseFloat(valorIssqn.toFixed(2)),
      valorFunrural: parseFloat(valorFunrural.toFixed(2)),
      totalNota: parseFloat(totalNota.toFixed(2)),
      totalFaturado: parseFloat(totalFaturado.toFixed(2)),
      totalAtributos: parseFloat(totalAtributos.toFixed(2)),
    };
  }, [naturezas]);

  // Re-run tax calc whenever natureza, items, or destination UF changes
  React.useEffect(() => {
    if (!formData.naturezaOperacaoId || !formData.calculoAutomatico) return;
    const taxes = calculateTaxes(
      formData.naturezaOperacaoId,
      formData.items,
      formData.uf,
      { totalProdutos: formData.totalProdutos, valorFrete: formData.valorFrete, valorSeguro: formData.valorSeguro, outrasDespesas: formData.outrasDespesas, desconto: formData.desconto, totalServicos: formData.totalServicos }
    );
    if (taxes) {
      setFormData((prev: any) => ({ ...prev, ...taxes }));
    }
  }, [formData.naturezaOperacaoId, formData.items, formData.uf, formData.calculoAutomatico, formData.valorFrete, formData.valorSeguro, formData.outrasDespesas, formData.desconto, formData.totalServicos, calculateTaxes]);
  // ────────────────────────────────────────────────────────────────────────────

  const handleAddItem = () => {
    setFormData((prev: any) => ({
      ...prev,
      items: [...prev.items, { produto: "", codigo: "", un: "", quantidade: 0, precoUn: 0, precoTotal: 0, ncm: "" }]
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      items: prev.items.filter((_: any, i: number) => i !== index)
    }));
  };

  const handleAddAutorizado = () => {
    setFormData((prev: any) => ({
      ...prev,
      autorizados: [...prev.autorizados, { contato: "", cpfCnpj: "" }]
    }));
  };

  const handleRemoveAutorizado = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      autorizados: prev.autorizados.filter((_: any, i: number) => i !== index)
    }));
  };

  const handleSave = () => {
    console.log("Saving NF-e:", formData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1200px] max-h-[95vh] p-0 overflow-hidden flex flex-col">
        <TooltipProvider>
          <DialogHeader className="p-6 pb-4 flex flex-row items-center justify-between border-b bg-white dark:bg-zinc-950">
            <div className="flex items-center gap-4">
              <DialogTitle className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Nota fiscal</DialogTitle>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose} className="rounded-lg px-8 border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 h-10 font-bold transition-all">
                Cancelar
              </Button>
              <Button onClick={handleSave} className="rounded-lg px-8 bg-emerald-600 hover:bg-emerald-700 text-white h-10 font-bold shadow-md hover:shadow-emerald-500/20 transition-all">
                Salvar
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="space-y-10 pb-10">
              {/* General Info */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3 space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Tipo de Saída <span className="text-red-500">*</span></Label>
                  <Select value={formData.tipoSaida} onValueChange={(v) => setFormData({ ...formData, tipoSaida: v })}>
                    <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Emissão Própria">Emissão Própria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Série <span className="text-red-500">*</span></Label>
                  <Input value={formData.serie} onChange={(e) => setFormData({ ...formData, serie: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1">
                    Número <span className="text-red-500">*</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-sky-500 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-800 text-[11px] max-w-[250px]">
                        O número pode ser alterado ao gravar caso outro usuário já tenha inserido uma nota com o mesmo número
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input value={formData.numero} onChange={(e) => setFormData({ ...formData, numero: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                </div>
                <div className="md:col-span-3 space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Loja</Label>
                  <Select value={formData.loja} onValueChange={(v) => setFormData({ ...formData, loja: v })}>
                    <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as lojas</SelectItem>
                      {branches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.nome_fantasia || b.razao_social}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Unidade de negócio</Label>
                  <Select value={formData.unidadeNegocio} onValueChange={(v) => setFormData({ ...formData, unidadeNegocio: v })}>
                    <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Nenhuma unidade">Nenhuma unidade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-4 space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Natureza de operação <span className="text-red-500">*</span></Label>
                  <Select
                    value={formData.naturezaOperacaoId}
                    onValueChange={(v) => {
                      const nat = naturezas.find(n => n.id === v);
                      if (nat) {
                        setFormData({
                          ...formData,
                          naturezaOperacaoId: v,
                          regimeTributario: nat.regimeTributario,
                          serie: nat.serie || formData.serie,
                          indicadorPresenca: nat.indicadorPresenca || formData.indicadorPresenca,
                          informacoesComplementares: nat.infoComplementares || formData.informacoesComplementares,
                          informacoesFisco: nat.infoFisco || formData.informacoesFisco
                        });
                      } else {
                        setFormData({ ...formData, naturezaOperacaoId: v });
                      }
                    }}
                  >
                    <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-emerald-500 dark:border-emerald-500/50">
                      <SelectValue placeholder="Selecione a natureza..." />
                    </SelectTrigger>
                    <SelectContent>
                      {naturezas.map(n => (
                        <SelectItem key={n.id} value={n.id}>{n.descricao}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Data de emissão <span className="text-red-500">*</span></Label>
                  <Input type="date" value={formData.dataEmissao} onChange={(e) => setFormData({ ...formData, dataEmissao: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1">
                    Hora de emissão
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-sky-500 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-800 text-[11px] max-w-[250px]">
                        A hora da emissão é atualizada automaticamente quando a nota é emitida
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input type="time" value={formData.horaEmissao} onChange={(e) => setFormData({ ...formData, horaEmissao: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Data saída</Label>
                  <Input type="date" value={formData.dataSaida} onChange={(e) => setFormData({ ...formData, dataSaida: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Hora saída</Label>
                  <Input type="time" value={formData.horaSaida} onChange={(e) => setFormData({ ...formData, horaSaida: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                </div>

                <div className="md:col-span-4 space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Código do regime tributário <span className="text-red-500">*</span></Label>
                  <Select value={formData.regimeTributario} onValueChange={(v) => setFormData({ ...formData, regimeTributario: v })}>
                    <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Simples nacional">Simples nacional</SelectItem>
                      <SelectItem value="Simples nacional - Excesso de sublimite de receita bruta">Simples nacional - Excesso de sublimite de receita bruta</SelectItem>
                      <SelectItem value="Regime normal">Regime normal</SelectItem>
                      <SelectItem value="MEI">MEI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-4 space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Finalidade <span className="text-red-500">*</span></Label>
                  <Select value={formData.finalidade} onValueChange={(v) => setFormData({ ...formData, finalidade: v })}>
                    <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NF-e normal">NF-e normal</SelectItem>
                      <SelectItem value="NF-e complementar">NF-e complementar</SelectItem>
                      <SelectItem value="NF-e de ajuste">NF-e de ajuste</SelectItem>
                      <SelectItem value="Devolução de mercadoria">Devolução de mercadoria</SelectItem>
                      <SelectItem value="Nota de crédito">Nota de crédito</SelectItem>
                      <SelectItem value="Nota de débito">Nota de débito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-4 space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Indicador de presença <span className="text-red-500">*</span></Label>
                  <Select value={formData.indicadorPresenca} onValueChange={(v) => setFormData({ ...formData, indicadorPresenca: v })}>
                    <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0 - Não se aplica">0 - Não se aplica</SelectItem>
                      <SelectItem value="1 - Operação presencial">1 - Operação presencial</SelectItem>
                      <SelectItem value="2 - Operação não presencial, pela Internet">2 - Operação não presencial, pela Internet</SelectItem>
                      <SelectItem value="3 - Operação não presencial, Teleatendimento">3 - Operação não presencial, Teleatendimento</SelectItem>
                      <SelectItem value="4 - NFC-e em operação com entrega em domicílio">4 - NFC-e em operação com entrega em domicílio</SelectItem>
                      <SelectItem value="5 - Operação presencial, fora do estabelecimento">5 - Operação presencial, fora do estabelecimento</SelectItem>
                      <SelectItem value="9 - Operação não presencial, outros">9 - Operação não presencial, outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-4 space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1">
                    Intermediador
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-sky-500 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-800 text-[11px] max-w-[250px]">
                        Indica se a operação foi realizada com intermediador, como Hub ou Marketplace por exemplo.
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Select value={formData.intermediador} onValueChange={(v) => setFormData({ ...formData, intermediador: v })}>
                    <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0 - Operação sem intermediador">0 - Operação sem intermediador</SelectItem>
                      <SelectItem value="1 - Operação em site ou plataforma de terceiros">1 - Operação em site ou plataforma de terceiros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Destinatário */}
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                  <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                  Destinatário
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Nome do contato <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Input value={formData.nomeContato} onChange={(e) => setFormData({ ...formData, nomeContato: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 pr-12 border-emerald-500 dark:border-emerald-500/50" />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <Search className="h-4 w-4 text-emerald-500" />
                        <Plus className="h-4 w-4 text-emerald-500" />
                      </div>
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Tipo da pessoa <span className="text-red-500">*</span></Label>
                    <Select value={formData.tipoPessoa} onValueChange={(v) => setFormData({ ...formData, tipoPessoa: v })}>
                      <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Jurídica">Jurídica</SelectItem>
                        <SelectItem value="Física">Física</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">CNPJ</Label>
                    <Input value={formData.cnpj} onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Vendedor</Label>
                    <Input value={formData.vendedor} onChange={(e) => setFormData({ ...formData, vendedor: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Compra Governamental</Label>
                    <Select value={formData.compraGovernamental} onValueChange={(v) => setFormData({ ...formData, compraGovernamental: v })}>
                      <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Não">Não</SelectItem>
                        <SelectItem value="Sim">Sim</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 flex items-center pt-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="consumidorFinal" checked={formData.consumidorFinal} onCheckedChange={(v) => setFormData({ ...formData, consumidorFinal: !!v })} className="border-emerald-500 data-[state=checked]:bg-emerald-500" />
                      <Label htmlFor="consumidorFinal" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer">Consumidor final</Label>
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">CEP</Label>
                    <Input value={formData.cep} onChange={(e) => setFormData({ ...formData, cep: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="md:col-span-1 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">UF</Label>
                    <Select value={formData.uf} onValueChange={(v) => setFormData({ ...formData, uf: v })}>
                      <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {BRAZILIAN_UFS.map(uf => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Município</Label>
                    <Input value={formData.municipio} onChange={(e) => setFormData({ ...formData, municipio: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Bairro</Label>
                    <Input value={formData.bairro} onChange={(e) => setFormData({ ...formData, bairro: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>

                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Endereço</Label>
                    <Input value={formData.endereco} onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Número</Label>
                    <Input value={formData.destNumero} onChange={(e) => setFormData({ ...formData, destNumero: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="md:col-span-6 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Complemento</Label>
                    <Input value={formData.complemento} onChange={(e) => setFormData({ ...formData, complemento: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>

                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Fone/FAX</Label>
                    <Input value={formData.foneFax} onChange={(e) => setFormData({ ...formData, foneFax: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="md:col-span-9 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">E-mail</Label>
                    <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>
                </div>
              </div>

              {/* Itens da nota fiscal */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                  <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                  Itens da nota fiscal
                </h3>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-sm">
                  <Table>
                    <TableHeader className="bg-zinc-50 dark:bg-zinc-900">
                      <TableRow className="hover:bg-transparent border-b border-zinc-200 dark:border-zinc-800">
                        <TableHead className="w-12 text-center font-bold text-zinc-400">#</TableHead>
                        <TableHead className="text-[11px] uppercase font-bold text-zinc-500 dark:text-zinc-400">Produto ou serviço</TableHead>
                        <TableHead className="text-[11px] uppercase font-bold text-zinc-500 dark:text-zinc-400">Código</TableHead>
                        <TableHead className="text-[11px] uppercase font-bold text-zinc-500 dark:text-zinc-400 text-center">UN</TableHead>
                        <TableHead className="text-[11px] uppercase font-bold text-zinc-500 dark:text-zinc-400 text-center">Qtde</TableHead>
                        <TableHead className="text-[11px] uppercase font-bold text-zinc-500 dark:text-zinc-400 text-right">Preço un</TableHead>
                        <TableHead className="text-[11px] uppercase font-bold text-zinc-500 dark:text-zinc-400 text-right">Preço total</TableHead>
                        <TableHead className="text-[11px] uppercase font-bold text-zinc-500 dark:text-zinc-400 text-center">NCM</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.items.map((item: any, index: number) => (
                        <TableRow key={index} className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                          <TableCell className="text-center font-bold text-zinc-400">{index + 1}</TableCell>
                          <TableCell>
                            <Input value={item.produto} onChange={(e) => {
                              const newItems = [...formData.items];
                              newItems[index].produto = e.target.value;
                              setFormData({ ...formData, items: newItems });
                            }} placeholder="Digite parte do nome ou código do item" className="h-9 border-none shadow-none focus-visible:ring-0 bg-transparent dark:text-zinc-200" />
                          </TableCell>
                          <TableCell>
                            <Input value={item.codigo} onChange={(e) => {
                              const newItems = [...formData.items];
                              newItems[index].codigo = e.target.value;
                              setFormData({ ...formData, items: newItems });
                            }} className="h-9 border-none shadow-none focus-visible:ring-0 bg-transparent text-center dark:text-zinc-200" />
                          </TableCell>
                          <TableCell>
                            <Input value={item.un} onChange={(e) => {
                              const newItems = [...formData.items];
                              newItems[index].un = e.target.value;
                              setFormData({ ...formData, items: newItems });
                            }} className="h-9 border-none shadow-none focus-visible:ring-0 bg-transparent text-center dark:text-zinc-200" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" value={item.quantidade} onChange={(e) => {
                              const newItems = [...formData.items];
                              newItems[index].quantidade = Number(e.target.value);
                              newItems[index].precoTotal = newItems[index].quantidade * newItems[index].precoUn;
                              setFormData({ ...formData, items: newItems });
                            }} className="h-9 border-none shadow-none focus-visible:ring-0 bg-transparent text-center dark:text-zinc-200" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" value={item.precoUn} onChange={(e) => {
                              const newItems = [...formData.items];
                              newItems[index].precoUn = Number(e.target.value);
                              newItems[index].precoTotal = newItems[index].quantidade * newItems[index].precoUn;
                              setFormData({ ...formData, items: newItems });
                            }} className="h-9 border-none shadow-none focus-visible:ring-0 bg-transparent text-right dark:text-zinc-200" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" value={item.precoTotal} readOnly className="h-9 border-none shadow-none focus-visible:ring-0 bg-transparent text-right font-medium dark:text-zinc-200" />
                          </TableCell>
                          <TableCell>
                            <Input value={item.ncm} onChange={(e) => {
                              const newItems = [...formData.items];
                              newItems[index].ncm = e.target.value;
                              setFormData({ ...formData, items: newItems });
                            }} className="h-9 border-none shadow-none focus-visible:ring-0 bg-transparent text-center dark:text-zinc-200" />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={handleAddItem} className="text-emerald-600 dark:text-emerald-400 font-bold gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/20">
                      <Plus className="h-4 w-4" /> Adicionar outro item (Alt+Z)
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                    <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                    Cálculo de Imposto
                  </h3>
                  <div className="flex items-center gap-3">
                    {formData.naturezaOperacaoId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs font-bold border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 gap-1"
                        onClick={() => {
                          const taxes = calculateTaxes(
                            formData.naturezaOperacaoId,
                            formData.items,
                            formData.uf,
                            { totalProdutos: formData.totalProdutos, valorFrete: formData.valorFrete, valorSeguro: formData.valorSeguro, outrasDespesas: formData.outrasDespesas, desconto: formData.desconto, totalServicos: formData.totalServicos }
                          );
                          if (taxes) setFormData((prev: any) => ({ ...prev, ...taxes }));
                        }}
                      >
                        Recalcular
                      </Button>
                    )}
                    <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-lg px-3">
                      <Label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Cálculo automático</Label>
                      <Switch checked={formData.calculoAutomatico} onCheckedChange={(v) => setFormData({ ...formData, calculoAutomatico: v })} className="data-[state=checked]:bg-emerald-500" />
                      <Badge variant="secondary" className={`border-none font-bold text-[10px] ${formData.calculoAutomatico ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-200 text-zinc-500'}`}>
                        {formData.calculoAutomatico ? 'ATIVADO' : 'MANUAL'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  {[
                    { label: "Total Produtos", key: "totalProdutos" },
                    { label: "Frete", key: "valorFrete" },
                    { label: "Seguro", key: "valorSeguro" },
                    { label: "Outras Desp.", key: "outrasDespesas" },
                    { label: "Desconto", key: "desconto" },
                    { label: "Total da Nota", key: "totalNota" },
                    { label: "Base ICMS", key: "baseIcms" },
                    { label: "Valor ICMS", key: "valorIcms" },
                    { label: "Base ICMS ST", key: "baseIcmsSt" },
                    { label: "Valor ICMS ST", key: "valorIcmsSt" },
                    { label: "Valor IPI", key: "valorIpi" },
                    { label: "Total IS", key: "totalIs" },
                    { label: "Total IBS", key: "totalIbs" },
                    { label: "Total CBS", key: "totalCbs" },
                    { label: "Total Serv.", key: "totalServicos" },
                    { label: "Valor ISSQN", key: "valorIssqn" },
                    { label: "Funrural", key: "valorFunrural" },
                    { label: "Faturado", key: "totalFaturado" },
                  ].map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{field.label}</Label>
                      <Input
                        type="number"
                        value={formData[field.key]}
                        onChange={(e) => setFormData({ ...formData, [field.key]: Number(e.target.value) })}
                        className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm font-medium"
                      />
                    </div>
                  ))}
                  <div className="md:col-span-1 space-y-1.5">
                    <Label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      Total A. Trib.
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-sky-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-800 text-[11px] max-w-[250px]">
                          Valor total aproximado dos tributos federais, estaduais e municipais
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input type="number" value={formData.totalAtributos} onChange={(e) => setFormData({ ...formData, totalAtributos: Number(e.target.value) })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm font-medium" />
                  </div>
                </div>
              </div>

              {/* Retenções */}
              <div className="flex items-center gap-2 text-zinc-700 font-bold cursor-pointer hover:text-emerald-600 transition-colors">
                <h3 className="text-lg">Retenções</h3>
                <Plus className="h-4 w-4 rotate-45" /> {/* To look like the arrow */}
              </div>

              {/* Transportador/Volumes */}
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                  <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                  Transportador/Volumes
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Transporte</Label>
                    <Select value={formData.transporte} onValueChange={(v) => setFormData({ ...formData, transporte: v })}>
                      <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Não haverá transporte">Não haverá transporte</SelectItem>
                        <SelectItem value="Transporte com logística cadastrada">Transporte com logística cadastrada</SelectItem>
                        <SelectItem value="Inserir transportadora manualmente">Inserir transportadora manualmente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-8 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Frete por conta</Label>
                    <Select value={formData.fretePorConta} onValueChange={(v) => setFormData({ ...formData, fretePorConta: v })}>
                      <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0 - Contratação do Frete por conta do Remetente (CIF)">0 - Contratação do Frete por conta do Remetente (CIF)</SelectItem>
                        <SelectItem value="1 - Contratação do Frete por conta do Destinatário (FOB)">1 - Contratação do Frete por conta do Destinatário (FOB)</SelectItem>
                        <SelectItem value="2 - Contratação do Frete por conta de Terceiros">2 - Contratação do Frete por conta de Terceiros</SelectItem>
                        <SelectItem value="3 - Transporte Próprio por conta do Remetente">3 - Transporte Próprio por conta do Remetente</SelectItem>
                        <SelectItem value="4 - Transporte Próprio por conta do Destinatário">4 - Transporte Próprio por conta do Destinatário</SelectItem>
                        <SelectItem value="9 - Sem Ocorrência de Transporte">9 - Sem Ocorrência de Transporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-12 py-2"><h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-1">Dados da transportadora</h4></div>

                  <div className="md:col-span-6 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Nome</Label>
                    <Input value={formData.transportadoraNome} onChange={(e) => setFormData({ ...formData, transportadoraNome: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Placa veículo</Label>
                    <Input value={formData.transportadoraPlaca} onChange={(e) => setFormData({ ...formData, transportadoraPlaca: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="md:col-span-1 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">UF veículo</Label>
                    <Select value={formData.transportadoraUFVeiculo} onValueChange={(v) => setFormData({ ...formData, transportadoraUFVeiculo: v })}>
                      <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                        <SelectValue placeholder="UF..." />
                      </SelectTrigger>
                      <SelectContent>
                        {BRAZILIAN_UFS.map(uf => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1">
                      RNTC
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-sky-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-800 text-[11px] max-w-[250px]">
                          Registro Nacional de Transportador de Carga (ANTT)
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input value={formData.transportadoraRNTC} onChange={(e) => setFormData({ ...formData, transportadoraRNTC: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>

                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">CNPJ/CPF</Label>
                    <Input value={formData.transportadoraCnpj} onChange={(e) => setFormData({ ...formData, transportadoraCnpj: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Inscrição Estadual</Label>
                    <Input value={formData.transportadoraIE} onChange={(e) => setFormData({ ...formData, transportadoraIE: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="md:col-span-1 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">UF</Label>
                    <Select value={formData.transportadoraUF} onValueChange={(v) => setFormData({ ...formData, transportadoraUF: v })}>
                      <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                        <SelectValue placeholder="UF..." />
                      </SelectTrigger>
                      <SelectContent>
                        {BRAZILIAN_UFS.map(uf => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-5 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Município</Label>
                    <Input value={formData.transportadoraMunicipio} onChange={(e) => setFormData({ ...formData, transportadoraMunicipio: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="md:col-span-12 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Endereço da transportadora</Label>
                    <Input value={formData.transportadoraEndereco} onChange={(e) => setFormData({ ...formData, transportadoraEndereco: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>

                  <div className="md:col-span-12 pt-4 pb-2"><h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-1">Dados do volume</h4></div>
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1 min-h-[1.25rem]">Quantidade</Label>
                    <Input value={formData.volumeQuantidade} onChange={(e) => setFormData({ ...formData, volumeQuantidade: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1 min-h-[1.25rem]">
                      Peso Bruto
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-sky-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-800 text-[11px] max-w-[250px]">
                          Em Kg
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input value={formData.volumePesoBruto} onChange={(e) => setFormData({ ...formData, volumePesoBruto: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1 min-h-[1.25rem]">
                      Peso Líquido
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-sky-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-800 text-[11px] max-w-[250px]">
                          Em Kg
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input value={formData.volumePesoLiquido} onChange={(e) => setFormData({ ...formData, volumePesoLiquido: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1 min-h-[1.25rem]">Numeração</Label>
                    <Input value={formData.volumeNumeracao} onChange={(e) => setFormData({ ...formData, volumeNumeracao: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1 min-h-[1.25rem]">Espécie</Label>
                    <Select value={formData.volumeEspecie} onValueChange={(v) => setFormData({ ...formData, volumeEspecie: v })}>
                      <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Selecione uma opção">Selecione uma opção</SelectItem>
                        <SelectItem value="Outros(s)">Outros(s)</SelectItem>
                        <SelectItem value="Volume(s)">Volume(s)</SelectItem>
                        <SelectItem value="Unidade(s)">Unidade(s)</SelectItem>
                        <SelectItem value="Caixa(s)">Caixa(s)</SelectItem>
                        <SelectItem value="Pacote(s)">Pacote(s)</SelectItem>
                        <SelectItem value="Envelope(s)">Envelope(s)</SelectItem>
                        <SelectItem value="Pallet(s)">Pallet(s)</SelectItem>
                        <SelectItem value="Saco(s)">Saco(s)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1 min-h-[1.25rem]">
                      Marca
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-sky-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-800 text-[11px] max-w-[250px]">
                          Marca, identificação ou marcação do volume.
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input value={formData.volumeMarca} onChange={(e) => setFormData({ ...formData, volumeMarca: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>
                </div>
              </div>

              {/* Pagamento */}
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                  <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                  Pagamento
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-6 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1">
                      Condição de pagamento
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-sky-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-800 text-[11px] max-w-[250px]">
                          Forma de pagamento cadastrada ou número de parcelas ou prazos. Exemplo 30, 60, 3x ou 15 +2x.
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input value={formData.condicaoPagamento} onChange={(e) => setFormData({ ...formData, condicaoPagamento: e.target.value })} className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="md:col-span-2 flex items-end">
                    <Button variant="outline" className="w-full h-10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/20">
                      Gerar parcelas
                    </Button>
                  </div>
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1">
                      Categoria
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-sky-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-800 text-[11px] max-w-[250px]">
                          Categoria de receita/despesa
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Select value={formData.categoria} onValueChange={(v) => setFormData({ ...formData, categoria: v })}>
                      <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Vendas de produtos">Vendas de produtos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Pessoas autorizadas a acessar o XML da nota */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200 font-bold cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group">
                  <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                  <h3 className="text-lg">Pessoas autorizadas a acessar o XML da nota</h3>
                  <Plus className="h-4 w-4 rotate-45 text-zinc-400 group-hover:text-emerald-500" />
                </div>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-sm">
                  <Table>
                    <TableHeader className="bg-zinc-50 dark:bg-zinc-900">
                      <TableRow className="hover:bg-transparent border-b border-zinc-200 dark:border-zinc-800">
                        <TableHead className="w-12 text-center font-bold text-zinc-400">#</TableHead>
                        <TableHead className="text-[11px] uppercase font-bold text-zinc-500 dark:text-zinc-400">Contato <Info className="h-3 w-3 inline text-sky-500" /></TableHead>
                        <TableHead className="text-[11px] uppercase font-bold text-zinc-500 dark:text-zinc-400">CPF/CNPJ</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.autorizados.map((aut: any, index: number) => (
                        <TableRow key={index} className="border-b border-zinc-100 dark:border-zinc-800/50">
                          <TableCell className="text-center font-bold text-zinc-400">{index + 1}</TableCell>
                          <TableCell>
                            <Input value={aut.contato} onChange={(e) => {
                              const newAut = [...formData.autorizados];
                              newAut[index].contato = e.target.value;
                              setFormData({ ...formData, autorizados: newAut });
                            }} className="h-9 border-none shadow-none focus-visible:ring-0 bg-transparent dark:text-zinc-200" />
                          </TableCell>
                          <TableCell>
                            <Input value={aut.cpfCnpj} onChange={(e) => {
                              const newAut = [...formData.autorizados];
                              newAut[index].cpfCnpj = e.target.value;
                              setFormData({ ...formData, autorizados: newAut });
                            }} className="h-9 border-none shadow-none focus-visible:ring-0 bg-transparent dark:text-zinc-200" />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveAutorizado(index)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={handleAddAutorizado} className="text-emerald-600 dark:text-emerald-400 font-bold gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/20">
                      <Plus className="h-4 w-4" /> Adicionar outro contato
                    </Button>
                  </div>
                </div>
              </div>

              {/* Informações adicionais */}
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                  <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                  Informações adicionais
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Informações complementares</Label>
                    <Textarea value={formData.informacoesComplementares} onChange={(e) => setFormData({ ...formData, informacoesComplementares: e.target.value })} className="min-h-[100px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1">
                      Informações complementares (natureza)
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-sky-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-800 text-[11px] max-w-[300px]">
                          Esta informação é gerada automaticamente pelo sistema com base nas informações complementares cadastradas nas naturezas.
                        </TooltipContent>
                      </Tooltip>
                      <Link href="/dashboard/naturezas-operacao" className="text-emerald-600 dark:text-emerald-400 lowercase font-normal flex items-center gap-1 ml-2 hover:underline">
                        <Info className="h-3 w-3" /> Naturezas de operação
                      </Link>
                    </Label>
                    <Textarea readOnly className="min-h-[80px] bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 opacity-80 cursor-not-allowed" value={formData.informacoesComplementares} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-1">
                      Informações adicionais de interesse do fisco (natureza)
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-sky-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-800 text-[11px] max-w-[300px]">
                          Esta informação é gerada automaticamente pelo sistema com base nas informações adicionais cadastradas nas naturezas.
                        </TooltipContent>
                      </Tooltip>
                      <Link href="/dashboard/naturezas-operacao" className="text-emerald-600 dark:text-emerald-400 lowercase font-normal flex items-center gap-1 ml-2 hover:underline">
                        <Info className="h-3 w-3" /> Naturezas de operação
                      </Link>
                    </Label>
                    <Textarea readOnly className="min-h-[80px] bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 opacity-80 cursor-not-allowed" value={formData.informacoesFisco} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>

  );
}
