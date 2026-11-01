"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, Smartphone, Wallet, X, Check } from "lucide-react";
import { peso } from "./menu-data";

export type PaymentMethod = "Cash" | "GCash" | "PayMaya";

interface PaymentModalProps {
  open: boolean;
  total: number;
  orderNumber: number;
  onCancel: () => void;
  onComplete: (info: { method: PaymentMethod; received: number; change: number }) => void;
}

const METHODS: { id: PaymentMethod; icon: typeof Banknote; hint: string }[] = [
  { id: "Cash", icon: Banknote, hint: "Pay at the counter" },
  { id: "GCash", icon: Smartphone, hint: "Scan QR to pay" },
  { id: "PayMaya", icon: Wallet, hint: "Scan QR to pay" },
];

const PRESETS = [100, 200, 500, 1000];

export default function PaymentModal({
  open,
  total,
  orderNumber,
  onCancel,
  onComplete,
}: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [cash, setCash] = useState("");

  // Reset each time the modal opens
  useEffect(() => {
    if (open) {
      setMethod("Cash");
      setCash("");
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  const received = useMemo(() => {
    const n = parseFloat(cash);
    return Number.isFinite(n) ? n : 0;
  }, [cash]);

  const change = Math.max(0, received - total);
  const cashShort = method === "Cash" && received < total;
  const canComplete = method !== "Cash" || received >= total;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#2a2d3d] bg-[#181a24] shadow-2xl sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2a2d3d] px-6 py-4">
          <div>
            <h2 id="payment-title" className="text-lg font-semibold text-[#e2e8f0]">
              Payment
            </h2>
            <p className="text-sm text-[#94a3b8]">Order #{orderNumber}</p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[#94a3b8] transition hover:bg-[#2a2d3d] hover:text-[#e2e8f0]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-5">
          {/* Total */}
          <div className="rounded-2xl border border-[#2a2d3d] bg-[#0f1117] p-5 text-center">
            <p className="text-sm text-[#94a3b8]">Total Amount</p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-[#f97316]">{peso(total)}</p>
          </div>

          {/* Payment methods */}
          <div>
            <p className="mb-2 text-sm font-medium text-[#e2e8f0]">Payment Method</p>
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Payment method">
              {METHODS.map(({ id, icon: Icon, hint }) => {
                const active = method === id;
                return (
                  <button
                    key={id}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMethod(id)}
                    className={`flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center transition active:scale-95 ${
                      active
                        ? "border-[#f97316] bg-[#f97316]/10 text-[#f97316]"
                        : "border-[#2a2d3d] bg-[#0f1117] text-[#94a3b8] hover:border-[#3a3e55]"
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-sm font-semibold">{id}</span>
                    <span className="hidden text-[11px] opacity-70 sm:block">{hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cash section */}
          {method === "Cash" ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="cash-received" className="mb-2 block text-sm font-medium text-[#e2e8f0]">
                  Cash Received
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-[#94a3b8]">
                    ₱
                  </span>
                  <input
                    id="cash-received"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={cash}
                    onChange={(e) => setCash(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                    className="h-14 w-full rounded-2xl border border-[#2a2d3d] bg-[#0f1117] pl-10 pr-4 text-2xl font-semibold text-[#e2e8f0] placeholder:text-[#475569] focus:border-[#f97316] focus:outline-none focus:ring-2 focus:ring-[#f97316]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                <button
                  onClick={() => setCash(String(total))}
                  className="min-h-[52px] rounded-xl border border-[#f97316]/50 bg-[#f97316]/10 text-sm font-semibold text-[#f97316] transition hover:bg-[#f97316]/20 active:scale-95"
                >
                  Exact
                </button>
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setCash(String(p))}
                    className="min-h-[52px] rounded-xl border border-[#2a2d3d] bg-[#0f1117] text-sm font-semibold text-[#e2e8f0] transition hover:border-[#f97316]/60 active:scale-95"
                  >
                    ₱{p.toLocaleString("en-PH")}
                  </button>
                ))}
              </div>

              <div
                className={`flex items-center justify-between rounded-2xl border px-5 py-4 ${
                  cashShort
                    ? "border-[#2a2d3d] bg-[#0f1117]"
                    : "border-emerald-500/40 bg-emerald-500/10"
                }`}
              >
                <span className="text-sm font-medium text-[#94a3b8]">Change Due</span>
                <span
                  className={`text-2xl font-bold ${cashShort ? "text-[#e2e8f0]" : "text-emerald-400"}`}
                >
                  {peso(change)}
                </span>
              </div>
              {cash !== "" && cashShort && (
                <p className="text-sm text-red-400">
                  Cash received is {peso(total - received)} short.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#2a2d3d] bg-[#0f1117] p-5 text-center text-sm text-[#94a3b8]">
              Ask the customer to pay {peso(total)} with {method}, then tap{" "}
              <span className="font-semibold text-[#e2e8f0]">Complete Order</span> once the payment is confirmed.
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 border-t border-[#2a2d3d] bg-[#181a24] px-6 py-4">
          <button
            onClick={onCancel}
            className="min-h-[56px] rounded-2xl border border-[#2a2d3d] bg-[#0f1117] text-base font-semibold text-[#e2e8f0] transition hover:bg-[#2a2d3d] active:scale-95"
          >
            Cancel
          </button>
          <button
            disabled={!canComplete}
            onClick={() =>
              onComplete({
                method,
                received: method === "Cash" ? received : total,
                change: method === "Cash" ? change : 0,
              })
            }
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-[#f97316] text-base font-bold text-white shadow-lg shadow-[#f97316]/20 transition hover:bg-[#ea6a0c] active:scale-95 disabled:cursor-not-allowed disabled:bg-[#2a2d3d] disabled:text-[#64748b] disabled:shadow-none"
          >
            <Check className="h-5 w-5" />
            Complete Order
          </button>
        </div>
      </div>
    </div>
  );
}
