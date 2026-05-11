import { useState, useMemo } from "react";
import { useGetMenuCategories, type MenuCategory, type MenuItem } from "@workspace/api-client-react";
import { Search, ChefHat, Info } from "lucide-react";
import { PublicLayout } from "./PublicLayout";

interface CategoryWithChildren extends MenuCategory {
  children?: MenuCategory[];
}

export default function BrowseMenuPage() {
  const { data: categories = [], isLoading } = useGetMenuCategories();
  const [search, setSearch] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);

  const cats = (categories as CategoryWithChildren[]) ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cats
      .map((cat) => {
        const allItems: MenuItem[] = [
          ...(cat.items ?? []),
          ...((cat.children ?? []).flatMap((c) => c.items ?? [])),
        ];
        const items = q
          ? allItems.filter(
              (i) =>
                i.name.toLowerCase().includes(q) ||
                (i.description ?? "").toLowerCase().includes(q),
            )
          : allItems;
        return { ...cat, _items: items };
      })
      .filter((c) => (activeCategoryId ? c.id === activeCategoryId : true))
      .filter((c) => c._items.length > 0);
  }, [cats, search, activeCategoryId]);

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">Бидний цэс</h1>
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Info size={14} />
            Захиалга өгөхийн тулд ширээн дээрх QR кодыг уншуулна уу.
          </p>
        </div>

        <div className="sticky top-16 z-20 bg-background/90 backdrop-blur py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 border-b border-border mb-6">
          <div className="flex gap-3 mb-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Хоол хайх..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
            <button
              onClick={() => setActiveCategoryId(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeCategoryId === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              Бүгд
            </button>
            {cats.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeCategoryId === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-16 text-muted-foreground">
            <ChefHat size={32} className="mx-auto mb-3 animate-pulse" />
            Уншиж байна...
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <ChefHat size={32} className="mx-auto mb-3 opacity-50" />
            Үр дүн олдсонгүй
          </div>
        )}

        <div className="space-y-10">
          {filtered.map((cat) => (
            <section key={cat.id}>
              <h2 className="font-display text-2xl font-bold mb-4 flex items-center gap-2">
                {cat.name}
                <span className="text-sm font-normal text-muted-foreground">({cat._items.length})</span>
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cat._items.map((item) => (
                  <article
                    key={item.id}
                    className={`rounded-2xl border border-border overflow-hidden bg-card hover:shadow-lg hover:border-primary/30 transition-all ${
                      !item.available ? "opacity-60" : ""
                    }`}
                  >
                    {item.imageUrl && (
                      <div className="aspect-[4/3] bg-muted overflow-hidden">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex justify-between items-start gap-3 mb-2">
                        <h3 className="font-semibold leading-tight">{item.name}</h3>
                        <span className="font-bold text-primary whitespace-nowrap">
                          ₮{Number(item.price).toLocaleString()}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                      )}
                      {!item.available && (
                        <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-destructive/10 text-destructive rounded-full">
                          Дууссан
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
