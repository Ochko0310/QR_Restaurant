import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CalendarCheck, User, Phone, Users, MessageSquare, CheckCircle2 } from "lucide-react";
import { PublicLayout } from "./PublicLayout";
import { useToast } from "@/hooks/use-toast";

interface ReservationPayload {
  guestName: string;
  guestPhone: string;
  partySize: number;
  reservationDate: string;
  notes?: string;
}

function useCreateReservation() {
  return useMutation({
    mutationFn: async (data: ReservationPayload) => {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Алдаа гарлаа");
      }
      return res.json();
    },
  });
}

function defaultDateTime(): string {
  const now = new Date();
  now.setHours(now.getHours() + 2);
  now.setMinutes(0, 0, 0);
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function ReservationsPage() {
  const { toast } = useToast();
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [partySize, setPartySize] = useState<number>(2);
  const [reservationDate, setReservationDate] = useState<string>(defaultDateTime());
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState<{ id: number; date: string } | null>(null);

  const createMutation = useCreateReservation();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim() || !guestPhone.trim() || !reservationDate) {
      toast({ title: "Шаардлагатай талбарууд", description: "Нэр, утас, огноог бөглөнө үү", variant: "destructive" });
      return;
    }
    createMutation.mutate(
      {
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        partySize,
        reservationDate: new Date(reservationDate).toISOString(),
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: (data: { id: number; reservationDate: string }) => {
          setSuccess({ id: data.id, date: data.reservationDate });
          setGuestName("");
          setGuestPhone("");
          setPartySize(2);
          setReservationDate(defaultDateTime());
          setNotes("");
        },
        onError: (err: Error) => {
          toast({ title: "Захиалга илгээгдсэнгүй", description: err.message, variant: "destructive" });
        },
      },
    );
  }

  if (success) {
    const dt = new Date(success.date);
    return (
      <PublicLayout>
        <div className="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 mx-auto flex items-center justify-center mb-6">
            <CheckCircle2 className="text-emerald-500" size={40} />
          </div>
          <h1 className="font-display text-3xl font-bold mb-3">Захиалга хүлээн авлаа</h1>
          <p className="text-muted-foreground mb-2">
            <span className="font-mono">#{success.id}</span> дугаартай захиалга бүртгэгдлээ.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Огноо: {dt.toLocaleString("mn-MN", { dateStyle: "full", timeStyle: "short" })}
          </p>
          <button
            onClick={() => setSuccess(null)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-2.5 rounded-xl font-medium"
          >
            Шинэ захиалга
          </button>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 text-xs font-medium mb-4">
            <CalendarCheck size={14} />
            Ширээ урьдчилан захиалах
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">Ширээ захиалах</h1>
          <p className="text-muted-foreground">
            Бид таны ирэх цагт бэлтгэлтэй угтан авах болно.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-2xl border border-border p-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <User size={14} /> Нэр
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Овог нэр"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Phone size={14} /> Утас
            </label>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="9999-1234"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Users size={14} /> Хүний тоо
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={partySize}
                onChange={(e) => setPartySize(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                required
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <CalendarCheck size={14} /> Огноо, цаг
              </label>
              <input
                type="datetime-local"
                value={reservationDate}
                onChange={(e) => setReservationDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                required
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <MessageSquare size={14} /> Тэмдэглэл (заавал биш)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Жишээ: тусгай хүсэлт, төрсөн өдөр..."
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-3 rounded-xl font-medium transition-colors"
          >
            {createMutation.isPending ? "Илгээж байна..." : "Захиалга илгээх"}
          </button>
        </form>
      </div>
    </PublicLayout>
  );
}
