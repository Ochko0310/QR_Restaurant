import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Display number falls back to the DB id while the order has not been
// associated with a shift period (e.g., no staff was clocked in).
export function orderDisplayNumber(order: { id: number; shiftNumber?: number | null }): string {
  return String(order.shiftNumber ?? order.id);
}
