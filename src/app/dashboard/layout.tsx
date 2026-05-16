
"use client"

import * as React from "react"
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from "next/navigation"
import {
  BriefcaseBusiness,
  Building2,
  GitFork,
  LayoutGrid,
  LogOut,
  Settings,
  Users,
  User,
  Loader2,
  Target,
  ListTree,
  ChevronDown,
  Shield,
  AreaChart,
  Rocket,
  UserPlus,
  DollarSign,
  Calendar,
  Archive,
  History,
  Megaphone,
  PlusSquare,
  FileClock,
  Bell,
  BellPlus,
  BellRing,
  Info,
  PartyPopper,
  Medal,
  Trophy,
  Award,
  Gem,
  MailCheck,
  Banknote,
  ShieldCheck,
  Store,
  Undo2,
  HandCoins,
  ShieldAlert,
  Sparkles,
} from "lucide-react"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { collection, getDocs, orderBy, query, doc, getDoc, addDoc, serverTimestamp, where, writeBatch } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import type { NavigationItem, RoleAccess, User as UserType, Notification, LoginConfiguration, GoalAlert, Goal, GoalLevelTargets, PeriodGroup, NotificationRead } from "@/lib/definitions"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { RealTimeClock } from "@/components/dashboard/real-time-clock"
import * as Icons from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { isAfter, isBefore, parseISO, formatDistanceToNowStrict } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ThemeToggle } from "@/components/theme-toggle"
import { FirebaseErrorListener } from "@/components/firebase-error-listener"
import { cn } from "@/lib/utils"
import { getPeriodStatus } from "@/lib/period-helpers"
import { PegaPixAutoSyncProvider } from "@/contexts/pega-pix-autosync-context"
import { RealizadoAutoSyncProvider } from "@/contexts/realizado-autosync-context"

const Icon = ({ name, ...props }: { name: string } & React.ComponentProps<typeof Users>) => {
  const LucideIcon = (Icons as any)[name] as React.ComponentType<any>;
  if (!LucideIcon) {
    return <Users {...props} />; // fallback icon
  }
  return <LucideIcon {...props} />;
};

type QueuedGoalAlert = GoalAlert & { achievedLevel?: keyof GoalLevelTargets };

