import { format } from "date-fns";
import { type Order } from "@workspace/api-client-react";
import { Clock, Receipt, Utensils, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrderCardProps {
  order: Order;
  actionLabel?: string;
  onAction?: () => void;
  isActionLoading?: boolean;
  variant?: 'default' | 'kitchen';
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  confirmed: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  preparing: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
  ready: 'bg-green-500/20 text-green-500 border-green-500/30',
  served: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30',
  paid: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  cancelled: 'bg-red-500/20 text-red-500 border-red-500/30'
};

export function OrderCard({ order, actionLabel, onAction, isActionLoading, variant = 'default' }: OrderCardProps) {
  const timeStr = format(new Date(order.createdAt), 'HH:mm');
  const elapsedMinutes = Math.floor((new Date().getTime() - new Date(order.createdAt).getTime()) / 60000);
  
  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-xl shadow-black/20 flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-display font-bold text-foreground">
            {order.tableName}
          </h3>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock size={14} /> {timeStr}
            </span>
            <span className="flex items-center gap-1">
              <Receipt size={14} /> #{order.id}
            </span>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${statusColors[order.status] || statusColors.pending}`}>
          {order.status}
        </div>
      </div>

      {variant === 'kitchen' && elapsedMinutes > 15 && (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-500 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
          <AlertCircle size={16} /> Order waiting for {elapsedMinutes} mins
        </div>
      )}

      <div className="flex-1 bg-background/50 rounded-xl p-4 border border-white/5 mb-4 overflow-y-auto">
        <ul className="space-y-3">
          {order.items.map(item => (
            <li key={item.id} className="flex gap-3 text-sm">
              <span className="font-bold text-primary bg-primary/10 w-6 h-6 flex items-center justify-center rounded flex-shrink-0">
                {item.quantity}
              </span>
              <div className="flex-1">
                <p className="font-medium text-foreground">{item.menuItemName}</p>
                {item.notes && (
                  <p className="text-muted-foreground text-xs italic mt-0.5 border-l-2 border-primary/30 pl-2">
                    Note: {item.notes}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between mt-auto pt-2">
        <div className="text-lg font-bold text-foreground">
          {variant === 'default' && `₮${order.totalAmount.toLocaleString()}`}
        </div>
        
        {actionLabel && onAction && (
          <Button 
            onClick={onAction} 
            disabled={isActionLoading}
            className="rounded-xl shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-transform"
          >
            {isActionLoading ? "Updating..." : actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
