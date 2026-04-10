import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  useValidateSession,
  useGetMenuCategories,
  useCreateOrder,
  useGetTableOrders,
  getGetTableOrdersQueryKey,
  type MenuItem,
} from "@workspace/api-client-react";
import { useStore } from "@/hooks/use-store";
import { useGuestRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingBag, Plus, Minus, X,
  Clock, ArrowRight, ReceiptText, QrCode,
  Banknote, Building2, AlertTriangle, View,
  Star, MapPin, Phone, MessageSquare,
  ChevronDown, ChevronLeft, ChevronRight,
  Send, Instagram, Facebook,
} from "lucide-react";
import "@google/model-viewer";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/* ─── Custom hooks for new APIs ─── */

function useBanners() {
  return useQuery({
    queryKey: ["banners"],
    queryFn: () => fetch("/api/banners").then(r => r.json()),
  });
}

function useReviews() {
  return useQuery({
    queryKey: ["reviews"],
    queryFn: () => fetch("/api/reviews").then(r => r.json()),
  });
}

function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then(r => r.json()),
  });
}

function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; phone: string; rating: number; comment: string }) =>
      fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews"] }),
  });
}

/* ─── Entry point ─── */

export default function GuestMenuPage() {
  const [token, setToken] = useState<string | null>(null);
  const isDemo = window.location.pathname.endsWith("/demo");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('t');
    if (t) setToken(t);
  }, []);

  if (isDemo) return <DemoMenuContent />;

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="w-24 h-24 bg-card rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-primary/10 border border-border">
            <QrCode size={48} className="text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold">Тавтай морилно уу</h1>
          <p className="text-muted-foreground text-lg">Захиалга өгөхийн тулд ширээн дээрх QR кодыг уншуулна уу.</p>
        </div>
      </div>
    );
  }

  return <GuestMenuContent token={token} />;
}

/* ─── Demo mode (no token) ─── */

function DemoMenuContent() {
  const { data: settings } = useSettings();
  const [view, setView] = useState<'menu' | 'reviews'>('menu');
  const [showMap, setShowMap] = useState(false);
  const name = settings?.restaurantName || "Ресторан";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <GuestHeader name={name} tableName="Demo" view={view} setView={setView} settings={settings} />
      <main className="max-w-4xl mx-auto flex-1 w-full">
        {view === 'menu' ? (
          <>
            <BannerCarousel />
            <MenuSection />
          </>
        ) : (
          <ReviewsSection />
        )}
      </main>
      <GuestFooter settings={settings} onMapClick={() => setShowMap(true)} />
      <AnimatePresence>{showMap && <MapModal settings={settings} onClose={() => setShowMap(false)} />}</AnimatePresence>
    </div>
  );
}

/* ─── Main guest content (with token) ─── */

