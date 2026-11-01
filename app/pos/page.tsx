"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  CheckCircle2,
  Cookie,
  CupSoda,
  LogOut,
  Minus,
  Moon,
  Plus,
  Search,
  ShoppingBag,
  Sun,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  INITIAL_MENU,
  peso,
  type CartLine,
  type Category,
  type MenuItem,
  type SelectedAddOn,
} from "./menu-data";
import PaymentModal, { type PaymentMethod } from "./payment-modal";
import ThermalReceiptModal from "./components/ThermalReceiptModal";
import { supabase } from "@/lib/supabase";

type Tab = "All" | Category;
type OrderType = "Dine-in" | "Take-out";

const TABS: Tab[] = ["All", "Takoyaki", "Drinks"];
const FIRST_ORDER_NUMBER = 1001;

function stockStatus(stock: number) {
  if (stock <= 0) return { label: "Out of Stock", cls: "bg-red-500/15 text-red-400 border-red-500/30" };
  if (stock <= 10) return { label: "Low Stock", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
  return { label: "In Stock", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
}

type ProductRecipe = {
  product_id: string;
  inventory_item_id: string;
  quantity_required: number;
};

async function deductRawMaterials(lines: CartLine[]) {
  if (!lines || lines.length === 0) {
    console.log("deductRawMaterials: No lines to process");
    return;
  }
  try {
    const productIds = lines.map((l) => l.item.id).filter(Boolean);
    const addOnIds = lines.flatMap(line => (line.addOns || []).map(a => a.id)).filter(Boolean);
    
    console.log("deductRawMaterials: Processing", { productIds, addOnIds, totalLines: lines.length });

    // Build query conditions only for non-empty arrays
    const conditions: string[] = [];
    if (productIds.length > 0) {
      conditions.push(`product_id.in.(${productIds.join(',')})`);
    }
    if (addOnIds.length > 0) {
      conditions.push(`add_on_id.in.(${addOnIds.join(',')})`);
    }

    if (conditions.length === 0) {
      console.log("deductRawMaterials: No product or add-on IDs to process");
      return;
    }

    const { data: recipes, error } = await supabase
      .from("product_recipes")
      .select("product_id, add_on_id, inventory_item_id, quantity_required")
      .or(conditions.join(','));

    if (error) {
      console.error("deductRawMaterials: Supabase query error:", error);
      return;
    }
    if (!recipes || recipes.length === 0) {
      console.log("deductRawMaterials: No recipes found for items");
      return;
    }

    console.log(`deductRawMaterials: Found ${recipes.length} recipe(s)`);

    const qtyByProduct = new Map<string, number>();
    const qtyByAddOn = new Map<string, number>();
    
    for (const line of lines) {
      qtyByProduct.set(line.item.id, (qtyByProduct.get(line.item.id) ?? 0) + line.qty);
      for (const addOn of (line.addOns || [])) {
        qtyByAddOn.set(addOn.id, (qtyByAddOn.get(addOn.id) ?? 0) + line.qty);
      }
    }
    
    const deductions = new Map<string, number>();

    for (const recipe of recipes as any[]) {
      const itemId = recipe.product_id || recipe.add_on_id;
      if (!itemId) continue;
      
      const orderedQty = (recipe.product_id ? qtyByProduct.get(itemId) : qtyByAddOn.get(itemId)) ?? 0;
      const amount = recipe.quantity_required * orderedQty;
      if (amount <= 0) continue;
      deductions.set(
        recipe.inventory_item_id,
        (deductions.get(recipe.inventory_item_id) ?? 0) + amount
      );
    }

    console.log(`deductRawMaterials: Calculated deductions for ${deductions.size} ingredient(s)`);

    for (const [inventoryItemId, amount] of deductions) {
      const { data: item, error: fetchError } = await supabase
        .from("inventory_items")
        .select("current_stock")
        .eq("id", inventoryItemId)
        .maybeSingle();

      if (fetchError || !item) {
        console.error("Error fetching inventory item:", fetchError);
        continue;
      }

      const newStock = Math.max(0, item.current_stock - amount);
      const { error: updateError } = await supabase
        .from("inventory_items")
        .update({ current_stock: newStock })
        .eq("id", inventoryItemId);

      if (updateError) {
        console.error("Error deducting inventory:", updateError);
      } else {
        console.log(
          `Inventory deducted: ingredient ${inventoryItemId} -${amount} (${item.current_stock} -> ${newStock})`
        );
      }
    }
  } catch (err) {
    console.error("Inventory deduction failed:", err);
  }
}

type AddOn = {
  id: string;
  name: string;
  price: number;
  applicable_categories?: string[];
};

export default function PosPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [menu, setMenu] = useState<MenuItem[]>(INITIAL_MENU);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [tab, setTab] = useState<Tab>("All");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("Dine-in");
  const [orderNumber, setOrderNumber] = useState(FIRST_ORDER_NUMBER);
  const [payOpen, setPayOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  const [customerInfo, setCustomerInfo] = useState("");
  const [customizeItem, setCustomizeItem] = useState<MenuItem | null>(null);
  const [customQty, setCustomQty] = useState(1);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [completedOrderData, setCompletedOrderData] = useState<{
    orderNumber: number;
    orderType: "Dine-in" | "Take-out";
    cart: CartLine[];
    total: number;
    paymentMethod: "Cash" | "GCash" | "PayMaya";
    cashReceived: number;
    change: number;
    customerInfo: string;
    timestamp: Date;
  } | null>(null);

  // Safe auth check on mount - clear stale sessions silently
  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn("Session check failed, clearing stale session:", error.message);
          await supabase.auth.signOut();
          localStorage.removeItem("user_session");
          if (mounted) router.push("/login");
          return;
        }
        // If no session but no error, user is simply not logged in
        // Middleware will handle redirect
        if (!session) {
          return;
        }
      } catch (err) {
        // Fail silently - clear stale data and redirect
        console.warn("Auth check failed, clearing stale session:", err);
        try {
          await supabase.auth.signOut();
        } catch {}
        localStorage.removeItem("user_session");
        if (mounted) router.push("/login");
      }
    };
    checkSession();
    return () => { mounted = false; };
  }, [router]);

  // Sync with customer display
  useEffect(() => {
    const cartData = {
      type: 'SYNC_CART',
      cart,
      orderType,
      orderNumber,
      subtotal: cart.reduce((acc, line) => acc + (line.item.price + (line.addOns || []).reduce((a, b) => a + b.price, 0)) * line.qty, 0),
    };

    // 1. Sync via BroadcastChannel (for same-tab or active tabs)
    const posChannel = new BroadcastChannel('toku_customer_display');
    if (cart.length === 0) {
      posChannel.postMessage({ type: 'CLEAR_CUSTOMER_VIEW' });
    } else {
      posChannel.postMessage(cartData);
    }
    posChannel.close();

    // 2. Sync via LocalStorage (for persisted state across tabs)
    if (cart.length === 0) {
      localStorage.removeItem('toku_pos_cart');
    } else {
      localStorage.setItem('toku_pos_cart', JSON.stringify(cartData));
    }
    
    // Trigger storage event manually for same-tab updates
    window.dispatchEvent(new Event('storage'));

    return () => {};
  }, [cart, orderType, orderNumber]);

  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.removeItem("user_session");
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const formattedTime = useMemo(() => {
    if (!currentTime) return "";
    return (
      currentTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }) +
      " • " +
      currentTime.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
    );
  }, [currentTime]);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase.from("products").select("*");
    if (error) {
      console.error("Error fetching POS menu:", error);
      return;
    }
    const rows = (data ?? []) as {
      id: string;
      name: string;
      price: number;
      category: string;
      stock: number;
      image_url: string | null;
    }[];
    setMenu(
      rows.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        category: p.category === "Drinks" ? "Drinks" : "Takoyaki",
        stock: Number(p.stock),
        image_url: p.image_url,
      }))
    );
  }, []);

  const fetchAddOns = useCallback(async () => {
    const { data, error } = await supabase.from("add_ons").select("*");
    if (error) {
      console.error("Error fetching add-ons:", error);
      return;
    }
    const rows = (data ?? []) as { id: string; name: string; price: number; applicable_categories?: string[] }[];
    setAddOns(rows.map((a) => ({ 
      id: a.id, 
      name: a.name, 
      price: Number(a.price),
      applicable_categories: a.applicable_categories ?? ["Takoyaki", "Drinks"]
    })));
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchAddOns();

    const productsChannel = supabase
      .channel("products-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          fetchProducts();
        }
      )
      .subscribe();

    const addOnsChannel = supabase
      .channel("realtime_addons")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "add_ons" },
        () => {
          fetchAddOns();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(addOnsChannel);
    };
  }, [fetchProducts, fetchAddOns]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menu.filter(
      (m) => (tab === "All" || m.category === tab) && (!q || m.name.toLowerCase().includes(q))
    );
  }, [menu, tab, query]);

  const lineUnitPrice = (l: CartLine) =>
    l.item.price + (l.addOns ?? []).reduce((s, a) => s + a.price, 0);
  const lineTotal = (l: CartLine) => lineUnitPrice(l) * l.qty;

  const itemCount = cart.reduce((s, l) => s + l.qty, 0);
  const total = cart.reduce((s, l) => s + lineTotal(l), 0);

  const qtyInCart = (id: string) =>
    cart.reduce((s, l) => (l.item.id === id ? s + l.qty : s), 0);

  const lineSignature = (l: CartLine) =>
    `${l.item.id}|${(l.addOns ?? []).map((a) => a.id).sort().join(",")}`;

  const pushLine = (line: CartLine) => {
    if (line.qty <= 0) return;
    setCart((prev) => {
      const totalForItem = prev
        .filter((l) => l.item.id === line.item.id)
        .reduce((s, l) => s + l.qty, 0);
      if (totalForItem + line.qty > line.item.stock) return prev;
      const signature = lineSignature(line);
      const existing = prev.find((l) => lineSignature(l) === signature);
      if (existing) {
        return prev.map((l) =>
          lineSignature(l) === signature ? { ...l, qty: l.qty + line.qty } : l
        );
      }
      return [...prev, line];
    });
  };

  const openCustomize = (item: MenuItem) => {
    if (item.stock <= 0) return;
    setCustomizeItem(item);
    setCustomQty(1);
    setSelectedAddOnIds([]);
  };

  const closeCustomize = () => {
    setCustomizeItem(null);
    setSelectedAddOnIds([]);
    setCustomQty(1);
  };

  const toggleAddOn = (id: string) => {
    setSelectedAddOnIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const categoryAddOns = useMemo(() => {
    if (!customizeItem) return [];
    const itemCategory = customizeItem.category || '';
    return addOns.filter((addon) => {
      if (!addon.applicable_categories || addon.applicable_categories.length === 0) return false;
      return addon.applicable_categories.some(
        (cat) => cat.trim().toLowerCase() === itemCategory.trim().toLowerCase()
      );
    });
  }, [addOns, customizeItem]);

  const customAddOns: SelectedAddOn[] = categoryAddOns.filter((a) => selectedAddOnIds.includes(a.id));
  const customUnitPrice = customizeItem
    ? customizeItem.price + customAddOns.reduce((s, a) => s + a.price, 0)
    : 0;
  const customTotal = customUnitPrice * customQty;

  const confirmCustomize = () => {
    if (!customizeItem) return;
    const qty = Math.min(customQty, customizeItem.stock);
    pushLine({ item: customizeItem, qty, addOns: customAddOns });
    closeCustomize();
  };

  const changeQty = (index: number, delta: number) => {
    setCart((prev) => {
      const line = prev[index];
      if (!line) return prev;
      const otherQty = prev
        .filter((l, i) => i !== index && l.item.id === line.item.id)
        .reduce((s, l) => s + l.qty, 0);
      const maxForLine = Math.max(0, line.item.stock - otherQty);
      const nextQty = Math.min(maxForLine, line.qty + delta);
      if (nextQty <= 0) return prev.filter((_, i) => i !== index);
      return prev.map((l, i) => (i === index ? { ...l, qty: nextQty } : l));
    });
  };

  const removeItem = (index: number) =>
    setCart((prev) => prev.filter((_, i) => i !== index));

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchLatestOrderNum = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('order_number')
        .order('order_number', { ascending: false })
        .limit(1);
      
      if (!error && data && data.length > 0) {
        setOrderNumber(data[0].order_number + 1);
      }
    };
    fetchLatestOrderNum();
  }, []);

  const completeOrder = async (info: { method: PaymentMethod; received: number; change: number }) => {
    setIsSubmitting(true);
    const orderPayload = {
      order_type: orderType,
      subtotal: total,
      total_amount: total,
      payment_method: info.method,
      cash_received: info.received,
      change_due: info.change,
      status: "Completed",
    };

    let orderId: string | null = null;
    let finalOrderNumber: number = orderNumber;
    let orderError: { message: string } | null = null;

    try {
      const { data, error } = await supabase
        .from("orders")
        .insert([orderPayload])
        .select("id, order_number");

      if (error) {
        orderError = error;
        console.error("SUPABASE INSERT ERROR:", error);
      } else if (data && data[0]) {
        orderId = data[0].id;
        finalOrderNumber = data[0].order_number;
      }
    } catch (err) {
      orderError = { message: err instanceof Error ? err.message : String(err) };
    }

    if (orderId) {
      const baseRows = cart.map((line) => ({
        order_id: orderId,
        product_id: line.item.id,
        product_name: line.item.name,
        quantity: line.qty,
        unit_price: line.item.price,
        total_price: lineUnitPrice(line) * line.qty,
      }));
      await supabase.from("order_items").insert(baseRows);

      const addOnRows = cart.flatMap((line) =>
        (line.addOns ?? []).map((addOn) => ({
          order_id: orderId,
          product_id: null,
          product_name: addOn.name,
          quantity: line.qty,
          unit_price: addOn.price,
          total_price: addOn.price * line.qty,
        }))
      );
      if (addOnRows.length > 0) {
        await supabase.from("order_items").insert(addOnRows);
      }
    }

    setMenu((prev) => prev.map((m) => {
        const qty = cart.filter(l => l.item.id === m.id).reduce((s, l) => s + l.qty, 0);
        return { ...m, stock: Math.max(0, m.stock - qty) };
    }));

    if (orderId) {
      try {
        await deductRawMaterials(cart);
      } catch (err) {
        console.error("Inventory deduction skipped:", err);
      }
    }

    if (!orderError) {
      const changeMsg = info.method === "Cash" && info.change > 0 ? ` Change due: ${peso(info.change)}.` : "";
      setToast(`Transaction Completed! Order #${finalOrderNumber} (${info.method}).${changeMsg}`);
      setTimeout(() => setToast(null), 4000);

      // Store completed order data for receipt modal
      setCompletedOrderData({
        orderNumber: finalOrderNumber,
        orderType,
        cart: [...cart],
        total,
        paymentMethod: info.method,
        cashReceived: info.received,
        change: info.change,
        customerInfo,
        timestamp: new Date(),
      });
      setReceiptOpen(true);
    } else {
      setToast(`Order not saved: ${orderError.message}`);
      setTimeout(() => setToast(null), 6000);
    }

    const posChannel = new BroadcastChannel('toku_customer_display');
    posChannel.postMessage({ type: 'CLEAR_CUSTOMER_VIEW' });
    posChannel.close();

    localStorage.removeItem('toku_pos_cart');
    localStorage.setItem('toku_customer_view_cleared', Date.now().toString());
    window.dispatchEvent(new Event('storage'));

    setCart([]);
    setOrderType("Dine-in");
    setOrderNumber(finalOrderNumber + 1);
    setPayOpen(false);
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#121318] text-slate-900 dark:text-zinc-100 lg:h-screen lg:overflow-hidden font-sans">
      <div className="mx-auto grid h-full max-w-[1800px] grid-cols-1 gap-4 p-3 sm:p-4 lg:grid-cols-12">
        {/* ============ LEFT: MENU CATALOG ============ */}
        <section className="flex min-h-0 flex-col gap-4 lg:col-span-8">
          {/* Top bar */}
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 bg-white/50 dark:bg-[#1a1c23]/50 px-4 py-3">
            <div className="flex items-center gap-3">
              <Image alt="Toku Takoyaki" className="rounded-full object-cover" height={40} src="/toku-logo.png" width={40} />
              <div>
                <h1 className="text-xl font-bold leading-tight text-slate-900 dark:text-zinc-100 tracking-tight">Toku Takoyaki</h1>
                <p className="text-sm text-slate-500 dark:text-zinc-500">Staff POS</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {formattedTime && (
                <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-[#1e2029] px-3 py-1.5 font-mono text-sm text-slate-600 dark:text-zinc-300 shadow-sm">
                  {formattedTime}
                </div>
              )}
              {/* Theme Toggle */}
              <button
                type="button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900/80 hover:bg-slate-200 dark:hover:bg-zinc-800 text-rose-500 px-2 py-1.5 text-xs font-medium cursor-pointer transition-colors"
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-400 transition hover:bg-red-500/20 duration-200"
              >
                <LogOut className="size-4" />
                Logout
              </button>
            </div>
          </header>

          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 dark:text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search menu..."
              aria-label="Search menu"
              className="h-12 w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1c23] pl-12 pr-10 text-base text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-600 focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-600/30 duration-200"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/5 duration-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

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
                  className={`min-h-[44px] flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95 sm:flex-none sm:min-w-[110px] ${
                    active
                      ? "bg-rose-600 text-white shadow-sm shadow-rose-900/20"
                      : "bg-slate-100 dark:bg-[#1e2029] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#252834]"
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
              <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/10 text-zinc-500">
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
                  const hasImage = Boolean(item.image_url) && !brokenImages.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => openCustomize(item)}
                      disabled={soldOut}
                      aria-label={`Customize ${item.name}`}
                      className={`group relative flex flex-col justify-between h-full rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#1a1c23] p-3.5 text-left transition-all duration-200 hover:border-rose-500/40 shadow-sm active:scale-[0.97] ${
                        soldOut
                          ? "cursor-not-allowed opacity-50"
                          : inCart > 0
                          ? "border-rose-600 ring-1 ring-rose-600/40"
                          : ""
                      }`}
                    >
                      {/* Fixed height image container */}
                      <div className="relative w-full h-36 bg-[#111217] rounded-xl overflow-hidden mb-3">
                        {hasImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image_url as string}
                            alt={item.name}
                            className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-105"
                            onError={() =>
                              setBrokenImages((prev) => new Set(prev).add(item.id))
                            }
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#111217] to-[#1a1c23]">
                            <span className="text-xs font-semibold text-zinc-700 tracking-widest uppercase">
                              {item.category === "Drinks" ? "Drink" : "Takoyaki"}
                            </span>
                          </div>
                        )}

                        {/* Stock badge: only show Low Stock or Out of Stock */}
                        {item.stock <= 10 && (
                          <span
                            className={`absolute left-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-sm ${
                              item.stock <= 0
                                ? "bg-red-500/25 text-red-300 border-red-500/40"
                                : "bg-amber-500/25 text-amber-300 border-amber-500/40"
                            }`}
                          >
                            {item.stock <= 0 ? "Out of Stock" : "Low Stock"}
                          </span>
                        )}

                        {inCart > 0 && (
                          <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-600 px-1.5 text-xs font-bold text-white shadow-md">
                            {inCart}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col justify-between">
                        <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 line-clamp-1 mb-1">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-1">
                          {item.category}
                        </p>
                        <p className="text-base font-bold text-rose-600 dark:text-rose-400">{peso(item.price)}</p>
                        {maxed && !soldOut && (
                          <p className="mt-1 text-[11px] text-amber-500 dark:text-amber-400">Max stock in order</p>
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
        <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#1a1c23] lg:col-span-4 lg:min-h-0">
          {/* Header */}
          <div className="space-y-3 border-b border-slate-200 dark:border-white/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-zinc-500">Active Order</p>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">Order #{orderNumber}</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500">Cashier: Staff</p>
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

            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 dark:bg-[#111217] p-1" role="radiogroup" aria-label="Order type">
              {(["Dine-in", "Take-out"] as OrderType[]).map((t) => {
                const active = orderType === t;
                const Icon = t === "Dine-in" ? UtensilsCrossed : ShoppingBag;
                return (
                  <button
                    key={t}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setOrderType(t)}
                    className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${
                      active ? "bg-rose-600 text-white" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customer Name / Table # input above order items list */}
          <div className="px-4 pt-3 pb-1">
            <input
              type="text"
              value={customerInfo}
              onChange={(e) => setCustomerInfo(e.target.value)}
              placeholder="Customer Name / Table # (optional)"
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111217] px-3 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-600 dark:placeholder:text-zinc-600 focus:border-rose-600 focus:outline-none focus:ring-1 focus:ring-rose-600 duration-200"
            />
          </div>

          {/* Cart list */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {cart.length === 0 ? (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-center text-slate-500 dark:text-zinc-500">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-[#111217]">
                  <ShoppingBag className="h-9 w-9 opacity-60" />
                </div>
                <p className="max-w-[220px] text-base">Tap a menu item to start the order.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {cart.map((line, index) => (
                  <li
                    key={`${line.item.id}-${index}`}
                    className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#1a1c23] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">{line.item.name}</p>
                        <p className="text-xs text-slate-500 dark:text-zinc-500">
                          {peso(lineUnitPrice(line))} each
                        </p>
                        {(line.addOns || []).length > 0 && (
                          <p className="mt-1 text-[11px] leading-snug text-rose-400">
                            + {(line.addOns || []).map((a) => `${a.name} (${peso(a.price)})`).join(", ")}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(index)}
                        aria-label={`Remove ${line.item.name}`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 dark:text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400 active:scale-95"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-[#111217] p-1">
                        <button
                          onClick={() => changeQty(index, -1)}
                          aria-label={`Decrease ${line.item.name}`}
                          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-900 dark:text-zinc-100 transition hover:bg-slate-200 dark:hover:bg-white/5 active:scale-90"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-9 text-center text-base font-bold tabular-nums text-slate-900 dark:text-zinc-100">
                          {line.qty}
                        </span>
                        <button
                          onClick={() => changeQty(index, 1)}
                          disabled={qtyInCart(line.item.id) >= line.item.stock}
                          aria-label={`Increase ${line.item.name}`}
                          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-900 dark:text-zinc-100 transition hover:bg-slate-200 dark:hover:bg-white/5 active:scale-90 disabled:opacity-30"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-base font-bold text-rose-500 tabular-nums">{peso(lineTotal(line))}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Summary */}
          <div className="space-y-3 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-[#1a1c23] p-4">
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-zinc-500">
              <span>
                Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
              </span>
              <span className="tabular-nums text-slate-900 dark:text-zinc-100">{peso(total)}</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-base font-semibold text-slate-900 dark:text-zinc-100">Total Amount</span>
              <span className="text-4xl font-bold tabular-nums tracking-tight text-rose-600 dark:text-rose-500">
                {peso(total)}
              </span>
            </div>
            <button
              disabled={cart.length === 0}
              onClick={() => setPayOpen(true)}
              className="min-h-[64px] w-full rounded-2xl bg-rose-600 text-lg font-bold text-white shadow-md shadow-rose-900/30 transition-all duration-200 hover:bg-rose-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-zinc-500 disabled:shadow-none"
            >
              Proceed to Payment
            </button>
          </div>
        </aside>
      </div>

      {/* ============ JOLLIBEE-STYLE CUSTOMIZE MODAL ============ */}
      {customizeItem && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customize-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCustomize();
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#1a1c23] text-slate-900 dark:text-zinc-100 shadow-2xl">
            {/* Header */}
            <div className="relative flex items-center gap-4 border-b border-slate-200 dark:border-white/5 p-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500/25 to-slate-100 dark:from-orange-500/25 dark:to-[#111217]">
                {customizeItem.image_url && !brokenImages.has(customizeItem.id) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={customizeItem.image_url}
                    alt={customizeItem.name}
                    className="h-20 w-20 object-cover"
                    onError={() =>
                      setBrokenImages((prev) => new Set(prev).add(customizeItem.id))
                    }
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center">
                    {customizeItem.category === "Drinks" ? (
                      <CupSoda className="h-9 w-9 text-sky-300/80" />
                    ) : (
                      <Cookie className="h-9 w-9 text-orange-400/80" />
                    )}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h2 id="customize-title" className="truncate text-lg font-bold leading-tight text-slate-900 dark:text-zinc-100">
                  {customizeItem.name}
                </h2>
                <p className="text-sm font-semibold text-rose-600 dark:text-rose-500">
                  {peso(customizeItem.price)} base
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-[#111217] p-1">
                <button
                  onClick={() => setCustomQty((q) => Math.max(1, q - 1))}
                  disabled={customQty <= 1}
                  aria-label="Decrease quantity"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-900 dark:text-zinc-100 transition hover:bg-slate-200 dark:hover:bg-white/5 active:scale-90 disabled:opacity-30"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-base font-bold tabular-nums text-slate-900 dark:text-zinc-100">{customQty}</span>
                <button
                  onClick={() => setCustomQty((q) => Math.min(customizeItem.stock, q + 1))}
                  disabled={customQty >= customizeItem.stock}
                  aria-label="Increase quantity"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-900 dark:text-zinc-100 transition hover:bg-slate-200 dark:hover:bg-white/5 active:scale-90 disabled:opacity-30"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={closeCustomize}
                aria-label="Close"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 dark:text-zinc-500 transition hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Section: Customize / Add-ons */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
                Customize / Add-ons ({customizeItem.category})
              </p>
              {categoryAddOns.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-zinc-500">No applicable add-ons for this category.</p>
              ) : (
                <ul className="space-y-2">
                  {categoryAddOns.map((addOn) => {
                    const checked = selectedAddOnIds.includes(addOn.id);
                    return (
                      <li key={addOn.id}>
                        <label
                          className={`flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-all duration-200 ${
                            checked
                              ? "border-rose-600 bg-rose-600/10"
                              : "border-slate-200 dark:border-white/5 bg-white dark:bg-[#111217] hover:border-rose-600/50"
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAddOn(addOn.id)}
                              className="size-5 shrink-0 accent-rose-600"
                            />
                            <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{addOn.name}</span>
                          </span>
                          <span className="text-sm font-bold text-rose-600 dark:text-rose-500">
                            +{peso(addOn.price)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 dark:border-white/5 p-4">
              <button
                onClick={confirmCustomize}
                disabled={customizeItem.stock <= 0}
                className="min-h-[64px] w-full rounded-2xl bg-rose-600 text-lg font-bold text-white shadow-md shadow-rose-900/30 transition-all duration-200 hover:bg-rose-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-zinc-500 disabled:shadow-none"
              >
                Add to Order - {peso(customTotal)}
              </button>
            </div>
          </div>
        </div>
      )}

      <PaymentModal
        open={payOpen}
        total={total}
        orderNumber={orderNumber}
        isSubmitting={isSubmitting}
        onCancel={() => {
          setPayOpen(false);
        }}
        onComplete={completeOrder}
        onCashChange={(received, change) => {
          const posChannel = new BroadcastChannel('toku_customer_display');
          posChannel.postMessage({
            type: 'SYNC_CART',
            cart,
            orderType,
            orderNumber,
            subtotal: total,
            total,
            cashTendered: received,
            changeDue: change
          });
          posChannel.close();
        }}
      />

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-emerald-500/40 bg-[#1a1c23] px-5 py-3 text-sm font-medium text-zinc-100 shadow-2xl"
        >
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          {toast}
        </div>
      )}

      {completedOrderData && (
        <ThermalReceiptModal
          isOpen={receiptOpen}
          onClose={() => {
            setReceiptOpen(false);
            setCompletedOrderData(null);
          }}
          onPrint={() => window.print()}
          orderNumber={completedOrderData.orderNumber}
          orderType={completedOrderData.orderType}
          cart={completedOrderData.cart}
          total={completedOrderData.total}
          paymentMethod={completedOrderData.paymentMethod}
          cashReceived={completedOrderData.cashReceived}
          change={completedOrderData.change}
          customerInfo={completedOrderData.customerInfo}
          timestamp={completedOrderData.timestamp}
        />
      )}
    </div>
  );
}
