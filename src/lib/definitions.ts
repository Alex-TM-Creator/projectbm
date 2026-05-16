
export type Company = {
  id: string;
  name: string;
};

export type Branch = {
  id: string;
  name: string;
  companyId?: string; // Optional: To link a branch to a company
};

export type CompanyBranch = {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  cidade: string; // municipio
  uf: string;
  telefone: string;
  branchId: string; // Link to the existing Branch collection
  certificateFileName?: string;
  certificatePassword?: string;
  certificateUrl?: string;
  certificateExpiresAt?: string;
  logoUrl?: string;
};

export type Role = {
  id: string;
  name: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  companyBranchId: string;
  branchId: string;
  roleId: string;
  isAdmin: boolean;
  avatarUrl: string;
  disabled?: boolean;
  notes?: { [periodGroupId: string]: string };
};

export type Seller = User & {
  roleName: string;
};

export type ValueType = 'currency' | 'percentage';

export type GoalType = {
  id: string;
  name: string;
  order: number;
  valueType: ValueType;
  awardTypeIds?: string[];
};

export type NavigationItem = {
  id: string;
  title: string;
  path?: string;
  icon: string;
  order: number;
  parentId: string | null;
  visible: boolean;
};

export type RoleAccess = {
  id: string; // Should be the same as the roleId
  roleId: string;
  allowedNavIds: string[];
  homePagePath?: string;
}

export type Period = {
  id: string;
  name: string; // ex: "Janeiro 2024"
  startDate: string;
  endDate: string;
  isLocked?: boolean;
}

export type PeriodGroup = {
  id: string;
  name: string; // ex: "Primeiro Trimestre 2024"
  periods: Period[];
  autoSyncEnabled?: boolean;
}

export type GoalLevelTargets = {
  Bronze: number;
  Prata: number;
  Ouro: number;
  Diamante: number;
}

export type Goal = {
  id: string;
  name: string;
  goalTypeId: string;
  periodId: string; // References a single period within a group
  periodGroupId: string;
  userId: string;
  companyBranchId: string;
  branchId: string;
  roleId: string;
  hasLevels: boolean;
  targetValue?: number; // For single-level goals
  levelTargets?: GoalLevelTargets; // For multi-level goals
  realizado?: number; // Achieved value
}

// Definição para a nova Meta Pega Pix
export type PegaPixGoal = {
  id: string;
  name: string;
  periodGroupId: string;
  responsibleId: string;
  responsibleType: 'user' | 'branch' | 'role';
  levels: GoalLevelTargets;
  realizado: number;
  createdAt: any; // Firestore Timestamp
};

export type PegaPixAward = {
  id: string;
  name: string;
  levels: GoalLevelTargets; // Stores the award value for each level
  responsibleIds: string[];
  responsibleType: 'user' | 'branch' | 'role';
  createdAt: any; // Firestore Timestamp
}


export type AwardLevel = {
  name: 'Bronze' | 'Prata' | 'Ouro' | 'Diamante';
  value: number;
}

export type SalesRange = {
  id: string;
  from: number;
  to: number;
  value: number; // Can be percentage or fixed value
}

export type AwardTypeOption = 'fixedBonusByLevel' | 'percentageByLevel' | 'salesRangeBonus' | 'fixedBonusBySalesRange' | 'freightConversionBonus' | 'bonusByCumulativeLevel';
export type AwardTypeCategory = 'bonus' | 'award';
export type FreightTargetType = 'percentage' | 'currency';


export type AwardType = {
  id: string;
  name: string;
  description: string;
  type: AwardTypeOption;
  category: AwardTypeCategory;
  levels: AwardLevel[];
  ranges: SalesRange[];
  roleId?: string;
  roleIds?: string[];
  branchId?: string;
  goalTypeIds?: string[];
  // For freightConversionBonus
  freightTargetType?: FreightTargetType;
  freightTargetValue?: number;
  freightCommissionType?: FreightTargetType;
  commissionPercentage?: number;
  // For bonusByCumulativeLevel
  cumulativeLevelTarget?: AwardLevel['name'];
  cumulativeOccurrences?: number;
  cumulativeBonusValue?: number;
}

