import { Link, useLocation } from "wouter";
import { useStore } from "@/hooks/use-store";
import { useStaffRealtime } from "@/hooks/use-realtime";
import {
  LogOut, UtensilsCrossed, ChefHat, Receipt,
  Table as TableIcon, BarChart3, Wifi, WifiOff
} from "lucide-react";

export function StaffLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useStore();
  const [location, setLocation] = useLocation();
  const { connected } = useStaffRealtime();

  const handleLogout = () => {
    logout();
    setLocation("/staff/login");
  };

  const links = [];
  if (user?.role === 'manager') {
    links.push({ href: "/staff/reports", label: "Reports", icon: BarChart3 });
    links.push({ href: "/staff/menu", label: "Menu Catalog", icon: UtensilsCrossed });
    links.push({ href: "/staff/tables", label: "Tables & QR", icon: TableIcon });
  }
  if (user?.role === 'chef' || user?.role === 'manager') {
    links.push({ href: "/staff/chef", label: "Kitchen Board", icon: ChefHat });
  }
  if (user?.role === 'cashier' || user?.role === 'manager') {
    links.push({ href: "/staff/cashier", label: "Payments", icon: Receipt });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row font-sans">
      <aside className="w-full md:w-64 bg-card border-b md:border-r border-border p-4 flex flex-col gap-4 shadow-2xl shadow-black/50 z-10 relative">
        <div className="flex items-center justify-between md:justify-start gap-3 px-2 py-4">
          <div className="flex items-center gap-2 text-primary">
            <ChefHat size={28} />
            <span className="font-display font-bold text-2xl tracking-wide">L'Aura</span>
          </div>
          <div className="md:hidden">
             {connected ? <Wifi size={18} className="text-green-500" /> : <WifiOff size={18} className="text-red-500" />}
          </div>
        </div>
        
        <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 flex-1">
          {links.map(l => {
            const isActive = location === l.href;
            return (
              <Link 
                key={l.href} 
                href={l.href} 
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap md:whitespace-normal
                  ${isActive 
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
              >
                <l.icon size={20} className={isActive ? 'text-primary-foreground' : 'text-muted-foreground'} />
                <span className="font-semibold text-sm">{l.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border pt-4 hidden md:block">
          <div className="flex items-center justify-between px-2 mb-4">
             <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
               {connected ? (
                 <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Live</>
               ) : (
                 <><span className="w-2 h-2 rounded-full bg-red-500"></span> Offline</>
               )}
             </div>
          </div>
          <div className="bg-background/50 rounded-xl p-3 mb-3 border border-white/5">
            <p className="text-xs text-muted-foreground">Logged in as</p>
            <p className="font-bold text-foreground text-sm truncate">{user?.name}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-primary/20 text-primary text-[10px] uppercase font-bold tracking-wider rounded">
              {user?.role}
            </span>
          </div>
          <button 
            onClick={handleLogout} 
            className="flex items-center justify-center gap-2 text-destructive bg-destructive/10 px-4 py-3 w-full hover:bg-destructive hover:text-destructive-foreground rounded-xl transition-colors font-bold text-sm"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>
      
      <main className="flex-1 overflow-y-auto relative bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-card/30 to-background">
        {children}
      </main>
    </div>
  );
}
