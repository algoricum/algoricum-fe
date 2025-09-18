"use client";

import { Ship as Chip, Wifi } from "lucide-react";

interface PaymentCardProps {
  last4?: string | null;
  expMonth?: number | null;
  expYear?: number | null;
  brand?: string | null;
  cardholderName?: string;
  className?: string;
  variant?: "default" | "premium" | "dark" | "gradient";
}

const brandColors = {
  visa: "from-blue-600 to-blue-800",
  mastercard: "from-red-500 to-orange-600",
  amex: "from-green-600 to-teal-700",
  discover: "from-orange-500 to-amber-600",
  default: "from-slate-700 to-slate-900",
};

const brandLogos = {
  visa: "VISA",
  mastercard: "Mastercard",
  amex: "AMEX",
  discover: "DISCOVER",
};

const classNames = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(" ");
};

export function PaymentCard({
  last4,
  expMonth,
  expYear,
  brand,
  cardholderName = "CARDHOLDER NAME",
  className,
  variant = "default",
}: PaymentCardProps) {
  const brandKey = brand?.toLowerCase() as keyof typeof brandColors;
  const gradientClass = brandColors[brandKey] || brandColors.default;
  const brandLogo = brandLogos[brandKey as keyof typeof brandLogos] || brand?.toUpperCase() || "CARD";

  const getVariantStyles = () => {
    switch (variant) {
      case "premium":
        return "bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 text-black";
      case "dark":
        return "bg-gradient-to-br from-gray-800 to-black text-white";
      case "gradient":
        return `bg-gradient-to-br ${gradientClass} text-white`;
      default:
        return `bg-gradient-to-br ${gradientClass} text-white`;
    }
  };

  return (
    <div
      className={classNames(
        "relative w-full max-w-sm aspect-[1.586/1] rounded-2xl p-6 shadow-2xl",
        "transform transition-all duration-300 hover:scale-105 hover:shadow-3xl",
        "bg-gradient-to-br backdrop-blur-sm",
        getVariantStyles(),
        className,
      )}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 rounded-2xl opacity-10">
        <div className="absolute top-4 right-4 w-20 h-20 rounded-full bg-white/20" />
        <div className="absolute bottom-8 left-4 w-16 h-16 rounded-full bg-white/10" />
        <div className="absolute top-1/2 left-1/2 w-32 h-32 rounded-full bg-white/5 transform -translate-x-1/2 -translate-y-1/2" />
      </div>

      {/* Card Content */}
      <div className="relative z-10 h-full flex flex-col justify-between">
        {/* Top Section */}
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-2">
            <Chip className="w-8 h-8 text-yellow-300" />
            <Wifi className="w-6 h-6 opacity-60" />
          </div>
          <div className="text-right">
            <div className="text-lg font-bold tracking-wider">{brandLogo}</div>
          </div>
        </div>

        {/* Card Number */}
        <div className="space-y-4">
          <div className="text-2xl font-mono tracking-[0.2em] font-light">•••• •••• •••• {last4 || "••••"}</div>

          {/* Card Details */}
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <div className="text-xs opacity-70 uppercase tracking-wide">Cardholder</div>
              <div className="text-sm font-medium uppercase tracking-wide">{cardholderName}</div>
            </div>

            <div className="text-right space-y-1">
              <div className="text-xs opacity-70 uppercase tracking-wide">Expires</div>
              <div className="text-lg font-mono">
                {expMonth?.toString().padStart(2, "0") || "••"}/{expYear?.toString().slice(-2) || "••"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Holographic Effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 transform -skew-x-12" />
    </div>
  );
}
