import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/use-store";
import { useStaffRealtime } from "@/hooks/use-realtime";
import {
  useGetOrders, useGetTables, useGetMenuCategories, useUpdateOrderStatus,
  useGetTableQr, useGetReportSummary, useUpdateMenuItem, useDeleteMenuItem,
  useCreateMenuCategory, useCreateMenuItem, useCreateOrder, useCreateTable,
  getGetOrdersQueryKey, getGetMenuCategoriesQueryKey, getGetTablesQueryKey,
  customFetch,
  type Order, type Table,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ChefHat, LogOut, Utensils, ShoppingBag, BarChart3,
  QrCode, Clock, Printer, CheckCheck, X, Plus, Trash2,
  Wifi, WifiOff, TableProperties, Banknote, ArrowRight,
  CalendarDays, Download, Pencil, Users, ClipboardList,
  Minus, Search, Building2, UserCheck, UserX, View,
  Upload,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Star, MapPin, Image, MessageSquare, Settings, Phone, Instagram, Facebook,
  CalendarPlus, Timer, Percent, AlertCircle,
} from "lucide-react";

/* ─── Image Upload Helper ─── */

const ACCEPTED_IMAGE_TYPES = "image/*,.jpg,.jpeg,.png,.gif,.webp,.svg,.avif,.bmp,.tiff,.tif,.heic,.heif,.ico,.jfif";

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const token = useStore.getState().token;
  const res = await fetch("/api/upload/image", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error("Зураг оруулахад алдаа гарлаа");
  const data = await res.json();
  return data.url;
}

