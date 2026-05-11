import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Send, MessageSquare, User, Phone, CheckCircle2 } from "lucide-react";
import { PublicLayout } from "./PublicLayout";
import { useToast } from "@/hooks/use-toast";

interface Review {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
}

function useReviews() {
  return useQuery<Review[]>({
    queryKey: ["reviews"],
    queryFn: () => fetch("/api/reviews").then((r) => r.json()),
  });
}

function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name?: string; phone?: string; rating: number; comment: string }) => {
      const res = await fetch("/api/reviews", {
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews"] }),
  });
}

function StarDisplay({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}
        />
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          className="p-1 transition-transform hover:scale-110"
        >
          <Star
            size={28}
            className={n <= display ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}
          />
        </button>
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const { toast } = useToast();
  const { data: reviews = [], isLoading } = useReviews();
  const submitMutation = useSubmitReview();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);

  const stats = useMemo(() => {
    if (reviews.length === 0) return { avg: 0, count: 0, dist: [0, 0, 0, 0, 0] };
    const sum = reviews.reduce((s, r) => s + r.rating, 0);
    const dist = [0, 0, 0, 0, 0];
    reviews.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]!++;
    });
    return { avg: sum / reviews.length, count: reviews.length, dist };
  }, [reviews]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim() || comment.trim().length < 5) {
      toast({ title: "Сэтгэгдэл богино байна", description: "Дор хаяж 5 тэмдэгт оруулна уу", variant: "destructive" });
      return;
    }
    submitMutation.mutate(
      {
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        rating,
        comment: comment.trim(),
      },
      {
        onSuccess: () => {
          setName("");
          setPhone("");
          setRating(5);
          setComment("");
          setJustSubmitted(true);
          toast({ title: "Баярлалаа!", description: "Таны сэтгэгдлийг хүлээн авлаа" });
        },
        onError: (err: Error) => {
          toast({ title: "Илгээгдсэнгүй", description: err.message, variant: "destructive" });
        },
      },
    );
  }

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 text-xs font-medium mb-4">
            <Star size={14} />
            Зочдын сэтгэгдэл
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">Сэтгэгдэл</h1>
          <p className="text-muted-foreground">Бусдын үнэлгээ, өөрийн санаагаа хуваалцаарай.</p>
        </div>

        {stats.count > 0 && (
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <div className="bg-card rounded-2xl border border-border p-6">
              <div className="text-5xl font-display font-bold mb-2">{stats.avg.toFixed(1)}</div>
              <StarDisplay value={Math.round(stats.avg)} size={20} />
              <p className="text-sm text-muted-foreground mt-2">{stats.count} сэтгэгдэл</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-6 space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = stats.dist[star - 1] ?? 0;
                const pct = stats.count > 0 ? (count / stats.count) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-3 text-sm">
                    <span className="w-4 text-right text-muted-foreground">{star}</span>
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-xs text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          <section>
            <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
              <MessageSquare size={18} />
              Сэтгэгдлүүд
            </h2>
            {isLoading && <p className="text-muted-foreground">Уншиж байна...</p>}
            {!isLoading && reviews.length === 0 && (
              <p className="text-muted-foreground text-sm">Одоогоор сэтгэгдэл байхгүй байна.</p>
            )}
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {reviews.map((r) => (
                <article key={r.id} className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <StarDisplay value={r.rating} />
                    <time className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("mn-MN")}
                    </time>
                  </div>
                  <p className="text-sm leading-relaxed">{r.comment}</p>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
              <Send size={18} />
              Сэтгэгдэл үлдээх
            </h2>
            {justSubmitted ? (
              <div className="bg-card rounded-2xl border border-border p-6 text-center">
                <CheckCircle2 className="text-emerald-500 mx-auto mb-3" size={40} />
                <p className="font-medium mb-2">Баярлалаа!</p>
                <p className="text-sm text-muted-foreground mb-4">Таны сэтгэгдлийг хүлээн авлаа.</p>
                <button
                  onClick={() => setJustSubmitted(false)}
                  className="text-sm text-primary hover:underline"
                >
                  Дахин үлдээх
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Үнэлгээ</label>
                  <StarPicker value={rating} onChange={setRating} />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium mb-2">
                    <User size={14} /> Нэр (заавал биш)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Нэргүй"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Phone size={14} /> Утас (заавал биш)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9999-1234"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium mb-2">
                    <MessageSquare size={14} /> Сэтгэгдэл
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    placeholder="Танд таалагдсан зүйл..."
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-3 rounded-xl font-medium transition-colors"
                >
                  {submitMutation.isPending ? "Илгээж байна..." : "Илгээх"}
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
