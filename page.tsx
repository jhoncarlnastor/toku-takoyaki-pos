"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Cookie,
  CupSoda,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { INITIAL_MENU, peso, type CartLine, type Category, type MenuItem } from "./menu-data";
import PaymentModal, { type PaymentMethod } from "./payment-modal";

type Tab = "All" | Category;
type OrderType = "Dine-in" | "Take-out";

const TABS: Tab[] = ["All", "Takoyaki", "Drinks"];
const FIRST_ORDER_NUMBER = 1001;

function stockStatus(stock: number) {
  if (stock <= 0) return { label: "Out of Stock", cls: "bg-red-500/15 text-red-400 border-red-500/30" };
  if (stock <= 10) return { label: "Low Stock", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
  return { label: "In Stock", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
}

export default function PosPage() {
  const [menu, setMenu] = useState<MenuItem[]>(INITIAL_MENU);
  const [tab, setTab] = useState<Tab>("All");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("Dine-in");
  const [orderNumber, setOrderNumber] = useState(FIRST_ORDER_NUMBER);
  const [payOpen, setPayOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menu.filter(
      (m) => (tab === "All" || m.category === tab) && (!q || m.name.toLowerCase().includes(q))
    );
  }, [menu, tab, query]);

  const itemCount = cart.reduce((s, l) => s + l.qty, 0);
  const total = cart.reduce((s, l) => s + l.qty * l.item.price, 0);

  const qtyInCart = (id: string) => cart.find((l) => l.item.id === id)?.qty ?? 0;

  const addItem = (item: MenuItem) => {
    if (item.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.item.id === item.id);
      if (existing) {
        if (existing.qty >= item.stock) return prev;
        return prev.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { item, qty: 1 }];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.item.id === id ? { ...l, qty: Math.min(l.item.stock, l.qty + delta) } : l
        )
        .filter((l) => l.qty > 0)
    );
  };

  const removeItem = (id: string) => setCart((prev) => prev.filter((l) => l.item.id !== id));

  const completeOrder = (info: { method: PaymentMethod; received: number; change: number }) => {
    // Deduct stock
    setMenu((prev) =>
      prev.map((m) => {
        const line = cart.find((l) => l.item.id === m.id);
        return line ? { ...m, stock: Math.max(0, m.stock - line.qty) } : m;
      })
    );
    const msg =
      info.method === "Cash" && info.change > 0
        ? `Order #${orderNumber} completed. Change due: ${peso(info.change)}`
        : `Order #${orderNumber} completed (${info.method}).`;
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
    setCart([]);
    setOrderType("Dine-in");
    setOrderNumber((n) => n + 1);
    setPayOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e2e8f0] lg:h-screen lg:overflow-hidden">
      <div className="mx-auto grid h-full max-w-[1800px] grid-cols-1 gap-4 p-3 sm:p-4 lg:grid-cols-12">
        {/* ============ LEFT: MENU CATALOG ============ */}
        <section className="flex min-h-0 flex-col gap-4 lg:col-span-8">
          {/* Top bar */}
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f97316] text-white">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight">Toku Takoyaki</h1>
                <p className="text-sm text-[#94a3b8]">Staff POS</p>
              </div>
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search menu..."
                aria-label="Search menu"
                className="h-12 w-full rounded-2xl border border-[#2a2d3d] bg-[#181a24] pl-12 pr-10 text-base text-[#e2e8f0] placeholder:text-[#64748b] focus:border-[#f97316] focus:outline-none focus:ring-2 focus:ring-[#f97316]/30"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#94a3b8] hover:bg-[#2a2d3d]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </header>

          {/* Category tabs */}
          <div className="flex gap-2" role="tablist" aria-label="Menu categories">
            {TABS.map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t)}
                  className={`min-h-[48px] flex-1 rounded-2xl border px-6 text-base font-semibold transition active:scale-95 sm:flex-none sm:min-w-[130px] ${
                    active
                      ? "border-[#f97316] bg-[#f97316] text-white shadow-lg shadow-[#f97316]/20"
                      : "border-[#2a2d3d] bg-[#181a24] text-[#94a3b8] hover:text-[#e2e8f0]"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {/* Product grid */}
          <div className="min-h-0 flex-1 lg:overflow-y-auto lg:pr-1">
            {filtered.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-[#2a2d3d] text-[#94a3b8]">
                <Search className="h-10 w-10 opacity-50" />
                <p>No items found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {filtered.map((item) => {
                  const status = stockStatus(item.stock);
                  const inCart = qtyInCart(item.id);
                  const soldOut = item.stock <= 0;
                  const maxed = inCart >= item.stock;
                  const Icon = item.category === "Drinks" ? CupSoda : Cookie;
                  return (
                    <button
                      key={item.id}
                      onClick={() => addItem(item)}
                      disabled={soldOut}
                      aria-label={`Add ${item.name} to order`}
                      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-[#181a24] text-left transition active:scale-[0.97] ${
                        soldOut
                          ? "cursor-not-allowed border-[#2a2d3d] opacity-50"
                          : inCart > 0
                          ? "border-[#f97316] ring-1 ring-[#f97316]/40"
                          : "border-[#2a2d3d] hover:border-[#f97316]/60"
                      }`}
                    >
                      {/* Image placeholder */}
                      <div
                        className={`relative flex aspect-[4/3] w-full items-center justify-center ${
                          item.category === "Drinks"
                            ? "bg-gradient-to-br from-sky-500/20 to-[#181a24]"
                            : "bg-gradient-to-br from-[#f97316]/25 to-[#181a24]"
                        }`}
                      >
                        <Icon
                          className={`h-12 w-12 transition group-hover:scale-110 ${
                            item.category === "Drinks" ? "text-sky-300/80" : "text-[#f97316]/80"
                          }`}
                        />
                        <span
                          className={`absolute left-2 top-2 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}
                        >
                          {status.label}
                        </span>
                        {inCart > 0 && (
                          <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-[#f97316] px-2 text-sm font-bold text-white">
                            {inCart}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between gap-1 p-3">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-[#e2e8f0]">
                          {item.name}
                        </p>
                        <p className="text-base font-bold text-[#f97316]">{peso(item.price)}</p>
                        {maxed && !soldOut && (
                          <p className="text-[11px] text-amber-400">Max stock in order</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ============ RIGHT: ACTIVE ORDER ============ */}
        <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-3xl border border-[#2a2d3d] bg-[#181a24] lg:col-span-4 lg:min-h-0">
          {/* Header */}
          <div className="space-y-3 border-b border-[#2a2d3d] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94a3b8]">Active Order</p>
                <h2 className="text-2xl font-bold">Order #{orderNumber}</h2>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-red-400 transition hover:bg-red-500/10 active:scale-95"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#0f1117] p-1" role="radiogroup" aria-label="Order type">
              {(["Dine-in", "Take-out"] as OrderType[]).map((t) => {
                const active = orderType === t;
                const Icon = t === "Dine-in" ? UtensilsCrossed : ShoppingBag;
                return (
                  <button
                    key={t}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setOrderType(t)}
                    className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl text-sm font-semibold transition active:scale-95 ${
                      active ? "bg-[#f97316] text-white" : "text-[#94a3b8] hover:text-[#e2e8f0]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cart list */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {cart.length === 0 ? (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-center text-[#94a3b8]">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#0f1117]">
                  <ShoppingBag className="h-9 w-9 opacity-60" />
                </div>
                <p className="max-w-[220px] text-base">Tap a menu item to start the order.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {cart.map(({ item, qty }) => (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-[#2a2d3d] bg-[#0f1117] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.name}</p>
                        <p className="text-xs text-[#94a3b8]">{peso(item.price)} each</p>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remove ${item.name}`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#94a3b8] transition hover:bg-red-500/10 hover:text-red-400 active:scale-95"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1 rounded-xl bg-[#181a24] p-1">
                        <button
                          onClick={() => changeQty(item.id, -1)}
                          aria-label={`Decrease ${item.name}`}
                          className="flex h-11 w-11 items-center justify-center rounded-lg text-[#e2e8f0] transition hover:bg-[#2a2d3d] active:scale-90"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-9 text-center text-base font-bold tabular-nums">{qty}</span>
                        <button
                          onClick={() => changeQty(item.id, 1)}
                          disabled={qty >= item.stock}
                          aria-label={`Increase ${item.name}`}
                          className="flex h-11 w-11 items-center justify-center rounded-lg text-[#e2e8f0] transition hover:bg-[#2a2d3d] active:scale-90 disabled:opacity-30"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-base font-bold tabular-nums">{peso(item.price * qty)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Summary */}
          <div className="space-y-3 border-t border-[#2a2d3d] bg-[#181a24] p-4">
            <div className="flex items-center justify-between text-sm text-[#94a3b8]">
              <span>
                Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
              </span>
              <span className="tabular-nums">{peso(total)}</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-base font-semibold">Total Amount</span>
              <span className="text-4xl font-bold tabular-nums tracking-tight text-[#f97316]">
                {peso(total)}
              </span>
            </div>
            <button
              disabled={cart.length === 0}
              onClick={() => setPayOpen(true)}
              className="min-h-[64px] w-full rounded-2xl bg-[#f97316] text-lg font-bold text-white shadow-lg shadow-[#f97316]/20 transition hover:bg-[#ea6a0c] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#2a2d3d] disabled:text-[#64748b] disabled:shadow-none"
            >
              Proceed to Payment
            </button>
          </div>
        </aside>
      </div>

      <PaymentModal
        open={payOpen}
        total={total}
        orderNumber={orderNumber}
        onCancel={() => setPayOpen(false)}
        onComplete={completeOrder}
      />

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-emerald-500/40 bg-[#181a24] px-5 py-3 text-sm font-medium text-[#e2e8f0] shadow-2xl"
        >
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}
