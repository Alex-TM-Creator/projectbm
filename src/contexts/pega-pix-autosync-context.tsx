"use client";

import * as React from "react";
import { collection, getDocs, query, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PegaPixGoal, PeriodGroup, SalesOrder, CompanyBranch, User } from "@/lib/definitions";
import { isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { getGroupStatus } from "@/lib/period-helpers";

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

const LS_KEY = "pegaPixAutoSync";

// ─── Context ──────────────────────────────────────────────────────────────────
const AutoSyncContext = React.createContext<AutoSyncContextType>({
  config: DEFAULT_CONFIG,
  setConfig: () => {},
  lastSyncAt: null,
  isSyncing: false,
  triggerNow: async () => {},
});

export const usePegaPixAutoSync = () => React.useContext(AutoSyncContext);

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

function computeGoalNetReceived(
  goal: PegaPixGoal,
  orders: SalesOrder[],
  companyBranchesMap: CompanyBranch[],
  pGroup: PeriodGroup,
  users: User[]
): number {
  let totalNetReceived = 0;

  const addValuesIfWithinPeriods = (instDateObj: any, netValue: number) => {
    if (!instDateObj) return;
    const edate = (instDateObj as any)?.toDate ? (instDateObj as any).toDate() : new Date(instDateObj || 0);
    for (const p of pGroup.periods) {
      const sDate = (p.startDate as any)?.toDate ? (p.startDate as any).toDate() : new Date(p.startDate || 0);
      const eDate = (p.endDate as any)?.toDate ? (p.endDate as any).toDate() : new Date(p.endDate || 0);
      if (isWithinInterval(edate, { start: startOfDay(sDate), end: endOfDay(eDate) })) {
        totalNetReceived += netValue;
        break;
      }
    }
  };

  orders.forEach(order => {
    if (goal.responsibleType === "user" && order.createdByUserId !== goal.responsibleId) return;
    if (goal.responsibleType === "branch") {
      const cb = companyBranchesMap.find(c => c.id === order.companyBranchId);
      if (!cb || cb.branchId !== goal.responsibleId) return;
    }
    if (goal.responsibleType === "role") {
      const seller = users.find(u => u.id === order.createdByUserId);
      if (!seller || seller.roleId !== goal.responsibleId) return;
    }

    // Installments
    (order.payments || []).forEach(p => {
      (p.installments || []).forEach(inst => {
        if (inst.paid && inst.paidAt) {
          const receivedRatio = order.total > 0 ? inst.value / order.total : 0;
          const proportionalFreight = (order.freightValue || 0) * receivedRatio;
          let proportionalServicesTotal = 0;
          (order.services || []).forEach(service => {
            proportionalServicesTotal += service.price * receivedRatio;
          });
          const netValue = inst.value - proportionalFreight - proportionalServicesTotal;
          addValuesIfWithinPeriods(inst.paidAt, netValue);
        }
      });
    });

    // Reversals
    if (order.status === "cancelled" || order.status === "returned") {
      const reversalEventDate = order.status === "cancelled" ? order.cancelledAt : order.returnedAt;
      if (reversalEventDate) {
        let totalPaidBeforeReversal = 0;
        (order.payments || []).forEach(p => {
          (p.installments || []).forEach(inst => {
            if (inst.reversalStatus === "reversal_approved" || inst.paid) {
              totalPaidBeforeReversal += inst.value;
            }
          });
        });
        if (totalPaidBeforeReversal > 0) {
          const receivedRatio = order.total > 0 ? totalPaidBeforeReversal / order.total : 0;
          const proportionalFreight = (order.freightValue || 0) * receivedRatio;
          let proportionalServicesTotal = 0;
          (order.services || []).forEach(service => {
            proportionalServicesTotal += service.price * receivedRatio;
          });
          const netValueReversal = totalPaidBeforeReversal - proportionalFreight - proportionalServicesTotal;
          addValuesIfWithinPeriods(reversalEventDate, -netValueReversal);
        }
      }
    }
  });

  return totalNetReceived;
}

async function runAutoSync(): Promise<boolean> {
  const [goalsSnap, periodGroupsSnap, ordersSnap, cbSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, "pegaPixGoals")),
    getDocs(collection(db, "periodgroups")),
    getDocs(query(collection(db, "salesOrders"))),
    getDocs(collection(db, "companyBranches")),
    getDocs(collection(db, "users")),
  ]);

  const goals = goalsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as PegaPixGoal);
  const periodGroups = periodGroupsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as PeriodGroup);
  const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }) as SalesOrder);
  const companyBranches = cbSnap.docs.map(d => ({ id: d.id, ...d.data() }) as CompanyBranch);
  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }) as User);

  const batch = writeBatch(db);
  let count = 0;

  // Filtrar apenas metas em grupos que possuem a sincronização ativa e estão vigentes (Ativo ou Agendado)
  const activePeriodGroups = periodGroups.filter(g => {
    const status = getGroupStatus(g).text;
    const isVigente = status === "Ativo" || status === "Agendado";
    return isVigente && g.autoSyncEnabled === true;
  });
  const activePeriodGroupIds = new Set(activePeriodGroups.map(g => g.id));

  for (const goal of goals) {
    if (!activePeriodGroupIds.has(goal.periodGroupId)) continue;

    const pGroup = activePeriodGroups.find(g => g.id === goal.periodGroupId);
    if (!pGroup || !pGroup.periods || pGroup.periods.length === 0) continue;

    const netReceived = computeGoalNetReceived(goal, orders, companyBranches, pGroup, users);
    if (netReceived !== (goal.realizado || 0)) {
      const docRef = doc(db, "pegaPixGoals", goal.id);
      batch.update(docRef, { realizado: netReceived });
      count++;
    }
  }

  if (count > 0) await batch.commit();
  console.log(`[PegaPix AutoSync] ${count} metas atualizadas em ${new Date().toLocaleTimeString("pt-BR")}`);

  // Verifica se ainda existe algum grupo que justifica manter o AutoSync ligado
  const hasVigenteEnabled = periodGroups.some(g => {
    const status = getGroupStatus(g).text;
    return (status === "Ativo" || status === "Agendado") && g.autoSyncEnabled === true;
  });

  return hasVigenteEnabled;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function PegaPixAutoSyncProvider({ children }: { children: React.ReactNode }) {
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
        console.log("[PegaPix AutoSync] Master Switch desativado automaticamente: nenhum grupo vigente ativo encontrado.");
      }
    } catch (err) {
      console.error("[PegaPix AutoSync] Erro:", err);
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