export type PeriodValues = {
  [periodId: string]: {
    targetValue?: number;
    levelTargets?: GoalLevelTargets;
  }
}

// Used in the Goal creation form
export type GoalSetting = {
  goalTypeId: string;
  hasLevels: boolean;
  periodValues: PeriodValues;
};

export type PaymentOrder = {
  id: string;
  responsibleId: string;
  responsibleType: 'user' | 'branch' | 'role';
  responsibleName: string;
  periodGroupId: string;
  periodGroupName: string;
  amount: number;
  baseAward: number;
  extraBonus: number;
  discount: number;
  status: 'pending' | 'paid' | 'cancelled';
  generatedAt: string;
  paidAt?: string;
  notes?: string;
};

export type DeliveryPaymentOrderItem = {
  itemId: string; // SalesOrder ID or AssistanceRequest ID
  type: 'Pedido' | 'ASTEC';
  number: number;
  date: string;
  baseFreight: number;
  finalFreight: number;
};

export type DeliveryPaymentOrder = {
  id: string;
  driverId: string;
  driverName: string;
  periodStartDate: string;
  periodEndDate: string;
  totalAmount: number;
  items: DeliveryPaymentOrderItem[];
  status: 'pending' | 'paid';
  generatedAt: string;
  paidAt?: string;
};

export type DeliveryTeamPaymentOrderResult = {
  id: string;
  name: string;
  type: 'Motorista' | 'Ajudante';
  participations: number;
  amountToReceive: number;
};

export type DeliveryTeamPaymentOrder = {
  id: string;
  periodStartDate: string;
  periodEndDate: string;
  companyCommission: number;
  totalServiceValue: number;
  totalDistributed: number;
  results: DeliveryTeamPaymentOrderResult[];
  createdAt: any; // Firestore Timestamp
  status: 'pending' | 'paid';
  paidAt?: any; // Firestore Timestamp
};


export type CampaignMedia = {
  url: string;
  type: string;
};

export type Campaign = {
  id: string;
  title: string;
  text: string;
  media: CampaignMedia[];
  createdAt: any; // Firestore Timestamp
  startDate?: string;
  endDate?: string;
  targetRoleIds?: string[];
  allowDownload?: boolean;
};

export type Notification = {
  id: string;
  title: string;
  text: string;
  createdAt: any; // Firestore Timestamp
  startDate?: string;
  endDate?: string;
  targetRoleIds?: string[];
  link?: string;
  showOnEveryLogin?: boolean;
  callToAction?: string;
};

export type NotificationRead = {
  id: string;
  notificationId: string;
  userId: string;
  userName: string;
  readAt: any; // Firestore Timestamp
}

export type AccessLog = {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  path: string;
  timestamp: any; // Firestore Timestamp
};

export type PeriodTarget = {
  isLevelGoal: boolean;
  targetValue: number;
  levelTargets: GoalLevelTargets;
}

export type GoalFormData = {
  responsibleType: 'branch' | 'user' | 'role';
  responsibleId: string;
  periodGroupId: string;
  goalTypeId: string;
  periodTargets: Record<string, PeriodTarget>;
};

export type LoginConfiguration = {
  id: 'loginConfiguration';
  logoUrl: string;
};

export type UploadLogoInput = {
  fileDataUri: string;
  contentType: string;
};

export type GoalAlertTriggerType = 'percentage' | 'level';
export type GoalAlertTargetType = 'general' | 'user' | 'branch' | 'role';


