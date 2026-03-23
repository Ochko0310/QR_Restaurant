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
  ChefHat, LogOut, Utensils, ShoppingBag, BarChart3,
  QrCode, Clock, Printer, CheckCheck, X, Plus, Trash2,
  Wifi, WifiOff, TableProperties,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type Tab = "orders" | "menu" | "reports" | "tables";

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
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Гал тогооны баримт #${order.id}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: #000;
      width: 72mm;
      padding: 4px;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .large { font-size: 20px; }
    .xlarge { font-size: 28px; letter-spacing: 2px; }
    .divider { border-top: 2px dashed #000; margin: 8px 0; }
    .divider-solid { border-top: 2px solid #000; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; margin: 4px 0; }
    .item-name { flex: 1; }
    .item-qty { font-weight: bold; font-size: 16px; min-width: 30px; text-align: right; }
    .note { font-size: 12px; color: #444; margin-top: 2px; }
    .big-order { font-size: 36px; font-weight: bold; text-align: center; margin: 8px 0; }
    .table-info { font-size: 18px; font-weight: bold; text-align: center; background: #000; color: #fff; padding: 4px; margin: 6px 0; }
  </style>
</head>
<body>
  <div class="center bold" style="font-size:16px;">★ ГАЛ ТОГООНЫ БАРИМТ ★</div>
  <div class="divider-solid"></div>

  <div class="table-info">${order.tableName ?? "Ширээ"}</div>
  <div class="big-order">#${order.id}</div>

  <div class="row note">
    <span>Цаг: ${time}</span>
    <span>${date}</span>
  </div>

  <div class="divider"></div>

  <div class="bold" style="margin-bottom:6px;">ЗАХИАЛСАН ХООЛ:</div>
  ${order.items.map(item => `
    <div class="row">
      <span class="item-name">${item.menuItemName}</span>
      <span class="item-qty">× ${item.quantity}</span>
    </div>
    ${item.notes ? `<div class="note">  → ${item.notes}</div>` : ""}
  `).join("")}

  <div class="divider-solid"></div>
  <div class="center note">Хоол бэлэн болсноор "Хүргэсэн" товч дарна уу</div>
  <div class="center note" style="margin-top:4px;">Нийт: ₮${Number(order.totalAmount).toLocaleString()}</div>
  <div class="divider"></div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 300);
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
    { id: "menu", label: "Цэс", icon: <Utensils size={16} />, roles: ["manager"] },
    { id: "reports", label: "Тайлан", icon: <BarChart3 size={16} />, roles: ["manager"] },
    { id: "tables", label: "Ширээ", icon: <TableProperties size={16} />, roles: ["manager"] },
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
        {activeTab === "orders" && <OrdersView />}
        {activeTab === "menu" && <MenuManagement />}
        {activeTab === "reports" && <ReportsView />}
        {activeTab === "tables" && <TablesView />}
      </main>
    </div>
  );
}

function OrdersView() {
  const { data: orders, isLoading } = useGetOrders();
  const updateStatus = useUpdateOrderStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const active = orders?.filter((o) => !["paid", "cancelled"].includes(o.status)) ?? [];
  const done = orders?.filter((o) => o.status === "paid").slice(0, 5) ?? [];

  const handle = (orderId: number, status: string) => {
    updateStatus.mutate(
      { orderId, data: { status: status as "confirmed" | "preparing" | "ready" | "served" | "paid" | "cancelled" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey() });
        },
      }
    );
  };

  const handlePrintAndConfirm = (order: Order) => {
    printKitchenReceipt(order);
    handle(order.id, "preparing");
    toast({ title: `Захиалга #${order.id} — баримт хэвлэгдлээ, гал тогоонд илгээлээ` });
  };

  const handleDeliver = (order: Order) => {
    handle(order.id, "paid");
    toast({ title: `Захиалга #${order.id} — хүргэгдсэн, дууслаа ✓` });
  };

  const handleCancel = (order: Order) => {
    handle(order.id, "cancelled");
    toast({ title: `Захиалга #${order.id} цуцлагдлаа`, variant: "destructive" });
  };

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-8">
      {/* Flow explanation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card/50 border border-border rounded-xl px-4 py-3">
        <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full text-xs font-bold">Шинэ</span>
        <span>→ Баримт хэвлэж гал тогоонд өгнө →</span>
        <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full text-xs font-bold">Гал тогоонд</span>
        <span>→ Хоол болсноор хүргэнэ →</span>
        <span className="bg-gray-500/20 text-gray-400 border border-gray-500/30 px-2 py-0.5 rounded-full text-xs font-bold">Дууссан</span>
      </div>

      {/* Active orders */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-xl font-bold">Идэвхтэй захиалгууд</h2>
          <span className="bg-primary/10 text-primary text-sm font-bold px-2.5 py-0.5 rounded-full border border-primary/20">
            {active.length}
          </span>
        </div>

        {!active.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
            <p>Одоогоор захиалга байхгүй байна</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {active.map((order) => (
              <OrderCard key={order.id} order={order}>
                {/* New order: print receipt */}
                {(order.status === "pending" || order.status === "confirmed") && (
                  <div className="flex flex-col gap-2">
                    <Button
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                      onClick={() => handlePrintAndConfirm(order)}
                    >
                      <Printer size={15} className="mr-2" />
                      Баримт хэвлэх — Гал тогоонд илгээх
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground hover:text-destructive text-xs"
                      onClick={() => handleCancel(order)}
                    >
                      <X size={12} className="mr-1" /> Цуцлах
                    </Button>
                  </div>
                )}

                {/* In kitchen: waiting */}
                {order.status === "preparing" && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm">
                      <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                      Гал тогоонд бэлдэж байна...
                    </div>
                    <Button
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                      onClick={() => handleDeliver(order)}
                    >
                      <CheckCheck size={15} className="mr-2" />
                      Хүргэсэн — Дууслаа
                    </Button>
                  </div>
                )}

                {/* Ready / served: deliver */}
                {(order.status === "ready" || order.status === "served") && (
                  <Button
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                    onClick={() => handleDeliver(order)}
                  >
                    <CheckCheck size={15} className="mr-2" />
                    Хүргэсэн — Дууслаа
                  </Button>
                )}
              </OrderCard>
            ))}
          </div>
        )}
      </div>

      {/* Recently completed */}
      {done.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-muted-foreground mb-3">Саяхан дууссан захиалгууд</h3>
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
  if (!report) return <div className="text-center py-16 text-muted-foreground">Тайлан олдсонгүй</div>;

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
          <h3 className="font-bold mb-4">Хамгийн их захиалагдсан (Top 5)</h3>
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
    <div className={`bg-card border rounded-2xl overflow-hidden shadow-sm transition-all ${
      (order.status === "pending" || order.status === "confirmed")
        ? "border-primary/40 shadow-primary/10"
        : "border-border"
    }`}>
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
              <span className="bg-primary/10 text-primary w-6 h-6 flex items-center justify-center rounded text-xs font-bold">
                {item.quantity}
              </span>
              {item.menuItemName}
            </span>
            <span className="text-muted-foreground text-xs">₮{(Number(item.unitPrice) * item.quantity).toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t border-border flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Нийт</span>
        <span className="font-bold text-primary">₮{Number(order.totalAmount).toLocaleString()}</span>
      </div>
      {children && <div className="px-4 pb-4 pt-1">{children}</div>}
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
