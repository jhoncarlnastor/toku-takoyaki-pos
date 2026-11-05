"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  add_ons?: any[];
}

const ADDON_PRICE_THRESHOLD = 20;
const ADDON_NAME_HINTS = ["cheese", "sauce", "nata", "crumbs", "oreo", "mayo"];

const parseAddonsJson = (item: any): any[] => {
  let addons = item.add_ons || item.addons || item.selectedAddons || [];
  if (typeof addons === "string") {
    try {
      addons = JSON.parse(addons);
    } catch (e) {
      addons = [];
    }
  }
  // Defensive copy: never mutate the order_items array held in React state
  return Array.isArray(addons) ? [...addons] : [];
};

const addonLabel = (addon: any): string =>
  typeof addon === "string"
    ? addon
    : String(addon?.name || addon?.product_name || addon?.title || "");

// Menu lookups used to route add-ons to the right product category
type MenuRefs = {
  productCats: Record<string, string>; // product id -> "Takoyaki" | "Drinks" | ...
  productNames: Record<string, string>; // product name (lower) -> category
  addonCats: Record<string, string[]>; // add-on name (lower) -> applicable_categories
};

const EMPTY_MENU_REFS: MenuRefs = { productCats: {}, productNames: {}, addonCats: {} };

const fetchMenuRefs = async (): Promise<MenuRefs> => {
  const [productsRes, addonsRes] = await Promise.all([
    supabase.from("products").select("id, name, category"),
    supabase.from("add_ons").select("name, applicable_categories"),
  ]);

  const productCats: Record<string, string> = {};
  const productNames: Record<string, string> = {};
  (productsRes.data || []).forEach((p: any) => {
    if (p.id && p.category) productCats[p.id] = p.category;
    if (p.name && p.category) productNames[String(p.name).toLowerCase()] = p.category;
  });

  const addonCats: Record<string, string[]> = {};
  (addonsRes.data || []).forEach((a: any) => {
    if (a.name) {
      addonCats[String(a.name).toLowerCase()] = Array.isArray(a.applicable_categories)
        ? a.applicable_categories
        : [];
    }
  });

  return { productCats, productNames, addonCats };
};

const classifyItem = (item: any): "main" | "addon" => {
  if (item.is_addon === true || item.isAddOn === true || item.addon === true) return "addon";
  if (item.is_main === true || item.isMain === true) return "main";

  const category = String(item.category || item.product_category || item.cat || "").toLowerCase();
  if (category.includes("add-on") || category.includes("addon") || category.includes("add on")) {
    return "addon";
  }

  const name = String(item.product_name || item.name || item.title || "").toLowerCase();
  const nameIsAddon = ADDON_NAME_HINTS.some((hint) => name.includes(hint));
  const unitPrice = Number(item.unit_price ?? item.price ?? 0);
  const hasNoProduct = item.product_id === null || item.product_id === undefined;

  // Small-price rows (P10 cheese/spicy sauce) are add-ons, never main cards.
  // Cheapest real menu main is P25 (Bottled Water), so no main is ever caught here.
  if (unitPrice > 0 && unitPrice <= ADDON_PRICE_THRESHOLD) return "addon";
  // Zero-price add-on rows from the POS backward-compat insert (product_id: null)
  if (unitPrice === 0 && hasNoProduct && nameIsAddon) return "addon";

  // Everything else renders as a main product card — mains are NEVER hidden
  return "main";
};