export type GoalAlert = {
  id: string;
  name: string;
  goalTypeIds: string[];
  targetType: GoalAlertTargetType;
  userIds?: string[];
  branchIds?: string[];
  roleIds?: string[];
  message: string;
  showOnLogin: boolean;
  createdAt: any; // Firestore Timestamp
  triggerType: GoalAlertTriggerType;
  triggerValue: number | keyof GoalLevelTargets;
};

// Types for Cleaning Materials Management
export type CleaningProduct = {
  id: string;
  name: string;
  price: number;
  price2?: number;
  price3?: number;
};

export type CleaningRequestItem = {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  price2?: number;
  price3?: number;
};

export type CleaningRequest = {
  id: string;
  userId: string;
  userName: string;
  branchId: string;
  branchName: string;
  items: CleaningRequestItem[];
  totalValue: number;
  createdAt: any; // Firestore Timestamp
  statusId?: string;
};

export type Status = {
  id: string;
  name: string;
  color?: string; // Hex color code e.g., "#RRGGBB"
  shouldNotify?: boolean;
};

export type PriceColumnConfig = {
  id: 'priceColumnConfig'; // Singleton document
  price1CompanyId?: string | null;
  price2CompanyId?: string | null;
  price3CompanyId?: string | null;
};

export type GlobalObservations = {
  id: 'globalObservations';
  text: string;
};

export type Phone = {
  id: string;
  type: 'celular' | 'fixo' | 'comercial';
  number: string;
}

export type Address = {
  id: string;
  type: 'Residencial' | 'Comercial' | 'Entrega' | 'Cobrança';
  cep: string;
  address: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  residenceType?: 'Casa' | 'Apartamento' | 'Sobrado' | 'Outro';
}

export type Customer = {
  id: string;
  type: 'fisica' | 'juridica';
  name: string;
  cpf?: string;
  cnpj?: string;
  inscricaoEstadual?: string;
  razaoSocial?: string;
  birthDate?: string;
  email?: string;
  phones: Phone[];
  addresses: Address[];
  createdAt: any;
  branchId: string;
  createdById: string;
  createdByName: string;
}

export type CustomerCredit = {
  id: string;
  customerId: string;
  customerName: string;
  creditAmount: number;
  usedAmount: number;
  balance: number;
  notes?: string;
  orderNumber?: number; // New field
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  createdBy: string;
}

export type CustomerCreditMovement = {
  id: string;
  customerId: string;
  type: 'addition' | 'removal' | 'consume' | 'refund' | 'adjustment';
  amount: number;
  reason: string;
  relatedDocId?: string; // Pedido ID
  createdAt: any;
  userId: string;
  userName: string;
}

export type Supplier = {
  id: string;
  type: 'fisica' | 'juridica';
  name: string;
  cpf?: string;
  cnpj?: string;
  inscricaoEstadual?: string;
  razaoSocial?: string;
  birthDate?: string;
  email?: string;
  phones: Phone[];
  cep: string;
  address: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  createdAt: any;
  branchId: string;
  createdById: string;
  createdByName: string;
}

export type DeliveryAssistant = {
  id: string;
  name: string;
  phone?: string;
  isActive?: boolean;
  userId?: string | null;
};

export type DriverDiscount = {
  id: string;
  name: string;
  type: 'fixed' | 'percentage';
  value: number;
}

export type Driver = {
  id: string;
  name: string;
  phone?: string;
  isActive?: boolean;
  discounts?: DriverDiscount[];
  userId?: string | null;
};

export type Team = {
  id: string;
  name: string;
  driverId: string;
  driverName?: string;
  assistantIds: string[];
  assistantNames?: string[];
  createdAt: any; // Firestore Timestamp
};

export type DeliveryType = {
  id: string;
  name: string;
  order: number;
};

export type SaleType = {
  id: string;
  name: string;
  order: number;
  countsTowardsMercantilGoal?: boolean;
  countsTowardsFreightGoal?: boolean;
  countsTowardsServiceGoal?: boolean;
  roleIds?: string[];
  branchIds?: string[];
  consolidateToRoleIds?: string[] | null;
};

