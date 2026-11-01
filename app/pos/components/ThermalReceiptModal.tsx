"use client";

import { useEffect, useRef } from "react";
import { Printer, X, CheckCircle2 } from "lucide-react";
import { peso } from "../menu-data";

interface CartLine {
  item: {
    id: string;
    name: string;
    price: number;
    category: string;
    stock: number;
    image_url?: string | null;
  };
  qty: number;
  addOns?: { id: string; name: string; price: number }[];
}

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: () => void;
  orderNumber: number;
  orderType: "Dine-in" | "Take-out";
  cart: CartLine[];
  total: number;
  paymentMethod: "Cash" | "GCash" | "PayMaya";
  cashReceived: number;
  change: number;
  customerInfo?: string;
  timestamp: Date;
}

export default function ThermalReceiptModal({
  isOpen,
  onClose,
  onPrint,
  orderNumber,
  orderType,
  cart,
  total,
  paymentMethod,
  cashReceived,
  change,
  customerInfo,
  timestamp,
}: ThermalReceiptModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && printRef.current) {
      printRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const subtotal = cart.reduce((acc, line) => {
    const lineTotal = line.item.price + (line.addOns || []).reduce((a, b) => a + b.price, 0);
    return acc + lineTotal * line.qty;
  }, 0);

  const formatTime = (date: Date) => {
    return date.toLocaleString("en-PH", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-title"
    >
      <div
        ref={containerRef}
        id="thermal-receipt-container"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[320px] bg-white rounded-xl shadow-2xl overflow-hidden font-mono text-black"
      >
        <div className="p-4 border-b border-gray-200 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CheckCircle2 className="h-6 w-6 text-rose-600" />
            <span className="text-xl font-bold tracking-tight">TOKU TAKOYAKI</span>
          </div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Staff POS & Live Order Receipt</p>
        </div>

        <div className="p-4 border-b border-gray-200 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="font-semibold">Order #</span>
            <span className="font-bold tabular-nums">{orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Type</span>
            <span className="font-medium capitalize">{orderType.toLowerCase()}</span>
          </div>
          {customerInfo && (
            <div className="flex justify-between">
              <span>Customer</span>
              <span className="font-medium truncate max-w-[150px]">{customerInfo}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Date/Time</span>
            <span className="font-medium">{formatTime(timestamp)}</span>
          </div>
        </div>

        <div className="p-4 border-b border-gray-200">
          {cart.map((line, index) => (
            <div key={index} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{line.item.name}</span>
                <span className="font-bold tabular-nums">{peso(line.item.price * line.qty)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Qty: {line.qty} × {peso(line.item.price)}</span>
              </div>
              {line.addOns && line.addOns.length > 0 && (
                <div className="ml-2 space-y-0.5 border-l border-gray-200 pl-2">
                  {line.addOns.map((addOn, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-gray-500">
                      <span>+ {addOn.name}</span>
                      <span className="font-medium">{peso(addOn.price * line.qty)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-b border-gray-200 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-medium tabular-nums">{peso(subtotal)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-lg">
            <span>Total</span>
            <span className="tabular-nums">{peso(total)}</span>
          </div>
          <div className="flex justify-between">
            <span>Payment</span>
            <span className="font-medium capitalize">{paymentMethod}</span>
          </div>
          {paymentMethod === "Cash" && (
            <>
              <div className="flex justify-between">
                <span>Cash Received</span>
                <span className="font-medium tabular-nums">{peso(cashReceived)}</span>
              </div>
              <div className="flex justify-between text-green-600 font-medium">
                <span>Change Due</span>
                <span className="tabular-nums">{peso(change)}</span>
              </div>
            </>
          )}
        </div>

        <div className="p-4 text-center border-b border-gray-200">
          <p className="text-sm font-medium mb-1">Thank you for dining with</p>
          <p className="text-sm font-bold text-rose-600">Toku Takoyaki!</p>
          <p className="text-xs text-gray-500 mt-1">Please come again.</p>
        </div>

        <div className="p-4 flex gap-2">
          <button
            ref={printRef}
            onClick={onPrint}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 transition"
          >
            <Printer className="h-5 w-5" />
            Print Receipt
          </button>
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
          >
            <X className="h-5 w-5" />
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