const levelConfig: Record<string, { icon: React.ReactNode, colorClass: string, bgClass: string, shadowClass: string }> = {
    Bronze: { 
      icon: <Medal className="h-16 w-16" />, 
      colorClass: "text-orange-500", 
      bgClass: "bg-orange-500/10",
      shadowClass: "shadow-[0_0_50px_-12px_rgba(249,115,22,0.5)]" 
    },
    Prata: { 
      icon: <Trophy className="h-16 w-16" />, 
      colorClass: "text-slate-400", 
      bgClass: "bg-slate-400/10",
      shadowClass: "shadow-[0_0_50px_-12px_rgba(148,163,184,0.5)]" 
    },
    Ouro: { 
      icon: <Award className="h-16 w-16" />, 
      colorClass: "text-yellow-500", 
      bgClass: "bg-yellow-500/10",
      shadowClass: "shadow-[0_0_50px_-12px_rgba(234,179,8,0.5)]" 
    },
    Diamante: { 
      icon: <Gem className="h-16 w-16" />, 
      colorClass: "text-sky-400", 
      bgClass: "bg-sky-400/10",
      shadowClass: "shadow-[0_0_50px_-12px_rgba(56,189,248,0.5)]" 
    },
};


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [user, setUser] = React.useState<any>(null)
  const [userData, setUserData] = React.useState<UserType | null>(null);
  const [loading, setLoading] = React.useState(true)
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [avatar, setAvatar] = React.useState("https://picsum.photos/100/100?random=1")
  const [userName, setUserName] = React.useState("Admin")
  const [userInitials, setUserInitials] = React.useState("AD")
  const [menuItems, setMenuItems] = React.useState<NavigationItem[]>([]);
  const [menuSearchTerm, setMenuSearchTerm] = React.useState("");
  const [loadingMenu, setLoadingMenu] = React.useState(true);
  const [openMobile, setOpenMobile] = React.useState(false);

  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [hasUnread, setHasUnread] = React.useState(false);
  const [loginModalQueue, setLoginModalQueue] = React.useState<Notification[]>([]);
  const [activeLoginModal, setActiveLoginModal] = React.useState<Notification | null>(null);
  const [hasLoginModalsBeenSet, setHasLoginModalsBeenSet] = React.useState(false);
  
  const [goalAlertQueue, setGoalAlertQueue] = React.useState<QueuedGoalAlert[]>([]);
  const [activeGoalAlert, setActiveGoalAlert] = React.useState<QueuedGoalAlert | null>(null);
  const goalAlertsCheckedRef = React.useRef(false);


  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user)
        setAvatar(user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`)
        setUserName(user.displayName || "Usuário")
        setUserInitials(user.displayName ? user.displayName.substring(0, 2).toUpperCase() : "U")

        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            setUserData(userDocSnap.data() as UserType);
        }

      } else {
        router.push("/login")
      }
      setLoading(false)
    });

    const fetchLoginConfig = async () => {
        try {
          const configDocRef = doc(db, "settings", "loginConfiguration");
          const docSnap = await getDoc(configDocRef);
          if (docSnap.exists()) {
            setLogoUrl((docSnap.data() as LoginConfiguration).logoUrl);
          }
        } catch(err) {
          console.error("Could not fetch login configuration", err);
        }
      }
    fetchLoginConfig();

    return () => unsubscribe()
  }, [router])
  
  React.useEffect(() => {
    const fetchMenuData = async () => {
      if (!user) return;

      try {
        const navCollection = collection(db, "navigation");
        const q = query(navCollection, orderBy("order"));
        const navSnapshot = await getDocs(q);
        const allNavItems = navSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NavigationItem));
        const visibleNavItems = allNavItems.filter(item => item.visible);

        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          setMenuItems(visibleNavItems);
          setLoadingMenu(false);
          return;
        }

        const userData = userDocSnap.data() as UserType;
        
        if (!userData.roleId) {
            setMenuItems([]);
            setLoadingMenu(false);
            return;
        }
        
        const roleAccessDocRef = doc(db, "roleAccess", userData.roleId);
        const roleAccessDocSnap = await getDoc(roleAccessDocRef);

        if (userData.isAdmin) {
            setMenuItems(visibleNavItems);
            setLoadingMenu(false);
            return;
        }

        if (!roleAccessDocSnap.exists()) {
          setMenuItems([]); // No access config for this role, show nothing.
          setLoadingMenu(false);
          return;
        }

        const roleAccess = roleAccessDocSnap.data() as RoleAccess;
        const allowedNavIds = new Set(roleAccess.allowedNavIds);
        
        const filteredItems = visibleNavItems.filter(item => {
          if (item.path === '/dashboard/profile') return false;

          if (allowedNavIds.has(item.id)) {
            if (item.parentId) {
                return allNavItems.some(parent => parent.id === item.parentId && allowedNavIds.has(parent.id));
            }
            return true;
          }
          return false;
        });
        
        setMenuItems(filteredItems);

      } catch (error) {
        toast({
          title: "Erro ao carregar menu",
          description: "Não foi possível carregar a navegação.",
          variant: "destructive",
        });
        setMenuItems([]);
      } finally {
        setLoadingMenu(false);
      }
    };

    if (user) {
        fetchMenuData();
    }
  }, [toast, user]);

  React.useEffect(() => {
    const logAccess = async () => {
      if (user && userData && pathname && pathname !== '/dashboard/logs') {
        try {
          await addDoc(collection(db, "accessLogs"), {
            userId: user.uid,
            userName: userData.name,
            userAvatar: userData.avatarUrl,
            path: pathname,
            timestamp: serverTimestamp(),
          });
        } catch (error) {
          console.error("Error logging access:", error);
        }
      }
    };
    logAccess();
  }, [user, userData, pathname]);

  React.useEffect(() => {
    const fetchAndShowNotifications = async () => {
      if (!userData || hasLoginModalsBeenSet) return;
      
      setHasLoginModalsBeenSet(true); // Lock to prevent re-running
      
      try {
          const now = new Date();
          const notificationsRef = collection(db, "notifications");
          
          const targetRoleIds = userData.isAdmin ? [] : [userData.roleId, ""];
          const queries = userData.isAdmin
            ? [query(notificationsRef)]
            : [
                query(notificationsRef, where("targetRoleIds", "array-contains", userData.roleId)),
                query(notificationsRef, where("targetRoleIds", "==", [])),
              ];

          const querySnapshots = await Promise.all(queries.map(q => getDocs(q)));
          
          const allNotificationsMap = new Map<string, Notification>();
          
          querySnapshots.forEach(snap => {
              snap.docs.forEach((doc:any) => {
                  if (!allNotificationsMap.has(doc.id)) {
                  allNotificationsMap.set(doc.id, { id: doc.id, ...doc.data() } as Notification);
                  }
              });
          });

          const validNotifications = Array.from(allNotificationsMap.values()).filter(n => {
              const startDate = n.startDate ? parseISO(n.startDate) : null;
              const endDate = n.endDate ? parseISO(n.endDate) : null;
              if (startDate && isAfter(startDate, now)) return false;
              if (endDate && isBefore(endDate, now)) return false;
              return true;
          }).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));


          // --- Logic for Login Modal ---
          const modalsToShow = validNotifications.filter(n => n.showOnEveryLogin);
          if (modalsToShow.length > 0) {
            setLoginModalQueue(modalsToShow);
            setActiveLoginModal(modalsToShow[0]);
          }
          
          // --- Logic for Toasts (Pop-ups) ---
          const shownToastIds = JSON.parse(sessionStorage.getItem('shown_notifications_toasts') || '[]');
          const toastToShow = validNotifications.find(n => !n.showOnEveryLogin && !shownToastIds.includes(n.id));

          if (toastToShow) {
              toast({
                  title: toastToShow.title,
                  description: toastToShow.text,
                  duration: 10000,
                  onClick: toastToShow.link ? () => router.push(toastToShow.link!) : undefined,
                  className: toastToShow.link ? "cursor-pointer" : "",
              });
              sessionStorage.setItem('shown_notifications_toasts', JSON.stringify([...shownToastIds, toastToShow.id]));
          }
          
          // -- Logic for Bell Indicator --
          const readNotificationIds = JSON.parse(localStorage.getItem('read_notifications') || '[]');
          const hasNew = validNotifications.some(n => !readNotificationIds.includes(n.id));
          setHasUnread(hasNew);
          setNotifications(validNotifications.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
          
      } catch (error) {
          console.error("Failed to fetch notifications:", error);
      }
    }

    const checkGoalAlerts = async () => {
        if (!userData || !userData.roleId) return;
        if (goalAlertsCheckedRef.current) return; // Guard against double execution
        goalAlertsCheckedRef.current = true;

        const alertsRef = collection(db, "goalAlerts");
        const goalsRef = collection(db, "goals");
        const periodGroupsRef = collection(db, "periodgroups");

        const [alertsSnapshots, goalsSnapshots, periodGroupsSnap] = await Promise.all([
            Promise.all([
                getDocs(query(alertsRef, where("targetType", "==", "general"))),
                getDocs(query(alertsRef, where("targetType", "==", "user"), where("userIds", "array-contains", userData.id))),
                getDocs(query(alertsRef, where("targetType", "==", "branch"), where("branchIds", "array-contains", userData.branchId))),
                getDocs(query(alertsRef, where("targetType", "==", "role"), where("roleIds", "array-contains", userData.roleId))),
            ]),
            Promise.all([
                getDocs(query(goalsRef, where("userId", "==", userData.id))),
                getDocs(query(goalsRef, where("roleId", "==", userData.roleId))),
            ]),
            getDocs(periodGroupsRef),
        ]);

        const allAlertsMap = new Map<string, GoalAlert>();
        alertsSnapshots.flat().forEach(snap => snap.docs.forEach(d => allAlertsMap.set(d.id, {id: d.id, ...d.data()} as GoalAlert)));
        const relevantAlerts = Array.from(allAlertsMap.values());
        
        const allUserGoalsMap = new Map<string, Goal>();
        goalsSnapshots.flat().forEach(snap => snap.docs.forEach(d => allUserGoalsMap.set(d.id, { id: d.id, ...d.data() } as Goal)));
        
        const periodGroups = periodGroupsSnap.docs.map(doc => doc.data() as PeriodGroup);
        const allPeriods = periodGroups.flatMap(g => g.periods);
        const activePeriodIds = new Set(allPeriods.filter(p => getPeriodStatus(p).text === 'Ativo').map(p => p.id));
        
        const goals = Array.from(allUserGoalsMap.values()).filter(g => activePeriodIds.has(g.periodId));
        
        let percentageAlertsToShow: QueuedGoalAlert[] = [];
        let levelAlertsToShow: QueuedGoalAlert[] = [];

        const shownAlerts = JSON.parse(sessionStorage.getItem('shown_goal_alerts') || '[]');
        const orderedLevels: Array<keyof GoalLevelTargets> = ['Bronze', 'Prata', 'Ouro', 'Diamante'];
    
        let bestOverallPercentageAlert: GoalAlert | null = null;
    
        for (const goal of goals) {
            const realizado = goal.realizado || 0;
            
            // --- Percentage Alerts ---
            const target = goal.levelTargets?.Diamante ?? goal.targetValue ?? 0;
            if (target > 0) {
                const achievement = (realizado / target) * 100;
                
                for (const alert of relevantAlerts) {
                    if (alert.triggerType !== 'percentage') continue;
                    if (alert.goalTypeIds && alert.goalTypeIds.length > 0 && !alert.goalTypeIds.includes(goal.goalTypeId)) continue;
                    
                    if (achievement >= (alert.triggerValue as number)) {
                         if (!bestOverallPercentageAlert || (alert.triggerValue as number) > (bestOverallPercentageAlert.triggerValue as number)) {
                            bestOverallPercentageAlert = alert;
                        }
                    }
                }
            }

            // --- Level Alerts ---
            if (goal.hasLevels && goal.levelTargets) {
                 let achievedLevelForGoal: keyof GoalLevelTargets | null = null;
                 for (let i = orderedLevels.length - 1; i >= 0; i--) {
                     const levelName = orderedLevels[i];
                     const levelTarget = goal.levelTargets[levelName];
                     if (levelTarget && realizado >= levelTarget) {
                         achievedLevelForGoal = levelName;
                         break;
                     }
                 }

                 if (achievedLevelForGoal) {
                    const levelAlert = relevantAlerts.find(alert => 
                        alert.triggerType === 'level' &&
                        alert.triggerValue === achievedLevelForGoal &&
                        (!alert.goalTypeIds || alert.goalTypeIds.length === 0 || alert.goalTypeIds.includes(goal.goalTypeId))
                    );
                    if (levelAlert) {
                       levelAlertsToShow.push({ ...levelAlert, achievedLevel: achievedLevelForGoal });
                    }
                 }
            }
        }
        
        if (bestOverallPercentageAlert) {
            const isAlreadyShown = !bestOverallPercentageAlert.showOnLogin && shownAlerts.includes(bestOverallPercentageAlert.id);
            if (!isAlreadyShown) {
                percentageAlertsToShow.push(bestOverallPercentageAlert);
            }
        }
        
        const uniquePercentageAlerts = percentageAlertsToShow.filter((alert, index, self) => index === self.findIndex((a) => a.id === alert.id));
        const uniqueLevelAlerts = levelAlertsToShow.filter((alert, index, self) => index === self.findIndex((a) => a.id === alert.id));
        
        const allAlertsToShow = [...uniquePercentageAlerts, ...uniqueLevelAlerts];

        if (allAlertsToShow.length > 0) {
            const nonRecurringAlerts = allAlertsToShow.filter(a => !a.showOnLogin);
            if (nonRecurringAlerts.length > 0) {
                const newShownAlerts = [...new Set([...shownAlerts, ...nonRecurringAlerts.map(a => a.id)])];
                sessionStorage.setItem('shown_goal_alerts', JSON.stringify(newShownAlerts));
            }
            setGoalAlertQueue(prev => [...prev, ...allAlertsToShow]);
        }
      };

    if (userData) {
      fetchAndShowNotifications();
      checkGoalAlerts();
    }
  }, [userData, toast, router, hasLoginModalsBeenSet]);
  
  // Effect to display alerts from the queue one by one
  React.useEffect(() => {
    if (goalAlertQueue.length > 0 && !activeGoalAlert) {
      const nextAlert = goalAlertQueue[0];
      setActiveGoalAlert(nextAlert);
      setGoalAlertQueue(prev => prev.slice(1));
    }
  }, [goalAlertQueue, activeGoalAlert]);

  const handleLogout = async () => {
    try {
      await signOut(auth)
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      })
      router.push("/login")
    } catch (error) {
      toast({
        title: "Erro no Logout",
        description: "Não foi possível sair. Tente novamente.",
        variant: "destructive"
      })
    }
  }

  const handleLinkClick = (path: string) => {
    router.push(path);
  };
  
  const handleOpenNotificationDropdown = async () => {
    if (hasUnread) {
        setHasUnread(false);
        const allNotificationIds = notifications.map(n => n.id);
        localStorage.setItem('read_notifications', JSON.stringify(allNotificationIds));

        if (!userData) return;

        const unreadNotifications = notifications.filter(n => 
            !JSON.parse(localStorage.getItem('read_notification_writes') || '[]').includes(n.id)
        );

        if (unreadNotifications.length > 0) {
            const batch = writeBatch(db);
            unreadNotifications.forEach(notification => {
                const readRef = doc(collection(db, "notificationReads"));
                batch.set(readRef, {
                    notificationId: notification.id,
                    userId: userData.id,
                    userName: userData.name,
                    readAt: serverTimestamp(),
                });
            });

            try {
                await batch.commit();
                const writtenIds = unreadNotifications.map(n => n.id);
                const previouslyWritten = JSON.parse(localStorage.getItem('read_notification_writes') || '[]');
                localStorage.setItem('read_notification_writes', JSON.stringify([...previouslyWritten, ...writtenIds]));
            } catch (error) {
                console.error("Failed to save read confirmations:", error);
            }
        }
    }
  }
  
  const filteredMenuItems = React.useMemo(() => {
    if (!menuSearchTerm.trim()) return menuItems;
    const term = menuSearchTerm.toLowerCase();
    
    const matchingItems = menuItems.filter(item => item.title.toLowerCase().includes(term));
    const matchingIds = new Set<string>();
    
    matchingItems.forEach(item => {
      let currentId: string | null = item.id;
      while (currentId) {
        matchingIds.add(currentId);
        const currentItem = menuItems.find(i => i.id === currentId);
        currentId = currentItem?.parentId || null;
      }
    });

    return menuItems.filter(item => matchingIds.has(item.id));
  }, [menuItems, menuSearchTerm]);

  const getSubItems = (parentId: string | null) => filteredMenuItems.filter(item => item.parentId === parentId);
  const getSafePath = (path?: string) => {
    if (!path) return "#";
    return path.startsWith('/') ? path : `/dashboard/${path}`;
  };

  const findParentOfActiveItem = (activePath: string) => {
    const activeItem = menuItems.find(item => getSafePath(item.path) === activePath);
    if (!activeItem) return null;
    if (!activeItem.parentId) return null; // It's a top-level item

    const parentItem = menuItems.find(item => item.id === activeItem.parentId);
    if (!parentItem) return null;

    // If the parent is a top-level item, return its ID
    if (!parentItem.parentId) return parentItem.id;
    
    // If the parent is a second-level item, return its parent's ID (the top-level one)
    return parentItem.parentId;
  }
  
  const activeParentId = findParentOfActiveItem(pathname);
  
  const hasAccessToCurrentPage = React.useMemo(() => {
    if (loadingMenu || userData?.isAdmin) {
      return true;
    }
    // Always allow access to the main dashboard, profile, and settings pages
    const alwaysAllowedPaths = ['/dashboard', '/dashboard/profile', '/dashboard/settings', '/dashboard/summary', '/dashboard/seller-summary'];
    if (alwaysAllowedPaths.includes(pathname)) {
      return true;
    }

    const pathIsAllowed = menuItems.some(item => {
      const safePath = getSafePath(item.path);
      if (safePath === '#') return false;
      
      // If the current path is exactly the item path
      if (pathname === safePath) return true;
      
      // If the current path is a sub-path of the item path (e.g., /history/123 under /history)
      if (pathname.startsWith(safePath + '/')) return true;

      return false;
    });

    return pathIsAllowed;
  }, [loadingMenu, menuItems, pathname, userData?.isAdmin]);


  if (loading || loadingMenu) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }
  
  const renderAlertContent = () => {
      if (!activeGoalAlert) return null;

      const isLevelAlert = activeGoalAlert.triggerType === 'level' && activeGoalAlert.achievedLevel;
      const config = isLevelAlert 
        ? levelConfig[activeGoalAlert.achievedLevel!] 
        : { 
            icon: <PartyPopper className="h-16 w-16" />, 
            colorClass: "text-primary", 
            bgClass: "bg-primary/10",
            shadowClass: "shadow-[0_0_50px_-12px_rgba(var(--primary),0.5)]"
          };

      return (
         <AlertDialogContent className="sm:max-w-[450px] border-none bg-background/60 backdrop-blur-3xl shadow-glass rounded-[2.5rem] p-8 overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <AlertDialogHeader className="items-center text-center space-y-6">
                  <div className={cn(
                    "relative flex h-32 w-32 items-center justify-center rounded-full mb-2 animate-in zoom-in-50 duration-500",
                    config.bgClass,
                    config.shadowClass
                  )}>
                    <div className={cn("relative z-10 drop-shadow-2xl", config.colorClass)}>
                      {config.icon}
                    </div>
                    <Sparkles className="absolute -top-2 -right-2 h-8 w-8 text-yellow-500 animate-pulse" />
                    <div className="absolute inset-0 rounded-full bg-inherit animate-ping opacity-20" />
                  </div>
                  
                  <div className="space-y-2">
                    <AlertDialogTitle className={cn("text-4xl font-headline font-bold tracking-tight", config.colorClass)}>
                      {activeGoalAlert.name}
                    </AlertDialogTitle>
                    <div className="flex items-center justify-center gap-2">
                       <div className="h-px w-8 bg-border" />
                       <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Conquista Desbloqueada</span>
                       <div className="h-px w-8 bg-border" />
                    </div>
                  </div>

                  <AlertDialogDescription className="text-xl font-medium leading-relaxed text-foreground/80 px-4">
                    {activeGoalAlert.message.replace('{{level}}', activeGoalAlert.achievedLevel || '')}
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="sm:justify-center mt-8">
                  <AlertDialogAction 
                    onClick={() => setActiveGoalAlert(null)}
                    className="h-12 px-10 rounded-2xl bg-primary text-primary-foreground font-bold text-lg hover:scale-105 transition-transform shadow-glass"
                  >
                    Maravilha!
                  </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
      )
  }

  const dismissModal = () => {
    const queue = [...loginModalQueue];
    queue.shift(); // Remove the current modal
    setLoginModalQueue(queue);

    if (queue.length > 0) {
      setActiveLoginModal(queue[0]); // Show the next one
    } else {
      setActiveLoginModal(null); // No more modals
    }
  };

  const handleActionClick = () => {
    if (activeLoginModal?.link) {
      router.push(activeLoginModal.link);
    }
    dismissModal();
  }

  const renderLoginModal = () => {
    if (!activeLoginModal) return null;

    return (
      <AlertDialog open={!!activeLoginModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{activeLoginModal.title}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              {activeLoginModal.text}
            </AlertDialogDescription>
          </AlertDialogHeader>
           <AlertDialogFooter>
            {activeLoginModal.link && (
                <Button asChild variant="link" className="p-0 h-auto">
                    <div onClick={handleActionClick} className="cursor-pointer">
                        {activeLoginModal.callToAction || "Clique aqui e saiba mais."}
                    </div>
                </Button>
            )}
            <AlertDialogAction onClick={dismissModal}>Ok, entendi!</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const renderSubItems = (items: NavigationItem[], level: number) => {
    return items.map(subItem => {
        const subItemPath = getSafePath(subItem.path);
        const subSubItems = getSubItems(subItem.id);
        const isActive = pathname === subItemPath;
        
        if (subSubItems.length > 0) {
          return (
            <Collapsible key={subItem.id} className="w-full" defaultOpen={subSubItems.some(i => pathname === getSafePath(i.path))}>
              <SidebarMenuSubItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuSubButton className="justify-between">
                        <span className="truncate">{subItem.title}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                    </SidebarMenuSubButton>
                </CollapsibleTrigger>
              </SidebarMenuSubItem>
              <CollapsibleContent>
                <SidebarMenuSub className="pl-4">
                  {subSubItems.map(subSubItem => (
                     <SidebarMenuSubItem key={subSubItem.id}>
                        <SidebarMenuSubButton asChild isActive={pathname === getSafePath(subSubItem.path)}>
                          <Link href={getSafePath(subSubItem.path)} onClick={() => setOpenMobile(false)}>
                            <span className="truncate">{subSubItem.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          )
        }
        
        return (
          <SidebarMenuSubItem key={subItem.id}>
            <SidebarMenuSubButton asChild isActive={isActive}>
              <Link href={subItemPath} onClick={() => setOpenMobile(false)}>
                <span className="truncate">{subItem.title}</span>
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        )
    });
  }

  return (
    <PegaPixAutoSyncProvider>
    <RealizadoAutoSyncProvider>
    <>
    <FirebaseErrorListener />
    <SidebarProvider openMobile={openMobile} onOpenChange={setOpenMobile}>
      <Sidebar>
        <SidebarHeader>
          <div className="flex h-14 items-center justify-center px-2">
            {logoUrl ? (
                <Image src={logoUrl} alt="Logo" width={140} height={40} className="object-contain" />
            ) : (
                <h1 className="text-xl font-bold text-sidebar-foreground">Barato Móveis</h1>
            )}
          </div>
          <div className="px-4 pb-2 pt-1 border-b border-sidebar-border mb-2">
            <div className="relative">
              <Icons.Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar abas..."
                className="w-full bg-background/50 pl-8 rounded-xl shadow-soft h-9 border-border/50 text-sm focus-visible:ring-primary/30"
                value={menuSearchTerm}
                onChange={(e) => setMenuSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="scrollbar-hide">
          <SidebarMenu>
            {getSubItems(null).map(item => {
                const subItems = getSubItems(item.id);
                const itemPath = getSafePath(item.path);
                if (subItems.length > 0) {
                    return (
                        <Collapsible key={item.id} className="w-full" defaultOpen={activeParentId === item.id}>
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                    <SidebarMenuButton className="justify-between">
                                        <div className="flex items-center gap-2">
                                            <Icon name={item.icon} />
                                            <span className="truncate">{item.title}</span>
                                        </div>
                                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                                    </SidebarMenuButton>
                                </CollapsibleTrigger>
                            </SidebarMenuItem>
                            <CollapsibleContent>
                                <SidebarMenuSub>
                                    {renderSubItems(subItems, 1)}
                                </SidebarMenuSub>
                            </CollapsibleContent>
                        </Collapsible>
                    )
                }
                return (
                    <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton asChild tooltip={item.title} isActive={pathname === itemPath}>
                            <Link href={itemPath} onClick={() => setOpenMobile(false)}><Icon name={item.icon} /> <span className="truncate">{item.title}</span></Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                )
            })}
          </SidebarMenu>
        </SidebarContent>
         <SidebarFooter>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton onClick={handleLogout} tooltip="Sair">
                        <LogOut /> <span className="truncate">Sair</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarRail />
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-50 px-4 lg:h-[70px] lg:px-6 shadow-sm transition-all duration-300">
          <SidebarTrigger className="md:hidden" />
          <div className="w-full flex-1">
          </div>
          <RealTimeClock />
          <ThemeToggle />
           <DropdownMenu onOpenChange={open => open && handleOpenNotificationDropdown()}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {hasUnread && <span className="absolute top-0 right-0 flex h-2 w-2 rounded-full bg-red-500" />}
                <span className="sr-only">Toggle notifications</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notificações</DropdownMenuLabel>
              <DropdownMenuSeparator />
                {notifications.length > 0 ? (
                    notifications.map(n => (
                        <DropdownMenuItem 
                          key={n.id} 
                          className="flex flex-col items-start gap-1 whitespace-normal"
                          onSelect={n.link ? () => router.push(n.link!) : undefined}
                          disabled={!n.link}
                        >
                          <p className="font-semibold">{n.title}</p>
                          <p className="text-xs text-muted-foreground">{n.text}</p>
                           <p className="text-xs text-muted-foreground/80 mt-1">
                            {formatDistanceToNowStrict(n.createdAt.toDate(), { addSuffix: true, locale: ptBR })}
                          </p>
                        </DropdownMenuItem>
                    ))
                ) : (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        Nenhuma notificação nova.
                    </div>
                )}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <Avatar>
                  <AvatarImage src={avatar} alt={userName} />
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
               <DropdownMenuItem onSelect={() => handleLinkClick('/dashboard/profile')}>
                <>
                  <User className="mr-2 h-4 w-4" />
                  <span>Perfil</span>
                </>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleLinkClick('/dashboard/settings')}>
                <>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configurações</span>
                </>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleLogout}>
                <>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          {hasAccessToCurrentPage ? (
            children
          ) : (
             <Card className="max-w-2xl mx-auto mt-16">
                <CardHeader className="text-center">
                    <ShieldAlert className="mx-auto h-12 w-12 text-destructive mb-4" />
                    <CardTitle>Acesso Negado</CardTitle>
                    <CardDescription>
                        Você não tem permissão para visualizar esta página. Contate um administrador se você acredita que isso é um erro.
                    </CardDescription>
                </CardHeader>
            </Card>
          )}
        </main>
        
        <AlertDialog open={!!activeGoalAlert} onOpenChange={(open) => {if(!open) setActiveGoalAlert(null)}}>
          {renderAlertContent()}
        </AlertDialog>
        
        {renderLoginModal()}

      </SidebarInset>
    </SidebarProvider>
    </>
    </RealizadoAutoSyncProvider>
    </PegaPixAutoSyncProvider>
  );
}
