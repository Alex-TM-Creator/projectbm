
"use client";

import * as React from "react";
import QRCode from "react-qr-code";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, LayoutTemplate, Plus, GripVertical, X, Search } from "lucide-react";
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
import type { LabelTemplate, LabelFieldKey, LabelField, Product, SalesOrder, Address } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import * as Icons from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const PREVIEW_SCALE_FACTOR = 3.5; // Fator de escala reduzido para caber no modal sem scroll

const availableFields: { id: LabelFieldKey; label: string }[] = [
  { id: 'name', label: 'Nome do Produto' },
  { id: 'internalCode', label: 'Cód. Interno' },
  { id: 'barcode', label: 'Código de Barras' },
  { id: 'qrcode', label: 'QR Code' },
  { id: 'salePrice', label: 'Preço de Venda' },
  { id: 'volumeCount', label: 'Contagem de Volumes (ex: 1/5)' },
  { id: 'orderNumber', label: 'Número do Pedido' },
  { id: 'customerName', label: 'Nome do Cliente' },
  { id: 'deliveryAddress', label: 'Endereço de Entrega' },
  { id: 'customText', label: 'Texto Livre' },
];

export default function LabelTemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = React.useState<LabelTemplate[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [salesOrders, setSalesOrders] = React.useState<SalesOrder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currentTemplate, setCurrentTemplate] = React.useState<Partial<LabelTemplate>>({ fields: [] });
  const [templateToDelete, setTemplateToDelete] = React.useState<LabelTemplate | null>(null);

  const [draggingField, setDraggingField] = React.useState<{
    id: string;
    action: 'move' | 'resize';
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialWidth?: number;
  } | null>(null);
  const previewRef = React.useRef<HTMLDivElement>(null);
  
  const [productSearch, setProductSearch] = React.useState("");
  const [filteredProducts, setFilteredProducts] = React.useState<Product[]>([]);
  const [selectedPreviewProduct, setSelectedPreviewProduct] = React.useState<Product | null>(null);

  const [orderSearch, setOrderSearch] = React.useState("");
  const [filteredOrders, setFilteredOrders] = React.useState<SalesOrder[]>([]);
  const [selectedPreviewOrder, setSelectedPreviewOrder] = React.useState<SalesOrder | null>(null);


  const isEditing = !!currentTemplate.id;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [templatesSnap, productsSnap, salesOrdersSnap] = await Promise.all([
        getDocs(query(collection(db, "labelTemplates"), orderBy("name"))),
        getDocs(query(collection(db, "products"), orderBy("name"))),
        getDocs(query(collection(db, "salesOrders"))),
      ]);
      setTemplates(templatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LabelTemplate)));
      setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setSalesOrders(salesOrdersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalesOrder)));
    } catch (error) {
      toast({ title: "Erro ao buscar modelos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  React.useEffect(() => {
    if (productSearch) {
      setFilteredProducts(products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.internalCode?.toLowerCase().includes(productSearch.toLowerCase())));
    } else {
      setFilteredProducts([]);
    }
  }, [productSearch, products]);

  React.useEffect(() => {
    if (orderSearch) {
      setFilteredOrders(salesOrders.filter(o => o.orderNumber.toString().includes(orderSearch) || o.customerName.toLowerCase().includes(orderSearch.toLowerCase())));
    } else {
      setFilteredOrders([]);
    }
  }, [orderSearch, salesOrders]);

  
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, fieldId: string, action: 'move' | 'resize' = 'move') => {
    e.preventDefault();
    e.stopPropagation();
    const field = currentTemplate.fields?.find(f => f.id === fieldId);
    if (!field) return;

    setDraggingField({
      id: fieldId,
      action,
      startX: e.clientX,
      startY: e.clientY,
      initialX: field.x,
      initialY: field.y,
      initialWidth: field.maxWidth || (field.key === 'qrcode' ? field.size : 20),
    });
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!draggingField || !previewRef.current) return;

    const dx = (e.clientX - draggingField.startX) / PREVIEW_SCALE_FACTOR;
    const dy = (e.clientY - draggingField.startY) / PREVIEW_SCALE_FACTOR;

    setCurrentTemplate(prev => {
        if (!prev || !prev.fields) return prev;
        return {
            ...prev,
            fields: prev.fields.map(f => {
                if (f.id !== draggingField.id) return f;
                
                if (draggingField.action === 'resize') {
                    const newWidth = Math.max(10, parseFloat(((draggingField.initialWidth || 20) + dx).toFixed(2)));
                    if (f.key === 'qrcode') {
                        return { ...f, size: newWidth };
                    }
                    return { ...f, maxWidth: newWidth };
                } else {
                    const newX = parseFloat((draggingField.initialX + dx).toFixed(2));
                    const newY = parseFloat((draggingField.initialY + dy).toFixed(2));
                    return { ...f, x: newX, y: newY };
                }
            })
        };
    });
  }, [draggingField]);

  const handleMouseUp = React.useCallback(() => {
    setDraggingField(null);
  }, []);

  React.useEffect(() => {
    if (draggingField) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingField, handleMouseMove, handleMouseUp]);


  const handleOpenDialog = (template?: LabelTemplate) => {
    setCurrentTemplate(template || { name: "", width: 50, height: 30, fields: [] });
    setSelectedPreviewProduct(null);
    setSelectedPreviewOrder(null);
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentTemplate({ fields: [] });
    setOpen(false);
  };
  
  const handleAddField = (fieldKey: LabelFieldKey) => {
    setCurrentTemplate(prev => {
        if (prev?.fields?.some(f => f.key === fieldKey)) {
          toast({ title: "Campo já adicionado", variant: "destructive"});
          return prev;
        };
        const fieldData = availableFields.find(f => f.id === fieldKey);
        if (!fieldData) return prev;

        const newField: LabelField = {
            id: `${fieldKey}-${Date.now()}`,
            key: fieldKey,
            label: fieldData.label,
            x: 2,
            y: (prev.fields?.length || 0) * 8, // Stagger new fields
            fontSize: 10,
            fontWeight: 'normal',
        };
        
        if (fieldKey === 'qrcode') {
            newField.size = 20; // Default size in mm
        }

        return { ...prev, fields: [...(prev.fields || []), newField] };
    });
  };
  
  const handleRemoveField = (fieldId: string) => {
    setCurrentTemplate(prev => ({
      ...prev,
      fields: (prev?.fields || []).filter(f => f.id !== fieldId),
    }));
  };

  const handleFieldUpdate = (fieldId: string, property: keyof LabelField, value: any) => {
    setCurrentTemplate(prev => {
        if (!prev || !prev.fields) return prev;
        return {
            ...prev,
            fields: prev.fields.map(f => f.id === fieldId ? { ...f, [property]: value } : f)
        };
    });
  };

  const handleSubmit = async () => {
    if (!currentTemplate.name || !currentTemplate.width || !currentTemplate.height) {
      toast({ title: "Campos obrigatórios", description: "Nome, largura e altura são obrigatórios.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const dataToSave = {
        name: currentTemplate.name,
        width: currentTemplate.width,
        height: currentTemplate.height,
        fields: currentTemplate.fields || [],
      };

      if (isEditing) {
        const docRef = doc(db, "labelTemplates", currentTemplate.id!);
        await updateDoc(docRef, dataToSave as any);
        toast({ title: "Modelo Atualizado!" });
      } else {
        await addDoc(collection(db, "labelTemplates"), { ...dataToSave, createdAt: serverTimestamp() });
        toast({ title: "Modelo Criado!" });
      }
      handleCloseDialog();
      fetchData();
    } catch (error) {
      toast({ title: isEditing ? "Erro ao atualizar" : "Erro ao criar", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;
    try {
      await deleteDoc(doc(db, "labelTemplates", templateToDelete.id));
      toast({ title: "Modelo Deletado", variant: "destructive" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    } finally {
      setTemplateToDelete(null);
    }
  };
  
  const formatCurrency = (value?: number) => {
    if (value === undefined) return "";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };
  
  const formatAddress = (address?: Address) => {
    if (!address) return "[Endereço]";
    return `${address.address}, ${address.number} ${address.complement ? `(${address.complement})` : ''} - ${address.neighborhood}, ${address.city}/${address.state}`;
  };
  
  const renderFieldForPreview = (field: LabelField, product?: Product | null, order?: SalesOrder | null) => {
    let content: React.ReactNode = `[${field.label}]`;

    switch (field.key) {
        case 'name':
            content = product?.name || `[${field.label}]`;
            break;
        case 'internalCode':
            content = product?.internalCode ? `Cód: ${product.internalCode}` : `[${field.label}]`;
            break;
        case 'barcode':
            content = product?.barcode ? (
                <div className="text-center">
                    {/* Placeholder for barcode SVG/Image */}
                    <div style={{ background: '#000', height: '100%', width: '100%' }} />
                    <p style={{ fontSize: '6pt', letterSpacing: '2px', margin: 0 }}>{product.barcode}</p>
                </div>
            ) : `[${field.label}]`;
            break;
        case 'qrcode':
            const qrData = product?.barcode || product?.internalCode || product?.id || 'NO_DATA';
            content = (
              <div className="flex flex-col items-center justify-center w-full h-full">
                <div style={{ width: "100%", height: "100%" }}>
                  <QRCode
                    size={256}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    value={qrData}
                    viewBox={`0 0 256 256`}
                  />
                </div>
              </div>
            );
            break;
        case 'salePrice':
            content = product ? formatCurrency(product.salePrice) : "R$ 99,99";
            break;
        case 'volumeCount':
            content = product ? `1/${product.volumeQuantity || 1}` : `[${field.label}]`;
            break;
        case 'orderNumber':
            content = order ? `#${order.orderNumber}` : `[${field.label}]`;
            break;
        case 'customerName':
            content = order ? order.customerName : `[${field.label}]`;
            break;
        case 'deliveryAddress':
            content = order?.deliveryAddress ? formatAddress(order.deliveryAddress) : `[${field.label}]`;
            break;
        case 'customText':
            content = field.customTextValue || `[Seu Texto Aqui]`;
            break;
    }

    if (!content) return null;

    const fieldStyle: React.CSSProperties = {
        position: 'absolute',
        left: `${field.x * PREVIEW_SCALE_FACTOR}px`,
        top: `${field.y * PREVIEW_SCALE_FACTOR}px`,
        fontSize: `${field.fontSize * (PREVIEW_SCALE_FACTOR / 2.8)}px`,
        fontWeight: field.fontWeight as React.CSSProperties['fontWeight'],
        lineHeight: 1.1,
        color: 'black',
    };

    if (field.key === 'qrcode') {
        fieldStyle.width = `${field.size || 20}mm`;
        fieldStyle.height = `${field.size || 20}mm`;
    } else {
        if (field.maxWidth && field.maxWidth > 0) {
            fieldStyle.width = `${field.maxWidth * PREVIEW_SCALE_FACTOR}px`;
            fieldStyle.whiteSpace = 'normal';
            fieldStyle.wordBreak = 'break-word';
            fieldStyle.outline = '1px dashed #94a3b8';
            fieldStyle.backgroundColor = 'rgba(148, 163, 184, 0.1)';
        } else {
            fieldStyle.whiteSpace = 'nowrap';
        }
    }

    return (
        <div
            key={field.id}
            className="cursor-grab active:cursor-grabbing p-1 -m-1 group"
            onMouseDown={(e) => handleMouseDown(e, field.id, 'move')}
            style={fieldStyle}
        >
            {content}
            {field.key !== 'barcode' && (
                <div 
                   className="absolute right-[-6px] top-0 bottom-0 w-3 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-blue-500/50 hover:bg-blue-500/80 z-10 rounded-full"
                   onMouseDown={(e) => handleMouseDown(e, field.id, 'resize')}
                />
            )}
        </div>
    );
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
              <LayoutTemplate /> Modelos de Etiquetas
            </h1>
            <p className="text-muted-foreground">Crie e gerencie os layouts para suas etiquetas.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Novo Modelo</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl" onCloseAutoFocus={handleCloseDialog}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Modelo' : 'Novo Modelo de Etiqueta'}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-8 py-4">
                {/* Coluna da Esquerda: Configurações */}
                <div className="md:col-span-2 space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Modelo</Label>
                      <Input id="name" value={currentTemplate.name || ""} onChange={(e) => setCurrentTemplate(p => ({...p, name: e.target.value}))} placeholder="Ex: Etiqueta de Gôndola 50x30" disabled={isSubmitting}/>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="width">Largura (mm)</Label>
                            <Input id="width" type="number" value={currentTemplate.width || ""} onChange={e => setCurrentTemplate(p => ({...p, width: Number(e.target.value) || 0}))}/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="height">Altura (mm)</Label>
                            <Input id="height" type="number" value={currentTemplate.height || ""} onChange={e => setCurrentTemplate(p => ({...p, height: Number(e.target.value) || 0}))}/>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <Label>Adicionar Campos</Label>
                        <div className="flex flex-wrap gap-2">
                            {availableFields.map(field => (
                                <Button key={field.id} variant="outline" size="sm" onClick={() => handleAddField(field.id)}>
                                    <Plus className="h-4 w-4 mr-1"/>
                                    {field.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <Accordion type="multiple" className="w-full space-y-2">
                        {(currentTemplate.fields || []).map(field => (
                            <AccordionItem key={field.id} value={field.id} className="border rounded-md px-3">
                                <AccordionTrigger className="py-2 text-sm font-medium">
                                    <div className="flex items-center gap-2">
                                        <GripVertical className="h-4 w-4 text-muted-foreground"/>
                                        {field.label}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4 space-y-4">
                                    {field.key === 'customText' && (
                                        <div className="space-y-1">
                                            <Label htmlFor={`val-${field.id}`} className="text-xs">Texto para exibição</Label>
                                            <Input id={`val-${field.id}`} value={field.customTextValue || ''} placeholder="Escreva o seu texto..." onChange={e => handleFieldUpdate(field.id, 'customTextValue', e.target.value)} />
                                        </div>
                                    )}
                                    {field.key === 'qrcode' ? (
                                      <div className="space-y-1">
                                        <Label htmlFor={`size-${field.id}`} className="text-xs">Tamanho (mm)</Label>
                                        <Input id={`size-${field.id}`} type="number" value={field.size || 20} onChange={e => handleFieldUpdate(field.id, 'size', Number(e.target.value))} />
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label htmlFor={`font-${field.id}`} className="text-xs">Fonte (pt)</Label>
                                            <Input id={`font-${field.id}`} type="number" value={field.fontSize} onChange={e => handleFieldUpdate(field.id, 'fontSize', Number(e.target.value))} />
                                        </div>
                                        <div className="flex items-center space-x-2 pt-5">
                                            <Switch id={`bold-${field.id}`} checked={field.fontWeight === 'bold'} onCheckedChange={c => handleFieldUpdate(field.id, 'fontWeight', c ? 'bold' : 'normal')} />
                                            <Label htmlFor={`bold-${field.id}`}>Negrito</Label>
                                        </div>
                                      </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label htmlFor={`x-${field.id}`} className="text-xs">Posição X (mm)</Label>
                                            <Input id={`x-${field.id}`} type="number" value={field.x} onChange={e => handleFieldUpdate(field.id, 'x', Number(e.target.value))} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor={`y-${field.id}`} className="text-xs">Posição Y (mm)</Label>
                                            <Input id={`y-${field.id}`} type="number" value={field.y} onChange={e => handleFieldUpdate(field.id, 'y', Number(e.target.value))} />
                                        </div>
                                    </div>
                                    {field.key !== 'qrcode' && field.key !== 'barcode' && (
                                     <div className="space-y-1">
                                         <Label htmlFor={`maxWidth-${field.id}`} className="text-xs">Largura Máx. (mm) <span className="font-normal text-muted-foreground">- Cria quebra de linha se o texto ficar maior</span></Label>
                                         <Input id={`maxWidth-${field.id}`} type="number" value={field.maxWidth || ''} placeholder="Deixe em branco para linha única infinita" onChange={e => handleFieldUpdate(field.id, 'maxWidth', e.target.value ? Number(e.target.value) : undefined)} />
                                     </div>
                                    )}
                                    <Button variant="destructive" size="sm" onClick={() => handleRemoveField(field.id)}><X className="h-4 w-4 mr-1"/> Remover Campo</Button>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
                {/* Coluna da Direita: Preview */}
                <div className="md:col-span-3 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pré-visualização</CardTitle>
                            <CardDescription>Arraste os campos para posicionar.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 flex justify-center w-full overflow-hidden">
                             <div 
                              ref={previewRef}
                              className="relative bg-white border border-dashed border-gray-400 overflow-hidden shadow-md shrink-0"
                              style={{
                                width: `${(currentTemplate.width || 0) * PREVIEW_SCALE_FACTOR}px`,
                                height: `${(currentTemplate.height || 0) * PREVIEW_SCALE_FACTOR}px`,
                              }}
                            >
                                {(currentTemplate.fields || []).map(field => renderFieldForPreview(field, selectedPreviewProduct, selectedPreviewOrder))}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Testar com Dados Reais</CardTitle>
                        <CardDescription>Busque um produto ou pedido para preencher a pré-visualização.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label>Produto</Label>
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Buscar produto..."
                              className="pl-8"
                              value={productSearch}
                              onChange={(e) => {
                                setProductSearch(e.target.value);
                                setSelectedPreviewOrder(null);
                              }}
                            />
                          </div>
                          {filteredProducts.length > 0 && (
                            <ScrollArea className="h-40 rounded-md border mt-2">
                              {filteredProducts.map(p => (
                                <div key={p.id} className="p-2 text-sm hover:bg-muted cursor-pointer" onClick={() => { setSelectedPreviewProduct(p); setProductSearch(""); }}>
                                  [{p.internalCode}] {p.name}
                                </div>
                              ))}
                            </ScrollArea>
                          )}
                          {selectedPreviewProduct && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              Visualizando com: <Badge>{selectedPreviewProduct.name}</Badge>
                              <Button variant="ghost" size="sm" onClick={() => setSelectedPreviewProduct(null)}>Limpar</Button>
                            </div>
                          )}
                        </div>

                        <div>
                          <Label>Pedido</Label>
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Buscar pedido..."
                              className="pl-8"
                              value={orderSearch}
                              onChange={(e) => {
                                setOrderSearch(e.target.value);
                                setSelectedPreviewProduct(null);
                              }}
                            />
                          </div>
                          {filteredOrders.length > 0 && (
                            <ScrollArea className="h-40 rounded-md border mt-2">
                              {filteredOrders.map(o => (
                                <div key={o.id} className="p-2 text-sm hover:bg-muted cursor-pointer" onClick={() => {
                                    setSelectedPreviewOrder(o);
                                    setOrderSearch("");
                                    if (o.items.length > 0) {
                                      const firstProduct = products.find(p => p.id === o.items[0].productId);
                                      setSelectedPreviewProduct(firstProduct || null);
                                    }
                                  }}>
                                  #{o.orderNumber} - {o.customerName}
                                </div>
                              ))}
                            </ScrollArea>
                          )}
                          {selectedPreviewOrder && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              Visualizando com: <Badge>Pedido #{selectedPreviewOrder.orderNumber}</Badge>
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedPreviewOrder(null); setSelectedPreviewProduct(null); }}>Limpar</Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
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
            <CardTitle>Modelos Salvos</CardTitle>
            <CardDescription>
              {templates.length} modelos de etiqueta cadastrados.
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
                    <TableHead>Nome</TableHead>
                    <TableHead>Tamanho (L x A)</TableHead>
                    <TableHead>Campos</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>{template.width}mm x {template.height}mm</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {template.fields.map(field => (
                            <Badge key={field.id} variant="outline">{field.label}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(template)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-red-600" onSelect={(e) => { e.preventDefault(); setTemplateToDelete(template);}}><Trash2 className="mr-2 h-4 w-4" />Deletar</DropdownMenuItem>
                            </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {templateToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação irá excluir o modelo <strong className="mx-1">{templateToDelete.name}</strong>.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setTemplateToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Sim, excluir</AlertDialogAction>
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

    