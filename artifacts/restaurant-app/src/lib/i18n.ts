import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Lang = "mn" | "en";

type Dict = Record<string, string>;

const mn: Dict = {
  menu: "Цэс",
  cart: "Сагс",
  orders: "Захиалгууд",
  order_history: "Захиалгын түүх",
  add: "Нэмэх",
  remove: "Хасах",
  cancel: "Цуцлах",
  confirm: "Баталгаажуулах",
  total: "Нийт",
  subtotal: "Дэд дүн",
  tip: "Тип",
  service_charge: "Үйлчилгээний хураамж",
  split_bill: "Тооцоо хуваах",
  pay: "Төлөх",
  paid: "Төлөгдсөн",
  preparing: "Бэлдэж байна",
  ready: "Бэлэн",
  pending: "Хүлээгдэж буй",
  served: "Үйлчилсэн",
  cancelled: "Цуцлагдсан",
  table: "Ширээ",
  quantity: "Тоо",
  price: "Үнэ",
  name: "Нэр",
  login: "Нэвтрэх",
  logout: "Гарах",
  save: "Хадгалах",
  loading: "Уншиж байна...",
  empty_cart: "Сагс хоосон",
  order_placed: "Захиалга хүлээн авлаа",
  reservation: "Суудал захиалах",
  per_person: "хүнд",
  search: "Хайх",
  settings: "Тохиргоо",
  reviews: "Сэтгэгдэл",
  rating: "Үнэлгээ",
  language: "Хэл",
  // Tabs
  tab_orders: "Захиалгууд",
  tab_summary: "Нэгтгэл",
  tab_menu: "Цэс",
  tab_reports: "Тайлан",
  tab_inventory: "Бараа",
  tab_tables: "Ширээ",
  tab_reservations: "Захиалга",
  tab_banners: "Зар",
  tab_reviews: "Сэтгэгдэл",
  tab_shifts: "Ээлж",
  tab_settings: "Тохиргоо",
  // Header
  system_title: "Рестораны Систем",
  realtime: "Бодит цаг",
  offline: "Офлайн",
  // Guest
  our_menu: "Бидний цэс",
  place_order: "Захиалах",
  review_placeholder: "Санал хүсэлтээ үлдээнэ үү...",
  // Shifts
  clock_in: "Ээлжинд орох",
  clock_out: "Ээлж дуусгах",
  current_status: "Одоогийн төлөв",
  active: "Идэвхтэй",
  not_clocked_in: "Ээлжинд ороогүй",
  my_recent_shifts: "Миний сүүлийн ээлжүүд",
  all_staff_shifts: "Бүх ажилтны ээлж",
  no_history: "Түүх байхгүй",
  // Payment
  payment: "Төлбөр авах",
  amount_received: "Авсан мөнгөн дүн",
  change: "Хариулах мөнгө",
  short: "Дутуу мөнгө",
  // Reports
  sales_report: "Борлуулалтын тайлан",
  today: "Өнөөдөр",
  last_7_days: "Сүүлийн 7 хоног",
  last_30_days: "Сүүлийн 30 хоног",
  all_time: "Бүгд",
  export_excel: "Excel татах",
  view: "Харах",
  from_date: "Эхлэх",
  to_date: "Төгсөх",
  total_orders: "Нийт захиалга",
  total_revenue: "Нийт орлого",
  avg_order_value: "Дундаж дүн",
  avg_service_time: "Дунд. үйлчилгээ",
  table_turnover: "Ширээний эргэлт",
  cancelled_count: "Цуцалсан",
  cash: "Бэлэн мөнгө",
  bank: "Банкаар",
  peak_hours: "Ачаалалтай цагууд",
  top_items: "Хамгийн их захиалагдсан хоол",
  no_data: "Мэдээлэл алга",
  no_report: "Тайлан олдсонгүй",
  // Orders
  new_order: "Шинэ",
  send_to_kitchen: "Гал тогоонд өгөх",
  ready_to_serve: "Зөөх хоол",
  served_btn: "Зөөсөн",
  mark_ready: "Бэлэн болсон",
  new_orders: "Шинэ захиалга",
  preparing_orders: "Бэлдэх захиалгууд",
  no_orders: "Одоогоор захиалга байхгүй байна",
  no_prep_orders: "Одоогоор бэлдэх захиалга байхгүй",
  close: "Хаах",
  // Payment detail
  payment_method: "Төлбөрийн төрөл",
  created: "Үүссэн",
  paid_at: "Төлсөн",
};

