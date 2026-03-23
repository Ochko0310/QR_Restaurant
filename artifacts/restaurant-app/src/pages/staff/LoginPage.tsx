import { useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/use-store";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChefHat, Lock, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function StaffLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();
  const { setAuth } = useStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ data: { username, password } }, {
      onSuccess: (data) => {
        setAuth(data.token, data.user);
        setLocation("/staff");
      },
      onError: (err: any) => {
        toast({ title: "Login Failed", description: err?.message || "Invalid credentials", variant: "destructive" });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 blur-[100px] rounded-full" />
      </div>

      <div className="w-full max-w-md bg-card border border-white/5 p-8 rounded-3xl shadow-2xl shadow-black/50 relative z-10 backdrop-blur-xl">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-inner">
            <ChefHat size={32} />
          </div>
        </div>
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground">L'Aura Staff</h1>
          <p className="text-muted-foreground mt-2">Sign in to manage operations</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <div className="relative">
              <UserIcon className="absolute left-3 top-3 text-muted-foreground" size={18} />
              <Input 
                type="text" 
                placeholder="Username" 
                value={username} 
                onChange={e => setUsername(e.target.value)}
                className="pl-10 h-12 bg-background border-white/10 rounded-xl focus:border-primary focus:ring-primary/20 text-foreground"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-muted-foreground" size={18} />
              <Input 
                type="password" 
                placeholder="Password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                className="pl-10 h-12 bg-background border-white/10 rounded-xl focus:border-primary focus:ring-primary/20 text-foreground"
                required
              />
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={login.isPending}
            className="w-full h-12 text-lg font-bold rounded-xl shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-transform"
          >
            {login.isPending ? "Authenticating..." : "Sign In"}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5">
          <p className="text-xs text-muted-foreground text-center mb-3 font-semibold uppercase tracking-widest">Demo Accounts</p>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-background/50 p-3 rounded-xl border border-white/5">
            <span className="text-primary">manager / manager123</span>
            <span className="text-primary">waiter / waiter123</span>
            <span className="text-primary">chef / chef123</span>
            <span className="text-primary">cashier / cashier123</span>
          </div>
        </div>
      </div>
    </div>
  );
}
