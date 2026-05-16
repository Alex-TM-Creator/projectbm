"use client";

import * as React from "react";
import { collection, getDocs, query, doc, writeBatch, orderBy as firestoreOrderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Goal, GoalType, PeriodGroup, SalesOrder, SaleType, Service, Branch, CompanyBranch, User as UserType } from "@/lib/definitions";
import { isWithinInterval, parseISO } from "date-fns";
import { getGroupStatus, getPeriodStatus } from "@/lib/period-helpers";

// ─── Types ────────────────────────────────────────────────────────────────────
export type AutoSyncInterval = 5 | 10 | 30;

export type AutoSyncConfig = {
  enabled: boolean;
  intervalMinutes: AutoSyncInterval;
};

type AutoSyncContextType = {
  config: AutoSyncConfig;
  setConfig: (config: AutoSyncConfig) => void;
  lastSyncAt: Date | null;
  isSyncing: boolean;
  triggerNow: () => Promise<void>;
};

const DEFAULT_CONFIG: AutoSyncConfig = {
  enabled: false,
  intervalMinutes: 10,
};

const LS_KEY = "realizadoAutoSync";

// ─── Context ──────────────────────────────────────────────────────────────────
const AutoSyncContext = React.createContext<AutoSyncContextType>({
  config: DEFAULT_CONFIG,
  setConfig: () => {},
  lastSyncAt: null,
  isSyncing: false,
  triggerNow: async () => {},
});

export const useRealizadoAutoSync = () => React.useContext(AutoSyncContext);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function loadConfig(): AutoSyncConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as AutoSyncConfig;
  } catch {}
  return DEFAULT_CONFIG;
}

function saveConfig(cfg: AutoSyncConfig) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  } catch {}
}

const calculateNetReceived = (order: SalesOrder): number => {
  const paidInstallments = (order.payments || []).flatMap(p => p.installments || []).filter(inst => inst.paid);
  if (paidInstallments.length === 0) return 0;
  const totalPaid = paidInstallments.reduce((acc, inst) => acc + inst.value, 0);
  const paidRatio = order.total > 0 ? totalPaid / order.total : 0;
  const proportionalFreight = (order.freightValue || 0) * paidRatio;
  const proportionalServices = (order.services || []).reduce((sum, service) => sum + (service.price * paidRatio), 0);
  return totalPaid - proportionalFreight - proportionalServices;
};

const calculateReversals = (order: SalesOrder): number => {
  if (order.status !== 'cancelled' && order.status !== 'returned') return 0;
  const paidInstallments = (order.payments || []).flatMap(p => p.installments || []).filter(inst => inst.paid);
  if (paidInstallments.length === 0) return 0;
  const totalPaid = paidInstallments.reduce((acc, inst) => acc + inst.value, 0);
  const paidRatio = order.total > 0 ? totalPaid / order.total : 0;
  const proportionalFreight = (order.freightValue || 0) * paidRatio;
  const proportionalServices = (order.services || []).reduce((sum, service) => sum + (service.price * paidRatio), 0);
  return totalPaid - proportionalFreight - proportionalServices;
};

