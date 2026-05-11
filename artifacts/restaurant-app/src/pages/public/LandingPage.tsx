import { Link } from "wouter";
import { Utensils, CalendarCheck, Star, ArrowRight, MapPin, Phone, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PublicLayout } from "./PublicLayout";

function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });
}

function useBanners() {
  return useQuery({
    queryKey: ["banners"],
    queryFn: () => fetch("/api/banners").then((r) => r.json()),
  });
}

const actions = [
  {
    to: "/browse",
    icon: Utensils,
    title: "Цэс үзэх",
    desc: "Бидний санал болгож буй хоол, ундааны сонголтуудтай танилцана уу.",
    accent: "from-primary/20 via-primary/5",
  },
  {
    to: "/reservations",
    icon: CalendarCheck,
    title: "Ширээ захиалах",
    desc: "Урьдчилан суудлаа авч, хүлээгдэлгүйгээр ирээрэй.",
    accent: "from-amber-500/20 via-amber-500/5",
  },
  {
    to: "/reviews",
    icon: Star,
    title: "Сэтгэгдэл",
    desc: "Бусдын үнэлгээг харж, өөрийн санаа бодлоо хуваалцаарай.",
    accent: "from-emerald-500/20 via-emerald-500/5",
  },
] as const;

type Banner = { id: number; title?: string | null; imageUrl: string; linkUrl?: string | null };

export default function LandingPage() {
  const { data: settings } = useSettings();
  const { data: banners } = useBanners();
  const restaurantName = settings?.restaurantName || "Ресторан";
  const bannerList: Banner[] = Array.isArray(banners) ? banners : [];
  const [bannerIndex, setBannerIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (bannerList.length <= 1 || isPaused) return;
    const id = setInterval(() => {
      setBannerIndex((i) => (i + 1) % bannerList.length);
    }, 5000);
    return () => clearInterval(id);
  }, [bannerList.length, isPaused]);

  useEffect(() => {
    if (bannerIndex >= bannerList.length) setBannerIndex(0);
  }, [bannerList.length, bannerIndex]);

  return (
    <PublicLayout>
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                <Utensils size={14} />
                Тавтай морилно уу
              </div>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                {restaurantName}
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg">
                Цэсээ харах, ширээ захиалах, сэтгэгдэл үлдээх — бүгдийг ресторанд ирэхээс өмнө хийх боломжтой.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/browse"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-3 rounded-xl font-medium transition-colors"
                >
                  Цэс үзэх <ArrowRight size={16} />
                </Link>
                <Link
                  href="/reservations"
                  className="inline-flex items-center gap-2 border border-border hover:bg-muted px-5 py-3 rounded-xl font-medium transition-colors"
                >
                  Ширээ захиалах
                </Link>
              </div>
              {(settings?.restaurantAddress || settings?.restaurantPhone || settings?.openingHours) && (
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-4 border-t border-border">
                  {settings?.restaurantAddress && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={14} /> {settings.restaurantAddress}
                    </span>
                  )}
                  {settings?.restaurantPhone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={14} /> {settings.restaurantPhone}
                    </span>
                  )}
                  {settings?.openingHours && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={14} /> {settings.openingHours}
                    </span>
                  )}
                </div>
              )}
            </div>
            {bannerList.length > 0 && (
              <div
                className="relative rounded-3xl overflow-hidden shadow-2xl border border-border aspect-[16/9] bg-muted/40"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
              >
                {bannerList.map((banner, i) => {
                  const img = (
                    <img
                      src={banner.imageUrl}
                      alt={banner.title || ""}
                      className="w-full h-full object-contain"
                      loading={i === 0 ? "eager" : "lazy"}
                    />
                  );
                  return (
                    <div
                      key={banner.id}
                      className={`absolute inset-0 transition-opacity duration-700 ${
                        i === bannerIndex ? "opacity-100" : "opacity-0 pointer-events-none"
                      }`}
                      aria-hidden={i !== bannerIndex}
                    >
                      {banner.linkUrl ? (
                        <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                          {img}
                        </a>
                      ) : (
                        img
                      )}
                    </div>
                  );
                })}
                {bannerList.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {bannerList.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setBannerIndex(i)}
                        aria-label={`Banner ${i + 1}`}
                        className={`h-1.5 rounded-full transition-all ${
                          i === bannerIndex ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/70"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {actions.map(({ to, icon: Icon, title, desc, accent }) => (
            <Link
              key={to}
              href={to}
              className={`group relative overflow-hidden rounded-2xl border border-border p-6 hover:border-primary/40 transition-all bg-gradient-to-br ${accent} to-transparent`}
            >
              <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Icon className="text-primary" size={22} />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{desc}</p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                Үргэлжлүүлэх <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
