
import { collection, writeBatch, getDocs, doc } from "firebase/firestore";
import { db } from "./firebase";
import type { NavigationItem } from "./definitions";

// Estrutura inicial do menu
const initialNavigationItems: Omit<NavigationItem, 'id'>[] = [
  { title: 'Painel de Controle', path: '/dashboard', icon: 'LayoutGrid', order: 0, parentId: null, visible: true },
  { title: 'Resumo do Sistema', path: '/dashboard/summary', icon: 'Info', order: 1, parentId: null, visible: true },
  { title: 'Sumário do Vendedor', path: '/dashboard/seller-summary', icon: 'User', order: 2, parentId: null, visible: true },
  { title: 'Agendamento', icon: 'CalendarDays', order: 3, parentId: null, visible: true, path: '#' },
  { title: 'Agendar Entregas', path: '/dashboard/scheduling', icon: 'CalendarPlus', order: 3.1, parentId: 'agendamento', visible: true },
  { title: 'Rota do Dia', path: '/dashboard/scheduling/daily-route', icon: 'Map', order: 3.2, parentId: 'agendamento', visible: true },
  { title: 'Minha Rota', path: '/dashboard/my-route', icon: 'Route', order: 3.3, parentId: 'agendamento', visible: true },
  { title: 'Meu Frete', path: '/dashboard/driver-freight', icon: 'DollarSign', order: 3.4, parentId: 'agendamento', visible: true },
  { title: 'Ordem de Pagamento (Entrega)', path: '/dashboard/delivery-payment', icon: 'FileText', order: 3.5, parentId: 'agendamento', visible: true },
  { title: 'Pagamento Equipe', path: '/dashboard/delivery-payment-team', icon: 'HandCoins', order: 3.55, parentId: 'agendamento', visible: true },
  { title: 'Histórico de Pagamentos (Entrega)', path: '/dashboard/delivery-payment/history', icon: 'History', order: 3.6, parentId: 'agendamento', visible: true },
  { title: 'Histórico Pagamentos (Equipe)', path: '/dashboard/delivery-payment-team/history', icon: 'History', order: 3.7, parentId: 'agendamento', visible: true },
  { title: 'Meu Desempenho', path: '/dashboard/my-performance', icon: 'TrendingUp', order: 4, parentId: null, visible: true },
  { title: 'Alertas', path: '/dashboard/alerts', icon: 'AlertTriangle', order: 5, parentId: 'configurações', visible: true },
  { title: 'Criar Notificação', path: '/dashboard/create-notification', icon: 'BellPlus', order: 6, parentId: null, visible: true },
  { title: 'Gerenciar Notificações', path: '/dashboard/notification-history', icon: 'Bell', order: 7, parentId: null, visible: true },
  { title: 'Confirmação de Leitura', path: '/dashboard/read-confirmation', icon: 'MailCheck', order: 8, parentId: null, visible: true },
  { title: 'Campanhas', path: '/dashboard/campaigns', icon: 'Megaphone', order: 9, parentId: null, visible: true },
  { title: 'Criar Campanha', path: '/dashboard/create-campaign', icon: 'PlusSquare', order: 10, parentId: null, visible: true },
  { title: 'Histórico de Campanhas', path: '/dashboard/campaign-history', icon: 'History', order: 11, parentId: null, visible: true },
  { title: 'Definir Metas', path: '/dashboard/create-goal', icon: 'Target', order: 12, parentId: null, visible: true },
  { title: 'Metas', path: '/dashboard/goals', icon: 'Target', order: 13, parentId: null, visible: true },
  
  { title: 'Lançar Realizado', icon: 'Rocket', order: 14, parentId: null, visible: true, path: '#' },
  { title: 'Por Vendedor', path: '/dashboard/realizado', icon: 'User', order: 14.1, parentId: 'lançar-realizado', visible: true },
  { title: 'Por Filial', path: '/dashboard/realizado/filial', icon: 'GitFork', order: 14.2, parentId: 'lançar-realizado', visible: true },
  { title: 'Por Função', path: '/dashboard/realizado/funcao', icon: 'BriefcaseBusiness', order: 14.3, parentId: 'lançar-realizado', visible: true },
  
  { title: 'Pega Pix', icon: 'Grab', order: 15, parentId: null, visible: true, path: '#' },
  { title: 'Criar Meta', path: '/dashboard/pega-pix/create', icon: 'PlusCircle', order: 16, parentId: 'pega pix', visible: true },
  { title: 'Metas Pega Pix', path: '/dashboard/pega-pix/goals', icon: 'Target', order: 17, parentId: 'pega pix', visible: true },
  { title: 'Definir Premiação', path: '/dashboard/pega-pix/awards', icon: 'Award', order: 18, parentId: 'pega pix', visible: true },
  { title: 'Lançar Realizado', path: '/dashboard/pega-pix/results', icon: 'Rocket', order: 19, parentId: 'pega pix', visible: true },
  { title: 'Resultado Vendedores', path: '/dashboard/pega-pix/sellers', icon: 'Users', order: 20, parentId: 'pega pix', visible: true },
  { title: 'Resultado por Função', path: '/dashboard/pega-pix/roles-report', icon: 'BriefcaseBusiness', order: 21, parentId: 'pega pix', visible: true },
  { title: 'Resultado por Filial', path: '/dashboard/pega-pix/branches-report', icon: 'GitFork', order: 22, parentId: 'pega pix', visible: true },
  { title: 'Relatório Geral', path: '/dashboard/pega-pix/report', icon: 'BarChart2', order: 23, parentId: 'pega pix', visible: true },

  { title: 'Cálculo de Premiações', path: '/dashboard/awards', icon: 'Award', order: 24, parentId: null, visible: true },
  { title: 'Gerar Ordens de Pagamento', path: '/dashboard/payment-orders', icon: 'DollarSign', order: 25, parentId: null, visible: true },
  
  { title: 'Materiais de Limpeza', icon: 'SprayCan', order: 27, parentId: null, visible: true, path: '#' },
  { title: 'Produtos', path: '/dashboard/cleaning/products', icon: 'List', order: 28, parentId: 'materiais de limpeza', visible: true },
  { title: 'Solicitar', path: '/dashboard/cleaning/request', icon: 'ShoppingCart', order: 29, parentId: 'materiais de limpeza', visible: true },
  { title: 'Histórico', path: '/dashboard/cleaning/history', icon: 'History', order: 30, parentId: 'materiais de limpeza', visible: true },
  
  { title: 'Relatórios', icon: 'AreaChart', order: 31, parentId: null, visible: true, path: '#' },
  { title: 'Relatório Vendedores', path: '/dashboard/reports/sellers', icon: 'Users', order: 32, parentId: 'relatórios', visible: true },
  { title: 'Relatório Filiais', path: '/dashboard/reports/branches', icon: 'GitFork', order: 33, parentId: 'relatórios', visible: true },
  { title: 'Relatório Funções', path: '/dashboard/reports/roles', icon: 'BriefcaseBusiness', order: 34, parentId: 'relatórios', visible: true },
  { title: 'Relatório Geral', path: '/dashboard/reports/general', icon: 'BarChart2', order: 35, parentId: 'relatórios', visible: true },
  { title: 'Relatório de Entregas', path: '/dashboard/delivery-report', icon: 'Truck', order: 35.1, parentId: 'relatórios', visible: true },
  { title: 'Aniversariantes', path: '/dashboard/reports/birthdays', icon: 'Cake', order: 35.15, parentId: 'relatórios', visible: true },
  { title: 'Histórico de Pagamentos (Prêmio)', path: '/dashboard/payment-history-orders-premium', icon: 'History', order: 35.2, parentId: 'relatórios', visible: true },
  
  { title: 'Etiquetas', icon: 'Tag', order: 35.3, parentId: null, visible: true, path: '#' },
  { title: 'Modelos de Etiquetas', path: '/dashboard/label-templates', icon: 'LayoutTemplate', order: 35.4, parentId: 'etiquetas', visible: true },
  { title: 'Imprimir Etiquetas', path: '/dashboard/print-labels', icon: 'Printer', order: 35.5, parentId: 'etiquetas', visible: true },

  { title: 'Estoque', icon: 'Package', order: 36, parentId: null, visible: true, path: '#' },
  { title: 'Consulta de Estoque', path: '/dashboard/stock-consult', icon: 'Search', order: 37, parentId: 'estoque', visible: true },
  { title: 'Ajuste de Estoque', path: '/dashboard/stock-adjustment', icon: 'SlidersHorizontal', order: 38, parentId: 'estoque', visible: true },
  { title: 'Movimentação entre Estoques', path: '/dashboard/stock-movement', icon: 'ArrowRightLeft', order: 39, parentId: 'estoque', visible: true },
  { title: 'Histórico de Movimentações', path: '/dashboard/stock-movement-history', icon: 'History', order: 40, parentId: 'estoque', visible: true },
  { title: 'Solicitar Transferência', path: '/dashboard/transfers/request', icon: 'PlusSquare', order: 41, parentId: 'estoque', visible: true },
  { title: 'Histórico de Transferências', path: '/dashboard/transfers/history', icon: 'History', order: 42, parentId: 'estoque', visible: true },

  { title: 'Compras', icon: 'Truck', order: 43, parentId: null, visible: true, path: '#' },
  { title: 'Nova Compra / Lançamento', path: '/dashboard/purchases/new', icon: 'FilePlus', order: 44, parentId: 'compras', visible: true },
  { title: 'Histórico de Compras', path: '/dashboard/purchases/history', icon: 'History', order: 45, parentId: 'compras', visible: true },
  
  { title: 'Vendas', icon: 'ShoppingCart', order: 45.1, parentId: null, visible: true, path: '#' },
  { title: 'Pedido de Venda', path: '/dashboard/sales/new', icon: 'FilePlus', order: 45.2, parentId: 'vendas', visible: true },
  { title: 'Histórico de Pedidos', path: '/dashboard/sales/history', icon: 'History', order: 45.3, parentId: 'vendas', visible: true },
  { title: 'Extrato de Vendas', path: '/dashboard/sales/extract', icon: 'BarChart2', order: 45.35, parentId: 'vendas', visible: true },
  { title: 'Observações Adicionais', path: '/dashboard/additional-observations', icon: 'FileText', order: 45.36, parentId: 'vendas', visible: true },
  { title: 'Recebimento', path: '/dashboard/recebimento', icon: 'DollarSign', order: 45.4, parentId: 'vendas', visible: true },
  { title: 'Histórico de Recebimentos', path: '/dashboard/payment-history', icon: 'History', order: 45.45, parentId: 'vendas', visible: true },
  { title: 'Liberação de Estorno', path: '/dashboard/reversal-release', icon: 'Undo2', order: 45.46, parentId: 'vendas', visible: true },
  { title: 'Histórico de Estornos', path: '/dashboard/reversal-history', icon: 'History', order: 45.47, parentId: 'vendas', visible: true },
  { title: 'Histórico de Cancelamento', path: '/dashboard/cancellation-history', icon: 'FileX', order: 45.48, parentId: 'vendas', visible: true },
  { title: 'Histórico de Devoluções', path: '/dashboard/returned-history', icon: 'Undo2', order: 45.49, parentId: 'vendas', visible: true },
  { title: 'Permissões de Venda', path: '/dashboard/sales/permissions', icon: 'Shield', order: 45.5, parentId: 'vendas', visible: true },
  { title: 'Controle de Desconto', path: '/dashboard/discount-control', icon: 'Percent', order: 45.6, parentId: 'vendas', visible: true },
  { title: 'Liberação de Desconto', path: '/dashboard/discount-release', icon: 'ShieldCheck', order: 45.7, parentId: 'vendas', visible: true },
  
  { title: 'ASTEC', icon: 'Wrench', order: 45.9, parentId: null, visible: true, path: '#' },
  { title: 'Abrir Chamado', path: '/dashboard/astec/new', icon: 'PlusSquare', order: 45.91, parentId: 'astec', visible: true },
  { title: 'Histórico de Chamados', path: '/dashboard/astec/history', icon: 'History', order: 45.92, parentId: 'astec', visible: true },
  { title: 'Laudos Técnicos', path: '/dashboard/astec/reports', icon: 'FileText', order: 45.93, parentId: 'astec', visible: true },
  
  { title: 'Montagem', icon: 'HardHat', order: 45.94, parentId: null, visible: true, path: '#' },
  { title: 'Montadores', path: '/dashboard/assembly/technicians', icon: 'HardHat', order: 45.95, parentId: 'montagem', visible: true },
  { title: 'Fechamento de Montagem', path: '/dashboard/assembly/closing', icon: 'ClipboardCheck', order: 45.96, parentId: 'montagem', visible: true },
  { title: 'Histórico de Fechamentos', path: '/dashboard/assembly/history', icon: 'History', order: 45.97, parentId: 'montagem', visible: true },

  { title: 'Cadastros', icon: 'Archive', order: 46, parentId: null, visible: true, path: '#' },
  { title: 'Usuários', path: '/dashboard/users', icon: 'Users', order: 47, parentId: 'cadastros', visible: true },
  { title: 'Clientes', path: '/dashboard/customers', icon: 'Contact', order: 48, parentId: 'cadastros', visible: true },
  { title: 'Crédito Cliente', path: '/dashboard/customer-credits', icon: 'BadgeDollarSign', order: 48.5, parentId: 'cadastros', visible: true },
  { title: 'Fornecedores', path: '/dashboard/suppliers', icon: 'Truck', order: 49, parentId: 'cadastros', visible: true },
  { title: 'Ajudantes', path: '/dashboard/delivery-assistants', icon: 'Users', order: 49.5, parentId: 'cadastros', visible: true },
  { title: 'Motoristas', path: '/dashboard/drivers', icon: 'Car', order: 49.6, parentId: 'cadastros', visible: true },
  { title: 'Equipes', path: '/dashboard/teams', icon: 'Users', order: 49.7, parentId: 'cadastros', visible: true },
  { title: 'Vendedores', path: '/dashboard/sellers', icon: 'UserPlus', order: 50, parentId: 'cadastros', visible: true },
  { title: 'Empresas', path: '/dashboard/companies', icon: 'Building2', order: 51, parentId: 'cadastros', visible: true },
  { title: 'Filiais', path: '/dashboard/branches', icon: 'GitFork', order: 52, parentId: 'cadastros', visible: true },
  { title: 'Empresas Filiais', path: '/dashboard/company-branches', icon: 'Building', order: 53, parentId: 'cadastros', visible: true },
  { title: 'Funções', path: '/dashboard/roles', icon: 'BriefcaseBusiness', order: 54, parentId: 'cadastros', visible: true },
  { title: 'Status', path: '/dashboard/status', icon: 'Tags', order: 55, parentId: 'cadastros', visible: true },
  { title: 'Tipos de Entrega', path: '/dashboard/delivery-types', icon: 'Truck', order: 56, parentId: 'cadastros', visible: true },
  { title: 'Operações de Venda', path: '/dashboard/sale-types', icon: 'ShoppingCart', order: 57, parentId: 'cadastros', visible: true },
  { title: 'Formas de Pagamento', path: '/dashboard/payment-methods', icon: 'CreditCard', order: 58, parentId: 'cadastros', visible: true },
  { title: 'Serviços', path: '/dashboard/services', icon: 'Wrench', order: 59, parentId: 'cadastros', visible: true },
  { title: 'Locais de Estocagem', path: '/dashboard/stocking-locations', icon: 'Package', order: 60, parentId: 'cadastros', visible: true },
  { title: 'Categorias de Produto', path: '/dashboard/product-categories', icon: 'FolderTree', order: 61, parentId: 'cadastros', visible: true },
  { title: 'Tipos de Produto', path: '/dashboard/product-types', icon: 'Tag', order: 62, parentId: 'cadastros', visible: true },
  { title: 'Markup', path: '/dashboard/markups', icon: 'Percent', order: 63, parentId: 'cadastros', visible: true },
  { title: 'Marcas', path: '/dashboard/brands', icon: 'Bookmark', order: 64, parentId: 'cadastros', visible: true },
  { title: 'Modalidades de Produto', path: '/dashboard/product-modalities', icon: 'Component', order: 65, parentId: 'cadastros', visible: true },
  { title: 'Produtos', path: '/dashboard/products', icon: 'Package', order: 66, parentId: 'cadastros', visible: true },
  { title: 'Obrigações Fiscais', path: '/dashboard/fiscal-obligations', icon: 'FileText', order: 67, parentId: 'cadastros', visible: true },
  { title: 'Frete por CEP', path: '/dashboard/freight-cep-range', icon: 'Map', order: 68, parentId: 'cadastros', visible: true },
  
  { title: 'Personalização', path: '/dashboard/customization', icon: 'Palette', order: 69, parentId: null, visible: true },
  
  { title: 'Caixa', icon: 'Banknote', order: 70, parentId: null, visible: true, path: '#' },
  { title: 'Conta', path: '/dashboard/caixa/conta', icon: 'UserCog', order: 71, parentId: 'caixa', visible: true },
  { title: 'Caixa', path: '/dashboard/caixa/caixa', icon: 'Store', order: 72, parentId: 'caixa', visible: true },
  { title: 'Histórico de Fechamentos', path: '/dashboard/caixa/history', icon: 'History', order: 72.1, parentId: 'caixa', visible: true },
  { title: 'Autorizações de Fechamento', path: '/dashboard/caixa/authorization', icon: 'ShieldCheck', order: 72.2, parentId: 'caixa', visible: true },
  { title: 'Histórico de Autorizações', path: '/dashboard/caixa/authorization-history', icon: 'FileClock', order: 72.3, parentId: 'caixa', visible: true },

  { title: 'Configurações', icon: 'Settings', order: 73, parentId: null, visible: true, path: '#' },
  { title: 'Definir Acesso', path: '/dashboard/access-control', icon: 'Shield', order: 74, parentId: 'configurações', visible: true },
  { title: 'Log de Acessos', path: '/dashboard/logs', icon: 'FileClock', order: 75, parentId: 'configurações', visible: true },
  { title: 'Confirmação de Leitura', path: '/dashboard/read-confirmation', icon: 'MailCheck', order: 76, parentId: 'configurações', visible: true },
  { title: 'Backup do Sistema', path: '/dashboard/backup', icon: 'Save', order: 76.5, parentId: 'configurações', visible: true },
  { title: 'Privacidade', path: '/dashboard/privacy', icon: 'Shield', order: 77, parentId: 'configurações', visible: true },
  
  { title: 'Imprimir Chamado ASTEC', path: '/dashboard/astec/history/[id]', icon: 'Printer', order: 99, parentId: null, visible: false },
  { title: 'Imprimir Pedido de Venda', path: '/dashboard/sales/history/[id]', icon: 'Printer', order: 99.1, parentId: null, visible: false },
  { title: 'Imprimir Ordem de Pagamento (Entrega)', path: '/dashboard/delivery-payment/history/[id]', icon: 'Printer', order: 99.2, parentId: null, visible: false },
  { title: 'Imprimir Pedido de Limpeza', path: '/dashboard/cleaning/history/[id]', icon: 'Printer', order: 99.3, parentId: null, visible: false },
  { title: 'Imprimir Romaneio', path: '/dashboard/scheduling/print/[date]', icon: 'Printer', order: 99.4, parentId: null, visible: false },
  { title: 'Imprimir Romaneio ASTEC', path: '/dashboard/scheduling/print-astec/[date]', icon: 'Printer', order: 99.5, parentId: null, visible: false },
  { title: 'Imprimir Ordem de Pagamento (Prêmio)', path: '/dashboard/payment-history-orders-premium/[id]', icon: 'Printer', order: 99.6, parentId: null, visible: false },
  { title: 'Imprimir Pedido de Transferência', path: '/dashboard/transfers/history/[id]', icon: 'Printer', order: 99.7, parentId: null, visible: false },
  { title: 'Imprimir Ordem de Pagamento (Equipe)', path: '/dashboard/delivery-payment-team/history/[id]', icon: 'Printer', order: 99.8, parentId: null, visible: false },
  { title: 'Imprimir Fechamento de Montagem', path: '/dashboard/assembly/history/[id]', icon: 'Printer', order: 99.9, parentId: null, visible: false },
];

