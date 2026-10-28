import type React from "react";
import type { FC } from "react";
import { cn } from "@/utils";

interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "success" | "error" | "hint" | "step"
> {
  ref?: React.Ref<HTMLInputElement>;
  success?: boolean;
  error?: boolean;
  hint?: string;
  step?: number;
}

const Input: FC<InputProps> = ({
  type = "text",
  className,
  disabled = false,
  success = false,
  error = false,
  hint,
  "aria-invalid": ariaInvalid,
  ...props
}) => {
  const invalid = error || ariaInvalid === true || ariaInvalid === "true";
  const state = disabled
    ? "cursor-not-allowed border-gray-300 bg-gray-100 text-gray-500 opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
    : invalid
      ? "border-error-500 bg-error-50 text-gray-900 ring-1 ring-error-500/10 focus:border-error-600 focus:ring-error-500/20 dark:border-error-400 dark:bg-error-500/10 dark:text-gray-100 dark:focus:border-error-400"
      : success
        ? "border-success-500 bg-success-50/50 text-gray-800 focus:border-success-500 focus:ring-success-500/20 dark:border-success-500 dark:bg-success-500/10 dark:text-gray-100"
        : "border-gray-300 bg-white text-gray-800 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800";
  return (
    <div className="relative">
      <input
        {...props}
        type={type}
        disabled={disabled}
        aria-invalid={invalid || ariaInvalid || undefined}
        className={cn(
          "h-11 w-full appearance-none rounded-lg border px-4 py-2.5 text-sm shadow-theme-xs transition-colors outline-none placeholder:text-gray-400 focus:ring-3 dark:placeholder:text-white/30",
          state,
          className,
        )}
      />
      {hint && (
        <p
          className={cn(
            "mt-1.5 text-xs",
            invalid
              ? "text-error-600 dark:text-error-400"
              : success
                ? "text-success-600 dark:text-success-400"
                : "text-gray-500 dark:text-gray-400",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
};
export default Input;
