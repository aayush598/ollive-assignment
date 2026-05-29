import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "bordered" | "elevated" | "brand";
}

export function Card({ className = "", variant = "default", children, ...props }: CardProps) {
  const variants = {
    default: "bg-white rounded-xl border border-slate-200",
    bordered: "bg-white rounded-xl border-2 border-slate-200",
    elevated: "bg-white rounded-xl shadow-lg",
    brand:
      "bg-white rounded-xl border border-indigo-100 shadow-sm hover:shadow-md transition-shadow duration-200",
  };

  return (
    <div className={`${variants[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-6 py-4 border-b border-slate-100 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-6 py-4 ${className}`} {...props}>
      {children}
    </div>
  );
}
