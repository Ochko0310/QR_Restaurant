import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/use-store";
import { useStaffRealtime } from "@/hooks/use-realtime";
import { socket } from "@/lib/socket";
import { useT } from "@/lib/i18n";
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
  CalendarDays, Download, Pencil, Users,
  Minus, Search, Building2, UserCheck, UserX, View,
  Upload, Package, Bell, AlertTriangle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Star, MapPin, Image, MessageSquare, Settings, Phone, Instagram, Facebook,
  CalendarPlus, Timer, AlertCircle,
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

type Tab = "orders" | "menu" | "reports" | "tables" | "reservations" | "banners" | "reviews" | "settings" | "inventory" | "staff";

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

// ── Payment modal ──────────────────────────────────────────────────────────────
function PaymentModal({ orders, pendingSiblings, onConfirm, onClose }: {
  orders: Order[];
  pendingSiblings?: Order[];
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { data: settings } = useQuery<Record<string, string>>({ queryKey: ["settings"], queryFn: () => customFetch("/api/settings") });
  const queryClient = useQueryClient();
  const t = useT();
  const primary = orders[0]!;
  const subtotal = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

  // Tip / service charge defaults from restaurant settings
  const defaultTipPct = parseFloat(settings?.tip_percent ?? "0") || 0;
  const defaultServicePct = parseFloat(settings?.service_charge_percent ?? "0") || 0;

  const [tipPct, setTipPct] = useState<number>(defaultTipPct);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState<boolean>(defaultServicePct > 0);
  const [splitCount, setSplitCount] = useState<number>(1);

  // Sync defaults when settings load
  useEffect(() => {
    setTipPct(defaultTipPct);
    setServiceChargeEnabled(defaultServicePct > 0);
  }, [defaultTipPct, defaultServicePct]);

  const tipAmount = Math.round(subtotal * (tipPct / 100));
  const serviceCharge = serviceChargeEnabled ? Math.round(subtotal * (defaultServicePct / 100)) : 0;
  const total = subtotal + tipAmount + serviceCharge;
  const perPerson = splitCount > 1 ? Math.ceil(total / splitCount) : total;

  const [cash, setCash] = useState("");
  const cashNum = parseFloat(cash) || 0;
  const change = cashNum - total;

  // Persist billing adjustments to backend before payment confirmation
  const saveBilling = async () => {
    // Split total proportionally across orders so each row records its share
    const ratios = orders.map(o => Number(o.totalAmount) / (subtotal || 1));
    await Promise.all(orders.map((o, i) => {
      const r = ratios[i]!;
      return customFetch(`/api/orders/${o.id}/billing`, {
        method: "PATCH",
        body: JSON.stringify({
          tipAmount: Math.round(tipAmount * r),
          serviceChargeAmount: Math.round(serviceCharge * r),
          splitCount,
        }),
      });
    }));
    queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey() });
  };

  const handleConfirm = async () => {
    try { await saveBilling(); } catch { /* non-blocking */ }
    onConfirm();
  };

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
            <h2 className="font-bold text-lg">{t("payment")} · {primary.tableName}</h2>
            <p className="text-sm text-muted-foreground">
              {orders.length > 1
                ? `${orders.length} захиалга: ${orders.map(o => `#${o.id}`).join(", ")}`
                : `Захиалга #${primary.id}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50">
            <X size={18} />
          </button>
        </div>

        {/* Pending sibling warning */}
        {pendingSiblings && pendingSiblings.length > 0 && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-start gap-2">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              Энэ ширээн дээр бэлтгэгдэж буй захиалга байна (
              {pendingSiblings.map(o => `#${o.id}`).join(", ")}
              ). Тооцоонд ороогүй — бэлэн болсны дараа тусад нь авна.
            </div>
          </div>
        )}

        {/* Items summary — grouped by order if multiple */}
        <div className="px-6 py-4 space-y-3 border-b border-border max-h-56 overflow-y-auto">
          {orders.map((o, idx) => (
            <div key={o.id} className="space-y-2">
              {orders.length > 1 && (
                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <span>Захиалга #{o.id}</span>
                  <span>₮{Number(o.totalAmount).toLocaleString()}</span>
                </div>
              )}
              {o.items.map(item => (
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
              {orders.length > 1 && idx < orders.length - 1 && (
                <div className="border-b border-border/50" />
              )}
            </div>
          ))}
        </div>

        {/* Tip / service charge / split */}
        <div className="px-6 py-4 border-b border-border space-y-3">
          <div>
            <label className="text-xs text-muted-foreground flex items-center justify-between mb-1">
              <span>{t("tip")} (%)</span>
              <span className="font-mono">₮{tipAmount.toLocaleString()}</span>
            </label>
            <div className="flex gap-2">
              {[0, 5, 10, 15, 20].map(p => (
                <button key={p} onClick={() => setTipPct(p)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    tipPct === p ? "bg-primary/20 border-primary text-primary" : "bg-muted/30 border-border text-muted-foreground hover:border-primary/40"
                  }`}>{p}%</button>
              ))}
            </div>
          </div>
          {defaultServicePct > 0 && (
            <label className="flex items-center justify-between cursor-pointer text-sm">
              <span className="text-muted-foreground">{t("service_charge")} ({defaultServicePct}%)</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs">₮{serviceCharge.toLocaleString()}</span>
                <input type="checkbox" checked={serviceChargeEnabled}
                  onChange={e => setServiceChargeEnabled(e.target.checked)}
                  className="w-4 h-4 accent-primary" />
              </span>
            </label>
          )}
          <div>
            <label className="text-xs text-muted-foreground flex items-center justify-between mb-1">
              <span>{t("split_bill")}</span>
              <span className="font-mono">{splitCount > 1 ? `₮${perPerson.toLocaleString()} / ${t("per_person")}` : "—"}</span>
            </label>
            <div className="flex items-center gap-2">
              <button onClick={() => setSplitCount(Math.max(1, splitCount - 1))}
                className="w-8 h-8 rounded-lg bg-muted/50 hover:bg-muted flex items-center justify-center">
                <Minus size={14} />
              </button>
              <input type="number" min="1" max="20" value={splitCount}
                onChange={e => setSplitCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-center" />
              <button onClick={() => setSplitCount(Math.min(20, splitCount + 1))}
                className="w-8 h-8 rounded-lg bg-muted/50 hover:bg-muted flex items-center justify-center">
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="px-6 py-4 border-b border-border space-y-1.5">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{t("subtotal")}</span>
            <span>₮{subtotal.toLocaleString()}</span>
          </div>
          {tipAmount > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{t("tip")} ({tipPct}%)</span>
              <span>+₮{tipAmount.toLocaleString()}</span>
            </div>
          )}
          {serviceCharge > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{t("service_charge")} ({defaultServicePct}%)</span>
              <span>+₮{serviceCharge.toLocaleString()}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="font-medium">{t("total")}</span>
            <span className="text-2xl font-bold text-primary">₮{total.toLocaleString()}</span>
          </div>
        </div>

        {/* Cash input */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block flex items-center gap-2">
              <Banknote size={14} /> {t("amount_received")}
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
              <span className="font-medium">{change >= 0 ? t("change") : t("short")}</span>
              <span className="text-xl font-bold">₮{Math.abs(change).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>{t("cancel")}</Button>
          <Button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
            disabled={cashNum < total}
            onClick={handleConfirm}
          >
            <CheckCheck size={16} className="mr-2" />
            {t("confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function OrderDetailModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const t = useT();
  const pm = (order as any).paymentMethod as "cash" | "bank" | undefined;
  const total = Number(order.totalAmount);
  const subtotal = order.items.reduce(
    (sum, it) => sum + Number(it.unitPrice) * it.quantity,
    0,
  );
  const createdAt = new Date(order.createdAt);
  const paidAtRaw = (order as any).paidAt;
  const paidAt = paidAtRaw ? new Date(paidAtRaw) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-bold text-lg">{t("order_history")}</h2>
            <p className="text-sm text-muted-foreground">
              Захиалга #{order.id} · {order.tableName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-2 border-b border-border max-h-56 overflow-y-auto">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="flex items-start gap-2 text-muted-foreground flex-1 min-w-0">
                <span className="bg-primary/10 text-primary w-5 h-5 flex items-center justify-center rounded text-xs font-bold flex-shrink-0 mt-0.5">
                  {item.quantity}
                </span>
                <span className="truncate">{item.menuItemName}</span>
              </span>
              <span className="flex-shrink-0">
                ₮{(Number(item.unitPrice) * item.quantity).toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 space-y-2 border-b border-border text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>{t("subtotal")}</span>
            <span>₮{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="font-medium">{t("total")}</span>
            <span className="text-xl font-bold text-primary">
              ₮{total.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="px-6 py-4 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("payment_method")}</span>
            {pm === "bank" ? (
              <span className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold flex items-center gap-1">
                <Banknote size={12} /> {t("bank")}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1">
                <Banknote size={12} /> {t("cash")}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock size={12} /> {t("created")}
            </span>
            <span>{format(createdAt, "yyyy-MM-dd HH:mm")}</span>
          </div>
          {paidAt && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCheck size={12} /> {t("paid_at")}
              </span>
              <span>{format(paidAt, "yyyy-MM-dd HH:mm")}</span>
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <Button variant="outline" className="w-full" onClick={onClose}>
            {t("close")}
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
  const t = useT();

  if (!token || !user) {
    setLocation("/staff/login");
    return null;
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; roles: string[] }[] = [
    { id: "orders", label: t("tab_orders"), icon: <ShoppingBag size={16} />, roles: ["manager", "cashier", "chef"] },
    { id: "menu", label: t("tab_menu"), icon: <Utensils size={16} />, roles: ["manager"] },
    { id: "reports", label: t("tab_reports"), icon: <BarChart3 size={16} />, roles: ["manager", "cashier"] },
    { id: "inventory", label: t("tab_inventory"), icon: <Package size={16} />, roles: ["manager", "cashier"] },
    { id: "tables", label: t("tab_tables"), icon: <TableProperties size={16} />, roles: ["manager"] },
    { id: "reservations", label: t("tab_reservations"), icon: <CalendarPlus size={16} />, roles: ["manager", "cashier"] },
    { id: "banners", label: t("tab_banners"), icon: <Image size={16} />, roles: ["manager"] },
    { id: "reviews", label: t("tab_reviews"), icon: <MessageSquare size={16} />, roles: ["manager"] },
    { id: "staff", label: "Ажилтан", icon: <Users size={16} />, roles: ["manager", "cashier", "chef"] },
    { id: "settings", label: t("tab_settings"), icon: <Settings size={16} />, roles: ["manager"] },
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
              <p className="font-bold text-sm leading-tight">{t("system_title")}</p>
              <p className="text-xs text-muted-foreground">
                {user.name} · <span className="text-primary capitalize">{user.role}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-xs ${connected ? "text-green-400" : "text-muted-foreground"}`}>
              {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
              <span className="hidden sm:inline">{connected ? t("realtime") : t("offline")}</span>
            </div>
            <NotificationBell />
            <LogoutButton role={user.role} onLoggedOut={() => { logout(); setLocation("/staff/login"); }} />
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
        {activeTab === "menu" && <MenuManagement />}
        {activeTab === "reports" && <ReportsView />}
        {activeTab === "inventory" && <InventoryView />}
        {activeTab === "tables" && <TablesView />}
        {activeTab === "reservations" && <ReservationsManagement />}
        {activeTab === "banners" && <BannersManagement />}
        {activeTab === "reviews" && <ReviewsManagement />}
        {activeTab === "staff" && <StaffAndShiftsView role={user.role} meId={user.id} />}
        {activeTab === "settings" && <SettingsManagement />}
      </main>
    </div>
  );
}

/* ─── Shifts / Clock-in ─── */

type ShiftRow = {
  id: number;
  userId: number;
  clockInAt: string;
  clockOutAt: string | null;
  note: string | null;
  userName?: string;
  userRole?: string;
};

function formatShiftDuration(start: string, end: string | null): string {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const mins = Math.max(0, Math.round((e - s) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} цаг ${m} мин`;
}

function MyShiftPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const t = useT();
  const { data: me } = useQuery<{ openShift: ShiftRow | null; recent: ShiftRow[] }>({
    queryKey: ["shifts-me"],
    queryFn: () => customFetch("/api/shifts/me"),
    refetchInterval: 30000,
  });

  const clockIn = useMutation({
    mutationFn: () => customFetch("/api/shifts/clock-in", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts-me"] });
      toast({ title: "Ээлжинд орлоо" });
    },
    onError: (err: any) => toast({ title: "Алдаа", description: err?.message || "", variant: "destructive" }),
  });

  const openShift = me?.openShift ?? null;
  const recent = me?.recent ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2"><Clock size={20} /> {t("tab_shifts")}</h2>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-muted-foreground">{t("current_status")}</p>
            {openShift ? (
              <p className="text-lg font-bold text-green-400">
                {t("active")} · {formatShiftDuration(openShift.clockInAt, null)}
              </p>
            ) : (
              <p className="text-lg font-bold text-muted-foreground">{t("not_clocked_in")}</p>
            )}
            {openShift && (
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(openShift.clockInAt), "yyyy-MM-dd HH:mm")}
              </p>
            )}
          </div>
          {!openShift && (
            <Button onClick={() => clockIn.mutate()} disabled={clockIn.isPending}
              className="bg-green-500 hover:bg-green-600 text-white">
              <Clock size={14} className="mr-2" /> {t("clock_in")}
            </Button>
          )}
        </div>
        {openShift && (
          <p className="mt-3 text-xs text-muted-foreground">
            Ээлж дуусгахдаа "Гарах" товч дарна уу — ээлжийг автоматаар хаана.
          </p>
        )}
      </div>

      <div>
        <h3 className="font-bold mb-3">{t("my_recent_shifts")}</h3>
        <div className="bg-card border border-border rounded-2xl divide-y divide-border">
          {recent.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">{t("no_history")}</div>
          ) : (
            recent.map(s => (
              <div key={s.id} className="p-4 flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{format(new Date(s.clockInAt), "yyyy-MM-dd")}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(s.clockInAt), "HH:mm")} —{" "}
                    {s.clockOutAt ? format(new Date(s.clockOutAt), "HH:mm") : "идэвхтэй"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm">{formatShiftDuration(s.clockInAt, s.clockOutAt)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Logout with auto clock-out ─── */

function LogoutButton({ role, onLoggedOut }: { role: string; onLoggedOut: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const { data: me } = useQuery<{ openShift: ShiftRow | null; recent: ShiftRow[] }>({
    queryKey: ["shifts-me"],
    queryFn: () => customFetch("/api/shifts/me"),
    enabled: role !== "manager",
  });
  const hasOpenShift = !!me?.openShift;
  const isManager = role === "manager";

  const handle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!isManager && hasOpenShift) {
        if (!confirm("Ээлж дуусгаад гарах уу?")) { setBusy(false); return; }
        try {
          await customFetch("/api/shifts/clock-out", { method: "POST", body: JSON.stringify({}) });
          toast({ title: "Ээлж дууслаа" });
        } catch {
          // Non-blocking: logout even if clock-out failed
        }
      }
      onLoggedOut();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handle} disabled={busy}
      title={!isManager && hasOpenShift ? "Ээлж дуусгаад гарах" : "Гарах"}>
      {!isManager && hasOpenShift ? (
        <><Clock size={14} className="mr-1.5 text-red-400" /><span className="hidden sm:inline text-xs">Ээлж дуусгаад гарах</span><LogOut size={14} className="sm:hidden" /></>
      ) : (
        <LogOut size={16} />
      )}
    </Button>
  );
}

/* ─── Staff & Shifts (combined) ─── */

type StaffUser = {
  id: number;
  username: string;
  name: string;
  role: "manager" | "chef" | "cashier";
  createdAt: string;
};

const roleLabel = (r: string) =>
  ({ manager: "Менежер", chef: "Тогооч", cashier: "Кассчин" } as Record<string, string>)[r] ?? r;

function StaffAndShiftsView({ role, meId }: { role: string; meId: number }) {
  if (role !== "manager") return <MyShiftPanel />;
  return <ManagerStaffList meId={meId} />;
}

function ManagerStaffList({ meId }: { meId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery<StaffUser[]>({
    queryKey: ["users"],
    queryFn: () => customFetch("/api/users"),
  });
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const del = useMutation({
    mutationFn: (id: number) => customFetch(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Ажилтан устгагдлаа" });
    },
    onError: (err: any) => toast({ title: "Алдаа", description: err?.message || "", variant: "destructive" }),
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold flex items-center gap-2"><Users size={20} /> Ажилтан & Ээлж</h2>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus size={16} /> Ажилтан нэмэх</Button>
      </div>

      {showAdd && <StaffForm onClose={() => setShowAdd(false)} onDone={() => { queryClient.invalidateQueries({ queryKey: ["users"] }); setShowAdd(false); toast({ title: "Ажилтан бүртгэгдлээ" }); }} />}
      {editing && <StaffForm user={editing} onClose={() => setEditing(null)} onDone={() => { queryClient.invalidateQueries({ queryKey: ["users"] }); setEditing(null); toast({ title: "Хадгалагдлаа" }); }} />}

      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {(users ?? []).length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Ажилтан бүртгэгдээгүй байна</div>
        ) : (
          (users ?? []).map(u => {
            const isOpen = expandedId === u.id;
            return (
              <div key={u.id}>
                <div
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isOpen ? null : u.id)}
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-transform ${isOpen ? "rotate-90 bg-primary/20 text-primary" : "bg-muted/40 text-muted-foreground"}`}>
                      <ArrowRight size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{u.name}
                        {u.id === meId && <span className="ml-2 text-xs text-primary">(Та)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">@{u.username} · {roleLabel(u.role)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setEditing(u)} className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground">
                      <Pencil size={14} />
                    </button>
                    {u.id !== meId && (
                      <button onClick={() => { if (confirm(`"${u.name}"-г устгах уу?`)) del.mutate(u.id); }}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {isOpen && <UserShiftHistory userId={u.id} />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function UserShiftHistory({ userId }: { userId: number }) {
  const { data: shifts, isLoading } = useQuery<ShiftRow[]>({
    queryKey: ["shifts-by-user", userId],
    queryFn: () => customFetch(`/api/shifts?userId=${userId}`),
  });

  if (isLoading) return <div className="px-4 pb-4"><Spinner /></div>;

  const rows = shifts ?? [];
  const totalMins = rows.reduce((sum, s) => {
    const startT = new Date(s.clockInAt).getTime();
    const endT = s.clockOutAt ? new Date(s.clockOutAt).getTime() : Date.now();
    return sum + Math.max(0, Math.round((endT - startT) / 60000));
  }, 0);
  const totalH = Math.floor(totalMins / 60);
  const totalM = totalMins % 60;

  // Group by date (yyyy-mm-dd)
  const byDay = new Map<string, ShiftRow[]>();
  for (const s of rows) {
    const d = format(new Date(s.clockInAt), "yyyy-MM-dd");
    const arr = byDay.get(d) ?? [];
    arr.push(s);
    byDay.set(d, arr);
  }
  const days = [...byDay.entries()];

  return (
    <div className="bg-background/50 border-t border-border px-4 py-4 space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Нийт ажилсан өдөр: <b className="text-foreground">{days.length}</b></span>
        <span className="text-muted-foreground">Нийт цаг: <b className="text-foreground">{totalH} ц {totalM} мин</b></span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3">Ээлжийн бүртгэл алга</p>
      ) : (
        <div className="bg-card rounded-xl border border-border divide-y divide-border max-h-80 overflow-y-auto">
          {days.map(([day, list]) => {
            const dayMins = list.reduce((sum, s) => {
              const startT = new Date(s.clockInAt).getTime();
              const endT = s.clockOutAt ? new Date(s.clockOutAt).getTime() : Date.now();
              return sum + Math.max(0, Math.round((endT - startT) / 60000));
            }, 0);
            return (
              <div key={day} className="p-3">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-foreground">{day}</span>
                  <span className="font-mono text-muted-foreground">{Math.floor(dayMins / 60)} ц {dayMins % 60} мин</span>
                </div>
                <div className="space-y-1.5">
                  {list.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {format(new Date(s.clockInAt), "HH:mm")} —{" "}
                        {s.clockOutAt ? format(new Date(s.clockOutAt), "HH:mm") : <span className="text-green-400">идэвхтэй</span>}
                      </span>
                      <span className="font-mono">{formatShiftDuration(s.clockInAt, s.clockOutAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StaffForm({ user, onClose, onDone }: { user?: StaffUser; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffUser["role"]>(user?.role ?? "cashier");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || (!user && !username.trim()) || (!user && !password.trim())) {
      toast({ title: "Бүх талбарыг бөглөнө үү", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (user) {
        const body: Record<string, unknown> = { name, role };
        if (password) body.password = password;
        await customFetch(`/api/users/${user.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await customFetch("/api/users", { method: "POST", body: JSON.stringify({ name, username, password, role }) });
      }
      onDone();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Алдаа гарлаа";
      toast({ title: "Алдаа", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-lg">{user ? "Ажилтан засах" : "Ажилтан нэмэх"}</h2>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Нэр</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
          </div>
          {!user && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Нэвтрэх нэр</label>
              <input value={username} onChange={e => setUsername(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">{user ? "Шинэ нууц үг (заавал биш)" : "Нууц үг"}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Үүрэг</label>
            <select value={role} onChange={e => setRole(e.target.value as StaffUser["role"])}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary">
              <option value="chef">Тогооч</option>
              <option value="cashier">Кассчин</option>
              <option value="manager">Менежер</option>
            </select>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Буцах</Button>
          <Button className="flex-1" onClick={submit} disabled={saving}>{saving ? "Хадгалж байна..." : "Хадгалах"}</Button>
        </div>
      </div>
    </div>
  );
}

function OrdersView({ role }: { role: string }) {
  const t = useT();
  const isChef = role === "chef";
  const isManager = role === "manager";
  const { data: orders, isLoading } = useGetOrders();
  const updateStatus = useUpdateOrderStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  // Chef only sees preparing orders
  const active = orders?.filter((o) => {
    if (isChef) return o.status === "preparing";
    return !["paid", "cancelled"].includes(o.status);
  })?.filter((o) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return o.tableName?.toLowerCase().includes(q) || String(o.id).includes(q) || o.items?.some((i: any) => i.menuItemName?.toLowerCase().includes(q));
  }) ?? [];

  // Totals across all active orders on the same table (excludes paid/cancelled)
  // so cashier can see the combined amount owed per shared-QR group.
  const tableGroupTotals = (() => {
    const map = new Map<number, { total: number; count: number }>();
    const activeForTotals = (orders ?? []).filter(o => !["paid", "cancelled"].includes(o.status));
    for (const o of activeForTotals) {
      const prev = map.get(o.tableId) ?? { total: 0, count: 0 };
      prev.total += Number(o.totalAmount);
      prev.count += 1;
      map.set(o.tableId, prev);
    }
    return map;
  })();

  const done = orders?.filter((o) => o.status === "paid").slice(0, 5) ?? [];

  const handle = (orderId: number, status: string) => {
    updateStatus.mutate(
      { orderId, data: { status: status as "confirmed" | "preparing" | "ready" | "served" | "paid" | "cancelled" } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey() }),
        onError: (err: any) => {
          const msg = err?.response?.data?.message || err?.message || "Статус шинэчилж чадсангүй";
          toast({ title: "Алдаа", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleSendToKitchen = (order: Order) => {
    handle(order.id, "preparing");
    toast({ title: `Захиалга #${order.id} — гал тогоонд илгээгдлээ` });
  };

  const handlePaymentConfirm = async (ordersToPay: Order[]) => {
    try {
      for (const o of ordersToPay) {
        await updateStatus.mutateAsync({
          orderId: o.id,
          data: { status: "paid" },
        });
      }
      queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey() });
      setPayingOrder(null);
      const label =
        ordersToPay.length > 1
          ? `${ordersToPay.length} захиалга (${ordersToPay.map(o => `#${o.id}`).join(", ")})`
          : `Захиалга #${ordersToPay[0]!.id}`;
      toast({ title: `${label} — төлбөр амжилттай авлаа ✓` });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Төлбөр авч чадсангүй";
      toast({ title: "Алдаа", description: msg, variant: "destructive" });
    }
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
          <h2 className="text-xl font-bold">{t("preparing_orders")}</h2>
          <span className="bg-orange-500/10 text-orange-400 text-sm font-bold px-2.5 py-0.5 rounded-full border border-orange-500/20">{active.length}</span>
        </div>

        {!active.length ? (
          <div className="text-center py-20 text-muted-foreground">
            <ChefHat size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">{t("no_prep_orders")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {active.map((order) => (
              <OrderCard key={order.id} order={order} tableGroup={tableGroupTotals.get(order.tableId)}>
                <Button className="w-full bg-green-500 hover:bg-green-600 text-white font-bold text-base py-5"
                  onClick={() => { handle(order.id, "ready"); toast({ title: `#${order.id} — ${t("ready")}` }); }}>
                  <CheckCheck size={18} className="mr-2" /> {t("mark_ready")}
                </Button>
              </OrderCard>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ─── Manager / Cashier Full View ─── */
  return (
    <>
      {payingOrder && (() => {
        const payable = (orders ?? []).filter(
          (o) =>
            o.tableId === payingOrder.tableId &&
            (o.status === "ready" || o.status === "served"),
        );
        const group = payable.length > 0 ? payable : [payingOrder];
        const pendingSiblings = (orders ?? []).filter(
          (o) =>
            o.tableId === payingOrder.tableId &&
            ["pending", "confirmed", "preparing"].includes(o.status),
        );
        return (
          <PaymentModal
            orders={group}
            pendingSiblings={pendingSiblings}
            onConfirm={() => handlePaymentConfirm(group)}
            onClose={() => setPayingOrder(null)}
          />
        );
      })()}

      {createOpen && (
        <CreateOrderModal
          onClose={() => setCreateOpen(false)}
          onDone={() => { setCreateOpen(false); queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey() }); }}
        />
      )}

      {detailOrder && (
        <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />
      )}

      <div className="space-y-8">
        {/* Flow banner + search + create button */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground bg-card/50 border border-border rounded-xl px-4 py-3 flex-1">
            <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full text-xs font-bold">Шинэ</span>
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
                <OrderCard key={order.id} order={order} tableGroup={tableGroupTotals.get(order.tableId)} onVoidItem={(isManager || role === "cashier") ? handleVoidItem : undefined}>
                  {(order.status === "pending" || order.status === "confirmed") && (
                    <div className="flex flex-col gap-2">
                      <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                        onClick={() => handleSendToKitchen(order)}>
                        <ChefHat size={15} className="mr-2" /> Гал тогоонд өгөх
                      </Button>
                      <button
                        onClick={() => handleCancel(order)}
                        className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors text-center py-1"
                      >
                        Цуцлах
                      </button>
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
                            onClick={() => handlePaymentConfirm([order])}>
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
                          onClick={() => handlePaymentConfirm([order])}>
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
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setDetailOrder(order)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-card border border-border rounded-xl text-sm opacity-70 hover:opacity-100 hover:border-primary/40 transition text-left"
                >
                  <span className="text-muted-foreground">#{order.id} · {order.tableName}</span>
                  <span className="text-muted-foreground">{format(new Date(order.createdAt), "HH:mm")}</span>
                  <span className="font-bold">₮{Number(order.totalAmount).toLocaleString()}</span>
                </button>
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

function toLocalDatetimeValue(d: Date) {
  return format(d, "yyyy-MM-dd'T'HH:mm");
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

/* ─── Inventory (External goods) ─── */

type InventoryItem = {
  id: number;
  name: string;
  type: string;
  quantity: number;
  threshold: number;
  imageUrl: string | null;
  price: number;
  categoryId: number | null;
  menuItemId: number | null;
  createdAt: string;
  updatedAt: string;
};

function useInventory() {
  return useQuery<InventoryItem[]>({
    queryKey: ["inventory"],
    queryFn: () => customFetch<InventoryItem[]>("/api/inventory"),
  });
}

function InventoryView() {
  const { data, isLoading, refetch } = useInventory();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  if (isLoading && !data) return <Spinner />;

  const items = data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold flex items-center gap-2"><Package size={20} /> Барааны нөөц</h2>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus size={16} /> Бараа нэмэх</Button>
      </div>

      {showAdd && (
        <InventoryForm
          onClose={() => setShowAdd(false)}
          onDone={() => { refetch(); setShowAdd(false); toast({ title: "Бараа нэмэгдлээ" }); }}
        />
      )}

      {items.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground text-sm">
          <Package size={32} className="mx-auto mb-2 opacity-30" />
          Бараа байхгүй байна
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const low = item.quantity <= item.threshold;
            return (
              <div key={item.id} className={`bg-card border rounded-2xl overflow-hidden ${low ? "border-orange-500/40" : "border-border"}`}>
                {item.imageUrl ? (
                  <div className="h-32 w-full bg-muted">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-32 w-full bg-muted/30 flex items-center justify-center">
                    <Package size={32} className="opacity-20" />
                  </div>
                )}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.type}</p>
                    </div>
                    {low && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                        <AlertTriangle size={10} /> Бага
                      </span>
                    )}
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold">{item.quantity}<span className="text-xs text-muted-foreground font-normal"> ш</span></p>
                      <p className="text-[10px] text-muted-foreground">доод хэмжээ: {item.threshold}</p>
                      <p className="text-xs text-primary font-semibold mt-0.5">₮{Number(item.price).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingId(item.id)}
                        className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`"${item.name}" устгах уу?`)) return;
                          try {
                            await customFetch(`/api/inventory/${item.id}`, { method: "DELETE" });
                            toast({ title: "Бараа устгагдлаа" });
                            refetch();
                          } catch (err: any) {
                            const msg = err?.response?.data?.message || err?.message || "Устгаж чадсангүй";
                            toast({ title: "Алдаа", description: msg, variant: "destructive" });
                          }
                        }}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
                {editingId === item.id && (
                  <InventoryForm
                    item={item}
                    onClose={() => setEditingId(null)}
                    onDone={() => { refetch(); setEditingId(null); toast({ title: "Хадгалагдлаа" }); }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InventoryForm({ item, onClose, onDone }: { item?: InventoryItem; onClose: () => void; onDone: () => void }) {
  const { data: categories } = useGetMenuCategories();
  const [name, setName] = useState(item?.name ?? "");
  const [type, setType] = useState(item?.type ?? "");
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 0));
  const [threshold, setThreshold] = useState(String(item?.threshold ?? 5));
  const [price, setPrice] = useState(String(item?.price ?? 0));
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [categoryId, setCategoryId] = useState<string>(item?.categoryId ? String(item.categoryId) : "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Flatten parent + child categories into a single ordered list for the select
  const catOptions: { id: number; label: string }[] = [];
  for (const c of (categories ?? []) as any[]) {
    catOptions.push({ id: c.id, label: c.name });
    for (const sub of (c.children ?? [])) {
      catOptions.push({ id: sub.id, label: `  — ${sub.name}` });
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !type.trim()) {
      toast({ title: "Нэр болон төрлийг бөглөнө үү", variant: "destructive" });
      return;
    }
    if (!categoryId) {
      toast({ title: "Цэсний ангилал сонгоно уу", variant: "destructive" });
      return;
    }
    const priceNum = parseFloat(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast({ title: "Үнэ буруу байна", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        type: type.trim(),
        quantity: parseInt(quantity) || 0,
        threshold: parseInt(threshold) || 0,
        price: priceNum,
        imageUrl: imageUrl || null,
        categoryId: parseInt(categoryId),
      };
      if (item) {
        await customFetch(`/api/inventory/${item.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await customFetch("/api/inventory", { method: "POST", body: JSON.stringify(body) });
      }
      onDone();
    } catch (err) {
      toast({ title: "Алдаа гарлаа", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{item ? "Бараа засах" : "Шинэ бараа"}</h3>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Нэр</label>
          <input value={name} onChange={e => setName(e.target.value)} required
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Төрөл (ундаа, дарс, ус...)</label>
          <input value={type} onChange={e => setType(e.target.value)} required
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Цэсний ангилал</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary">
            <option value="">— Ангилал сонгох —</option>
            {catOptions.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Тоо ширхэг</label>
          <input type="number" min="0" value={quantity} onChange={e => setQuantity(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Доод хэмжээ</label>
          <input type="number" min="0" value={threshold} onChange={e => setThreshold(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Үнэ (₮)</label>
          <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
        </div>
      </div>
      <ImageUploadField value={imageUrl} onChange={setImageUrl} label="Зураг" />
      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="flex-1">{saving ? "Хадгалж байна..." : "Хадгалах"}</Button>
        <Button type="button" variant="outline" onClick={onClose}>Цуцлах</Button>
      </div>
    </form>
  );
}

/* ─── Notifications ─── */

type NotificationRow = {
  id: number;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
};

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data } = useQuery<NotificationRow[]>({
    queryKey: ["notifications"],
    queryFn: () => customFetch<NotificationRow[]>("/api/notifications"),
    refetchInterval: 30000,
  });

  useEffect(() => {
    const onNew = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
    socket.on("notification:new", onNew);
    return () => { socket.off("notification:new", onNew); };
  }, [queryClient]);

  const items = data ?? [];
  const unread = items.filter(n => !n.read).length;

  const markAllRead = async () => {
    await customFetch("/api/notifications/read-all", { method: "POST" });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const clearAll = async () => {
    if (!confirm("Бүх мэдэгдлийг устгах уу?")) return;
    await customFetch("/api/notifications", { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 font-bold">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-[70vh] bg-card border border-border rounded-2xl shadow-2xl z-50 flex flex-col">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <p className="font-bold text-sm">Мэдэгдлүүд</p>
              <div className="flex gap-1">
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-[11px] text-primary hover:underline">Бүгдийг уншсан</button>
                )}
                {items.length > 0 && (
                  <button onClick={clearAll} className="text-[11px] text-muted-foreground hover:text-red-400 ml-2">Цэвэрлэх</button>
                )}
              </div>
            </div>
            <div className="overflow-y-auto">
              {items.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-xs">Мэдэгдэл алга</div>
              ) : (
                items.map(n => (
                  <div key={n.id} className={`p-3 border-b border-border/50 last:border-0 ${!n.read ? "bg-primary/5" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm">{n.title}</p>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">{format(new Date(n.createdAt), "MM-dd HH:mm")}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ReportsView() {
  const t = useT();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const [from, setFrom] = useState(toLocalDatetimeValue(startOfToday));
  const [to, setTo] = useState(toLocalDatetimeValue(now));
  const { data: report, isLoading, refetch } = useGetReportSummary({ from, to });

  const setRange = (type: "today" | "7d" | "30d" | "all") => {
    const end = new Date();
    const start = new Date(end);
    if (type === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (type === "7d") {
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (type === "30d") {
      start.setDate(end.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    } else {
      start.setFullYear(2000, 0, 1);
      start.setHours(0, 0, 0, 0);
    }
    setFrom(toLocalDatetimeValue(start));
    setTo(toLocalDatetimeValue(end));
  };

  if (isLoading && !report) return <Spinner />;
  if (!report) return <div className="text-center py-16 text-muted-foreground">{t("no_report")}</div>;

  const topItems = (report.topItems ?? []) as Array<{ name: string; quantity: number; revenue: number }>;
  const peakHours = ((report as any).peakHours ?? []).slice(0, 8).map((h: any) => ({
    name: `${String(h.hour).padStart(2, "0")}:00`,
    orders: h.orders,
    revenue: h.revenue,
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">{t("sales_report")}</h2>

      {/* Date range filter */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {[
            { label: t("today"), type: "today" as const },
            { label: t("last_7_days"), type: "7d" as const },
            { label: t("last_30_days"), type: "30d" as const },
            { label: t("all_time"), type: "all" as const },
          ].map(({ label, type }) => (
            <button key={type} onClick={() => setRange(type)}
              className="px-3 py-1.5 rounded-xl text-sm font-medium border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all">
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5 flex items-center gap-1">
              <CalendarDays size={12} /> {t("from_date")}
            </label>
            <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)}
              className="bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary [color-scheme:dark]" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5 flex items-center gap-1">
              <CalendarDays size={12} /> {t("to_date")}
            </label>
            <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)}
              className="bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary [color-scheme:dark]" />
          </div>
          <Button size="sm" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? t("loading") : t("view")}
          </Button>
          <Button size="sm" variant="outline" onClick={async () => {
            const token = useStore.getState().token;
            const url = `/api/reports/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
            const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
            if (!res.ok) return;
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `report_${from.slice(0, 10)}_${to.slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
          }}>
            <Download size={14} className="mr-1" /> {t("export_excel")}
          </Button>
        </div>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label={t("total_orders")} value={String(report.totalOrders)} />
        <StatCard label={t("total_revenue")} value={`₮${Number(report.totalRevenue).toLocaleString()}`} primary />
        <StatCard label={t("avg_order_value")} value={`₮${Number(report.averageOrderValue).toFixed(0)}`} />
      </div>

      {/* Service stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label={t("avg_service_time")} value={`${(report as any).avgServiceMinutes ?? 0} мин`} />
        <StatCard label={t("table_turnover")} value={`${(report as any).tableTurnover ?? 0}`} />
        <StatCard label={t("cancelled_count")} value={`${(report as any).cancelledCount ?? 0}`} />
      </div>

      {/* Payment breakdown */}
      {(report as any).paymentBreakdown && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-muted-foreground text-sm">{t("cash")}</p>
            <p className="text-2xl font-bold mt-1">₮{Number((report as any).paymentBreakdown.cash ?? 0).toLocaleString()}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-muted-foreground text-sm">{t("bank")}</p>
            <p className="text-2xl font-bold mt-1">₮{Number((report as any).paymentBreakdown.bank ?? 0).toLocaleString()}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Peak hours */}
        {peakHours.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-bold mb-4">{t("peak_hours")}</h3>
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

        {/* Top items — full list, sorted by quantity desc */}
        <div className="bg-card border border-border rounded-2xl p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-bold">{t("top_items")}</h3>
            <span className="text-xs text-muted-foreground">{topItems.length}</span>
          </div>
          {topItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">{t("no_data")}</div>
          ) : (
            <>
              <div style={{ height: Math.max(240, topItems.length * 32 + 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topItems} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip formatter={(v: number, key: string) => [key === "quantity" ? `${v} ш` : `₮${Number(v).toLocaleString()}`, key === "quantity" ? "Тоо" : "Орлого"]} />
                    <Bar dataKey="quantity" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 border-t border-border pt-3 space-y-1 max-h-72 overflow-y-auto">
                {topItems.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg hover:bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground text-xs w-6 text-right">{idx + 1}.</span>
                      <span className="truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-semibold">{item.quantity} ш</span>
                      <span className="text-xs text-muted-foreground w-24 text-right">₮{Number(item.revenue).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
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

function OrderCard({ order, children, onVoidItem, tableGroup }: {
  order: Order;
  children?: React.ReactNode;
  onVoidItem?: (orderId: number, itemId: number) => void;
  tableGroup?: { total: number; count: number };
}) {
  const pm = (order as any).paymentMethod;
  const canVoid = onVoidItem && !["paid", "cancelled"].includes(order.status);
  const showTableTotal = tableGroup && tableGroup.count > 1;

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden shadow-sm transition-all ${
      (order.status === "pending" || order.status === "confirmed")
        ? "border-primary/40 shadow-primary/10"
        : pm === "bank" && order.status === "paid"
          ? "border-emerald-500/40 shadow-emerald-500/10"
          : "border-border"
    }`}>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/20">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-2xl leading-tight flex items-center gap-2 flex-wrap">
            {order.tableName}
            {pm === "bank" && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Банк
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
            <span className="flex items-center gap-1"><Clock size={10} /> {format(new Date(order.createdAt), "HH:mm")}</span>
            <span>·</span>
            <span>Захиалга #{order.id}</span>
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${STATUS_COLORS[order.status]}`}>
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
        {showTableTotal && (
          <div className="flex items-center justify-between mt-1 pt-1 border-t border-dashed border-border/60">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              Ширээний нийт <span className="opacity-60">· {tableGroup!.count} захиалга</span>
            </span>
            <span className="text-sm font-bold text-emerald-400">₮{tableGroup!.total.toLocaleString()}</span>
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

  if (isLoading) return <Spinner />;

  const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

  // Sort by rating DESC, then newest first
  const sortedReviews = [...(reviews ?? [])].sort((a: any, b: any) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Сэтгэгдлийн удирдлага</h2>
      <p className="text-xs text-muted-foreground">Сайн сэтгэгдлүүд дээр нь харагдана. Хэрэглэгчийн сэтгэгдлийг устгах боломжгүй.</p>
      <div className="grid gap-3">
        {sortedReviews.map((r: any) => (
          <div key={r.id} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{r.name}</p>
              <span className="text-yellow-400 text-sm">{stars(r.rating)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5"><Phone size={10} className="inline mr-1" />{r.phone}</p>
            <p className="text-sm mt-2">{r.comment}</p>
            <p className="text-xs text-muted-foreground mt-1">{r.createdAt ? format(new Date(r.createdAt), "yyyy-MM-dd HH:mm") : ""}</p>
          </div>
        ))}
        {sortedReviews.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">Сэтгэгдэл байхгүй</p>}
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
