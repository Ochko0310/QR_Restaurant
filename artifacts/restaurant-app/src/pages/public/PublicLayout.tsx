import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Utensils, CalendarCheck, Star, Home } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });
}

const navItems = [
  { to: "/", label: "Нүүр", icon: Home },
  { to: "/browse", label: "Цэс", icon: Utensils },
  { to: "/reservations", label: "Захиалга", icon: CalendarCheck },
  { to: "/reviews", label: "Сэтгэгдэл", icon: Star },
] as const;

export function PublicLayout({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings();
  const [location] = useLocation();
  const restaurantName = settings?.restaurantName || "Ресторан";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-display font-bold text-lg sm:text-xl">
            <Utensils className="text-primary" size={22} />
            <span className="truncate max-w-[160px] sm:max-w-none">{restaurantName}</span>
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => {
              const active = location === to || (to !== "/" && location.startsWith(to));
              return (
                <Link
                  key={to}
                  href={to}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-xs text-muted-foreground">
          <p>{restaurantName} — Тавтай морилно уу</p>
          {settings?.restaurantAddress && <p className="mt-1">{settings.restaurantAddress}</p>}
          {settings?.restaurantPhone && <p className="mt-1">Утас: {settings.restaurantPhone}</p>}
        </div>
      </footer>
    </div>
  );
}