const en: Dict = {
  menu: "Menu",
  cart: "Cart",
  orders: "Orders",
  order_history: "Order History",
  add: "Add",
  remove: "Remove",
  cancel: "Cancel",
  confirm: "Confirm",
  total: "Total",
  subtotal: "Subtotal",
  tip: "Tip",
  service_charge: "Service Charge",
  split_bill: "Split Bill",
  pay: "Pay",
  paid: "Paid",
  preparing: "Preparing",
  ready: "Ready",
  pending: "Pending",
  served: "Served",
  cancelled: "Cancelled",
  table: "Table",
  quantity: "Qty",
  price: "Price",
  name: "Name",
  login: "Login",
  logout: "Logout",
  save: "Save",
  loading: "Loading...",
  empty_cart: "Your cart is empty",
  order_placed: "Order placed",
  reservation: "Reservation",
  per_person: "per person",
  search: "Search",
  settings: "Settings",
  reviews: "Reviews",
  rating: "Rating",
  language: "Language",
  // Tabs
  tab_orders: "Orders",
  tab_summary: "Summary",
  tab_menu: "Menu",
  tab_reports: "Reports",
  tab_inventory: "Inventory",
  tab_tables: "Tables",
  tab_reservations: "Reservations",
  tab_banners: "Banners",
  tab_reviews: "Reviews",
  tab_shifts: "Shifts",
  tab_settings: "Settings",
  // Header
  system_title: "Restaurant System",
  realtime: "Live",
  offline: "Offline",
  // Guest
  our_menu: "Our Menu",
  place_order: "Place Order",
  review_placeholder: "Leave your feedback...",
  // Shifts
  clock_in: "Clock In",
  clock_out: "Clock Out",
  current_status: "Current Status",
  active: "Active",
  not_clocked_in: "Not clocked in",
  my_recent_shifts: "My Recent Shifts",
  all_staff_shifts: "All Staff Shifts",
  no_history: "No history",
  // Payment
  payment: "Payment",
  amount_received: "Amount Received",
  change: "Change",
  short: "Short",
  // Reports
  sales_report: "Sales Report",
  today: "Today",
  last_7_days: "Last 7 days",
  last_30_days: "Last 30 days",
  all_time: "All time",
  export_excel: "Export Excel",
  view: "View",
  from_date: "From",
  to_date: "To",
  total_orders: "Total Orders",
  total_revenue: "Total Revenue",
  avg_order_value: "Avg Order Value",
  avg_service_time: "Avg Service Time",
  table_turnover: "Table Turnover",
  cancelled_count: "Cancelled",
  cash: "Cash",
  bank: "Bank",
  peak_hours: "Peak Hours",
  top_items: "Top Selling Items",
  no_data: "No data",
  no_report: "No report found",
  // Orders
  new_order: "New",
  send_to_kitchen: "Send to Kitchen",
  ready_to_serve: "Ready to Serve",
  served_btn: "Served",
  mark_ready: "Mark Ready",
  new_orders: "New Orders",
  preparing_orders: "Preparing Orders",
  no_orders: "No orders at the moment",
  no_prep_orders: "No orders to prepare right now",
  close: "Close",
  // Payment detail
  payment_method: "Payment Method",
  created: "Created",
  paid_at: "Paid At",
};

const dicts: Record<Lang, Dict> = { mn, en };

type LangStore = {
  lang: Lang;
  setLang: (l: Lang) => void;
};

export const useLang = create<LangStore>()(
  persist(
    (set) => ({
      lang: "mn",
      setLang: (lang) => set({ lang }),
    }),
    { name: "lang" }
  )
);

export function useT() {
  const lang = useLang((s) => s.lang);
  return (key: keyof typeof mn) => dicts[lang][key] ?? String(key);
}

export function t(lang: Lang, key: keyof typeof mn): string {
  return dicts[lang][key] ?? String(key);
}