export async function seedNavigation() {
  const navCollection = collection(db, "navigation");
  const snapshot = await getDocs(navCollection);

  if (snapshot.empty) {
      const batch = writeBatch(db);

      const parentItems: { [key: string]: string } = {};

      initialNavigationItems.forEach(item => {
        let docId = item.title.toLowerCase().replace(/\s+/g, '-');
        if (item.path && item.path !== '#') {
            docId = item.path.replace('/dashboard/', '').replace(/\//g, '-');
        }

        const parentIdMap: Record<string, string> = {
          'agendamento': 'agendamento-parent',
          'relatórios': 'relatorios-parent',
          'cadastros': 'cadastros-parent',
          'configurações': 'configuracoes-parent',
          'pega pix': 'pega-pix-parent',
          'materiais de limpeza': 'materiais-de-limpeza-parent',
          'estoque': 'estoque-parent',
          'compras': 'compras-parent',
          'vendas': 'vendas-parent',
          'caixa': 'caixa-parent',
          'astec': 'astec-parent',
          'lançar-realizado': 'lancar-realizado-parent',
          'montagem': 'montagem-parent',
          'etiquetas': 'etiquetas-parent',
        };

        if (item.parentId === null && item.path ==='#') {
          parentItems[item.title.toLowerCase().replace(/\s+/g, '-')] = parentIdMap[item.title.toLowerCase().replace(/\s+/g, '-')] || docId;
        }
        
        const finalParentId = item.parentId ? parentIdMap[item.parentId] : null;
        
        const finalDocId = parentIdMap[docId] || docId;

        const docRef = doc(db, "navigation", finalDocId);
        batch.set(docRef, { ...item, parentId: finalParentId, id: finalDocId });
      });

      try {
        await batch.commit();
        console.log("Coleção 'navigation' populada com sucesso com dados iniciais.");
      } catch (error) {
        console.error("Erro ao popular a coleção 'navigation':", error);
      }
  }
}
