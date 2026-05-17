"use client";

import * as React from "react";
import { 
    Search, 
    ChevronsUpDown, 
    Wrench, Truck, Car, Package, MapPin, Route, Compass, Bus, Plane, Ship, TramFront, Tractor, Forklift, Construction, Anchor,
    ShoppingCart, DollarSign, CreditCard, Banknote, Receipt, BadgeDollarSign, TrendingUp, TrendingDown, Percent, HandCoins, Ticket,
    Home, Settings, Menu, LayoutGrid, Sidebar, PanelLeft, ListTree, Info, HelpCircle, Palette, Archive, ExternalLink, Link, LayoutDashboard, AppWindow, Pointer, Globe,
    Target, Award, Trophy, Medal, Gem, Rocket, BarChart2, AreaChart, PieChart, Crown, Star, BarChart, LineChart, Activity, FileBarChart, Variable, Sigma, Presentation,
    Megaphone, Bell, Mail, MessageSquare, Phone, Send,
    Printer, Tag, Tags, Sheet, Pen, PenLine, BookOpen, Bookmark, Clipboard, ClipboardList, ClipboardCheck, Scissors, Ruler, Eraser, Calculator, LayoutTemplate, StickyNote, BookUser, FolderClock, Briefcase, Laptop, Monitor, FileKey, FileLock, Glasses,
    PlusCircle, Pencil, Trash2, Copy, Save, Upload, Download, Filter, X, Check, MinusCircle, Edit,
    User, Users, UserPlus, UserCog, Contact, BriefcaseBusiness, Building2, Building, Shield, ShieldCheck, ShieldAlert, Key, Lock, Unlock,
    Calendar, Clock, Timer, FileClock, History, CalendarDays, CalendarCheck, CalendarPlus,
    FileText, Folder, Image, Video, Camera, Paperclip, File, FilePlus, FileMinus, FileSpreadsheet, FileKey as FileKeyIcon, FileLock as FileLockIcon,
    Grab, Book, GraduationCap, Lightbulb, Heart, Smile, Coffee, PackageSearch, Container, Boxes,
    Circle, Database, Layers, HardDrive, PackageOpen, Workflow, Scan, ScanBarcode, Ungroup, BoxSelect
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const iconTranslations: { [key: string]: string } = {
  "Wrench": "Ferramenta", "Truck": "Logística", "Car": "Carro", "Package": "Pacote", "MapPin": "Localização", "Route": "Rota", "Compass": "Bússola", "Bus": "Ônibus", "Plane": "Avião", "Ship": "Navio", "TramFront": "Bonde", "Tractor": "Trator", "Forklift": "Empilhadeira", "Construction": "Obra", "Anchor": "Âncora",
  "ShoppingCart": "Venda", "DollarSign": "Financeiro", "CreditCard": "Cartão", "Banknote": "Dinheiro", "Receipt": "Recibo", "BadgeDollarSign": "Sifrão", "TrendingUp": "Tendência Alta", "TrendingDown": "Tendência Baixa", "Percent": "Porcentagem", "HandCoins": "Troco", "Ticket": "Ticket",
  "Home": "Início", "Settings": "Configuração", "Menu": "Menu", "LayoutGrid": "Grade", "Sidebar": "Menu Lateral", "PanelLeft": "Painel Esquerdo", "ListTree": "Árvore", "Info": "Informação", "HelpCircle": "Ajuda", "Palette": "Cores", "Archive": "Arquivo", "ExternalLink": "Link Externo", "Link": "Link", "LayoutDashboard": "Dashboard", "AppWindow": "Janela", "Pointer": "Ponteiro",
  "Target": "Meta", "Award": "Prêmio", "Trophy": "Troféu", "Medal": "Medalha", "Gem": "Gema", "Rocket": "Foguete", "BarChart2": "Gráfico de Bar.", "AreaChart": "Área", "PieChart": "Pizza", "Crown": "Coroa", "Star": "Estrela", "BarChart": "Gráfico Barras", "LineChart": "Gráfico Linhas", "Activity": "Atividade", "FileBarChart": "Relatório Bar.", "Variable": "Variável", "Sigma": "Soma", "Presentation": "Apresentação",
  "Megaphone": "Mega-fone", "Bell": "Notificação", "Mail": "E-mail", "MessageSquare": "Mensagem", "Phone": "Telefone", "Send": "Enviar",
  "Printer": "Impressora", "Tag": "Etiqueta", "Tags": "Etiquetas", "Sheet": "Planilha", "Pen": "Caneta", "PenLine": "Escrever", "BookOpen": "Livro Aberto", "Bookmark": "Favorito", "Clipboard": "Clipboard", "ClipboardList": "Lista", "ClipboardCheck": "Confirmado", "Scissors": "Tesoura", "Ruler": "Régua", "Eraser": "Borracha", "Calculator": "Calculadora", "LayoutTemplate": "Template", "StickyNote": "Nota", "BookUser": "Agenda Contatos", "FolderClock": "Histórico Pastas",
  "PlusCircle": "Adicionar", "Pencil": "Editar", "Trash2": "Lixeira", "Copy": "Copiar", "Save": "Salvar", "Upload": "Upload", "Download": "Download", "Search": "Buscar", "Filter": "Filtro", "X": "Fechar", "Check": "Check", "MinusCircle": "Remover", "Edit": "Editar",
  "User": "Usuário", "Users": "Usuários", "UserPlus": "Mais Usuário", "UserCog": "Configurar Usuário", "Contact": "Contato", "BriefcaseBusiness": "Maleta", "Building2": "Prédios", "Building": "Prédio", "Shield": "Escudo", "ShieldCheck": "Escudo OK", "ShieldAlert": "Alerta Escudo", "Key": "Chave", "Lock": "Cadeado", "Unlock": "Destravar", "Briefcase": "Trabalho", "Glasses": "Óculos",
  "Calendar": "Calendário", "Clock": "Relógio", "Timer": "Temporizador", "FileClock": "Histórico Arq.", "History": "Histórico", "CalendarDays": "Dias", "CalendarCheck": "Verificar Cal.", "CalendarPlus": "Adicionar no Cal.",
  "FileText": "Texto", "Folder": "Pasta", "Image": "Imagem", "Video": "Vídeo", "Camera": "Câmera", "Paperclip": "Clipes", "File": "Arquivo", "FilePlus": "Novo Arq.", "FileMinus": "Remover Arq.", "FileSpreadsheet": "Excel", "FileKey": "Chave Arq.", "FileLock": "Arq. Travado", "Globe": "Globo", "Laptop": "Laptop", "Monitor": "Monitor",
  "Grab": "Mão", "Book": "Livro", "GraduationCap": "Chapéu", "Lightbulb": "Lâmpada", "Heart": "Coração", "Smile": "Sorriso", "Coffee": "Café", "PackageSearch": "Buscar Pacote", "Container": "Contêiner", "Boxes": "Caixas",
  "Circle": "Círculo", "Database": "Banco Dados", "Layers": "Camadas", "HardDrive": "Disco Rígido", "PackageOpen": "Pacote Aberto", "Workflow": "Fluxo Trabalho", "Scan": "Scanner", "ScanBarcode": "Código Barras", "Ungroup": "Desagrupar", "BoxSelect": "Selecionar Caixa"
};

export const iconCategories: { [category: string]: string[] } = {
  "Assistência Técnica & Entregas": ["Wrench", "Truck", "Car", "Package", "MapPin", "Route", "Compass", "Bus", "Plane", "Ship", "TramFront", "Tractor", "Forklift", "Construction"],
  "Vendas & Finanças": ["ShoppingCart", "DollarSign", "CreditCard", "Banknote", "Receipt", "BadgeDollarSign", "TrendingUp", "TrendingDown", "Percent", "HandCoins", "Ticket"],
  "Geral & UI": ["Home", "Settings", "Menu", "LayoutGrid", "Sidebar", "PanelLeft", "ListTree", "Info", "HelpCircle", "Palette", "Archive", "ExternalLink", "Link", "LayoutDashboard", "AppWindow", "Pointer", "Globe"],
  "Estoque & Armazém": ["Boxes", "PackageOpen", "Database", "Layers", "HardDrive", "Workflow", "Container", "PackageSearch", "Scan", "ScanBarcode", "Ungroup", "BoxSelect"],
  "Metas, Performance & Dados": ["Target", "Award", "Trophy", "Medal", "Gem", "Rocket", "BarChart2", "AreaChart", "PieChart", "Crown", "Star", "BarChart", "LineChart", "Activity", "FileBarChart", "Variable", "Sigma", "Presentation"],
  "Comunicação": ["Megaphone", "Bell", "Mail", "MessageSquare", "Phone", "Send"],
  "Escritório & Documentos": ["Calculator", "Printer", "Tag", "Tags", "Sheet", "Pen", "PenLine", "BookOpen", "Bookmark", "Clipboard", "ClipboardList", "ClipboardCheck", "Scissors", "Ruler", "Eraser", "LayoutTemplate", "StickyNote", "BookUser", "FolderClock", "Briefcase", "Laptop", "Monitor", "FileKey", "FileLock", "Glasses"],
  "Ações & Edição": ["PlusCircle", "Pencil", "Trash2", "Copy", "Save", "Upload", "Download", "Search", "Filter", "X", "Check", "MinusCircle", "Edit"],
  "Usuários & Administrativo": ["User", "Users", "UserPlus", "UserCog", "Contact", "BriefcaseBusiness", "Building2", "Building", "Shield", "ShieldCheck", "ShieldAlert", "Key", "Lock", "Unlock"],
  "Tempo & Calendário": ["Calendar", "Clock", "Timer", "FileClock", "History", "CalendarDays", "CalendarCheck", "CalendarPlus"],
  "Mídia & Arquivos": ["FileText", "Folder", "Image", "Video", "Camera", "Paperclip", "File", "FilePlus", "FileMinus", "FileSpreadsheet"],
  "Outros": ["Grab", "Book", "GraduationCap", "Lightbulb", "Heart", "Smile", "Coffee", "Anchor", "Circle"],
};

interface IconPickerProps {
    value: string | undefined;
    onChange: (value: string) => void;
}

const Icon = ({ name, className }: { name: string, className?: string }) => {
    const LucideIcon = (LucideIcons as any)[name] as React.ComponentType<any>;
    if (!LucideIcon) return null;
    return <LucideIcon className={className} />;
};

export function IconPicker({ value, onChange }: IconPickerProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");

    const filteredCategories = React.useMemo(() => {
        return Object.entries(iconCategories).map(([category, icons]) => {
            const filteredIcons = icons.filter(iconName => {
                const translated = iconTranslations[iconName] || iconName;
                return iconName.toLowerCase().includes(search.toLowerCase()) || 
                       translated.toLowerCase().includes(search.toLowerCase());
            });
            return { category, icons: filteredIcons };
        }).filter(group => group.icons.length > 0);
    }, [search]);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isOpen}
                    className="col-span-3 justify-between font-normal h-11"
                >
                    {value ? (
                        <div className="flex items-center gap-2">
                            <Icon name={value} className="h-4 w-4" />
                            <span>{iconTranslations[value] || value}</span>
                        </div>
                    ) : "Selecione um ícone"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <div className="p-3 border-b">
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                        <Input
                            placeholder="Buscar ícone (ex: Transporte, Estoque)..."
                            className="pl-8 h-9"
                            autoFocus
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                <div 
                    className="max-h-72 overflow-y-auto"
                    onWheel={(e) => e.stopPropagation()}
                >
                    <div className="py-2">
                        {filteredCategories.length === 0 && (
                            <div className="p-4 text-center text-sm text-muted-foreground">Nenhum ícone encontrado.</div>
                        )}
                        {filteredCategories.map(({ category, icons }) => (
                            <div key={category} className="px-2 pb-4">
                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{category}</div>
                                <div className="grid grid-cols-2 gap-1 mt-1">
                                    {icons.map(iconName => (
                                        <Button
                                            key={iconName}
                                            variant="ghost"
                                            className={cn(
                                                "justify-start font-normal h-9 px-2 gap-2 text-xs",
                                                value === iconName && "bg-primary/10 text-primary hover:bg-primary/15"
                                            )}
                                            onClick={() => {
                                                onChange(iconName);
                                                setIsOpen(false);
                                                setSearch("");
                                            }}
                                        >
                                            <Icon name={iconName} className="h-4 w-4 shrink-0" />
                                            <span className="truncate">{iconTranslations[iconName] || iconName}</span>
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