async function runAutoSync(): Promise<boolean> {
  const [
    goalsSnap, goalTypesSnap, periodsSnap, usersSnap, 
    branchesSnap, companyBranchesSnap, 
    saleTypesSnap, salesOrdersSnap, servicesSnap
  ] = await Promise.all([
    getDocs(collection(db, "goals")),
    getDocs(query(collection(db, "goaltypes"), firestoreOrderBy("order"))),
    getDocs(collection(db, "periodgroups")),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "branches")),
    getDocs(collection(db, "companyBranches")),
    getDocs(collection(db, "saleTypes")),
    getDocs(collection(db, "salesOrders")),
    getDocs(collection(db, "services")),
  ]);

  const goals = goalsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Goal);
  const goalTypes = goalTypesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as GoalType);
  const periodGroups = periodsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as PeriodGroup);
  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }) as UserType);
  const branches = branchesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Branch);
  const companyBranches = companyBranchesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as CompanyBranch);
  const saleTypes = saleTypesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as SaleType);
  const salesOrders = salesOrdersSnap.docs.map(d => ({ id: d.id, ...d.data() }) as SalesOrder);
  const services = servicesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Service);

  const batch = writeBatch(db);
  let count = 0;

  // Filtrar apenas metas em períodos Ativos ou Agendados E com sincronização ativa por grupo
  const activePeriodGroups = periodGroups.filter(g => {
    const status = getGroupStatus(g).text;
    const isVigente = status === "Ativo" || status === "Agendado";
    return isVigente && g.autoSyncEnabled === true;
  });
  const activePeriodGroupIds = new Set(activePeriodGroups.map(g => g.id));

  for (const goal of goals) {
    if (!activePeriodGroupIds.has(goal.periodGroupId)) continue;

    const goalType = goalTypes.find(gt => gt.id === goal.goalTypeId);
    if (!goalType) continue;

    const period = activePeriodGroups.flatMap(pg => pg.periods).find(p => p.id === goal.periodId);
    if (!period) continue;

    const startDate = parseISO(period.startDate);
    const endDate = parseISO(period.endDate);

    const salesInPeriod = salesOrders.filter(order => {
      const eventDate = order.status === 'cancelled' || order.status === 'returned'
          ? (order.cancelledAt || order.returnedAt)?.toDate()
          : order.createdAt?.toDate();
      if (!eventDate) return false;
      return isWithinInterval(eventDate, { start: startDate, end: endDate });
    });

    let applicableSales: SalesOrder[] = [];

    if (goal.userId) {
      const user = users.find(u => u.id === goal.userId);
      if (user) {
        applicableSales = salesInPeriod.filter(order => {
          if (order.createdByUserId !== user.id) return false;
          const saleType = saleTypes.find(st => st.id === order.saleTypeId);
          return !saleType?.roleIds || saleType.roleIds.length === 0 || saleType.roleIds.includes(user.roleId);
        });
      }
    } else if (goal.branchId) {
      applicableSales = salesInPeriod.filter(order => {
        const companyBranch = companyBranches.find(cb => cb.id === order.companyBranchId);
        if (companyBranch?.branchId !== goal.branchId) return false;
        const saleType = saleTypes.find(st => st.id === order.saleTypeId);
        return !saleType?.branchIds || saleType.branchIds.length === 0 || saleType.branchIds.includes(goal.branchId!);
      });
    } else if (goal.roleId) {
      const saleTypesForRole = saleTypes.filter(st => !st.roleIds || st.roleIds.length === 0 || st.roleIds.includes(goal.roleId!));
      const saleTypeIdsForRole = new Set(saleTypesForRole.map(st => st.id));

      const salesByRole = salesInPeriod.filter(order => {
        const seller = users.find(u => u.id === order.createdByUserId);
        return seller?.roleId === goal.roleId && saleTypeIdsForRole.has(order.saleTypeId);
      });
      
      const consolidatedSales = salesInPeriod.filter(order => {
        const saleType = saleTypes.find(st => st.id === order.saleTypeId);
        return saleType?.consolidateToRoleIds?.includes(goal.roleId!) && saleTypeIdsForRole.has(order.saleTypeId);
      });

      const salesMap = new Map<string, SalesOrder>();
      salesByRole.forEach(order => salesMap.set(order.id, order));
      consolidatedSales.forEach(order => salesMap.set(order.id, order));
      applicableSales = Array.from(salesMap.values());
    }

    let realizadoValue = 0;
    const goalTypeNameLower = goalType.name.toLowerCase();

    if (goalTypeNameLower.includes('mercantil')) {
      const mercantilSales = applicableSales.filter(o => saleTypes.find(st => st.id === o.saleTypeId)?.countsTowardsMercantilGoal);
      realizadoValue = mercantilSales.reduce((sum, order) => sum + calculateNetReceived(order) - calculateReversals(order), 0);
    } else if (goalTypeNameLower.includes('frete')) {
      const freightSales = applicableSales.filter(o => saleTypes.find(st => st.id === o.saleTypeId)?.countsTowardsFreightGoal);
      realizadoValue = freightSales.reduce((sum, order) => {
        if(order.status === 'cancelled' || order.status === 'returned') return sum;
        const totalPaid = (order.payments || []).flatMap(p => p.installments).filter(i => i.paid).reduce((acc, i) => acc + i.value, 0);
        const paidRatio = order.total > 0 ? totalPaid / order.total : 0;
        return sum + (order.freightValue || 0) * paidRatio;
      }, 0);
    } else if (services.some(s => s.name.toLowerCase() === goalTypeNameLower)) {
      const service = services.find(s => s.name.toLowerCase() === goalTypeNameLower);
      const serviceSales = applicableSales.filter(o => saleTypes.find(st => st.id === o.saleTypeId)?.countsTowardsServiceGoal);
      realizadoValue = serviceSales.reduce((sum, order) => {
        if(order.status === 'cancelled' || order.status === 'returned') return sum;
        const serviceInOrder = (order.services || []).find(s => s.serviceId === service!.id);
        if (!serviceInOrder) return sum;
        const totalPaid = (order.payments || []).flatMap(p => p.installments).filter(i => i.paid).reduce((acc, i) => acc + i.value, 0);
        const paidRatio = order.total > 0 ? totalPaid / order.total : 0;
        return sum + serviceInOrder.price * paidRatio;
      }, 0);
    } else {
      const saleTypeForGoal = saleTypes.find(st => st.name.toLowerCase() === goalTypeNameLower);
      if (saleTypeForGoal) {
        const salesForThisType = applicableSales.filter(order => order.saleTypeId === saleTypeForGoal.id);
        realizadoValue = salesForThisType.reduce((sum, order) => sum + calculateNetReceived(order) - calculateReversals(order), 0);
      }
    }

    if (realizadoValue !== (goal.realizado || 0)) {
      const docRef = doc(db, "goals", goal.id);
      batch.update(docRef, { realizado: realizadoValue });
      count++;
    }
  }

  // --- Automatic Period Locking Logic ---
  let lockedCount = 0;
  for (const group of periodGroups) {
    let groupNeedsUpdate = false;
    const updatedPeriods = group.periods.map(p => {
      // Se o período está encerrado mas ainda não está bloqueado
      if (getPeriodStatus(p).text === "Encerrado" && !p.isLocked) {
        groupNeedsUpdate = true;
        lockedCount++;
        return { ...p, isLocked: true };
      }
      return p;
    });

    if (groupNeedsUpdate) {
      const groupRef = doc(db, "periodgroups", group.id);
      batch.update(groupRef, { periods: updatedPeriods });
      count++; // Increment count to trigger batch commit if only locks were changed
    }
  }

  if (count > 0) {
    await batch.commit();
    if (lockedCount > 0) {
      console.log(`[Realizado AutoSync] ${lockedCount} períodos foram bloqueados automaticamente por encerramento.`);
    }
    console.log(`[Realizado AutoSync] Sincronização concluída em ${new Date().toLocaleTimeString("pt-BR")}`);
  }

  // Verifica se ainda existe algum grupo que justifica manter o AutoSync ligado
  const hasVigenteEnabled = periodGroups.some(g => {
    const status = getGroupStatus(g).text;
    return (status === "Ativo" || status === "Agendado") && g.autoSyncEnabled === true;
  });

  return hasVigenteEnabled;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function RealizadoAutoSyncProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = React.useState<AutoSyncConfig>(DEFAULT_CONFIG);
  const [lastSyncAt, setLastSyncAt] = React.useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Load from localStorage on mount (client only)
  React.useEffect(() => {
    setConfigState(loadConfig());
  }, []);

  const setConfig = React.useCallback((newConfig: AutoSyncConfig) => {
    setConfigState(newConfig);
    saveConfig(newConfig);
  }, []);

  const triggerNow = React.useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const shouldKeepOn = await runAutoSync();
      setLastSyncAt(new Date());

      // Se não houver mais nenhum grupo vigente com sync ativa, desliga o mestre global
      if (!shouldKeepOn && config.enabled) {
        setConfig({ ...config, enabled: false });
        console.log("[Realizado AutoSync] Master Switch desativado automaticamente: nenhum grupo vigente ativo encontrado.");
      }
    } catch (err) {
      console.error("[Realizado AutoSync] Erro:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, config, setConfig]);

  // Manage the interval
  React.useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (config.enabled) {
      const ms = config.intervalMinutes * 60 * 1000;
      intervalRef.current = setInterval(() => {
        triggerNow();
      }, ms);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [config.enabled, config.intervalMinutes, triggerNow]);

  return (
    <AutoSyncContext.Provider value={{ config, setConfig, lastSyncAt, isSyncing, triggerNow }}>
      {children}
    </AutoSyncContext.Provider>
  );
}