function ImageUploadButton({ onUploaded, className }: { onUploaded: (url: string) => void; className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onUploaded(url);
    } catch {
      toast({ title: "Зураг оруулахад алдаа гарлаа", variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [onUploaded, toast]);

  return (
    <>
      <input ref={inputRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={handleFile} />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50 ${className ?? ""}`}
      >
        <Upload size={16} />
        {uploading ? "Оруулж байна..." : "Төхөөрөмжөөс зураг сонгох"}
      </button>
    </>
  );
}

function ImageUploadField({ value, onChange, label }: { value: string; onChange: (url: string) => void; label?: string }) {
  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium">{label}</label>}
      {value && (
        <div className="relative w-full h-32 rounded-xl overflow-hidden border border-border">
          <img src={value} alt="Preview" className="w-full h-full object-cover" />
          <button onClick={() => onChange("")} className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white hover:bg-black/80">
            <X size={14} />
          </button>
        </div>
      )}
      <ImageUploadButton onUploaded={onChange} />
    </div>
  );
}

type Tab = "orders" | "summary" | "menu" | "reports" | "tables" | "reservations" | "banners" | "reviews" | "settings";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  confirmed: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  preparing: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  ready: "bg-green-500/20 text-green-400 border-green-500/30",
  served: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  paid: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Шинэ захиалга",
  confirmed: "Шинэ захиалга",
  preparing: "Гал тогоонд байна",
  ready: "Бэлэн",
  served: "Хүргэгдсэн",
  paid: "Дууссан",
  cancelled: "Цуцалсан",
};

function printKitchenReceipt(order: Order) {
  const time = format(new Date(order.createdAt), "HH:mm");
  const date = format(new Date(order.createdAt), "yyyy-MM-dd");
  const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>Гал тогооны баримт #${order.id}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 14px; color: #000; width: 72mm; padding: 4px; }
  .center { text-align: center; } .bold { font-weight: bold; }
  .divider { border-top: 2px dashed #000; margin: 8px 0; }
  .divider-solid { border-top: 2px solid #000; margin: 8px 0; }
  .row { display: flex; justify-content: space-between; margin: 4px 0; }
  .item-qty { font-weight: bold; font-size: 16px; min-width: 30px; text-align: right; }
  .note { font-size: 12px; color: #444; margin-top: 2px; }
  .big-order { font-size: 36px; font-weight: bold; text-align: center; margin: 8px 0; }
  .table-info { font-size: 18px; font-weight: bold; text-align: center; background: #000; color: #fff; padding: 4px; margin: 6px 0; }
</style></head><body>
  <div class="center bold" style="font-size:16px;">★ ГАЛ ТОГООНЫ БАРИМТ ★</div>
  <div class="divider-solid"></div>
  <div class="table-info">${order.tableName ?? "Ширээ"}</div>
  <div class="big-order">#${order.id}</div>
  <div class="row note"><span>Цаг: ${time}</span><span>${date}</span></div>
  <div class="divider"></div>
  <div class="bold" style="margin-bottom:6px;">ЗАХИАЛСАН ХООЛ:</div>
  ${order.items.map(item => `
    <div class="row"><span style="flex:1">${item.menuItemName}</span><span class="item-qty">× ${item.quantity}</span></div>
    ${item.notes ? `<div class="note">  → ${item.notes}</div>` : ""}
  `).join("")}
  <div class="divider-solid"></div>
  <div class="center note">Нийт: ₮${Number(order.totalAmount).toLocaleString()}</div>
  <div class="divider"></div>
</body></html>`;
  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
}

// ── Payment modal ──────────────────────────────────────────────────────────────
function PaymentModal({ order, onConfirm, onClose }: {
  order: Order;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const total = Number(order.totalAmount);
  const [cash, setCash] = useState("");
  const cashNum = parseFloat(cash) || 0;
  const change = cashNum - total;

  const quickAmounts = [
    Math.ceil(total / 1000) * 1000,
    Math.ceil(total / 5000) * 5000,
    Math.ceil(total / 10000) * 10000,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= total).slice(0, 3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-bold text-lg">Төлбөр авах</h2>
            <p className="text-sm text-muted-foreground">Захиалга #{order.id} · {order.tableName}</p>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50">
            <X size={18} />
          </button>
        </div>

        {/* Items summary */}
        <div className="px-6 py-4 space-y-2 border-b border-border max-h-40 overflow-y-auto">
          {order.items.map(item => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="bg-primary/10 text-primary w-5 h-5 flex items-center justify-center rounded text-xs font-bold">
                  {item.quantity}
                </span>
                {item.menuItemName}
              </span>
              <span>₮{(Number(item.unitPrice) * item.quantity).toLocaleString()}</span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Нийт дүн</span>
            <span className="text-2xl font-bold text-primary">₮{total.toLocaleString()}</span>
          </div>
        </div>

        {/* Cash input */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block flex items-center gap-2">
              <Banknote size={14} /> Авсан мөнгөн дүн
            </label>
            <input
              type="number"
              value={cash}
              onChange={e => setCash(e.target.value)}
              placeholder={`₮${total.toLocaleString()}`}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xl font-bold focus:outline-none focus:border-primary text-center"
              autoFocus
            />
          </div>

          {/* Quick amount buttons */}
          {quickAmounts.length > 0 && (
            <div className="flex gap-2">
              {quickAmounts.map(amt => (
                <button
                  key={amt}
                  onClick={() => setCash(String(amt))}
                  className="flex-1 px-3 py-2 text-sm font-bold bg-muted/50 hover:bg-primary/10 hover:text-primary border border-border rounded-xl transition-colors"
                >
                  ₮{amt.toLocaleString()}
                </button>
              ))}
            </div>
          )}

          {/* Change display */}
          {cashNum > 0 && (
            <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
              change >= 0
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}>
              <span className="font-medium">{change >= 0 ? "Хариулах мөнгө" : "Дутуу мөнгө"}</span>
              <span className="text-xl font-bold">₮{Math.abs(change).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Буцах</Button>
          <Button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
            disabled={cashNum < total}
            onClick={onConfirm}
          >
            <CheckCheck size={16} className="mr-2" />
            Төлбөр баталгаажуулах
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function StaffDashboard() {
  const { user, token, logout } = useStore();
  const [, setLocation] = useLocation();
  const { connected } = useStaffRealtime();
  const [activeTab, setActiveTab] = useState<Tab>("orders");

  if (!token || !user) {
    setLocation("/staff/login");
    return null;
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; roles: string[] }[] = [
    { id: "orders", label: "Захиалгууд", icon: <ShoppingBag size={16} />, roles: ["manager", "cashier", "waiter", "chef"] },
    { id: "summary", label: "Нэгтгэл", icon: <ClipboardList size={16} />, roles: ["manager", "cashier"] },
    { id: "menu", label: "Цэс", icon: <Utensils size={16} />, roles: ["manager"] },
    { id: "reports", label: "Тайлан", icon: <BarChart3 size={16} />, roles: ["manager"] },
    { id: "tables", label: "Ширээ", icon: <TableProperties size={16} />, roles: ["manager"] },
    { id: "reservations", label: "Захиалга", icon: <CalendarPlus size={16} />, roles: ["manager", "waiter"] },
    { id: "banners", label: "Зар", icon: <Image size={16} />, roles: ["manager"] },
    { id: "reviews", label: "Сэтгэгдэл", icon: <MessageSquare size={16} />, roles: ["manager"] },
    { id: "settings", label: "Тохиргоо", icon: <Settings size={16} />, roles: ["manager"] },
  ];

  const visibleTabs = tabs.filter((t) => t.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center">
              <ChefHat size={16} className="text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">Рестораны Систем</p>
              <p className="text-xs text-muted-foreground">
                {user.name} · <span className="text-primary capitalize">{user.role}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-xs ${connected ? "text-green-400" : "text-muted-foreground"}`}>
              {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
              <span className="hidden sm:inline">{connected ? "Бодит цаг" : "Офлайн"}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { logout(); setLocation("/staff/login"); }}>
              <LogOut size={16} />
            </Button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex gap-0.5 overflow-x-auto pb-0 scrollbar-hide">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {activeTab === "orders" && <OrdersView role={user.role} />}
        {activeTab === "summary" && <SummaryView />}
        {activeTab === "menu" && <MenuManagement />}
        {activeTab === "reports" && <ReportsView />}
        {activeTab === "tables" && <TablesView />}
        {activeTab === "reservations" && <ReservationsManagement />}
        {activeTab === "banners" && <BannersManagement />}
        {activeTab === "reviews" && <ReviewsManagement />}
        {activeTab === "settings" && <SettingsManagement />}
      </main>
    </div>
  );
}

function OrdersView({ role }: { role: string }) {
  const isChef = role === "chef";
  const isWaiter = role === "waiter";
  const isManager = role === "manager";
  const { data: orders, isLoading } = useGetOrders();
  const updateStatus = useUpdateOrderStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [discountOrder, setDiscountOrder] = useState<Order | null>(null);

  // Chef only sees preparing orders; waiter sees pending+ready+served
  const active = orders?.filter((o) => {
    if (isChef) return o.status === "preparing";
    if (isWaiter) return ["pending", "confirmed", "ready", "served"].includes(o.status);
    return !["paid", "cancelled"].includes(o.status);
  })?.filter((o) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return o.tableName?.toLowerCase().includes(q) || String(o.id).includes(q) || o.items?.some((i: any) => i.menuItemName?.toLowerCase().includes(q));
  }) ?? [];

  const done = orders?.filter((o) => o.status === "paid").slice(0, 5) ?? [];

  const handle = (orderId: number, status: string) => {
    updateStatus.mutate(
      { orderId, data: { status: status as "confirmed" | "preparing" | "ready" | "served" | "paid" | "cancelled" } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey() }) }
    );
  };

  const handlePrintAndConfirm = (order: Order) => {
    printKitchenReceipt(order);
    handle(order.id, "preparing");
    toast({ title: `Захиалга #${order.id} — баримт хэвлэгдлээ` });
  };

  const handlePaymentConfirm = (order: Order) => {
    handle(order.id, "paid");
    setPayingOrder(null);
    toast({ title: `Захиалга #${order.id} — төлбөр амжилттай авлаа ✓` });
  };

  const handleCancel = (order: Order) => {
    handle(order.id, "cancelled");
    toast({ title: `Захиалга #${order.id} цуцлагдлаа`, variant: "destructive" });
  };

  const handleVoidItem = async (orderId: number, itemId: number) => {
    if (!confirm("Энэ хоолыг захиалгаас хасах уу?")) return;
    try {
      await customFetch(`/api/orders/${orderId}/items/${itemId}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey() });
      toast({ title: "Хоол хасагдлаа" });
    } catch {
      toast({ title: "Алдаа гарлаа", variant: "destructive" });
    }
  };

  const handleDiscount = async (orderId: number, amount: number, reason: string) => {
    try {
      await customFetch(`/api/orders/${orderId}/discount`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discount: amount, reason }),
      });
      queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey() });
      setDiscountOrder(null);
      toast({ title: "Хөнгөлөлт хийгдлээ" });
    } catch {
      toast({ title: "Алдаа гарлаа", variant: "destructive" });
    }
  };

  if (isLoading) return <Spinner />;

  /* ─── Chef Kitchen View ─── */
  if (isChef) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground bg-card/50 border border-border rounded-xl px-4 py-3">
          <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full text-xs font-bold">Гал тогоо</span>
          <ArrowRight size={12} />
          <span>Захиалга бэлдэж дуусаад "Бэлэн болсон" дарна</span>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-xl font-bold">Бэлдэх захиалгууд</h2>
          <span className="bg-orange-500/10 text-orange-400 text-sm font-bold px-2.5 py-0.5 rounded-full border border-orange-500/20">{active.length}</span>
        </div>

        {!active.length ? (
          <div className="text-center py-20 text-muted-foreground">
            <ChefHat size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Одоогоор бэлдэх захиалга байхгүй</p>
            <p className="text-sm mt-1">Шинэ захиалга ирэхэд энд харагдана</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {active.map((order) => (
              <OrderCard key={order.id} order={order}>
                <Button className="w-full bg-green-500 hover:bg-green-600 text-white font-bold text-base py-5"
                  onClick={() => { handle(order.id, "ready"); toast({ title: `#${order.id} бэлэн болсон!` }); }}>
                  <CheckCheck size={18} className="mr-2" /> Бэлэн болсон
                </Button>
              </OrderCard>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ─── Waiter View ─── */
  if (isWaiter) {
    const newOrders = active.filter(o => o.status === "pending" || o.status === "confirmed");
    const readyOrders = active.filter(o => o.status === "ready");
    const servedOrders = active.filter(o => o.status === "served");

    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground bg-card/50 border border-border rounded-xl px-4 py-3">
          <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full text-xs font-bold">Шинэ</span>
          <ArrowRight size={12} />
          <span>Баримт хэвлэж гал тогоонд өгнө</span>
          <ArrowRight size={12} />
          <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full text-xs font-bold">Бэлэн</span>
          <ArrowRight size={12} />
          <span>Зочинд зөөнө</span>
        </div>

        {/* New orders to send to kitchen */}
        {newOrders.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-bold">Шинэ захиалга</h2>
              <span className="bg-yellow-500/10 text-yellow-400 text-sm font-bold px-2 py-0.5 rounded-full border border-yellow-500/20">{newOrders.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {newOrders.map((order) => (
                <OrderCard key={order.id} order={order}>
                  <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                    onClick={() => handlePrintAndConfirm(order)}>
                    <Printer size={15} className="mr-2" /> Гал тогоонд өгөх
                  </Button>
                </OrderCard>
              ))}
            </div>
          </div>
        )}

        {/* Ready to serve */}
        {readyOrders.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-bold">Зөөх хоол</h2>
              <span className="bg-green-500/10 text-green-400 text-sm font-bold px-2 py-0.5 rounded-full border border-green-500/20">{readyOrders.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {readyOrders.map((order) => (
                <OrderCard key={order.id} order={order}>
                  <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold"
                    onClick={() => { handle(order.id, "served"); toast({ title: `#${order.id} зөөгдлөө` }); }}>
                    <ArrowRight size={15} className="mr-2" /> Зөөсөн
                  </Button>
                </OrderCard>
              ))}
            </div>
          </div>
        )}

        {!newOrders.length && !readyOrders.length && !servedOrders.length && (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
            <p>Одоогоор захиалга байхгүй байна</p>
          </div>
        )}
      </div>
    );
  }

  /* ─── Manager / Cashier Full View ─── */
  return (
    <>
      {payingOrder && (
        <PaymentModal
          order={payingOrder}
          onConfirm={() => handlePaymentConfirm(payingOrder)}
          onClose={() => setPayingOrder(null)}
        />
      )}

      {createOpen && (
        <CreateOrderModal
          onClose={() => setCreateOpen(false)}
          onDone={() => { setCreateOpen(false); queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey() }); }}
        />
      )}

      {discountOrder && (
        <DiscountModal
          order={discountOrder}
          onConfirm={(amount, reason) => handleDiscount(discountOrder.id, amount, reason)}
          onClose={() => setDiscountOrder(null)}
        />
      )}

      <div className="space-y-8">
        {/* Flow banner + search + create button */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground bg-card/50 border border-border rounded-xl px-4 py-3 flex-1">
            <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full text-xs font-bold">Шинэ</span>
            <ArrowRight size={12} />
            <span>Баримт хэвлэж гал тогоонд өгнө</span>
            <ArrowRight size={12} />
            <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full text-xs font-bold">Гал тогоонд</span>
            <ArrowRight size={12} />
            <span>Хоол болсноор төлбөр авна</span>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus size={15} className="mr-2" /> Захиалга үүсгэх
          </Button>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2">
          <Search size={16} className="text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Захиалга хайх (ширээ, дугаар, хоол)..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          {searchQuery && <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>}
        </div>

        {/* Active orders */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-xl font-bold">Идэвхтэй захиалгууд</h2>
            <span className="bg-primary/10 text-primary text-sm font-bold px-2.5 py-0.5 rounded-full border border-primary/20">{active.length}</span>
          </div>

          {!active.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
              <p>Одоогоор захиалга байхгүй байна</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {active.map((order) => (
                <OrderCard key={order.id} order={order} onVoidItem={(isManager || role === "cashier") ? handleVoidItem : undefined}>
                  {(order.status === "pending" || order.status === "confirmed") && (
                    <div className="flex flex-col gap-2">
                      <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                        onClick={() => handlePrintAndConfirm(order)}>
                        <Printer size={15} className="mr-2" /> Баримт хэвлэх — Гал тогоонд
                      </Button>
                      <div className="flex gap-2">
                        {isManager && (
                          <button onClick={() => setDiscountOrder(order)}
                            className="flex-1 text-xs text-muted-foreground hover:text-primary transition-colors text-center py-1 flex items-center justify-center gap-1">
                            <Percent size={10} /> Хөнгөлөлт
                          </button>
                        )}
                        <button
                          onClick={() => handleCancel(order)}
                          className="flex-1 text-xs text-muted-foreground hover:text-destructive transition-colors text-center py-1"
                        >
                          Цуцлах
                        </button>
                      </div>
                    </div>
                  )}

                  {order.status === "preparing" && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm">
                        <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                        Гал тогоонд бэлдэж байна...
                      </div>
                      {(order as any).paymentMethod === "bank" ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-center gap-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                            <Banknote size={14} /> Банкаар төлсөн
                          </div>
                          <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                            onClick={() => handlePaymentConfirm(order)}>
                            <CheckCheck size={15} className="mr-2" /> Дуусга
                          </Button>
                        </div>
                      ) : (
                        <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                          onClick={() => setPayingOrder(order)}>
                          <CheckCheck size={15} className="mr-2" /> Төлбөр авах
                        </Button>
                      )}
                    </div>
                  )}

                  {(order.status === "ready" || order.status === "served") && (
                    (order as any).paymentMethod === "bank" ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-center gap-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                          <Banknote size={14} /> Банкаар төлсөн
                        </div>
                        <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                          onClick={() => handlePaymentConfirm(order)}>
                          <CheckCheck size={15} className="mr-2" /> Дуусга
                        </Button>
                      </div>
                    ) : (
                      <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                        onClick={() => setPayingOrder(order)}>
                        <CheckCheck size={15} className="mr-2" /> Төлбөр авах
                      </Button>
                    )
                  )}
                </OrderCard>
              ))}
            </div>
          )}
        </div>

        {/* Recently done */}
        {done.length > 0 && (
          <div>
            <h3 className="text-base font-semibold text-muted-foreground mb-3">Саяхан дууссан</h3>
            <div className="space-y-2">
              {done.map((order) => (
                <div key={order.id} className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-xl text-sm opacity-60">
                  <span className="text-muted-foreground">#{order.id} · {order.tableName}</span>
                  <span className="text-muted-foreground">{format(new Date(order.createdAt), "HH:mm")}</span>
                  <span className="font-bold">₮{Number(order.totalAmount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Create Order Modal (for cashier manual orders) ────────────────────────────
function CreateOrderModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: tables } = useGetTables();
  const { data: categories } = useGetMenuCategories();
  const createOrder = useCreateOrder();
  const { toast } = useToast();
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [activeCatId, setActiveCatId] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<number, { name: string; price: number; qty: number }>>({});
  const [search, setSearch] = useState("");

  const cats = categories ?? [];
  const currentCatId = activeCatId ?? cats[0]?.id ?? null;
  const currentCat = cats.find(c => c.id === currentCatId);
  const selectedTable = tables?.find(t => t.id === selectedTableId);

  const filteredItems = search.trim()
    ? cats.flatMap(c => c.items ?? []).filter(i => i.available && i.name.toLowerCase().includes(search.toLowerCase()))
    : (currentCat?.items ?? []).filter(i => i.available !== false);

  const addToCart = (item: { id: number; name: string; price: string | number }) => {
    setCart(prev => ({
      ...prev,
      [item.id]: { name: item.name, price: Number(item.price), qty: (prev[item.id]?.qty ?? 0) + 1 },
    }));
  };

  const updateQty = (itemId: number, delta: number) => {
    setCart(prev => {
      const cur = prev[itemId];
      if (!cur) return prev;
      const newQty = cur.qty + delta;
      if (newQty <= 0) { const next = { ...prev }; delete next[itemId]; return next; }
      return { ...prev, [itemId]: { ...cur, qty: newQty } };
    });
  };

  const cartItems = Object.entries(cart).map(([id, v]) => ({ id: Number(id), ...v }));
  const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);

  const handleSubmit = () => {
    if (!selectedTable?.qrToken || cartItems.length === 0) return;
    createOrder.mutate(
      { data: { tableToken: selectedTable.qrToken, items: cartItems.map(i => ({ menuItemId: i.id, quantity: i.qty })) } },
      {
        onSuccess: () => { toast({ title: "Захиалга амжилттай үүслээ" }); onDone(); },
        onError: () => toast({ title: "Алдаа гарлаа", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="font-bold text-lg">Захиалга үүсгэх</h2>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50"><X size={18} /></button>
        </div>

        {/* Table selector */}
        <div className="px-6 py-3 border-b border-border shrink-0">
          <label className="text-xs text-muted-foreground mb-2 block">Ширээ сонгох *</label>
          <div className="flex flex-wrap gap-2">
            {tables?.map(t => (
              <button key={t.id} onClick={() => setSelectedTableId(t.id)}
                className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
                  t.id === selectedTableId ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 border-border text-muted-foreground hover:border-primary/40"
                }`}>
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: menu browser */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
            {/* Search */}
            <div className="px-4 py-2 border-b border-border shrink-0">
              <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1.5">
                <Search size={14} className="text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Хоол хайх..."
                  className="flex-1 bg-transparent text-sm focus:outline-none" />
              </div>
            </div>
            {/* Category tabs */}
            {!search && (
              <div className="flex gap-1 overflow-x-auto px-4 py-2 border-b border-border shrink-0">
                {cats.map(cat => (
                  <button key={cat.id} onClick={() => setActiveCatId(cat.id)}
                    className={`shrink-0 px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      cat.id === currentCatId ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/30"
                    }`}>{cat.name}</button>
                ))}
              </div>
            )}
            {/* Items */}
            <div className="flex-1 overflow-y-auto">
              {filteredItems.map(item => (
                <div key={item.id} className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-primary">₮{Number(item.price).toLocaleString()}</p>
                  </div>
                  <button onClick={() => addToCart(item)}
                    className="w-7 h-7 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-colors">
                    <Plus size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right: cart */}
          <div className="w-56 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-border text-sm font-semibold text-muted-foreground shrink-0">Сагс</div>
            <div className="flex-1 overflow-y-auto">
              {cartItems.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">Хоол нэмнэ үү</div>
              ) : cartItems.map(item => (
                <div key={item.id} className="px-4 py-2.5 border-b border-border/50">
                  <p className="text-xs font-medium leading-tight mb-1.5">{item.name}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.id, -1)} className="w-5 h-5 rounded bg-muted flex items-center justify-center"><Minus size={10} /></button>
                      <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="w-5 h-5 rounded bg-muted flex items-center justify-center"><Plus size={10} /></button>
                    </div>
                    <span className="text-xs text-primary font-bold">₮{(item.price * item.qty).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Total */}
            <div className="px-4 py-3 border-t border-border shrink-0">
              <div className="flex justify-between text-sm mb-3">
                <span className="text-muted-foreground">Нийт</span>
                <span className="font-bold text-primary">₮{total.toLocaleString()}</span>
              </div>
              <Button className="w-full" disabled={!selectedTable || cartItems.length === 0 || createOrder.isPending} onClick={handleSubmit}>
                {createOrder.isPending ? "Үүсгэж байна..." : "Захиалах"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Summary View (for cashier + manager) ──────────────────────────────────────
function toLocalDatetimeValue(d: Date) {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

function SummaryView() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const [from, setFrom] = useState(toLocalDatetimeValue(startOfToday));
  const [to, setTo] = useState(toLocalDatetimeValue(now));
  const { data: report, isLoading, refetch } = useGetReportSummary({ from, to });
  const { toast } = useToast();

  const setRange = (type: "today" | "7d" | "30d") => {
    const end = new Date();
    const start = new Date(end);
    if (type === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (type === "7d") {
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(end.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    }
    setFrom(toLocalDatetimeValue(start));
    setTo(toLocalDatetimeValue(end));
  };

  const printReport = () => {
    const paidRevenue = Number(report?.totalRevenue ?? 0);
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>Нэгтгэл тайлан</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'Courier New', monospace; font-size: 12px; }
  h1 { font-size: 20px; text-align: center; margin-bottom: 4px; }
  .sub { text-align: center; color: #555; margin-bottom: 20px; font-size: 11px; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #ccc; }
</style></head><body>
<h1>★ НЭГТГЭЛ ТАЙЛАН ★</h1>
<div class="sub">${from.replace("T", " ")} — ${to.replace("T", " ")} · Хэвлэсэн: ${format(new Date(), "yyyy-MM-dd HH:mm")}</div>
<div class="row"><span>Төлөгдсөн захиалга:</span><span><b>${report?.totalOrders ?? 0}</b></span></div>
<div class="row"><span>Нийт орлого:</span><span><b>₮${paidRevenue.toLocaleString()}</b></span></div>
<div class="row"><span>Дундаж захиалгын дүн:</span><span><b>₮${Number(report?.averageOrderValue ?? 0).toFixed(0)}</b></span></div>
</body></html>`;
    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) { toast({ title: "Pop-up хаагдсан байна" }); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold">Орлогын нэгтгэл</h2>
        <Button variant="outline" size="sm" onClick={printReport} disabled={!report}>
          <Printer size={14} className="mr-2" /> Хэвлэх
        </Button>
      </div>

      {/* Quick range buttons */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: "Өнөөдөр", type: "today" as const },
          { label: "Сүүлийн 7 хоног", type: "7d" as const },
          { label: "Сүүлийн 30 хоног", type: "30d" as const },
        ].map(({ label, type }) => (
          <button key={type} onClick={() => setRange(type)}
            className="px-3 py-1.5 rounded-xl text-sm font-medium border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all">
            {label}
          </button>
        ))}
      </div>

      {/* Datetime range inputs */}
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5 flex items-center gap-1">
            <CalendarDays size={12} /> Эхлэх цаг
          </label>
          <input
            type="datetime-local"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5 flex items-center gap-1">
            <CalendarDays size={12} /> Сүүлийн цаг
          </label>
          <input
            type="datetime-local"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary [color-scheme:dark]"
          />
        </div>
        <Button size="sm" onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? "Уншиж байна..." : "Харах"}
        </Button>
      </div>

      {/* Stats */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-muted-foreground text-sm">Төлөгдсөн захиалга</p>
            <p className="text-3xl font-bold mt-1">{report.totalOrders}</p>
          </div>
          <div className="bg-card border border-primary/20 rounded-2xl p-5 shadow-lg shadow-primary/5">
            <p className="text-muted-foreground text-sm">Нийт орлого (төлөгдсөн)</p>
            <p className="text-3xl font-bold mt-1 text-primary">₮{Number(report.totalRevenue).toLocaleString()}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-muted-foreground text-sm">Дундаж захиалга</p>
            <p className="text-3xl font-bold mt-1">₮{Number(report.averageOrderValue).toFixed(0)}</p>
          </div>
        </div>
      )}

      {/* Date range label */}
      {report && (
        <p className="text-xs text-muted-foreground">
          {from.replace("T", " ")} — {to.replace("T", " ")} хугацааны төлөгдсөн захиалгуудын нэгтгэл
        </p>
      )}
    </div>
  );
}

// ── Menu item add form (per category) ─────────────────────────────────────────
function AddItemForm({ categoryId, onClose, onDone }: {
  categoryId: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const createItem = useCreateMenuItem();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [modelUrl, setModelUrl] = useState("");
  const [modelUploading, setModelUploading] = useState(false);
  const token = useStore((s) => s.token);

  const handleModelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setModelUploading(true);
    try {
      const fd = new FormData();
      fd.append("model", file);
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/upload/model`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error("upload failed");
      const { url } = await res.json() as { url: string };
      setModelUrl(url);
      toast({ title: "3D загвар амжилттай оруулсан" });
    } catch {
      toast({ title: "3D загвар оруулж чадсангүй", variant: "destructive" });
    } finally {
      setModelUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) return;
    createItem.mutate(
      {
        data: {
          categoryId,
          name: name.trim(),
          price: parseFloat(price),
          description: description.trim() || undefined,
          imageUrl: imageUrl || undefined,
          modelUrl: modelUrl || undefined,
          available: true,
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: `"${name}" нэмэгдлээ` });
          onDone();
        },
        onError: () => {
          toast({ title: "Алдаа гарлаа", variant: "destructive" });
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-border bg-muted/20 px-5 py-4 space-y-3">
      <p className="text-xs font-semibold text-primary uppercase tracking-wide">Шинэ хоол нэмэх</p>
      <div className="space-y-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Хоолны нэр *"
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
          required
          autoFocus
        />
        <div className="flex gap-2">
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="Үнэ (₮) *"
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            required
            min="0"
            step="100"
          />
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Тайлбар (заавал биш)"
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        {/* Image upload */}
        <ImageUploadField value={imageUrl} onChange={setImageUrl} label="Хоолны зураг" />

        {/* 3D Model upload */}
        <div className="flex items-center gap-3">
          <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors
            ${modelUploading ? "opacity-50 pointer-events-none" : "border-primary/30 hover:border-primary hover:text-primary"} bg-background`}>
            <View size={14} />
            {modelUploading ? "Байршуулж байна..." : modelUrl ? "3D солих" : "3D загвар (.glb)"}
            <input
              type="file"
              accept=".glb,.gltf"
              className="hidden"
              onChange={handleModelChange}
              disabled={modelUploading}
            />
          </label>
          {modelUrl && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-primary font-semibold">AR бэлэн</span>
              <button
                type="button"
                onClick={() => setModelUrl("")}
                className="w-4 h-4 bg-destructive rounded-full flex items-center justify-center"
              >
                <X size={9} />
              </button>
            </div>
          )}
          {!modelUrl && !modelUploading && (
            <span className="text-xs text-muted-foreground">GLB, GLTF файл</span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1" disabled={createItem.isPending || modelUploading}>
          {createItem.isPending ? "Нэмж бай��а..." : "Нэмэх"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}><X size={14} /></Button>
      </div>
    </form>
  );
}

// ── Menu item edit form ────────────────────────────────────────────────────────
function EditItemForm({ item, onClose, onDone }: {
  item: { id: number; name: string; price: string | number; description?: string | null; imageUrl?: string | null; modelUrl?: string | null; available: boolean };
  onClose: () => void;
  onDone: () => void;
}) {
  const updateItem = useUpdateMenuItem();
  const { toast } = useToast();
  const token = useStore((s) => s.token);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(Number(item.price)));
  const [description, setDescription] = useState(item.description ?? "");
  const [imageUrl, setImageUrl] = useState(item.imageUrl ?? "");
  const [modelUrl, setModelUrl] = useState((item as any).modelUrl ?? "");
  const [modelUploading, setModelUploading] = useState(false);

  const handleModelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setModelUploading(true);
    try {
      const fd = new FormData();
      fd.append("model", file);
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/upload/model`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error("upload failed");
      const { url } = await res.json() as { url: string };
      setModelUrl(url);
      toast({ title: "3D загвар амжилттай оруулсан" });
    } catch {
      toast({ title: "3D загвар оруулж чадсангүй", variant: "destructive" });
    } finally {
      setModelUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) return;
    updateItem.mutate(
      {
        itemId: item.id,
        data: {
          name: name.trim(),
          price: parseFloat(price),
          description: description.trim() || undefined,
          imageUrl: imageUrl || undefined,
          modelUrl: modelUrl || undefined,
        } as any,
      },
      {
        onSuccess: () => { toast({ title: "Хадгалагдлаа" }); onDone(); },
        onError: () => toast({ title: "Алдаа гарлаа", variant: "destructive" }),
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-primary/20 bg-primary/5 px-5 py-4 space-y-3">
      <p className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1">
        <Pencil size={11} /> Засварлах
      </p>
      <div className="space-y-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Хоолны нэр *"
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
          required
          autoFocus
        />
        <div className="flex gap-2">
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="Үнэ (₮) *"
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            required
            min="0"
            step="100"
          />
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Тайлбар (заавал биш)"
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </div>
        {/* Image upload */}
        <ImageUploadField value={imageUrl} onChange={setImageUrl} label="Хоолны зураг" />

        {/* 3D Model upload */}
        <div className="flex items-center gap-3">
          <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors
            ${modelUploading ? "opacity-50 pointer-events-none" : "border-primary/30 hover:border-primary hover:text-primary"} bg-background`}>
            <View size={14} />
            {modelUploading ? "Байршуулж байна..." : modelUrl ? "3D солих" : "3D загвар (.glb)"}
            <input type="file" accept=".glb,.gltf" className="hidden" onChange={handleModelChange} disabled={modelUploading} />
          </label>
          {modelUrl && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-primary font-semibold">AR бэлэн</span>
              <button type="button" onClick={() => setModelUrl("")}
                className="w-4 h-4 bg-destructive rounded-full flex items-center justify-center">
                <X size={9} />
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1" disabled={updateItem.isPending || modelUploading}>
          {updateItem.isPending ? "Хадгалж байна..." : "Хадгалах"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}><X size={14} /></Button>
      </div>
    </form>
  );
}

function MenuManagement() {
  const { data: categories, isLoading } = useGetMenuCategories();
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();
  const createCat = useCreateMenuCategory();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newCatName, setNewCatName] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [newSubCatName, setNewSubCatName] = useState("");
  const [addingSubCatFor, setAddingSubCatFor] = useState<number | null>(null);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [selectedSubCatId, setSelectedSubCatId] = useState<number | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  if (isLoading) return <Spinner />;

  const cats = (categories ?? []) as Array<any>;
  const activeCatId = selectedCatId ?? cats[0]?.id ?? null;
  const activeCat = cats.find((c: any) => c.id === activeCatId);
  const subCats = activeCat?.children ?? [];
  const activeSubCatId = selectedSubCatId;
  const activeSubCat = subCats.find((c: any) => c.id === activeSubCatId);

  // The category whose items we display: subcategory if selected, otherwise parent
  const displayCat = activeSubCat ?? activeCat;
  const displayItems = displayCat?.items ?? [];

  const refreshMenu = () => queryClient.invalidateQueries({ queryKey: getGetMenuCategoriesQueryKey() });

  const handleToggle = (itemId: number, available: boolean) => {
    updateItem.mutate(
      { itemId, data: { available: !available } },
      { onSuccess: () => { refreshMenu(); toast({ title: !available ? "Нээлттэй болголоо" : "Хаасан" }); } }
    );
  };

  const handleDeleteItem = (itemId: number, name: string) => {
    if (!confirm(`"${name}" устгах уу?`)) return;
    deleteItem.mutate(
      { itemId },
      { onSuccess: () => { refreshMenu(); toast({ title: "Устгасан" }); } }
    );
  };

  const handleCreateCat = (e: React.FormEvent) => {
    e.preventDefault();
    createCat.mutate(
      { data: { name: newCatName } },
      { onSuccess: () => { refreshMenu(); setNewCatName(""); setShowNewCat(false); toast({ title: "Ангилал нэмэгдлээ" }); } }
    );
  };

  const handleCreateSubCat = (e: React.FormEvent, parentId: number) => {
    e.preventDefault();
    createCat.mutate(
      { data: { name: newSubCatName, parentId } as any },
      { onSuccess: () => { refreshMenu(); setNewSubCatName(""); setAddingSubCatFor(null); toast({ title: "Дэд ангилал нэмэгдлээ" }); } }
    );
  };

  const handleDeleteCat = async (catId: number, catName: string) => {
    if (!confirm(`"${catName}" ангилалыг устгах уу?`)) return;
    try {
      const res = await customFetch(`/api/menu/categories/${catId}`, { method: "DELETE" });
      if (res && (res as any).error) {
        toast({ title: (res as any).message, variant: "destructive" });
        return;
      }
      refreshMenu();
      if (selectedCatId === catId) setSelectedCatId(null);
      if (selectedSubCatId === catId) setSelectedSubCatId(null);
      toast({ title: "Ангилал устгагдлаа" });
    } catch (err: any) {
      const msg = err?.message || "Устгахад алдаа гарлаа";
      toast({ title: msg, variant: "destructive" });
    }
  };

  // Count all items in a top-level category (including subcategories)
  const totalItems = (cat: any) => {
    const own = cat.items?.length ?? 0;
    const childItems = (cat.children ?? []).reduce((s: number, c: any) => s + (c.items?.length ?? 0), 0);
    return own + childItems;
  };

  return (
    <div className="space-y-0">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Цэсний удирдлага</h2>
        <Button size="sm" variant="outline" onClick={() => setShowNewCat(!showNewCat)}>
          <Plus size={14} className="mr-1" /> Ангилал нэмэх
        </Button>
      </div>

      {/* New category form */}
      {showNewCat && (
        <form onSubmit={handleCreateCat} className="flex gap-2 bg-card p-3 rounded-xl border border-border mb-4">
          <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Ангилалын нэр"
            className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary" required autoFocus />
          <Button type="submit" size="sm">Нэмэх</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowNewCat(false)}><X size={14} /></Button>
        </form>
      )}

      {/* Category tab strip */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 mb-4">
        {cats.map((cat: any) => (
          <button key={cat.id}
            onClick={() => { setSelectedCatId(cat.id); setSelectedSubCatId(null); setAddingItem(false); }}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
              cat.id === activeCatId
                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {cat.name}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${cat.id === activeCatId ? "bg-primary-foreground/20" : "bg-muted/50"}`}>
              {totalItems(cat)}
            </span>
          </button>
        ))}
      </div>

      {/* Selected category content */}
      {activeCat && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* Category header with delete + subcategory add */}
          <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-3">
              <p className="font-semibold text-sm">{activeCat.name}</p>
              {totalItems(activeCat) === 0 && (
                <button onClick={() => handleDeleteCat(activeCat.id, activeCat.name)}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 size={12} /> Устгах</button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="text-xs"
                onClick={() => { setAddingSubCatFor(addingSubCatFor === activeCat.id ? null : activeCat.id); }}>
                <Plus size={12} className="mr-1" /> Дэд ангилал
              </Button>
            </div>
          </div>

          {/* Subcategory add form */}
          {addingSubCatFor === activeCat.id && (
            <form onSubmit={(e) => handleCreateSubCat(e, activeCat.id)} className="flex gap-2 px-5 py-3 border-b border-border bg-muted/10">
              <input value={newSubCatName} onChange={(e) => setNewSubCatName(e.target.value)} placeholder="Дэд ангилалын нэр"
                className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary" required autoFocus />
              <Button type="submit" size="sm">Нэмэх</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAddingSubCatFor(null)}><X size={14} /></Button>
            </form>
          )}

          {/* Subcategory tabs */}
          {subCats.length > 0 && (
            <div className="px-5 py-2 border-b border-border flex gap-1.5 overflow-x-auto scrollbar-hide bg-muted/10">
              <button onClick={() => { setSelectedSubCatId(null); setAddingItem(false); }}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  !activeSubCatId ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"
                }`}>
                Бүгд ({activeCat.items?.length ?? 0})
              </button>
              {subCats.map((sub: any) => (
                <div key={sub.id} className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => { setSelectedSubCatId(sub.id); setAddingItem(false); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      sub.id === activeSubCatId ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"
                    }`}>
                    {sub.name} ({sub.items?.length ?? 0})
                  </button>
                  {(sub.items?.length ?? 0) === 0 && (
                    <button onClick={() => handleDeleteCat(sub.id, sub.name)} className="p-0.5 text-red-400/60 hover:text-red-400"><Trash2 size={10} /></button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Action bar */}
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{displayItems.length} хоол</p>
            <Button size="sm" className="bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
              onClick={() => setAddingItem(!addingItem)}>
              <Plus size={14} className="mr-1" /> Хоол нэмэх
            </Button>
          </div>

          {/* Add item inline form */}
          {addingItem && (
            <AddItemForm categoryId={displayCat?.id ?? activeCat.id}
              onClose={() => setAddingItem(false)}
              onDone={() => { refreshMenu(); setAddingItem(false); }} />
          )}

          {/* Items list */}
          {displayItems.length > 0 ? (
            <div className="divide-y divide-border">
              {displayItems.map((item: any) => (
                <div key={item.id}>
                  <div className="px-5 py-3.5 flex items-center gap-4">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${!item.available ? "line-through text-muted-foreground" : ""}`}>{item.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-primary text-sm font-bold">₮{Number(item.price).toLocaleString()}</span>
                        {item.description && <span className="text-xs text-muted-foreground truncate max-w-48">{item.description}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => handleToggle(item.id, item.available)}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                          item.available ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"
                        }`}>
                        {item.available ? "Нээлттэй" : "Хаалттай"}
                      </button>
                      <button onClick={() => setEditingItemId(editingItemId === item.id ? null : item.id)}
                        className={`p-1.5 transition-colors rounded ${editingItemId === item.id ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary"}`}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDeleteItem(item.id, item.name)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {editingItemId === item.id && (
                    <EditItemForm item={item} onClose={() => setEditingItemId(null)} onDone={() => { refreshMenu(); setEditingItemId(null); }} />
                  )}
                </div>
              ))}
            </div>
          ) : !addingItem ? (
            <div className="px-5 py-8 text-center text-muted-foreground text-sm">
              <Utensils size={28} className="mx-auto mb-2 opacity-30" />
              <p>Энэ ангилалд хоол байхгүй байна</p>
              <button onClick={() => setAddingItem(true)} className="text-primary hover:underline mt-1 text-xs">+ Хоол нэмэх</button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ReportsView() {
  const { data: report, isLoading } = useGetReportSummary();
  const COLORS = ["#f59e0b", "#3b82f6", "#f97316", "#22c55e", "#a855f7", "#ef4444", "#06b6d4"];

  if (isLoading) return <Spinner />;
  if (!report) return <div className="text-center py-16 text-muted-foreground">Тайлан олдсонгүй</div>;

  const statusData = Object.entries(report.ordersByStatus ?? {}).map(([k, v]) => ({
    name: STATUS_LABELS[k] ?? k,
    value: v as number,
  }));
  const topItems = (report.topItems ?? []) as Array<{ name: string; quantity: number; revenue: number }>;
  const peakHours = ((report as any).peakHours ?? []).slice(0, 8).map((h: any) => ({
    name: `${String(h.hour).padStart(2, "0")}:00`,
    orders: h.orders,
    revenue: h.revenue,
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Борлуулалтын тайлан</h2>

      {/* Main stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Нийт захиалга" value={String(report.totalOrders)} />
        <StatCard label="Нийт орлого" value={`₮${Number(report.totalRevenue).toLocaleString()}`} primary />
        <StatCard label="Хөнгөлөлт" value={`₮${Number((report as any).totalDiscount ?? 0).toLocaleString()}`} />
        <StatCard label="Цэвэр орлого" value={`₮${Number((report as any).netRevenue ?? report.totalRevenue).toLocaleString()}`} primary />
      </div>

      {/* Service stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Дундаж дүн" value={`₮${Number(report.averageOrderValue).toFixed(0)}`} />
        <StatCard label="Дунд. үйлчилгээ" value={`${(report as any).avgServiceMinutes ?? 0} мин`} />
        <StatCard label="Ширээний эргэлт" value={`${(report as any).tableTurnover ?? 0}`} />
        <StatCard label="Цуцалсан" value={`${(report as any).cancelledCount ?? 0}`} />
      </div>

      {/* Payment breakdown */}
      {(report as any).paymentBreakdown && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-muted-foreground text-sm">Бэлэн мөнгө</p>
            <p className="text-2xl font-bold mt-1">₮{Number((report as any).paymentBreakdown.cash ?? 0).toLocaleString()}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-muted-foreground text-sm">Банкаар</p>
            <p className="text-2xl font-bold mt-1">₮{Number((report as any).paymentBreakdown.bank ?? 0).toLocaleString()}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Peak hours */}
        {peakHours.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-bold mb-4">Ачаалалтай цагууд</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakHours}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={(v: number) => [`${v}`, "Захиалга"]} />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Status pie chart */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-bold mb-4">Захиалгын статусаар</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top items */}
        <div className="bg-card border border-border rounded-2xl p-5 md:col-span-2">
          <h3 className="font-bold mb-4">Хамгийн их захиалагдсан (Top 10)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topItems} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip formatter={(v: number) => [`${v} ш`, "Тоо"]} />
                <Bar dataKey="quantity" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function TablesView() {
  const { data: tables, isLoading } = useGetTables();
  const createTable = useCreateTable();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [qrTableId, setQrTableId] = useState<number | null>(null);
  const { data: qrData } = useGetTableQr(qrTableId ?? 0, { query: { enabled: !!qrTableId } } as any);
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCapacity, setAddCapacity] = useState("4");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCapacity, setEditCapacity] = useState("");

  if (isLoading) return <Spinner />;

  const statusColor: Record<string, string> = {
    available: "bg-green-500/20 text-green-400 border-green-500/30",
    occupied: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    reserved: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  const statusLabel: Record<string, string> = {
    available: "Чөлөөтэй",
    occupied: "Эзлэгдсэн",
    reserved: "Захиалгатай",
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetTablesQueryKey() });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const nextNum = (tables?.length ?? 0) + 1;
    createTable.mutate(
      { data: { number: nextNum, name: addName.trim(), capacity: parseInt(addCapacity) || 4 } },
      {
        onSuccess: () => { refresh(); setShowAdd(false); setAddName(""); setAddCapacity("4"); toast({ title: `"${addName}" ширээ нэмэгдлээ. QR автоматаар үүслээ.` }); },
        onError: () => toast({ title: "Алдаа гарлаа", variant: "destructive" }),
      }
    );
  };

  const handleEdit = async (tableId: number) => {
    await customFetch(`/api/tables/${tableId}`, { method: "PATCH", body: JSON.stringify({ name: editName.trim(), capacity: parseInt(editCapacity) || 4 }) });
    refresh();
    setEditingId(null);
    toast({ title: "Ширээний мэдээлэл шинэчлэгдлээ" });
  };

  const handleDelete = async (table: Table) => {
    if (!confirm(`"${table.name}" устгах уу? Ширээний бүх захиалга устана.`)) return;
    await customFetch(`/api/tables/${table.id}`, { method: "DELETE" });
    refresh();
    toast({ title: "Устгасан" });
  };

  const handleToggleSession = async (table: Table) => {
    const newStatus = table.status === "available" ? "occupied" : "available";
    await customFetch(`/api/tables/${table.id}`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
    refresh();
    toast({
      title: newStatus === "occupied"
        ? `${table.name} — Зочин суулгалаа. QR захиалга идэвхжлээ.`
        : `${table.name} — Ширээ чөлөөлөгдлөө. QR захиалга хаагдлаа.`,
    });
  };

  const printQR = (table: Table, url: string) => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>QR — ${table.name}</title>
<style>
  @page { size: 100mm 120mm; margin: 5mm; }
  body { font-family: sans-serif; text-align: center; padding: 8px; }
  h2 { font-size: 22px; margin: 8px 0 4px; }
  p { font-size: 11px; color: #555; word-break: break-all; margin: 4px 0; }
  .sub { font-size: 13px; color: #333; margin-top: 2px; }
  svg { margin: 10px auto; display: block; }
</style></head><body>
<h2>${table.name}</h2>
<div class="sub">${table.capacity} хүний суудал</div>
<div id="qr"></div>
<p>${url}</p>
<script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
<script>QRCode.toCanvas(document.createElement('canvas'),${JSON.stringify(url)},{width:200,margin:2},function(err,canvas){if(!err){document.getElementById('qr').appendChild(canvas);}setTimeout(()=>{window.print();window.close();},600);});</script>
</body></html>`;
    const win = window.open("", "_blank", "width=500,height=600");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Ширээний удирдлага</h2>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={14} className="mr-1" /> Ширээ нэмэх
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="flex gap-3 items-end bg-card p-4 rounded-2xl border border-border flex-wrap">
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Ширээний нэр *</label>
            <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Жишээ: 1-р ширээ"
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary w-40"
              required autoFocus />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Суудлын тоо</label>
            <input type="number" value={addCapacity} onChange={e => setAddCapacity(e.target.value)} min="1" max="20"
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary w-20" />
          </div>
          <Button type="submit" size="sm" disabled={createTable.isPending}>Нэмэх</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowAdd(false)}><X size={14} /></Button>
        </form>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {tables?.map((table) => (
          <div key={table.id} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
            {/* Table info or edit form */}
            {editingId === table.id ? (
              <div className="space-y-2">
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                  autoFocus />
                <div className="flex gap-2">
                  <input type="number" value={editCapacity} onChange={e => setEditCapacity(e.target.value)} min="1"
                    className="w-20 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary" />
                  <Button size="sm" className="flex-1" onClick={() => handleEdit(table.id)}>Хадгалах</Button>
                  <button onClick={() => setEditingId(null)} className="p-1.5 text-muted-foreground hover:text-foreground"><X size={14} /></button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold">{table.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Users size={10} /> {table.capacity} хүн</p>
                  {table.status === "occupied" && (table as any).occupiedSince && (
                    <OccupancyTimer since={(table as any).occupiedSince} />
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${statusColor[table.status ?? "available"]}`}>
                    {statusLabel[table.status ?? "available"]}
                  </span>
                </div>
              </div>
            )}

            {editingId !== table.id && (
              <>
                {/* Session control button */}
                <Button
                  size="sm"
                  className={`w-full font-bold ${
                    table.status === "available"
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                      : "bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30"
                  }`}
                  onClick={() => handleToggleSession(table)}
                >
                  {table.status === "available" ? (
                    <><UserCheck size={14} className="mr-1.5" /> Зочин суулгах</>
                  ) : (
                    <><UserX size={14} className="mr-1.5" /> Чөлөөлөх</>
                  )}
                </Button>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1"
                    onClick={() => { setEditingId(table.id); setEditName(table.name); setEditCapacity(String(table.capacity)); }}>
                    <Pencil size={12} className="mr-1" /> Засах
                  </Button>
                  <button onClick={() => handleDelete(table)}
                    className="px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>

                <Button size="sm" variant="outline" className="w-full"
                  onClick={() => setQrTableId(qrTableId === table.id ? null : table.id)}>
                  <QrCode size={14} className="mr-1" /> QR код {qrTableId === table.id ? "хаах" : "харах"}
                </Button>

                {qrTableId === table.id && qrData && (
                  <div className="flex flex-col items-center gap-2 pt-1">
                    <div className="bg-white p-3 rounded-xl">
                      <QRCodeSVG value={qrData.url} size={110} />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center break-all leading-relaxed">{qrData.url}</p>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => printQR(table, qrData.url)}>
                      <Printer size={12} className="mr-1" /> QR хэвлэх
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, children, onVoidItem }: { order: Order; children?: React.ReactNode; onVoidItem?: (orderId: number, itemId: number) => void }) {
  const pm = (order as any).paymentMethod;
  const discount = Number((order as any).discount ?? 0);
  const canVoid = onVoidItem && !["paid", "cancelled"].includes(order.status);

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden shadow-sm transition-all ${
      (order.status === "pending" || order.status === "confirmed")
        ? "border-primary/40 shadow-primary/10"
        : pm === "bank" && order.status === "paid"
          ? "border-emerald-500/40 shadow-emerald-500/10"
          : "border-border"
    }`}>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/20">
        <div>
          <p className="font-bold text-sm flex items-center gap-2">
            Захиалга #{order.id}
            {pm === "bank" && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Банк
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Clock size={10} /> {format(new Date(order.createdAt), "HH:mm")} · {order.tableName}
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[order.status]}`}>
          {STATUS_LABELS[order.status]}
        </span>
      </div>
      <div className="px-4 py-3 space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-sm group">
            <span className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary w-6 h-6 flex items-center justify-center rounded text-xs font-bold">
                {item.quantity}
              </span>
              {item.menuItemName}
              {item.notes && <span className="text-xs text-muted-foreground italic">({item.notes})</span>}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">₮{(Number(item.unitPrice) * item.quantity).toLocaleString()}</span>
              {canVoid && (
                <button onClick={() => onVoidItem(order.id, item.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity" title="Хоол хасах">
                  <X size={12} />
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Нийт</span>
          <span className="font-bold text-primary">₮{Number(order.totalAmount).toLocaleString()}</span>
        </div>
        {discount > 0 && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-green-400 flex items-center gap-1"><Percent size={10} /> Хөнгөлөлт</span>
            <span className="text-xs text-green-400 font-bold">-₮{discount.toLocaleString()}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-medium">Төлөх дүн</span>
            <span className="font-bold text-lg text-primary">₮{(Number(order.totalAmount) - discount).toLocaleString()}</span>
          </div>
        )}
      </div>
      {children && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

/* ─── Banners Management ─── */

function BannersManagement() {
  const { data: banners, isLoading } = useQuery({ queryKey: ["banners-all"], queryFn: () => customFetch("/api/banners/all") as Promise<any[]> });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const addBanner = useMutation({
    mutationFn: (data: { title: string; imageUrl: string; linkUrl?: string }) =>
      customFetch("/api/banners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["banners-all"] }); setShowAdd(false); setTitle(""); setImageUrl(""); setLinkUrl(""); toast({ title: "Зар нэмэгдлээ" }); },
  });

  const toggleBanner = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      customFetch(`/api/banners/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["banners-all"] }),
  });

  const deleteBanner = useMutation({
    mutationFn: (id: number) => customFetch(`/api/banners/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["banners-all"] }); toast({ title: "Устгагдлаа" }); },
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Зарын удирдлага</h2>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}><Plus size={16} className="mr-1" /> Нэмэх</Button>
      </div>

      {showAdd && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <p className="font-medium text-sm">Шинэ зар</p>
          <input className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm" placeholder="Гарчиг" value={title} onChange={e => setTitle(e.target.value)} />
          <ImageUploadField value={imageUrl} onChange={setImageUrl} label="Зар зураг" />
          <input className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm" placeholder="Холбоос (заавал биш)" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" disabled={!imageUrl} onClick={() => addBanner.mutate({ title, imageUrl, linkUrl: linkUrl || undefined })}>Хадгалах</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Болих</Button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {(banners ?? []).map((b: any) => (
          <div key={b.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
            <img src={b.imageUrl} alt={b.title} className="w-20 h-14 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{b.title || "Гарчиггүй"}</p>
              <p className="text-xs text-muted-foreground truncate">{b.imageUrl}</p>
            </div>
            <button onClick={() => toggleBanner.mutate({ id: b.id, active: !b.active })} className={`px-3 py-1 rounded-full text-xs font-medium ${b.active ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}`}>
              {b.active ? "Идэвхтэй" : "Идэвхгүй"}
            </button>
            <button onClick={() => deleteBanner.mutate(b.id)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
          </div>
        ))}
        {(banners ?? []).length === 0 && <p className="text-muted-foreground text-sm text-center py-8">Зар байхгүй</p>}
      </div>
    </div>
  );
}

/* ─── Reviews Management ─── */

function ReviewsManagement() {
  const { data: reviews, isLoading } = useQuery({ queryKey: ["reviews-all"], queryFn: () => customFetch("/api/reviews/all") as Promise<any[]> });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteReview = useMutation({
    mutationFn: (id: number) => customFetch(`/api/reviews/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["reviews-all"] }); toast({ title: "Устгагдлаа" }); },
  });

  if (isLoading) return <Spinner />;

  const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Сэтгэгдлийн удирдлага</h2>
      <div className="grid gap-3">
        {(reviews ?? []).map((r: any) => (
          <div key={r.id} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{r.name}</p>
                  <span className="text-yellow-400 text-sm">{stars(r.rating)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5"><Phone size={10} className="inline mr-1" />{r.phone}</p>
                <p className="text-sm mt-2">{r.comment}</p>
                <p className="text-xs text-muted-foreground mt-1">{r.createdAt ? format(new Date(r.createdAt), "yyyy-MM-dd HH:mm") : ""}</p>
              </div>
              <button onClick={() => deleteReview.mutate(r.id)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {(reviews ?? []).length === 0 && <p className="text-muted-foreground text-sm text-center py-8">Сэтгэгдэл байхгүй</p>}
      </div>
    </div>
  );
}

/* ─── Settings Management ─── */

function SettingsManagement() {
  const { data: settings, isLoading } = useQuery({ queryKey: ["settings"], queryFn: () => customFetch("/api/settings") as Promise<Record<string, string>> });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const settingFields = [
    { key: "restaurantName", label: "Ресторанын нэр", placeholder: "Mongolian Grill", icon: <ChefHat size={16} /> },
    { key: "restaurantPhone", label: "Утас", placeholder: "+976 xxxx xxxx", icon: <Phone size={16} /> },
    { key: "restaurantAddress", label: "Хаяг", placeholder: "Улаанбаатар хот...", icon: <MapPin size={16} /> },
    { key: "instagramUrl", label: "Instagram", placeholder: "https://instagram.com/...", icon: <Instagram size={16} /> },
    { key: "facebookUrl", label: "Facebook", placeholder: "https://facebook.com/...", icon: <Facebook size={16} /> },
    { key: "googleMapsUrl", label: "Google Maps", placeholder: "https://maps.google.com/...", icon: <MapPin size={16} /> },
  ];

  const [values, setValues] = useState<Record<string, string>>({});
  const [openTime, setOpenTime] = useState("10:00");
  const [closeTime, setCloseTime] = useState("22:00");

  const loaded = !!settings;
  if (loaded && Object.keys(values).length === 0) {
    const init: Record<string, string> = {};
    for (const f of settingFields) init[f.key] = (settings as any)?.[f.key] ?? "";
    setValues(init);
    const hours = (settings as any)?.openHours ?? "";
    const match = hours.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
    if (match) { setOpenTime(match[1]); setCloseTime(match[2]); }
    else if (hours) { setOpenTime(hours); }
  }

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const allSettings = { ...values, openHours: `${openTime} - ${closeTime}` };
      await Promise.all(
        Object.entries(allSettings).map(([key, value]) =>
          customFetch(`/api/settings/${key}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) })
        )
      );
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "Бүх тохиргоо хадгалагдлаа" });
    } catch {
      toast({ title: "Алдаа гарлаа", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Ресторанын тохиргоо</h2>
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        {settingFields.map(f => (
          <div key={f.key} className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">{f.icon} {f.label}</label>
            <input
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
              placeholder={f.placeholder}
              value={values[f.key] ?? ""}
              onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
            />
          </div>
        ))}

        {/* Working hours with time pickers */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><Clock size={16} /> Ажлын цаг</label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Нээх цаг</label>
              <input
                type="time"
                value={openTime}
                onChange={e => setOpenTime(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <span className="text-muted-foreground mt-5">—</span>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Хаах цаг</label>
              <input
                type="time"
                value={closeTime}
                onChange={e => setCloseTime(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-border">
          <Button className="w-full" onClick={handleSaveAll} disabled={saving}>
            {saving ? "Хадгалж байна..." : "Бүгдийг хадгалах"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Occupancy Timer ─── */
function OccupancyTimer({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState("");
  const [warn, setWarn] = useState(false);

  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(since).getTime();
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      const m = mins % 60;
      setElapsed(hrs > 0 ? `${hrs}ц ${m}м` : `${m} мин`);
      setWarn(mins >= 90);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [since]);

  return (
    <p className={`text-xs flex items-center gap-1 mt-0.5 ${warn ? "text-red-400" : "text-orange-400"}`}>
      <Timer size={10} /> {elapsed} {warn && <AlertCircle size={10} />}
    </p>
  );
}

/* ─── Discount Modal ─── */
function DiscountModal({ order, onConfirm, onClose }: {
  order: Order;
  onConfirm: (amount: number, reason: string) => void;
  onClose: () => void;
}) {
  const total = Number(order.totalAmount);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"amount" | "percent">("amount");
  const discountAmount = mode === "percent"
    ? Math.round(total * (parseFloat(amount) || 0) / 100)
    : parseFloat(amount) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-lg">Хөнгөлөлт хийх</h2>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-lg"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Захиалга #{order.id}</span>
            <span className="font-bold">₮{total.toLocaleString()}</span>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setMode("amount")}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${mode === "amount" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
              Дүнгээр
            </button>
            <button onClick={() => setMode("percent")}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${mode === "percent" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
              Хувиар %
            </button>
          </div>

          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder={mode === "percent" ? "Хувь (жишээ: 10)" : "Дүн (₮)"}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:border-primary text-center"
            autoFocus min="0" max={mode === "percent" ? "100" : String(total)} />

          <input value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Шалтгаан (заавал биш)"
            className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />

          {discountAmount > 0 && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400">
              <span>Хөнгөлөлт</span>
              <span className="text-xl font-bold">-₮{discountAmount.toLocaleString()}</span>
            </div>
          )}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Буцах</Button>
          <Button className="flex-1" disabled={discountAmount <= 0 || discountAmount > total}
            onClick={() => onConfirm(discountAmount, reason)}>
            Хөнгөлөлт хийх
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Reservations Management ─── */
function ReservationsManagement() {
  const { data: tables } = useGetTables();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"));
  const [showAdd, setShowAdd] = useState(false);

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["reservations", dateFilter],
    queryFn: () => customFetch(`/api/reservations?date=${dateFilter}`) as Promise<any[]>,
  });

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [resDate, setResDate] = useState("");
  const [resTime, setResTime] = useState("18:00");
  const [resNotes, setResNotes] = useState("");

  const createReservation = useMutation({
    mutationFn: (data: any) => fetch("/api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      setShowAdd(false);
      setGuestName(""); setGuestPhone(""); setPartySize("2"); setResNotes("");
      toast({ title: "Захиалга бүртгэгдлээ" });
    },
    onError: () => toast({ title: "Алдаа гарлаа", variant: "destructive" }),
  });

  const updateReservation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; status?: string; tableId?: number }) =>
      customFetch(`/api/reservations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reservations"] }),
  });

  const deleteReservation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/reservations/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["reservations"] }); toast({ title: "Устгагдлаа" }); },
  });

  const handleCreate = () => {
    if (!guestName || !guestPhone || !resDate) return;
    createReservation.mutate({
      guestName, guestPhone,
      partySize: parseInt(partySize) || 2,
      reservationDate: `${resDate}T${resTime}:00`,
      notes: resNotes || undefined,
    });
  };

  const resStatusColor: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    confirmed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    seated: "bg-green-500/20 text-green-400 border-green-500/30",
    completed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
    no_show: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  const resStatusLabel: Record<string, string> = {
    pending: "Хүлээгдэж байна",
    confirmed: "Баталгаажсан",
    seated: "Суусан",
    completed: "Дууссан",
    cancelled: "Цуцалсан",
    no_show: "Ирээгүй",
  };

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold">Ширээ захиалга</h2>
        <div className="flex items-center gap-3">
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary [color-scheme:dark]" />
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}><Plus size={14} className="mr-1" /> Шинэ</Button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <p className="font-medium text-sm">Ширээ захиалга бүртгэх</p>
          <div className="grid grid-cols-2 gap-3">
            <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Зочны нэр *"
              className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" required />
            <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="Утас *"
              className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" required />
            <input type="number" value={partySize} onChange={e => setPartySize(e.target.value)} placeholder="Хүний тоо" min="1" max="50"
              className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
            <input type="date" value={resDate} onChange={e => setResDate(e.target.value)}
              className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary [color-scheme:dark]" required />
            <input type="time" value={resTime} onChange={e => setResTime(e.target.value)}
              className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary [color-scheme:dark]" />
            <input value={resNotes} onChange={e => setResNotes(e.target.value)} placeholder="Тэмдэглэл"
              className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!guestName || !guestPhone || !resDate}>Бүртгэх</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Болих</Button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {(reservations ?? []).map((r: any) => (
          <div key={r.id} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="font-bold text-sm flex items-center gap-2">
                  {r.guestName}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${resStatusColor[r.status]}`}>
                    {resStatusLabel[r.status]}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Phone size={10} /> {r.guestPhone} · <Users size={10} /> {r.partySize} хүн
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock size={10} /> {format(new Date(r.reservationDate), "yyyy-MM-dd HH:mm")}
                </p>
                {r.notes && <p className="text-xs text-muted-foreground italic">{r.notes}</p>}
              </div>
              <div className="flex items-center gap-1">
                {r.status === "pending" && (
                  <button onClick={() => updateReservation.mutate({ id: r.id, status: "confirmed" })}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
                    Батлах
                  </button>
                )}
                {r.status === "confirmed" && (
                  <button onClick={() => updateReservation.mutate({ id: r.id, status: "seated" })}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30">
                    Суулгах
                  </button>
                )}
                {r.status === "seated" && (
                  <button onClick={() => updateReservation.mutate({ id: r.id, status: "completed" })}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-500/20 text-gray-400 hover:bg-gray-500/30">
                    Дуусга
                  </button>
                )}
                {["pending", "confirmed"].includes(r.status) && (
                  <button onClick={() => updateReservation.mutate({ id: r.id, status: "cancelled" })}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30">
                    Цуцлах
                  </button>
                )}
                <button onClick={() => deleteReservation.mutate(r.id)}
                  className="px-1.5 py-1 text-muted-foreground hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
        {(reservations ?? []).length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-12">Энэ өдөрт захиалга байхгүй</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${primary ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
