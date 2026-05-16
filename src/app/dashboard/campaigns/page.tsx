
"use client";

import * as React from "react";
import { Loader2, Frown, RefreshCw, Download, Maximize, Megaphone, Clock, CheckCircle2, CalendarClock } from "lucide-react";
import { collection, getDocs, query, orderBy, doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import type { Campaign, User as UserType, CampaignMedia } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Image from "next/image";
import { format, isBefore, isAfter, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import Autoplay from "embla-carousel-autoplay";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

type CampaignStatus = "active" | "scheduled" | "finished";

const getCampaignStatus = (campaign: Campaign): { text: string; status: CampaignStatus } => {
  const now = new Date();
  if (campaign.startDate) {
    const startDate = parseISO(campaign.startDate);
    if (isAfter(startDate, now)) return { text: "Agendada", status: "scheduled" };
  }
  if (campaign.endDate) {
    const endDate = parseISO(campaign.endDate);
    if (isBefore(endDate, now)) return { text: "Encerrada", status: "finished" };
  }
  return { text: "Ativa", status: "active" };
};

const statusConfig = {
  active: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className: "bg-green-500/15 text-green-500 border border-green-500/30",
  },
  scheduled: {
    icon: <CalendarClock className="h-3.5 w-3.5" />,
    className: "bg-yellow-500/15 text-yellow-500 border border-yellow-500/30",
  },
  finished: {
    icon: <Clock className="h-3.5 w-3.5" />,
    className: "bg-muted text-muted-foreground border border-border",
  },
};

// ── Media item ────────────────────────────────────────────────────────────────
function MediaItem({
  media,
  allowDownload,
  onExpand,
}: {
  media: CampaignMedia;
  allowDownload?: boolean;
  onExpand: () => void;
}) {
  const isImage = media.type.startsWith("image/");
  return (
    <div
      className="aspect-video relative group cursor-pointer rounded-lg overflow-hidden bg-black"
      onClick={onExpand}
    >
      {isImage ? (
        <Image
          src={media.url}
          alt="Mídia da campanha"
          fill
          className="object-contain transition-transform duration-500 group-hover:scale-[1.02]"
        />
      ) : (
        <video
          src={media.url}
          className="w-full h-full object-contain"
          controls={false}
        />
      )}
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/10 backdrop-blur-sm rounded-full p-3 border border-white/30">
          <Maximize className="h-6 w-6 text-white" />
        </div>
      </div>
      {/* Download button */}
      {allowDownload && (
        <a
          href={media.url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <Button size="icon" variant="secondary" className="h-8 w-8 bg-black/50 hover:bg-black/70 border-0 text-white">
            <Download className="h-3.5 w-3.5" />
          </Button>
        </a>
      )}
    </div>
  );
}

// ── Campaign card ─────────────────────────────────────────────────────────────
function CampaignCard({
  campaign,
  onExpand,
}: {
  campaign: Campaign;
  onExpand: (media: CampaignMedia) => void;
}) {
  const status = getCampaignStatus(campaign);
  const sc = statusConfig[status.status];
  const hasMedia = campaign.media && campaign.media.length > 0;
  const multiMedia = hasMedia && campaign.media.length > 1;

  const relativeTime = React.useMemo(() => {
    if (!campaign.createdAt) return "";
    try {
      const date = campaign.createdAt.toDate
        ? campaign.createdAt.toDate()
        : parseISO(campaign.createdAt);
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    } catch {
      return "";
    }
  }, [campaign.createdAt]);

  return (
    <article className={cn(
      "group rounded-2xl border bg-card overflow-hidden",
      "shadow-sm hover:shadow-lg transition-all duration-300",
      status.status === "finished" && "opacity-60"
    )}>
      {/* Card header */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Logo / icon */}
          <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-base leading-tight truncate">{campaign.title}</h2>
            {relativeTime && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {relativeTime}
              </p>
            )}
          </div>
        </div>
        {/* Status badge */}
        <span className={cn(
          "inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0",
          sc.className
        )}>
          {sc.icon}
          {status.text}
        </span>
      </div>

      {/* Media */}
      {hasMedia && (
        <div className="px-5">
          {multiMedia ? (
            <div className="rounded-xl overflow-hidden border border-border/50">
              <Carousel
                className="w-full"
                plugins={[Autoplay({ delay: 4000, stopOnInteraction: true })]}
              >
                <CarouselContent>
                  {campaign.media.map((media, index) => (
                    <CarouselItem key={index}>
                      <MediaItem
                        media={media}
                        allowDownload={campaign.allowDownload}
                        onExpand={() => onExpand(media)}
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-3" />
                <CarouselNext className="right-3" />
              </Carousel>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden border border-border/50">
              <MediaItem
                media={campaign.media[0]}
                allowDownload={campaign.allowDownload}
                onExpand={() => onExpand(campaign.media[0])}
              />
            </div>
          )}
        </div>
      )}

      {/* Text */}
      {campaign.text && (
        <div className="px-5 pt-4 pb-5">
          <p className="text-sm text-card-foreground/90 whitespace-pre-wrap leading-relaxed">
            {campaign.text}
          </p>
        </div>
      )}

      {/* Bottom divider line accent */}
      <div className={cn(
        "h-0.5 w-full",
        status.status === "active" && "bg-gradient-to-r from-primary/40 via-primary/20 to-transparent",
        status.status === "scheduled" && "bg-gradient-to-r from-yellow-500/40 via-yellow-500/20 to-transparent",
        status.status === "finished" && "bg-transparent",
      )} />
    </article>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CampaignsPage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  const [userData, setUserData] = React.useState<UserType | null>(null);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedMedia, setSelectedMedia] = React.useState<CampaignMedia | null>(null);

  const fetchCampaigns = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const currentUserData = userDocSnap.exists() ? (userDocSnap.data() as UserType) : null;
      setUserData(currentUserData);

      const q = query(collection(db, "campaigns"), orderBy("createdAt", "desc"));
      const campaignSnapshot = await getDocs(q);
      const campaignsList = campaignSnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Campaign)
      );

      const filteredCampaigns = campaignsList.filter((campaign) => {
        if (currentUserData?.isAdmin) return true;
        if (!campaign.targetRoleIds || campaign.targetRoleIds.length === 0) return true;
        return currentUserData?.roleId && campaign.targetRoleIds.includes(currentUserData.roleId);
      });

      setCampaigns(filteredCampaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      toast({
        title: "Erro ao buscar campanhas",
        description: "Não foi possível carregar o feed de campanhas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  React.useEffect(() => {
    if (!authLoading) fetchCampaigns();
  }, [fetchCampaigns, authLoading]);

  const visibleCampaigns = campaigns.filter((c) => {
    const s = getCampaignStatus(c);
    return s.status === "active" || s.status === "scheduled";
  });

  const activeCnt = campaigns.filter((c) => getCampaignStatus(c).status === "active").length;
  const scheduledCnt = campaigns.filter((c) => getCampaignStatus(c).status === "scheduled").length;

  if (loading || authLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando campanhas...</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6 pb-10">

        {/* ── Header ── */}
        <div className="relative rounded-2xl overflow-hidden border bg-card px-6 py-8">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-primary/8 via-transparent to-transparent" />
          <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:20px_20px]" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Megaphone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Campanhas</h1>
                <p className="text-sm text-muted-foreground">Feed de comunicações da equipe</p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {activeCnt > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-green-500/15 text-green-500 border border-green-500/25">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  {activeCnt} {activeCnt === 1 ? "ativa" : "ativas"}
                </div>
              )}
              {scheduledCnt > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-yellow-500/15 text-yellow-500 border border-yellow-500/25">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {scheduledCnt} agendada{scheduledCnt > 1 ? "s" : ""}
                </div>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={fetchCampaigns}
                disabled={loading}
                className="h-8 w-8 shrink-0"
              >
                <RefreshCw className={loading ? "animate-spin h-3.5 w-3.5" : "h-3.5 w-3.5"} />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Feed ── */}
        <div className="max-w-2xl mx-auto w-full space-y-5">
          {visibleCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-72 rounded-2xl border border-dashed gap-3 text-center px-4">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                <Frown className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Nenhuma campanha ativa</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Parece que não há nenhuma campanha para você no momento.
                </p>
              </div>
            </div>
          ) : (
            visibleCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onExpand={setSelectedMedia}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Lightbox ── */}
      <Dialog open={!!selectedMedia} onOpenChange={(open) => !open && setSelectedMedia(null)}>
        <DialogContent className="max-w-5xl p-2 sm:p-3 bg-black/90 border-white/10 backdrop-blur-xl">
          <VisuallyHidden>
            <DialogTitle>Mídia Expandida</DialogTitle>
          </VisuallyHidden>
          {selectedMedia && (
            <div className="w-full flex items-center justify-center">
              {selectedMedia.type.startsWith("image/") ? (
                <Image
                  src={selectedMedia.url}
                  alt="Mídia expandida"
                  width={1920}
                  height={1080}
                  className="max-w-full max-h-[85vh] object-contain rounded-lg"
                />
              ) : (
                <video
                  src={selectedMedia.url}
                  className="max-w-full max-h-[85vh] object-contain rounded-lg"
                  controls
                  autoPlay
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