// Splits order_items into main product cards + add-ons nested per parent.
// Every non-add-on row becomes its own distinct box; add-on rows never do.
const groupOrderItems = (items: any[], refs: MenuRefs) => {
  const mains: any[] = [];
  const standaloneAddons: any[] = [];

  // Preserve the exact array sequence saved at POS checkout.
  // Identical mains with different add-ons are NEVER merged, grouped or
  // re-ordered — each stays its own box, in saved order.
  items.forEach((item: any) => {
    if (classifyItem(item) === "addon") {
      standaloneAddons.push(item);
    } else {
      mains.push({ ...item, attachedAddons: parseAddonsJson(item) });
    }
  });

  if (mains.length === 0) {
    return { mains, orphanAddons: standaloneAddons };
  }

  const lower = (v: any) => String(v ?? "").toLowerCase();
  const rowLabel = (row: any) => lower(row.product_name || row.name || row.title);
  const hasAddonNamed = (main: any, label: string) =>
    main.attachedAddons.some((a: any) => lower(addonLabel(a)) === label);

  const mainCategory = (main: any): string => {
    if (main.product_id && refs.productCats[main.product_id]) {
      return refs.productCats[main.product_id];
    }
    return refs.productNames[lower(main.product_name || main.name)] || "";
  };

  // ---- PHASE 1: EXACT INDEX-SEQUENCE MATCHING --------------------------
  // POS saves add-on rows grouped per cart line, in cart order, after the
  // mains. Each main's total_price includes ITS OWN add-ons because
  // lineUnitPrice = base + sum(addon prices), so:
  //   budget = total_price - (unit_price * quantity)
  // equals the sum of exactly that line's add-on rows' total_price.
  // Consume addon rows sequentially (saved order) until each line's budget
  // is filled EXACTLY — index 0 only ever receives index 0's add-ons, and
  // rows are never pushed across item lines.
  let cursor = 0;
  for (const main of mains) {
    const qty = Number(main.quantity) || 1;
    const unit = Number(main.unit_price ?? main.price ?? 0);
    const total = Number(main.total_price ?? 0);
    const budget = total - unit * qty;

    if (!(budget > 0) || cursor >= standaloneAddons.length) continue;

    const start = cursor;
    let sum = 0;
    while (cursor < standaloneAddons.length && sum < budget) {
      const row = standaloneAddons[cursor];
      const rowTotal = Number(row.total_price ?? row.price ?? 0);
      // A row that would overshoot the budget belongs to a LATER line
      if (rowTotal > 0 && sum + rowTotal > budget) break;
      sum += rowTotal;
      cursor++;
    }

    if (sum === budget) {
      main.attachedAddons.push(...standaloneAddons.slice(start, cursor));
    } else {
      cursor = start; // budget could not be filled exactly — leave rows for phase 2
    }
  }

  // ---- PHASE 2: leftovers (legacy/inconsistent totals) -----------------
  // Best-effort routing by add-on category + quantity, still never crossing
  // lines whose rows were already claimed exactly in phase 1.
  const leftovers = standaloneAddons.slice(cursor);
  leftovers.forEach((row: any) => {
    const label = rowLabel(row);
    const qty = Number(row.quantity || 1);

    const candidates = mains.filter((m) => !hasAddonNamed(m, label));
    // Every main already shows this add-on — it is a duplicate, do not re-add
    if (candidates.length === 0) return;
    const pool = candidates;

    const categories = refs.addonCats[label] || [];
    let target: any = null;

    if (categories.length > 0) {
      const sameCategory = pool.filter((m) => categories.includes(mainCategory(m)));
      if (sameCategory.length > 0) {
        target =
          sameCategory.find((m) => Number(m.quantity || 1) === qty) || sameCategory[0];
      }
    }

    if (!target) {
      target = pool.find((m) => Number(m.quantity || 1) === qty) || pool[0];
    }

    target.attachedAddons.push(row);
  });

  // Only when the order has NO main products at all do add-ons stand alone
  return { mains, orphanAddons: [] };
};