export type PaymentMethod = {
  id: string;
  name: string;
  receivingTerm: number; // Prazo de recebimento em dias
  installments: number; // Quantidade de parcelas
  order: number;
  installmentIntervalDays?: number;
  keepSameDay?: boolean;
  isGrouped?: boolean;
  interestRates?: number[];
  isCustomerCredit?: boolean;
};

export type Service = {
  id: string;
  name: string;
  priceType: 'fixed' | 'range';
  price?: number;
  minPrice?: number;
  maxPrice?: number;
  allowDiscount: boolean;
  order: number;
};

export type StockingLocation = {
  id: string;
  name: string;
  branchId: string;
  isVisibleInOrigin: boolean;
  isVisibleToOtherBranches: boolean;
  visibleToRoleIds?: string[];
  order: number;
  isActive?: boolean;
  allowNegativeStock?: boolean;
};

export type ProductCategory = {
  id: string;
  name: string;
  level: 'category' | 'group' | 'subgroup';
  parentId: string | null;
  order: number;
};

export type ProductType = {
  id: string;
  name: string;
  abbreviation: string;
  order: number;
};

export type ProductModality = {
  id: string;
  name: string;
  order: number;
};

export type Markup = {
  id: string;
  name: string;
  percentage: number;
};

export type Brand = {
  id: string;
  name: string;
  order: number;
};

export type Lot = {
  id: string;
  lotNumber: string;
  registrationDate: string;
  type: 'compra' | 'ajuste';
  lotValue?: number;
  createdAt: any;
  createdById: string;
  createdByName: string;
};

export type Product = {
  id: string;
  internalCode?: string;
  barcode?: string;
  name: string;
  brandId: string;
  productCategoryId: string;
  productTypeId: string;
  unitOfMeasure: string; // UN, KG, MT, etc.
  volumeQuantity?: number;
  costPrice: number;
  freightType?: 'percentage' | 'fixed';
  freightValue?: number;
  salePrice: number;
  markupId: string;
  isActive?: boolean;
  keywords?: string[]; // Para busca indexada
  // Fiscal Data
  ncm: string;
  cest: string;
  cfop: string;
  cst: string;
  origin: string;
  icms: number;
  ipi: number;
  pis: number;
  cofins: number;
};

export type ProductStock = {
  id: string;
  productId: string;
  stockingLocationId: string;
  quantity: number;
  minimumQuantity?: number;
  maximumQuantity?: number;
};

export type StockMovement = {
  id: string;
  productId: string;
  stockingLocationId: string;
  type: 'sale' | 'purchase' | 'return' | 'transfer' | 'inventory_adjustment';
  quantityChange: number; // Positive for increase, negative for decrease
  reason?: string; // e.g., 'Perda', 'Roubo', 'Quebra'
  relatedDocId?: string; // e.g., saleId, purchaseId, transferId
  lotId?: string;
  valueChange?: number; // Valor financeiro associado (ex: subtotal da venda)
  createdAt: any; // Firestore Timestamp
  userId: string;
  userName: string;
};

export type TransferOrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  receivedQuantity?: number;
};

export type TransferOrder = {
  id: string;
  originBranchId: string;
  destinationBranchId: string;
  status: 'pending' | 'separating' | 'in_transit' | 'received' | 'received_partially' | 'returned' | 'cancelled';
  items: TransferOrderItem[];
  requesterId: string;
  requesterName: string;
  createdAt: any; // Firestore timestamp
  shippedAt?: any;
  shippedByUserId?: string;
  shippedByName?: string;
  receivedAt?: any;
  receivedByUserId?: string;
  receivedByName?: string;
  updatedByUserId?: string; // For other status changes like 'separating' or 'cancelled'
  updatedByName?: string;
  notes?: string;
};

export type FiscalObligation = {
  id: string;
  name: string;
  description?: string;
  dueDate: string; // ISO string format
  status: 'pending' | 'completed';
  createdAt: any; // Firestore Timestamp
};

