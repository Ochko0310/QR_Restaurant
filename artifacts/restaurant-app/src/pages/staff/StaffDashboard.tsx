import { useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/use-store";
import { useStaffRealtime } from "@/hooks/use-realtime";
import {
  useGetOrders, useGetTables, useGetMenuCategories, useUpdateOrderStatus,
  useGetTableQr, useGetReportSummary, useUpdateMenuItem, useDeleteMenuItem,
  useCreateMenuCategory, getGetOrdersQueryKey, getGetMenuCategoriesQueryKey,
  type Order,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ChefHat, LogOut, Utensils, ShoppingBag, Receipt, BarChart3,
  QrCode, Clock, CheckCheck, RefreshCw, X, Plus, Trash2, ChevronRight,
  Wifi, WifiOff, TableProperties,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type Tab = "orders" | "kitchen" | "payment" | "menu" | "reports" | "tables";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  confirmed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  preparing: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  ready: "bg-green-500/20 text-green-400 border-green-500/30",
  served: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  paid: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Хүлээгдэж байна",
  confirmed: "Баталгаажсан",
  preparing: "Бэлдэж байна",
  ready: "Бэлэн",
  served: "Үйлчлэгдсэн",
  paid: "Төлбөр хийгдсэн",
  cancelled: "Цуцалсан",
};

export default function StaffDashboard() {
  const { user, token, logout } = useStore();
  const [, setLocation] = useLocation();
  const { connected } = useStaffRealtime();
  const [activeTab, setActiveTab] = useState<Tab>(
    user?.role === "chef" ? "kitchen" : user?.role === "cashier" ? "payment" : "orders"
  );

  if (!token || !user) {
    setLocation("/staff/login");
    return null;
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; roles: string[] }[] = [
    { id: "orders", label: "Захиалгууд", icon: <ShoppingBag size={16} />, roles: ["manager", "waiter"] },
    { id: "kitchen", label: "Гал тогоо", icon: <ChefHat size={16} />, roles: ["manager", "chef"] },
    { id: "payment", label: "Кассир", icon: <Receipt size={16} />, roles: ["manager", "cashier"] },
    { id: "menu", label: "Цэс", icon: <Utensils size={16} />, roles: ["manager"] },
    { id: "reports", label: "Тайлан", icon: <BarChart3 size={16} />, roles: ["manager"] },
    { id: "tables", label: "Ширээ", icon: <TableProperties size={16} />, roles: ["manager", "waiter"] },
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
        {activeTab === "orders" && <WaiterOrders />}
        {activeTab === "kitchen" && <KitchenOrders />}
        {activeTab === "payment" && <PaymentOrders />}
        {activeTab === "menu" && <MenuManagement />}
        {activeTab === "reports" && <ReportsView />}
        {activeTab === "tables" && <TablesView />}
      </main>
    </div>
  );
}

function WaiterOrders() {
  const { data: orders, isLoading } = useGetOrders();
  const updateStatus = useUpdateOrderStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const activeOrders = orders?.filter((o) => ["pending", "confirmed", "ready"].includes(o.status)) ?? [];

  const handle = (orderId: number, status: string) => {
    updateStatus.mutate(
      { orderId, data: { status: status as "confirmed" | "preparing" | "ready" | "served" | "paid" | "cancelled" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey() });
          toast({ title: `Захиалга #${orderId} → ${STATUS_LABELS[status]}` });
        },
      }
    );
  };

  if (isLoading) return <Spinner />;
  return (
    <div>
      <Header title="Идэвхтэй захиалгууд" count={activeOrders.length} />
      {!activeOrders.length ? <Empty text="Идэвхтэй захиалга байхгүй" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeOrders.map((o) => (
            <OrderCard key={o.id} order={o}>
              {o.status === "pending" && (
                <Button size="sm" className="w-full" onClick={() => handle(o.id, "confirmed")}>
                  <CheckCheck size={14} className="mr-1" /> Баталгаажуулах
                </Button>
              )}
              {o.status === "ready" && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => handle(o.id, "served")}>
                  <ChevronRight size={14} className="mr-1" /> Үйлчлэгдсэн
                </Button>
              )}
            </OrderCard>
          ))}
        </div>
      )}
    </div>
  );
}