export default function KitchenPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [menuRefs, setMenuRefs] = useState<MenuRefs>(EMPTY_MENU_REFS);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      // Deterministic item order: main rows are inserted before standalone add-on rows
      .order("id", { referencedTable: "order_items", ascending: true });
    if (data) setOrders(data);
  };

  useEffect(() => {
    fetchMenuRefs().then(setMenuRefs);
    fetchOrders();
    const channel = supabase
      .channel("kitchen-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetchOrders)
      // Items are inserted AFTER the order row — also refetch when items change
      // so main products appear as soon as they are saved
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, fetchOrders)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateStatus = async (orderId: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", orderId);
    fetchOrders();
  };

  const filteredOrders = orders.filter((o) =>
    activeTab === "active" ? o.status !== "COMPLETED" && o.status !== "DONE" : o.status === "COMPLETED" || o.status === "DONE"
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 font-sans">
      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-orange-500">KITCHEN DISPLAY SYSTEM</h1>
          <p className="text-slate-400 text-sm">Real-time Order Preparation Board</p>
        </div>
        <div className="flex gap-3 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === "active" ? "bg-orange-500 text-white" : "text-slate-400 hover:text-white"}`}
          >
            Active Orders ({orders.filter((o) => o.status !== "COMPLETED" && o.status !== "DONE").length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === "history" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}
          >
            Completed History
          </button>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
          <p className="text-xl font-medium">No {activeTab} orders at the moment</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map((order: any) => (
            <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-orange-500/20 text-orange-400 uppercase tracking-wider">
                      {order.order_type || "DINE-IN"}
                    </span>
                    <h2 className="text-2xl font-black mt-2">#{order.order_number || order.id?.slice(0, 4)}</h2>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {(() => {
                    const { mains, orphanAddons } = groupOrderItems(order.order_items || [], menuRefs);

                    // Fallback aggregates for orders whose main products were never saved
                    const orphanQty = orphanAddons.reduce(
                      (sum, a) => sum + (Number(a.quantity) || 1),
                      0
                    );
                    const orphanTotal = orphanAddons.reduce(
                      (sum, a) => sum + (Number(a.total_price) || Number(a.price) || 0),
                      0
                    );

                    return (
                      <>
                        {/* Main product cards only — add-on rows never render here */}
                        {mains.map((mainItem: any, idx: number) => (
                          <div
                            key={mainItem.id || idx}
                            className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80"
                          >
                            <div className="flex justify-between font-bold text-slate-200">
                              <span>
                                <span className="text-orange-400">{mainItem.quantity || 1}x</span>{" "}
                                {mainItem.product_name || mainItem.name || mainItem.title || "Product"}
                              </span>
                              <span className="text-slate-400 text-sm">
                                ₱{mainItem.total_price || mainItem.price || "0"}
                              </span>
                            </div>

                            {/* Add-ons strictly indented under THEIR main product */}
                            {mainItem.attachedAddons.length > 0 && (
                              <div className="mt-1.5 pl-3 border-l-2 border-orange-500/50 space-y-0.5">
                                {mainItem.attachedAddons.map((addon: any, aIdx: number) => (
                                  <p key={aIdx} className="text-xs text-slate-400 font-medium">
                                    + {addonLabel(addon)}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Orders with no saved main products (e.g. legacy #50):
                            complete fallback box with its own header — never floating text */}
                        {orphanAddons.length > 0 && (
                          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                            <div className="flex justify-between font-bold text-slate-200">
                              <span>
                                <span className="text-orange-400">{orphanQty}x</span>{" "}
                                Order Items / Add-ons
                              </span>
                              <span className="text-slate-400 text-sm">₱{orphanTotal}</span>
                            </div>
                            <div className="mt-1.5 pl-3 border-l-2 border-orange-500/50 space-y-0.5">
                              {orphanAddons.map((addon: any, oIdx: number) => (
                                <p key={addon.id || oIdx} className="text-xs text-slate-400 font-medium">
                                  + {Number(addon.quantity) || 1}x {addonLabel(addon)}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                <span className="text-lg font-black text-emerald-400">₱{order.total_amount || "0.00"}</span>
                {activeTab === "active" ? (
                  <button
                    onClick={() => updateStatus(order.id, "COMPLETED")}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg active:scale-95"
                  >
                    MARK DONE
                  </button>
                ) : (
                  <button
                    onClick={() => updateStatus(order.id, "PREPARING")}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs transition-all"
                  >
                    REOPEN
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}