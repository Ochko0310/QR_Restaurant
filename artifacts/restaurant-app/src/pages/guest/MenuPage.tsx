import { useState, useEffect } from "react";
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
  Banknote, Building2, AlertTriangle, View
} from "lucide-react";
import "@google/model-viewer";
import { useQueryClient } from "@tanstack/react-query";

export default function GuestMenuPage() {
  const [token, setToken] = useState<string | null>(null);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('t');
    if (t) setToken(t);
  }, []);

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="w-24 h-24 bg-card rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-primary/10 border border-border">
            <QrCode size={48} className="text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold">L'Aura-д тавтай морилно уу</h1>
          <p className="text-muted-foreground text-lg">
            Захиалга өгөхийн тулд ширээн дээрх QR кодыг уншуулна уу.
          </p>
        </div>
      </div>
    );
  }

  return <GuestMenuContent token={token} />;
}

function GuestMenuContent({ token }: { token: string }) {
  const { data: session, isLoading: sessionLoading, error: sessionError } = useValidateSession({ token });
  const [view, setView] = useState<'menu' | 'orders'>('menu');
  const [cartOpen, setCartOpen] = useState(false);
  const { connected } = useGuestRealtime(token);

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

  // QR security: if table is not activated (available), block ordering
  if ((session as any).tableStatus === "available") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="w-24 h-24 bg-yellow-500/10 rounded-3xl mx-auto flex items-center justify-center border border-yellow-500/20">
            <AlertTriangle size={48} className="text-yellow-500" />
          </div>
          <h1 className="text-2xl font-display font-bold">Ширээ идэвхжээгүй</h1>
          <p className="text-muted-foreground text-lg">
            Захиалга өгөхийн тулд үйлчлэгчид хандаж ширээгээ идэвхжүүлнэ үү.
          </p>
          <p className="text-sm text-muted-foreground/60">
            {session.tableName}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-card border border-white/10 flex items-center justify-center">
               <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="L'Aura" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <h1 className="font-display font-bold leading-tight">L'Aura</h1>
              <p className="text-[10px] text-primary font-bold uppercase tracking-widest">{session.tableName}</p>
            </div>
          </div>
          
          <div className="flex bg-card p-1 rounded-xl border border-white/5">
            <button 
              onClick={() => setView('menu')}
              className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${view === 'menu' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-white'}`}
            >
              Цэс
            </button>
            <button 
              onClick={() => setView('orders')}
              className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${view === 'orders' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-white'}`}
            >
              Захиалга {connected && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          {view === 'menu' ? (
            <motion.div key="menu" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <MenuSection />
            </motion.div>
          ) : (
            <motion.div key="orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <OrdersSection token={token} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Cart Button */}
      {view === 'menu' && <CartFloatButton onClick={() => setCartOpen(true)} />}

      {/* Cart Drawer */}
      <AnimatePresence>
        {cartOpen && <CartDrawer token={token} onClose={() => setCartOpen(false)} onOrderSuccess={() => { setCartOpen(false); setView('orders'); }} />}
      </AnimatePresence>
    </div>
  );
}

function MenuSection() {
  const { data: categories, isLoading } = useGetMenuCategories();
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading menu...</div>;

  const cats = categories ?? [];
  const activeCatId = selectedCatId ?? cats[0]?.id ?? null;
  const activeCat = cats.find(c => c.id === activeCatId);
  const visibleItems = (activeCat?.items ?? []).filter(i => i.available !== false);

  return (
    <div>
      {/* Hero */}
      <div className="relative h-40 md:h-56 mb-0">
        <img src={`${import.meta.env.BASE_URL}images/hero-bg.png`} alt="Restaurant ambiance" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-5 left-6 pr-6">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-1">Амтыг мэдрэ</h2>
          <p className="text-white/70 text-sm max-w-md hidden md:block">Манай тогооч нарын гаргалгаатай хоол сонголтыг үзэгтүн.</p>
        </div>
      </div>

      {/* Category tab strip — sticky below header */}
      <div className="sticky top-16 z-30 bg-background/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {cats.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCatId(cat.id)}
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

      {/* Items grid for selected category */}
      <div className="px-4 pt-6 pb-4">
        {activeCat && (
          <div>
            <h3 className="text-xl font-display font-bold text-primary mb-5">{activeCat.name}</h3>
            {visibleItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {visibleItems.map(item => (
                  <MenuItemCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
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

function MenuItemCard({ item }: { item: MenuItem }) {
  const { addToCart } = useStore();
  const { toast } = useToast();
  const [showAR, setShowAR] = useState(false);
  const imgUrl = item.imageUrl || `${import.meta.env.BASE_URL}images/menu-placeholder.png`;
  const modelUrl = (item as any).modelUrl as string | null;

  const handleAdd = () => {
    addToCart(item, 1);
    toast({
      title: "Сагсанд нэмэгдлээ",
      description: `${item.name} захиалганд нэмэгдлээ`,
      duration: 2000,
    });
  };

  return (
    <>
      <div className={`bg-card border border-white/5 rounded-2xl overflow-hidden flex shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${!item.available ? 'opacity-50 grayscale' : ''}`}>
        <div className="w-28 h-28 flex-shrink-0 bg-muted relative">
          <img src={imgUrl} alt={item.name} className="w-full h-full object-cover" />
          {modelUrl && (
            <button
              onClick={() => setShowAR(true)}
              className="absolute bottom-1 left-1 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-primary transition-colors"
            >
              <View size={12} /> AR
            </button>
          )}
        </div>
        <div className="p-4 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start gap-2">
              <h4 className="font-bold text-lg leading-tight">{item.name}</h4>
              <span className="font-bold text-primary whitespace-nowrap">₮{item.price.toLocaleString()}</span>
            </div>
            {item.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{item.description}</p>}
          </div>

          <div className="mt-4 flex items-center justify-between">
            {modelUrl && (
              <button
                onClick={() => setShowAR(true)}
                className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
              >
                <View size={14} /> 3D харах
              </button>
            )}
            <div className={!modelUrl ? "ml-auto" : ""}>
              <Button
                size="sm"
                className="h-8 rounded-lg font-bold shadow-md shadow-primary/20"
                disabled={!item.available}
                onClick={handleAdd}
              >
                {item.available ? <><Plus size={14} className="mr-1" /> Нэмэх</> : "Дуусчээ"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* AR 3D Viewer Modal */}
      <AnimatePresence>
        {showAR && modelUrl && (
          <ARViewerModal modelUrl={modelUrl} itemName={item.name} onClose={() => setShowAR(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

function ARViewerModal({ modelUrl, itemName, onClose }: { modelUrl: string; itemName: string; onClose: () => void }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="fixed inset-4 md:inset-16 z-[60] bg-card rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-background/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
              <View size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg">{itemName}</h3>
              <p className="text-xs text-muted-foreground">3D загвар & AR</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* 3D Viewer */}
        <div className="flex-1 relative bg-gradient-to-b from-zinc-900 to-zinc-950">
          {/* @ts-ignore */}
          <model-viewer
            src={modelUrl}
            alt={`${itemName} 3D загвар`}
            ar
            ar-modes="webxr scene-viewer quick-look"
            camera-controls
            touch-action="pan-y"
            auto-rotate
            shadow-intensity="1"
            style={{ width: "100%", height: "100%", minHeight: "300px" }}
          >
            <button slot="ar-button" className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-primary text-white px-6 py-3 rounded-2xl font-bold shadow-xl shadow-primary/30 flex items-center gap-2 text-sm">
              <View size={18} /> AR-аар харах
            </button>
          {/* @ts-ignore */}
          </model-viewer>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-background/50">
          <p className="text-xs text-muted-foreground text-center">
            Гар хурууаар эргүүлж, томруулж харна уу. "AR-аар харах" дарж ширээн дээрээ байрлуулна уу.
          </p>
        </div>
      </motion.div>
    </>
  );
}

function CartFloatButton({ onClick }: { onClick: () => void }) {
  const cart = useStore(s => s.cart);
  if (cart.length === 0) return null;
  
  const total = cart.reduce((acc, item) => acc + (item.menuItem.price * item.quantity), 0);
  const count = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-6 left-4 right-4 md:left-auto md:right-8 md:w-80 z-50"
    >
      <button 
        onClick={onClick}
        className="w-full bg-primary text-white p-4 rounded-2xl shadow-2xl shadow-primary/40 flex items-center justify-between hover:scale-[1.02] transition-transform"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center relative">
            <ShoppingBag size={20} />
            <span className="absolute -top-2 -right-2 bg-foreground text-background text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
              {count}
            </span>
          </div>
          <span className="font-bold">Захиалга харах</span>
        </div>
        <span className="font-bold text-lg">₮{total.toLocaleString()}</span>
      </button>
    </motion.div>
  );
}

function CartDrawer({ token, onClose, onOrderSuccess }: { token: string, onClose: () => void, onOrderSuccess: () => void }) {
  const { cart, updateQuantity, removeFromCart, clearCart } = useStore();
  const createOrder = useCreateOrder();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");

  const total = cart.reduce((acc, item) => acc + (item.menuItem.price * item.quantity), 0);

  const handlePlaceOrder = () => {
    createOrder.mutate({
      data: {
        tableToken: token,
        items: cart.map(i => ({ menuItemId: i.menuItem.id, quantity: i.quantity, notes: i.notes })),
        paymentMethod,
      } as any
    }, {
      onSuccess: () => {
        clearCart();
        queryClient.invalidateQueries({ queryKey: getGetTableOrdersQueryKey(token) });
        if (paymentMethod === "bank") {
          toast({ title: "Захиалга явлаа!", description: "Банкаар төлбөр хийгдсэн. Захиалга гал тогоонд илгээгдлээ." });
        } else {
          toast({ title: "Захиалга явлаа!", description: "Кассаар төлбөрөө төлнө үү." });
        }
        onOrderSuccess();
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message || err?.message || "Захиалга явуулж чадсангүй. Дахин оролдоно уу.";
        toast({ title: "Алдаа", description: msg, variant: "destructive" });
      }
    });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 md:left-auto md:w-96 md:top-0 md:bottom-0 bg-card z-50 flex flex-col shadow-2xl md:rounded-l-3xl rounded-t-3xl border-t md:border-l border-white/10"
      >
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-background/50">
          <h2 className="text-xl font-display font-bold">Таны захиалга</h2>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {cart.length === 0 ? (
            <div className="text-center text-muted-foreground mt-10">
              <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
              <p>Сагс хоосон байна.</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.menuItem.id} className="flex gap-4">
                <div className="flex-1">
                  <h4 className="font-bold text-foreground">{item.menuItem.name}</h4>
                  <p className="text-primary font-bold text-sm mt-1">₮{item.menuItem.price.toLocaleString()}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-3 bg-background border border-white/10 rounded-xl p-1">
                    <button onClick={() => updateQuantity(item.menuItem.id, -1)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-white bg-white/5 rounded-lg">
                      <Minus size={14} />
                    </button>
                    <span className="font-bold w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.menuItem.id, 1)} className="w-8 h-8 flex items-center justify-center text-primary hover:text-primary-foreground bg-primary/20 hover:bg-primary rounded-lg transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>
                  <button onClick={() => removeFromCart(item.menuItem.id)} className="text-xs text-destructive underline decoration-dotted underline-offset-2">Хасах</button>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-5 bg-background border-t border-white/5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Нийт төлбөр</span>
              <span className="text-2xl font-bold text-foreground">₮{total.toLocaleString()}</span>
            </div>

            {/* Payment method selection */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Төлбөрийн хэлбэр</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    paymentMethod === "cash"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-white/10 text-muted-foreground hover:border-white/20"
                  }`}
                >
                  <Banknote size={24} />
                  <span className="text-sm font-bold">Кассаар</span>
                  <span className="text-[10px] opacity-70">Бэлнээр төлөх</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("bank")}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    paymentMethod === "bank"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                      : "border-white/10 text-muted-foreground hover:border-white/20"
                  }`}
                >
                  <Building2 size={24} />
                  <span className="text-sm font-bold">Банкаар</span>
                  <span className="text-[10px] opacity-70">Шилжүүлэг / QR</span>
                </button>
              </div>
            </div>

            {/* Bank payment placeholder for future integration */}
            {paymentMethod === "bank" && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-3">
                <p className="text-sm text-emerald-400 font-semibold text-center">Банкны шилжүүлэг</p>
                {/* TODO: Bank integration area - QPay, SocialPay, Khan Bank, etc. */}
                <div className="bg-background/50 rounded-lg p-4 text-center space-y-2 border border-dashed border-emerald-500/30">
                  <Building2 size={32} className="mx-auto text-emerald-500/40" />
                  <p className="text-xs text-muted-foreground">
                    Банкны QR код энд гарна
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">
                    QPay / SocialPay / Хаан банк
                  </p>
                </div>
                <p className="text-[11px] text-emerald-400/60 text-center">
                  Төлбөр хийсний дараа захиалга автоматаар баталгаажна
                </p>
              </div>
            )}

            <Button
              onClick={handlePlaceOrder}
              disabled={createOrder.isPending}
              className={`w-full h-14 rounded-xl text-lg font-bold shadow-xl relative overflow-hidden group ${
                paymentMethod === "bank" ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" : "shadow-primary/20"
              }`}
            >
              <span className="relative z-10 flex items-center gap-2">
                {createOrder.isPending ? "Илгээж байна..." : (
                  paymentMethod === "bank" ? "Төлбөр хийж захиалах" : "Гал тогоонд захиалах"
                )} <ArrowRight size={18} />
              </span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
            </Button>
          </div>
        )}
      </motion.div>
    </>
  );
}

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
              <p className="font-bold text-lg mt-1 text-primary">Order #{order.id}</p>
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
                <span className="text-muted-foreground">₮{(item.unitPrice * item.quantity).toLocaleString()}</span>
              </li>
            ))}
          </ul>
          
          <div className="pt-4 border-t border-white/5 flex justify-between items-center">
            <span className="text-muted-foreground">Total</span>
            <span className="font-bold text-xl">₮{order.totalAmount.toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function OrderStatusTracker({ status }: { status: string }) {
  const steps = ['pending', 'confirmed', 'preparing', 'ready', 'served'];
  const currentIndex = steps.indexOf(status);
  
  if (status === 'paid' || status === 'cancelled') {
    return (
      <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${status === 'paid' ? 'bg-zinc-800 text-zinc-400' : 'bg-red-500/20 text-red-500'}`}>
        {status}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end">
      <div className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-2">
        {status}
      </div>
      <div className="flex gap-1">
        {steps.map((step, idx) => (
          <div 
            key={step} 
            className={`w-3 h-1.5 rounded-full ${idx <= currentIndex ? 'bg-primary' : 'bg-white/10'}`} 
            title={step}
          />
        ))}
      </div>
    </div>
  );
}