function KitchenOrders() {
  const { data: orders, isLoading } = useGetOrders();
  const updateStatus = useUpdateOrderStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const kitchenOrders = orders?.filter((o) => ["confirmed", "preparing"].includes(o.status)) ?? [];

  const handle = (orderId: number, status: string) => {
    updateStatus.mutate(
      { orderId, data: { status: status as "confirmed" | "preparing" | "ready" | "served" | "paid" | "cancelled" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey() });
          toast({ title: `Захиалга #${orderId} → ${STATUS_LABELS[status]}` });
        },
      }
    );
  };

  if (isLoading) return <Spinner />;
  return (
    <div>
      <Header title="Гал тогооны захиалгууд" count={kitchenOrders.length} />
      {!kitchenOrders.length ? <Empty text="Боловсруулах захиалга байхгүй" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {kitchenOrders.map((o) => (
            <OrderCard key={o.id} order={o}>
              {o.status === "confirmed" && (
                <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600 text-white" onClick={() => handle(o.id, "preparing")}>
                  <RefreshCw size={14} className="mr-1" /> Бэлдэж эхлэх
                </Button>
              )}
              {o.status === "preparing" && (
                <Button size="sm" className="w-full bg-green-500 hover:bg-green-600 text-white" onClick={() => handle(o.id, "ready")}>
                  <CheckCheck size={14} className="mr-1" /> Бэлэн болсон
                </Button>
              )}
            </OrderCard>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentOrders() {
  const { data: orders, isLoading } = useGetOrders({ status: "served" });
  const updateStatus = useUpdateOrderStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handle = (orderId: number, amount: number) => {
    updateStatus.mutate(
      { orderId, data: { status: "paid" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey() });
          toast({ title: `Захиалга #${orderId} — ₮${Number(amount).toLocaleString()} төлбөр хийгдлээ` });
        },
      }
    );
  };

  if (isLoading) return <Spinner />;
  const served = orders ?? [];
  return (
    <div>
      <Header title="Төлбөр хүлээгдэж буй" count={served.length} />
      {!served.length ? <Empty text="Төлбөр хүлээж буй захиалга байхгүй" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {served.map((o) => (
            <OrderCard key={o.id} order={o}>
              <Button size="sm" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => handle(o.id, o.totalAmount)}>
                <Receipt size={14} className="mr-1" /> ₮{Number(o.totalAmount).toLocaleString()} Авах
              </Button>
            </OrderCard>
          ))}
        </div>
      )}
    </div>
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

  if (isLoading) return <Spinner />;

  const refreshMenu = () => queryClient.invalidateQueries({ queryKey: getGetMenuCategoriesQueryKey() });

  const handleToggle = (itemId: number, available: boolean) => {
    updateItem.mutate(
      { itemId, data: { available: !available } },
      { onSuccess: () => { refreshMenu(); toast({ title: !available ? "Нээлттэй болголоо" : "Хаасан" }); } }
    );
  };

  const handleDelete = (itemId: number) => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Цэсний удирдлага</h2>
        <Button size="sm" variant="outline" onClick={() => setShowNewCat(!showNewCat)}>
          <Plus size={14} className="mr-1" /> Ангилал нэмэх
        </Button>
      </div>
      {showNewCat && (
        <form onSubmit={handleCreateCat} className="flex gap-2 bg-card p-3 rounded-xl border border-border">
          <input
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Ангилалын нэр"
            className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
            required
          />
          <Button type="submit" size="sm">Нэмэх</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowNewCat(false)}><X size={14} /></Button>
        </form>
      )}
      {categories?.map((cat) => (
        <div key={cat.id} className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
            <h3 className="font-bold text-primary">{cat.name}</h3>
            <span className="text-xs text-muted-foreground">{cat.items?.length ?? 0} хоол</span>
          </div>
          <div className="divide-y divide-border">
            {cat.items?.map((item) => (
              <div key={item.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm ${!item.available ? "line-through text-muted-foreground" : ""}`}>{item.name}</p>
                  <p className="text-primary text-sm">₮{Number(item.price).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(item.id, item.available)}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                      item.available
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : "bg-red-500/20 text-red-400 border-red-500/30"
                    }`}
                  >
                    {item.available ? "Нээлттэй" : "Хаалттай"}
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="p-1.5 text-muted-foreground hover:text-destructive">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportsView() {
  const { data: report, isLoading } = useGetReportSummary();
  const COLORS = ["#f59e0b", "#3b82f6", "#f97316", "#22c55e", "#a855f7"];

  if (isLoading) return <Spinner />;
  if (!report) return <Empty text="Тайлан олдсонгүй" />;

  const statusData = Object.entries(report.ordersByStatus ?? {}).map(([k, v]) => ({
    name: STATUS_LABELS[k] ?? k,
    value: v as number,
  }));
  const topItems = (report.topItems ?? []) as Array<{ name: string; quantity: number; revenue: number }>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Борлуулалтын тайлан</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Нийт захиалга" value={String(report.totalOrders)} />
        <StatCard label="Нийт орлого" value={`₮${Number(report.totalRevenue).toLocaleString()}`} primary />
        <StatCard label="Дундаж дүн" value={`₮${Number(report.averageOrderValue).toFixed(0)}`} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-bold mb-4">Хамгийн их захиалагдах хоол (Top 5)</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topItems} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
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
  const [qrTableId, setQrTableId] = useState<number | null>(null);
  const { data: qrData } = useGetTableQr(qrTableId ?? 0, { query: { enabled: !!qrTableId } });

  if (isLoading) return <Spinner />;

  const statusColor: Record<string, string> = {
    available: "bg-green-500/20 text-green-400 border-green-500/30",
    occupied: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    reserved: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  const statusLabel: Record<string, string> = {
    available: "Чөлөөтэй",
    occupied: "Хэрэглэгдэж байна",
    reserved: "Захиалгатай",
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Ширээний удирдлага</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {tables?.map((table) => (
          <div key={table.id} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold">{table.name}</p>
                <p className="text-xs text-muted-foreground">{table.capacity} хүн</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${statusColor[table.status]}`}>
                {statusLabel[table.status]}
              </span>
            </div>
            <Button size="sm" variant="outline" className="w-full" onClick={() => setQrTableId(qrTableId === table.id ? null : table.id)}>
              <QrCode size={14} className="mr-1" /> QR код харах
            </Button>
            {qrTableId === table.id && qrData && (
              <div className="flex flex-col items-center gap-2 pt-1">
                <div className="bg-white p-3 rounded-xl">
                  <QRCodeSVG value={qrData.url} size={110} />
                </div>
                <p className="text-[10px] text-muted-foreground text-center break-all leading-relaxed">{qrData.url}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, children }: { order: Order; children?: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/20">
        <div>
          <p className="font-bold text-sm">Захиалга #{order.id}</p>
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
          <div key={item.id} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary w-5 h-5 flex items-center justify-center rounded text-xs font-bold">
                {item.quantity}
              </span>
              {item.menuItemName}
            </span>
            <span className="text-muted-foreground text-xs">₮{(Number(item.unitPrice) * item.quantity).toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-border flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Нийт</span>
        <span className="font-bold">₮{Number(order.totalAmount).toLocaleString()}</span>
      </div>
      {children && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function Header({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <h2 className="text-xl font-bold">{title}</h2>
      <span className="bg-primary/10 text-primary text-sm font-bold px-2.5 py-0.5 rounded-full border border-primary/20">{count}</span>
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

function Empty({ text }: { text: string }) {
  return <div className="text-center py-16 text-muted-foreground"><p>{text}</p></div>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