export type TransferSuggestion = {
  productId: string;
  productName: string;
  fromLocationId: string;
  fromBranchId: string;
  toLocationId: string;
  toBranchId: string;
  quantityToTransfer: number;
  excessQuantity: number;
  shortageQuantity: number;
};

export type PurchaseOrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  costPrice: number;
};

export type PurchaseOrder = {
  id: string;
  supplierId: string;
  supplierName: string;
  destinationBranchId: string;
  destinationLocationId: string;
  items: PurchaseOrderItem[];
  totalValue: number;
  status: 'pending' | 'completed';
  nfeXml?: string; // URL to the XML file in storage
  lotId?: string | null;
  createdAt: any; // Firestore Timestamp
  createdByUserId: string;
  createdByUserName: string;
};

// Tipos para Pedido de Venda
export type SalesOrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  total: number;
  originStockingLocationId: string;
  lotId?: string; // ID do lote de origem
  productModalityId?: string;
  deliveryOption?: 'Entregar' | 'Retirado';
};

export type SalesOrderService = {
  serviceId: string;
  serviceName: string;
  price: number;
};

export type Installment = {
  number: number;
  dueDate: string;
  value: number;
  paid: boolean;
  paidAt?: any; // Can be string (old) or Firestore Timestamp (new)
  paidByUserId?: string;
  paidInCaixaId?: string;
  reversalStatus?: 'reversal_pending' | 'reversal_approved' | 'reversal_denied';
}

export type SalesOrderPayment = {
  id: string;
  paymentMethodId: string;
  value: number;
  installments: Installment[];
  numInstallments?: number; // Temporary field for UI
};

export type DeliveryStatus = 'pending' | 'concluido' | 'reagendado' | 'rejeitado';

export type SalesOrder = {
  id: string;
  orderNumber: number;
  status: 'pending' | 'billed' | 'cancelled' | 'awaiting_approval' | 'returned';
  saleTypeId: string;
  deliveryTypeId: string;
  deliveryDate?: string;
  deliveryStatus?: DeliveryStatus;
  rejectionReason?: string;
  customerId: string;
  customerName: string;
  companyBranchId?: string;
  deliveryAddress?: Address;
  deliveryPhone?: Phone;
  items: SalesOrderItem[];
  services: SalesOrderService[];
  subtotal: number;
  freightValue: number;
  generalDiscountType: 'percentage' | 'fixed';
  generalDiscountValue: number;
  total: number;
  payments: SalesOrderPayment[];
  observations?: string;
  extraObservations?: string;
  createdAt: any;
  cancelledAt?: any;
  returnedAt?: any;
  createdByUserId: string;
  createdByUserName: string;
  extraBonus?: number;
  extraDiscount?: number;
  driverId?: string;
  driverName?: string;
  assistantIds?: string[];
  assistantNames?: string[];
  returnedItemsValue?: number;
  returnedFreightValue?: number;
  returnedServicesValue?: number;
};

export type SalesPermissions = {
  viewAllOrders?: {
    userIds: string[];
    roleIds: string[];
  };
  canViewOwnOrders?: {
    userIds: string[];
    roleIds: string[];
    allowEditingOwn?: boolean;
  };
  viewBranchOrders?: {
    users: { [userId: string]: string[] }; // userId -> branchId[]
    roles: { [roleId: string]: string[] }; // roleId -> branchId[]
  };
  canReleaseDiscount?: {
    userIds: string[];
    roleIds: string[];
  };
  viewAllPayments?: {
    userIds: string[];
    roleIds: string[];
  };
  viewBranchPayments?: {
    userIds: string[];
    roleIds: string[];
  };
  canReleaseReversal?: {
    userIds: string[];
    roleIds: string[];
  };
  canApplyGeneralDiscount?: {
    userIds: string[];
    roleIds: string[];
  };
};


