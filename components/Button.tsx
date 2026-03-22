"use client";

import { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
}

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99]";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-teal-600 text-white shadow-sm hover:bg-teal-500 hover:shadow-md",
  secondary:
    "border border-[var(--border-soft)] bg-[var(--surface-2)] text-[var(--foreground)] hover:border-[var(--border-strong)]",
  ghost:
    "border border-transparent bg-transparent text-[var(--muted-text)] hover:border-[var(--border-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
};

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function Button({
  children,
  className,
  disabled,
  isLoading = false,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      className={joinClasses(BASE_CLASSES, VARIANT_CLASSES[variant], className)}
      {...props}
    >
      {isLoading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