function GuestMenuContent({ token }: { token: string }) {
  const { data: session, isLoading: sessionLoading, error: sessionError } = useValidateSession({ token });
  const { data: settings } = useSettings();
  const [view, setView] = useState<'menu' | 'orders' | 'reviews'>('menu');
  const [cartOpen, setCartOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const { connected } = useGuestRealtime(token);
  const name = settings?.restaurantName || "Ресторан";

  if (sessionLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (sessionError || !session?.valid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-display font-bold text-destructive">Хүчингүй QR код</h1>
          <p className="text-muted-foreground">QR кодын сесс хүчингүй болсон байна. Үйлчлэгчдэд хандана уу.</p>
        </div>
      </div>
    );
  }

  if ((session as any).tableStatus === "available") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="w-24 h-24 bg-yellow-500/10 rounded-3xl mx-auto flex items-center justify-center border border-yellow-500/20">
            <AlertTriangle size={48} className="text-yellow-500" />
          </div>
          <h1 className="text-2xl font-display font-bold">Ширээ идэвхжээгүй</h1>
          <p className="text-muted-foreground text-lg">Захиалга өгөхийн тулд үйлчлэгчид хандаж ширээгээ идэвхжүүлнэ үү.</p>
          <p className="text-sm text-muted-foreground/60">{session.tableName}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <GuestHeader name={name} tableName={session.tableName} view={view} setView={setView} connected={connected} settings={settings} hasOrders />

      <main className="max-w-4xl mx-auto flex-1 w-full pb-32">
        <AnimatePresence mode="wait">
          {view === 'menu' ? (
            <motion.div key="menu" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <BannerCarousel />
              <MenuSection />
            </motion.div>
          ) : view === 'orders' ? (
            <motion.div key="orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <OrdersSection token={token} />
            </motion.div>
          ) : (
            <motion.div key="reviews" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <ReviewsSection />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {view === 'menu' && <CartFloatButton onClick={() => setCartOpen(true)} />}
      <AnimatePresence>
        {cartOpen && <CartDrawer token={token} onClose={() => setCartOpen(false)} onOrderSuccess={() => { setCartOpen(false); setView('orders'); }} />}
      </AnimatePresence>

      <GuestFooter settings={settings} onMapClick={() => setShowMap(true)} />
      <AnimatePresence>{showMap && <MapModal settings={settings} onClose={() => setShowMap(false)} />}</AnimatePresence>
    </div>
  );
}

/* ─── Header ─── */

function GuestHeader({ name, tableName, view, setView, connected, settings, hasOrders }: {
  name: string; tableName: string;
  view: string; setView: (v: any) => void;
  connected?: boolean;
  settings?: any; hasOrders?: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-card border border-white/10 flex items-center justify-center overflow-hidden">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt={name} className="w-6 h-6 object-contain" />
            )}
          </div>
          <div>
            <h1 className="font-display font-bold leading-tight text-sm">{name}</h1>
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest">{tableName}</p>
          </div>
        </div>

        <div className="flex bg-card p-1 rounded-xl border border-white/5">
          <button onClick={() => setView('menu')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${view === 'menu' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-white'}`}>
            Цэс
          </button>
          {hasOrders && (
            <button onClick={() => setView('orders')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${view === 'orders' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-white'}`}>
              Захиалга {connected && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>}
            </button>
          )}
          <button onClick={() => setView('reviews')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${view === 'reviews' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-white'}`}>
            Сэтгэгдэл
          </button>
        </div>
      </div>
    </header>
  );
}

/* ─── Banner Carousel ─── */

function BannerCarousel() {
  const { data: banners } = useBanners();
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const items = (banners ?? []) as Array<{ id: number; imageUrl: string; title?: string; linkUrl?: string }>;

  useEffect(() => {
    if (items.length <= 1) return;
    timerRef.current = setInterval(() => setCurrent(c => (c + 1) % items.length), 4000);
    return () => clearInterval(timerRef.current);
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="relative h-40 md:h-56">
        <img src={`${import.meta.env.BASE_URL}images/hero-bg.png`} alt="Restaurant" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-5 left-6 pr-6">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-1">Амтыг мэдрэ</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-44 md:h-60 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.img
          key={items[current]?.id}
          src={items[current]?.imageUrl}
          alt={items[current]?.title || "Banner"}
          className="w-full h-full object-cover absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />

      {items.length > 1 && (
        <>
          <button onClick={() => setCurrent(c => (c - 1 + items.length) % items.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-1.5 text-white hover:bg-black/70">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setCurrent(c => (c + 1) % items.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-1.5 text-white hover:bg-black/70">
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {items.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-white w-5' : 'bg-white/40'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Menu Section with sub-categories ─── */

function MenuSection() {
  const { data: categories, isLoading } = useGetMenuCategories();
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [expandedSubs, setExpandedSubs] = useState<Set<number>>(new Set());

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading menu...</div>;

  const cats = (categories ?? []) as Array<any>;
  const activeCatId = selectedCatId ?? cats[0]?.id ?? null;
  const activeCat = cats.find((c: any) => c.id === activeCatId);
  const children = activeCat?.children ?? [];
  const directItems = (activeCat?.items ?? []).filter((i: any) => i.available !== false);

  const toggleSub = (id: number) => {
    setExpandedSubs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div>
      {/* Category tab strip */}
      <div className="sticky top-16 z-30 bg-background/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {cats.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => { setSelectedCatId(cat.id); setExpandedSubs(new Set()); }}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                cat.id === activeCatId
                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                  : 'bg-card text-muted-foreground border-white/10 hover:border-primary/40 hover:text-foreground'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="px-4 pt-6 pb-4">
        {activeCat && (
          <div>
            <h3 className="text-xl font-display font-bold text-primary mb-5">{activeCat.name}</h3>

            {/* Direct items of this category */}
            {directItems.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                {directItems.map((item: any) => <MenuItemCard key={item.id} item={item} />)}
              </div>
            )}

            {/* Sub-categories */}
            {children.length > 0 && (
              <div className="space-y-3">
                {children.map((sub: any) => {
                  const subItems = (sub.items ?? []).filter((i: any) => i.available !== false);
                  const isExpanded = expandedSubs.has(sub.id);
                  return (
                    <div key={sub.id} className="border border-white/5 rounded-2xl overflow-hidden">
                      <button
                        onClick={() => toggleSub(sub.id)}
                        className="w-full flex items-center justify-between px-5 py-4 bg-card hover:bg-card/80 transition-colors"
                      >
                        <span className="font-semibold">{sub.name}</span>
                        <ChevronDown size={18} className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                              {subItems.length > 0 ? (
                                subItems.map((item: any) => <MenuItemCard key={item.id} item={item} />)
                              ) : (
                                <p className="text-sm text-muted-foreground col-span-2 text-center py-4">Хоосон байна</p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}

            {directItems.length === 0 && children.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p>Энэ ангилалд одоогоор хоол байхгүй байна.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Menu Item Card ─── */

function MenuItemCard({ item }: { item: MenuItem }) {
  const { addToCart } = useStore();
  const { toast } = useToast();
  const [showAR, setShowAR] = useState(false);
  const imgUrl = item.imageUrl || `${import.meta.env.BASE_URL}images/menu-placeholder.png`;
  const modelUrl = (item as any).modelUrl as string | null;

  const handleAdd = () => {
    addToCart(item, 1);
    toast({ title: "Сагсанд нэмэгдлээ", description: `${item.name} захиалганд нэмэгдлээ`, duration: 2000 });
  };

  return (
    <>
      <div className={`bg-card border border-white/5 rounded-2xl overflow-hidden flex shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${!item.available ? 'opacity-50 grayscale' : ''}`}>
        <div className="w-28 h-28 flex-shrink-0 bg-muted relative">
          <img src={imgUrl} alt={item.name} className="w-full h-full object-cover" />
          {modelUrl && (
            <button onClick={() => setShowAR(true)} className="absolute bottom-1 left-1 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-primary transition-colors">
              <View size={12} /> AR
            </button>
          )}
        </div>
        <div className="p-4 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start gap-2">
              <h4 className="font-bold text-lg leading-tight">{item.name}</h4>
              <span className="font-bold text-primary whitespace-nowrap">₮{Number(item.price).toLocaleString()}</span>
            </div>
            {item.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{item.description}</p>}
          </div>
          <div className="mt-4 flex items-center justify-between">
            {modelUrl && (
              <button onClick={() => setShowAR(true)} className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                <View size={14} /> 3D харах
              </button>
            )}
            <div className={!modelUrl ? "ml-auto" : ""}>
              <Button size="sm" className="h-8 rounded-lg font-bold shadow-md shadow-primary/20" disabled={!item.available} onClick={handleAdd}>
                {item.available ? <><Plus size={14} className="mr-1" /> Нэмэх</> : "Дуусчээ"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAR && modelUrl && <ARViewerModal modelUrl={modelUrl} itemName={item.name} onClose={() => setShowAR(false)} />}
      </AnimatePresence>
    </>
  );
}

/* ─── AR Viewer Modal ─── */

function ARViewerModal({ modelUrl, itemName, onClose }: { modelUrl: string; itemName: string; onClose: () => void }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]" />
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="fixed inset-4 md:inset-16 z-[60] bg-card rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-background/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center"><View size={18} className="text-primary" /></div>
            <div>
              <h3 className="font-bold text-lg">{itemName}</h3>
              <p className="text-xs text-muted-foreground">3D загвар & AR</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X size={20} /></button>
        </div>
        <div className="flex-1 relative bg-gradient-to-b from-zinc-900 to-zinc-950">
          {/* @ts-ignore */}
          <model-viewer
            src={modelUrl.endsWith(".usdz") ? undefined : modelUrl}
            ios-src={modelUrl.endsWith(".usdz") ? modelUrl : undefined}
            alt={`${itemName} 3D загвар`}
            ar
            ar-modes="webxr scene-viewer quick-look"
            ar-scale="fixed"
            camera-controls
            touch-action="pan-y"
            auto-rotate
            shadow-intensity="1"
            scale="0.5 0.5 0.5"
            min-camera-orbit="auto auto 0.1m"
            max-camera-orbit="auto auto 2m"
            camera-orbit="0deg 75deg 1m"
            style={{ width: "100%", height: "100%", minHeight: "300px" }}
          >
            <button slot="ar-button" className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-primary text-white px-6 py-3 rounded-2xl font-bold shadow-xl shadow-primary/30 flex items-center gap-2 text-sm">
              <View size={18} /> AR-аар харах
            </button>
          {/* @ts-ignore */}
          </model-viewer>
        </div>
        <div className="p-4 border-t border-white/5 bg-background/50">
          <p className="text-xs text-muted-foreground text-center">Гар хурууаар эргүүлж, томруулж харна уу. "AR-аар харах" дарж ширээн дээрээ байрлуулна уу.</p>
        </div>
      </motion.div>
    </>
  );
}

/* ─── Cart Float Button ─── */

function CartFloatButton({ onClick }: { onClick: () => void }) {
  const cart = useStore(s => s.cart);
  if (cart.length === 0) return null;
  const total = cart.reduce((acc, item) => acc + (Number(item.menuItem.price) * item.quantity), 0);
  const count = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed bottom-6 left-4 right-4 md:left-auto md:right-8 md:w-80 z-50">
      <button onClick={onClick} className="w-full bg-primary text-white p-4 rounded-2xl shadow-2xl shadow-primary/40 flex items-center justify-between hover:scale-[1.02] transition-transform">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center relative">
            <ShoppingBag size={20} />
            <span className="absolute -top-2 -right-2 bg-foreground text-background text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">{count}</span>
          </div>
          <span className="font-bold">Захиалга харах</span>
        </div>
        <span className="font-bold text-lg">₮{total.toLocaleString()}</span>
      </button>
    </motion.div>
  );
}

/* ─── Cart Drawer (with item notes) ─── */

function CartDrawer({ token, onClose, onOrderSuccess }: { token: string; onClose: () => void; onOrderSuccess: () => void }) {
  const { cart, updateQuantity, removeFromCart, clearCart, setItemNotes } = useStore();
  const createOrder = useCreateOrder();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [orderNotes, setOrderNotes] = useState("");

  const total = cart.reduce((acc, item) => acc + (Number(item.menuItem.price) * item.quantity), 0);

  const handlePlaceOrder = () => {
    createOrder.mutate({
      data: {
        tableToken: token,
        items: cart.map(i => ({ menuItemId: i.menuItem.id, quantity: i.quantity, notes: i.notes })),
        paymentMethod,
        notes: orderNotes || undefined,
      } as any
    }, {
      onSuccess: () => {
        clearCart();
        setOrderNotes("");
        queryClient.invalidateQueries({ queryKey: getGetTableOrdersQueryKey(token) });
        toast({ title: "Захиалга явлаа!", description: paymentMethod === "bank" ? "Банкаар төлбөр хийгдсэн." : "Кассаар төлбөрөө төлнө үү." });
        onOrderSuccess();
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message || err?.message || "Захиалга явуулж чадсангүй.";
        toast({ title: "Алдаа", description: msg, variant: "destructive" });
      }
    });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 md:left-auto md:w-96 md:top-0 md:bottom-0 bg-card z-50 flex flex-col shadow-2xl md:rounded-l-3xl rounded-t-3xl border-t md:border-l border-white/10"
        style={{ maxHeight: '85vh' }}
      >
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-background/50">
          <h2 className="text-xl font-display font-bold">Таны захиалга</h2>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {cart.length === 0 ? (
            <div className="text-center text-muted-foreground mt-10">
              <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
              <p>Сагс хоосон байна.</p>
            </div>
          ) : (
            <>
              {cart.map(item => (
                <div key={item.menuItem.id} className="space-y-2">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <h4 className="font-bold text-foreground">{item.menuItem.name}</h4>
                      <p className="text-primary font-bold text-sm mt-1">₮{Number(item.menuItem.price).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-3 bg-background border border-white/10 rounded-xl p-1">
                        <button onClick={() => updateQuantity(item.menuItem.id, -1)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-white bg-white/5 rounded-lg"><Minus size={14} /></button>
                        <span className="font-bold w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.menuItem.id, 1)} className="w-8 h-8 flex items-center justify-center text-primary hover:text-primary-foreground bg-primary/20 hover:bg-primary rounded-lg transition-colors"><Plus size={14} /></button>
                      </div>
                      <button onClick={() => removeFromCart(item.menuItem.id)} className="text-xs text-destructive underline decoration-dotted underline-offset-2">Хасах</button>
                    </div>
                  </div>
                  {/* Per-item note */}
                  <input
                    type="text"
                    placeholder="Нэмэлт тайлбар... (жишээ: хальсгүй)"
                    value={item.notes || ""}
                    onChange={e => setItemNotes(item.menuItem.id, e.target.value)}
                    className="w-full text-xs bg-background border border-white/10 rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                  />
                </div>
              ))}

              {/* General order note removed - per-item notes are sufficient */}
            </>
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-5 bg-background border-t border-white/5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Нийт төлбөр</span>
              <span className="text-2xl font-bold text-foreground">₮{total.toLocaleString()}</span>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Төлбөрийн хэлбэр</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPaymentMethod("cash")} className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${paymentMethod === "cash" ? "border-primary bg-primary/10 text-primary" : "border-white/10 text-muted-foreground hover:border-white/20"}`}>
                  <Banknote size={22} /><span className="text-xs font-bold">Кассаар</span>
                </button>
                <button onClick={() => setPaymentMethod("bank")} className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${paymentMethod === "bank" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-white/10 text-muted-foreground hover:border-white/20"}`}>
                  <Building2 size={22} /><span className="text-xs font-bold">Банкаар</span>
                </button>
              </div>
            </div>

            <Button
              onClick={handlePlaceOrder}
              disabled={createOrder.isPending}
              className={`w-full h-14 rounded-xl text-lg font-bold shadow-xl relative overflow-hidden group ${paymentMethod === "bank" ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" : "shadow-primary/20"}`}
            >
              <span className="relative z-10 flex items-center gap-2">
                {createOrder.isPending ? "Илгээж байна..." : "Захиалах"} <ArrowRight size={18} />
              </span>
            </Button>
          </div>
        )}
      </motion.div>
    </>
  );
}

/* ─── Orders Section ─── */

function OrdersSection({ token }: { token: string }) {
  const { data: allOrders, isLoading } = useGetTableOrders(token);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Ачааллаж байна...</div>;

  const orders = (allOrders ?? []).filter(o => o.status !== 'paid' && o.status !== 'cancelled');

  if (orders.length === 0) {
    return (
      <div className="text-center p-12 mt-12 bg-card rounded-3xl border border-white/5 mx-4 shadow-xl">
        <ReceiptText size={48} className="mx-auto mb-4 text-primary/40" />
        <h3 className="text-xl font-display font-bold mb-2">Идэвхтэй захиалга байхгүй</h3>
        <p className="text-muted-foreground">Цэсийг үзэж эхний захиалгаа өгнө үү.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {orders.map(order => (
        <div key={order.id} className="bg-card rounded-2xl p-5 border border-white/5 shadow-xl">
          <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1"><Clock size={14}/> {format(new Date(order.createdAt), 'HH:mm')}</p>
              <p className="font-bold text-lg mt-1 text-primary">#{order.id}</p>
              {["pending", "confirmed", "preparing"].includes(order.status) && (
                <EstimatedTime order={order} />
              )}
            </div>
            <OrderStatusTracker status={order.status} />
          </div>
          <ul className="space-y-3 mb-4">
            {order.items.map(item => (
              <li key={item.id} className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="bg-white/10 w-6 h-6 flex items-center justify-center rounded font-bold">{item.quantity}</span>
                  {item.menuItemName}
                </span>
                <span className="text-muted-foreground">₮{(Number(item.unitPrice) * item.quantity).toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <div className="pt-4 border-t border-white/5 flex justify-between items-center">
            <span className="text-muted-foreground">Нийт</span>
            <span className="font-bold text-xl">₮{Number(order.totalAmount).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function EstimatedTime({ order }: { order: any }) {
  // Estimate based on max preparationTime of items (default 15 min)
  const maxPrepTime = Math.max(...(order.items ?? []).map((i: any) => i.preparationTime ?? 15), 15);
  const createdAt = new Date(order.createdAt).getTime();
  const readyAt = createdAt + maxPrepTime * 60000;
  const remaining = Math.max(0, Math.ceil((readyAt - Date.now()) / 60000));

  if (remaining <= 0) return (
    <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
      <Clock size={10} /> Удахгүй бэлэн болно
    </p>
  );

  return (
    <p className="text-xs text-orange-400 mt-1 flex items-center gap-1">
      <Clock size={10} /> ~{remaining} мин хүлээнэ
    </p>
  );
}

function OrderStatusTracker({ status }: { status: string }) {
  const steps = ['pending', 'confirmed', 'preparing', 'ready', 'served'];
  const currentIndex = steps.indexOf(status);
  const labels: Record<string, string> = { pending: 'Хүлээгдэж буй', confirmed: 'Баталгаажсан', preparing: 'Бэлтгэж буй', ready: 'Бэлэн', served: 'Зөөгдсөн', paid: 'Төлөгдсөн', cancelled: 'Цуцлагдсан' };

  if (status === 'paid' || status === 'cancelled') {
    return <div className={`px-4 py-1.5 rounded-full text-xs font-bold ${status === 'paid' ? 'bg-zinc-800 text-zinc-400' : 'bg-red-500/20 text-red-500'}`}>{labels[status]}</div>;
  }

  return (
    <div className="flex flex-col items-end">
      <div className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold mb-2">{labels[status] || status}</div>
      <div className="flex gap-1">
        {steps.map((step, idx) => (
          <div key={step} className={`w-3 h-1.5 rounded-full ${idx <= currentIndex ? 'bg-primary' : 'bg-white/10'}`} title={step} />
        ))}
      </div>
    </div>
  );
}

/* ─── Reviews Section ─── */

function ReviewsSection() {
  const { data: reviews, isLoading } = useReviews();
  const submitReview = useSubmitReview();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !comment) {
      toast({ title: "Алдаа", description: "Бүх талбарыг бөглөнө үү", variant: "destructive" });
      return;
    }
    submitReview.mutate({ name, phone, rating, comment }, {
      onSuccess: () => {
        toast({ title: "Баярлалаа!", description: "Таны сэтгэгдэл амжилттай бичигдлээ." });
        setShowForm(false); setName(""); setPhone(""); setRating(5); setComment("");
      },
      onError: () => toast({ title: "Алдаа", description: "Сэтгэгдэл илгээж чадсангүй", variant: "destructive" }),
    });
  };

  const items = (reviews ?? []) as Array<{ id: number; rating: number; comment: string; createdAt: string }>;
  const avgRating = items.length > 0 ? (items.reduce((s, r) => s + r.rating, 0) / items.length).toFixed(1) : "0";

  return (
    <div className="p-4 space-y-6">
      {/* Summary */}
      <div className="bg-card rounded-2xl p-6 border border-white/5 shadow-xl text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Star size={28} className="text-yellow-500 fill-yellow-500" />
          <span className="text-4xl font-bold">{avgRating}</span>
        </div>
        <p className="text-sm text-muted-foreground">{items.length} сэтгэгдэл</p>
        <Button className="mt-4" onClick={() => setShowForm(!showForm)}>
          <MessageSquare size={16} className="mr-2" /> Сэтгэгдэл бичих
        </Button>
      </div>

      {/* Review Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
            onSubmit={handleSubmit}
          >
            <div className="bg-card rounded-2xl p-5 border border-white/5 shadow-xl space-y-4">
              <input type="text" placeholder="Таны нэр" value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50" />
              <input type="tel" placeholder="Утасны дугаар" value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50" />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Үнэлгээ</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} type="button" onClick={() => setRating(s)}>
                      <Star size={28} className={`transition-colors ${s <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-white/10'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <textarea placeholder="Сэтгэгдэл бичнэ үү..." value={comment} onChange={e => setComment(e.target.value)} rows={3}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 resize-none" />
              <Button type="submit" className="w-full" disabled={submitReview.isPending}>
                <Send size={16} className="mr-2" /> {submitReview.isPending ? "Илгээж байна..." : "Илгээх"}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Reviews list */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">Ачааллаж байна...</div>
      ) : items.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
          <p>Одоогоор сэтгэгдэл байхгүй байна.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(r => (
            <div key={r.id} className="bg-card rounded-2xl p-5 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} size={14} className={s <= r.rating ? 'text-yellow-500 fill-yellow-500' : 'text-white/10'} />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">{format(new Date(r.createdAt), 'yyyy.MM.dd')}</span>
              </div>
              <p className="text-sm text-foreground">{r.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Footer ─── */

function ReservationBooking({ restaurantName }: { restaurantName: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name || !phone || !date) return;
    setError("");
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: name, guestPhone: phone,
          partySize: parseInt(partySize) || 2,
          reservationDate: `${date}T${time}:00`,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Алдаа гарлаа");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Алдаа гарлаа");
    }
  };

  if (!open) return (
    <div className="mt-6 pt-4 border-t border-white/5">
      <button onClick={() => setOpen(true)}
        className="w-full py-3 bg-primary/10 border border-primary/20 rounded-xl text-primary font-bold text-sm hover:bg-primary/20 transition-colors flex items-center justify-center gap-2">
        <Clock size={16} /> Ширээ захиалах
      </button>
    </div>
  );

  if (submitted) return (
    <div className="mt-6 pt-4 border-t border-white/5 text-center space-y-2">
      <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
        <Star size={32} className="text-green-400" />
      </div>
      <p className="font-bold text-lg">Захиалга бүртгэгдлээ!</p>
      <p className="text-sm text-muted-foreground">Бид тантай удахгүй холбогдоно.</p>
    </div>
  );

  return (
    <div className="mt-6 pt-4 border-t border-white/5 space-y-3">
      <h4 className="font-bold text-sm">Ширээ захиалах</h4>
      <div className="grid grid-cols-2 gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Таны нэр *"
          className="bg-background border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Утасны дугаар *"
          className="bg-background border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
        <input type="number" value={partySize} onChange={e => setPartySize(e.target.value)} placeholder="Хүний тоо" min="1" max="50"
          className="bg-background border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="bg-background border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary [color-scheme:dark]" />
        <input type="time" value={time} onChange={e => setTime(e.target.value)}
          className="col-span-2 bg-background border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary [color-scheme:dark]" />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={!name || !phone || !date}
          className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm disabled:opacity-50">
          Захиалах
        </button>
        <button onClick={() => setOpen(false)}
          className="px-4 py-2.5 border border-white/10 rounded-xl text-sm text-muted-foreground hover:text-foreground">
          Болих
        </button>
      </div>
    </div>
  );
}

function GuestFooter({ settings, onMapClick }: { settings?: any; onMapClick: () => void }) {
  const name = settings?.restaurantName || "Ресторан";
  const phone = settings?.restaurantPhone;
  const address = settings?.restaurantAddress;
  const instagram = settings?.instagramUrl;
  const facebook = settings?.facebookUrl;
  const openHours = settings?.openHours;
  const googleMapsUrl = settings?.googleMapsUrl;

  return (
    <footer className="bg-card border-t border-white/5 mt-auto">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left space-y-1.5">
            <h3 className="font-display font-bold text-lg">{name}</h3>
            {phone && <p className="text-sm text-muted-foreground flex items-center gap-1.5 justify-center md:justify-start"><Phone size={14} /> {phone}</p>}
            {address && <p className="text-sm text-muted-foreground flex items-center gap-1.5 justify-center md:justify-start"><MapPin size={14} /> {address}</p>}
            {openHours && <p className="text-sm text-muted-foreground flex items-center gap-1.5 justify-center md:justify-start"><Clock size={14} /> {openHours}</p>}
          </div>
          <div className="flex items-center gap-3">
            {googleMapsUrl && (
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="p-2.5 bg-background border border-white/10 rounded-xl hover:bg-white/10 transition-colors" title="Байршил">
                <MapPin size={18} className="text-primary" />
              </a>
            )}
            {instagram && (
              <a href={instagram} target="_blank" rel="noopener noreferrer" className="p-2.5 bg-background border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                <Instagram size={18} className="text-pink-500" />
              </a>
            )}
            {facebook && (
              <a href={facebook} target="_blank" rel="noopener noreferrer" className="p-2.5 bg-background border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                <Facebook size={18} className="text-blue-500" />
              </a>
            )}
          </div>
        </div>
        {/* Reservation booking */}
        <ReservationBooking restaurantName={name} />

        <div className="mt-6 pt-4 border-t border-white/5 text-center">
          <p className="text-xs text-muted-foreground/50">&copy; {new Date().getFullYear()} {name}</p>
        </div>
      </div>
    </footer>
  );
}

/* ─── Map Modal ─── */

function MapModal({ settings, onClose }: { settings?: any; onClose: () => void }) {
  const lat = settings?.mapLat;
  const lng = settings?.mapLng;
  const name = settings?.restaurantName || "Ресторан";

  if (!lat || !lng) return null;

  const mapUrl = `https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]" />
      <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed inset-4 md:inset-16 z-[60] bg-card rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-background/50">
          <div className="flex items-center gap-3">
            <MapPin size={20} className="text-primary" />
            <h3 className="font-bold text-lg">{name} — Байршил</h3>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10"><X size={20} /></button>
        </div>
        <div className="flex-1 relative">
          <iframe src={mapUrl} className="w-full h-full border-0" allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
        <div className="p-4 border-t border-white/5 bg-background/50">
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="block w-full bg-primary text-white text-center py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors">
            <MapPin size={16} className="inline mr-2" /> Google Maps-д нээх
          </a>
        </div>
      </motion.div>
    </>
  );
}