// Tipos para Controle de Desconto
export type DiscountLimit = {
  id: string; // roleId
  maxDiscountPercentage: number;
};

export type DiscountApproval = {
  id: string; // Auto-gerado
  orderId: string;
  orderNumber: number;
  customerName: string;
  sellerName: string;
  totalDiscountPercentage: number;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: any; // Firestore Timestamp
  releasedBy?: string;
  releasedAt?: any;
  releaseNotes?: string;
};

export type FreightCepRange = {
  id: string;
  name: string;
  cepStart: string;
  cepEnd: string;
  value: number;
};

export type CaixaTransaction = {
  id: string;
  type: 'cancellation_reversal' | 'sangria' | 'suprimento';
  value: number; // Will be negative for reversals and sangrias
  relatedDocId?: string; // e.g., salesOrderId
  paymentMethodName?: string; // New field
  timestamp: string; // ISO string
  notes?: string;
}

// Tipos para o Caixa
export type CaixaConta = {
  id: string;
  userId: string;
  userName: string;
  branchId: string;
};

export type Caixa = {
  id: string;
  userId: string;
  userName: string;
  branchId: string;
  openingBalance: number;
  closingBalance?: number;
  confirmedBalance?: number; // New field
  difference?: number; // New field
  closingNotes?: string; // New field
  openedAt: any; // Firestore Timestamp
  closedAt?: any; // Firestore Timestamp
  status: 'open' | 'closed';
  transactions?: CaixaTransaction[];
};

export type ClosingAuthorizationRequest = {
  id: string;
  caixaId: string;
  userId: string;
  userName: string;
  branchId: string;
  branchName: string;
  expectedAmount: number;
  confirmedAmount: number;
  difference: number;
  details: {
    paymentMethod: string;
    expected: number;
    confirmed: number;
  }[];
  justification: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: any; // Firestore Timestamp
  processedByUserId?: string;
  processedByUserName?: string;
  processedAt?: any; // Firestore Timestamp
}

// Tipos para Estorno
export type ReversalRequestItem = {
  orderId: string;
  paymentId: string;
  installmentNumber: number;
  value: number;
};

export type ReversalRequest = {
  id: string;
  items: ReversalRequestItem[];
  totalValue: number;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  requestedByUserId: string;
  requestedByUserName: string;
  requestedAt: any; // Firestore Timestamp
  processedByUserId?: string;
  processedByUserName?: string;
  processedAt?: any;
};

export type AssistanceRequestItem = {
  productId: string;
  productName: string;
};

export type AssistanceRequest = {
  id: string;
  orderId: string;
  orderNumber: number;
  assistanceNumber?: number;
  customerId: string;
  customerName: string;
  branchId?: string; // Add this
  branchName: string;
  deliveryAddress?: Address;
  customer?: Customer; // To be populated client-side
  items: AssistanceRequestItem[];
  problemDescription: string;
  status: 'pending' | 'in_progress' | 'finished' | 'cancelled';
  createdAt: any;
  createdByUserId: string;
  createdByUserName: string;
  updatedAt?: any;
  scheduledDate?: string;
  driverId?: string;
  driverName?: string;
  assistantIds?: string[];
  assistantNames?: string[];
  freightValue?: number; // Add this line
};

export type AstecLaudo = {
  id: string;
  astecId: string;
  orderNumber: number;
  customerName: string;
  productName: string;
  problemReported: string;
  technicalAnalysis: string;
  solution: string;
  status: 'Pendente' | 'Aprovado' | 'Reprovado';
  createdAt: any; // Firestore Timestamp
  createdByUserId: string;
  createdByUserName: string;
}

export type AssemblerCommissionThreshold = {
  id: string;
  from: number;
  to: number;
};

export type AssemblerSalesRange = {
  id: string;
  from: number;
  to: number;
  bonusType: 'fixed' | 'percentage';
  bonusValue: number;
};

export type AssemblerProductTypeCommission = {
  productTypeId: string;
  productTypeName: string;
  commissionPercentage: number;
};

export type AssemblerAutomaticDiscount = {
  productTypeId: string;
  productTypeName: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
};

export type Montador = {
  id: string;
  name: string;
  userId: string | null;
  isActive: boolean;
  salesRanges: AssemblerSalesRange[];
  productTypeCommissions: AssemblerProductTypeCommission[];
  commissionThresholds?: AssemblerCommissionThreshold[];
  automaticDiscounts?: AssemblerAutomaticDiscount[];
  createdAt: any; // Firestore Timestamp
};

export type AssemblyClosingItem = {
  productId: string;
  productName: string;
  internalCode?: string;
  quantity: number;
  unitPrice: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  total: number;
  productTypeId: string;
};

export type AssemblyClosing = {
  id: string;
  montadorId: string;
  montadorName: string;
  closingDate: string;
  items: AssemblyClosingItem[];
  observations: string;
  subtotalProducts: number;
  subtotalAssistance: number;
  totalGeral: number;
  totalDescontos: number;
  totalFinal: number;
  totalNovo: number;
  totalSalvado: number;
  comissaoAplicada: boolean;
  comissaoNovo: number;
  comissaoSalvado: number;
  totalComissao: number;
  bonus: number;
  totalPremio: number;
  createdAt: any;
  createdByUserId: string;
  createdByUserName: string;
  status: 'pending' | 'paid';
  paidAt?: any;
};

export type LabelFieldKey =
  | 'name'
  | 'internalCode'
  | 'barcode'
  | 'qrcode'
  | 'salePrice'
  | 'volumeCount'
  | 'orderNumber'
  | 'customerName'
  | 'deliveryAddress'
  | 'customText';

export type LabelField = {
  id: string; // To use as a key in React
  key: LabelFieldKey;
  label: string; // To display in the editor
  x: number; // position in mm
  y: number; // position in mm
  fontSize: number; // in pt
  fontWeight: 'normal' | 'bold';
  size?: number; // in mm, for QR codes, barcodes, etc.
  maxWidth?: number; // in mm, max width before text wrapping
  customTextValue?: string; // value for free text fields
};

export type LabelTemplate = {
  id: string;
  name: string;
  width: number; // in mm
  height: number; // in mm
  fields: LabelField[];
  createdAt: any;
};
export type RegraICMS = {
  id: string;
  estados: string[];
  produtos: {
    tipo: 'NCM' | 'Produto' | 'Grupo de Produtos';
    valor: string;
  }[];
  cfop: string;
  aliquota: number;
  base: number;
  situacaoTributaria: string;
  // Novos campos detalhados
  presumido?: number;
  fcp?: number;
  modalidadeBC: string;
  codBeneficioUF?: string;
  codCreditoPresumido?: string;
  codBeneficioRBC?: string;
  motivoDesoneracao?: string;
  deducaoDesonerado?: boolean;
  // Substituição Tributária
  modalidadeBCST?: string;
  aliquotaST?: number;
  baseST?: number;
  mvaST?: number;
  pisST?: number;
  cofinsST?: number;
  // Substituição tributária retida anteriormente
  aliquotaRetida?: number;
  // ICMS partilha
  partilhaTipo?: string;
  partilhaBase?: number;
  partilhaAliqDestino?: number;
  partilhaAliqFCP?: number;
  // Informações adicionais da regra
  infoComplementares?: string;
  infoFisco?: string;
};

export type RegraIPI = {
  id: string;
  estados: string[];
  produtos: {
    tipo: 'NCM' | 'Produto' | 'Grupo de Produtos';
    valor: string;
  }[];
  situacaoTributaria: string;
  cfop?: string;
  aliquota: number;
  base: number;
  codEnquadramento: string;
  infoComplementares?: string;
  infoFisco?: string;
};

export type RegraPIS = {
  id: string;
  estados: string[];
  produtos: {
    tipo: 'NCM' | 'Produto' | 'Grupo de Produtos';
    valor: string;
  }[];
  cfop?: string;
  situacaoTributaria: string;
  aliquota: number;
  base: number;
  infoComplementares?: string;
  infoFisco?: string;
};

export type RegraCOFINS = RegraPIS;

export type RegraII = {
  id: string;
  estados: string[];
  produtos: {
    tipo: 'NCM' | 'Produto' | 'Grupo de Produtos';
    valor: string;
  }[];
  situacaoTributaria: string;
  aliquota: number;
  base: number;
  infoComplementares?: string;
  infoFisco?: string;
};

export type RegraISSQN = {
  id: string;
  estados: string[];
  produtos: {
    tipo: 'NCM' | 'Produto' | 'Grupo de Produtos';
    valor: string;
  }[];
  situacaoTributaria: string;
  aliquota: number;
  base: number;
  descontarISS: boolean;
  reterISS: boolean;
  infoComplementares?: string;
  infoFisco?: string;
};

export type RegraIS = {
  id: string;
  estados: string[];
  produtos: {
    tipo: 'NCM' | 'Produto' | 'Grupo de Produtos';
    valor: string;
  }[];
  situacaoTributaria: string;
  aliquota: number;
  base: number;
  unidadeMedida?: string;
  aliqUnidade?: number;
  infoComplementares?: string;
  infoFisco?: string;
};

export type RegraCBS = {
  id: string;
  estados: string[];
  produtos: {
    tipo: 'NCM' | 'Produto' | 'Grupo de Produtos';
    valor: string;
  }[];
  situacaoTributaria: string;
  codClassificacao?: string;
  aliquota: number;
  base: number;
  redAliq?: number;
  aliqEfet?: number;
  percDiferimento?: number;
  aliqAdRem?: number;
  aliqAdRemRet?: number;
  aliqAdRemRetAnt?: number;
  percDifMonofasico?: number;
  aliqIBSUF?: number;
  aliqIBSMun?: number;
  redAliqIBSUF?: number;
  aliqEfetIBSUF?: number;
  redAliqIBSMun?: number;
  aliqEfetIBSMun?: number;
  percDifIBSUF?: number;
  percDifIBSMun?: number;
  infoComplementares?: string;
  infoFisco?: string;
};

export type RegraIBS = RegraCBS;

export type NaturezaOperacao = {
  id: string;
  descricao: string;
  serie: string;
  tipo: 'Entrada' | 'Saída';
  regimeTributario: string;
  indicadorPresenca: string;
  isFaturada: boolean;
  isConsumidorFinal: boolean;
  isDevolucao: boolean;
  atualizarPrecoCompra: boolean;
  regrasICMS: RegraICMS[];
  regrasIPI: RegraIPI[];
  incluirFreteBaseIPI?: boolean;
  regrasPIS: RegraPIS[];
  regrasCOFINS: RegraCOFINS[];
  regrasII: RegraII[];
  regrasISSQN: RegraISSQN[];
  regrasIS: RegraIS[];
  regrasCBS: RegraCBS[];
  regrasIBS: RegraIBS[];
  // Novos campos aba Outros
  presumidoPisCofins?: boolean;
  somarIcms?: boolean;
  somarOutrasDespesas?: boolean;
  aliqFunrural?: number;
  compraProdutorRural?: boolean;
  descontarFunrural?: boolean;
  tipoAproxTrib?: 'Alíquota Tabela' | 'Alíquota fixa' | 'Alíquota no produto';
  tipoDesconto?: 'Condicional' | 'Incondicional';
  // Novos campos aba Retenções
  possuiCSRF?: boolean;
  aliqCSRF?: number;
  possuiIR?: boolean;
  aliqIR?: number;
  infoComplementares?: string;
  infoFisco?: string;
  branchId: string;
  createdAt: any;
};
