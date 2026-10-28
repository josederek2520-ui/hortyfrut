import { ButtonHTMLAttributes, ReactNode, Ref } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
  children: ReactNode; // Button text or content
  size?: "sm" | "md"; // Button size
  variant?: "primary" | "outline" | "danger"; // Button variant
  startIcon?: ReactNode; // Icon before the text
  endIcon?: ReactNode; // Icon after the text
  onClick?: () => void; // Click handler
  disabled?: boolean; // Disabled state
  className?: string; // Disabled state
}

const Button: React.FC<ButtonProps> = ({
  children,
  size = "md",
  variant = "primary",
  startIcon,
  endIcon,
  onClick,
  className = "",
  disabled = false,
  type = "button",
  ...props
}) => {
  // Size Classes
  const sizeClasses = {
    sm: "px-4 py-3 text-sm",
    md: "px-5 py-3.5 text-sm",
  };

  // Variant Classes
  const variantClasses = {
    primary:
      "boton-principal-hortyfru bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300",
    outline:
      "boton-secundario-hortyfru bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-white/3 dark:hover:text-gray-200",
    danger:
      "bg-error-500 text-white shadow-theme-xs hover:bg-error-600 disabled:bg-error-300 focus-visible:ring-error-500/30",
  };

  const esSelector =
    props["aria-pressed"] !== undefined && variant !== "danger";

  return (
    <button
      {...props}
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition focus-visible:ring-3 focus-visible:ring-brand-500/30 focus-visible:outline-none ${className} ${
        sizeClasses[size]
      } ${esSelector ? "pestana-hortyfru" : variantClasses[variant]} ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
      onClick={onClick}
      disabled={disabled}
    >
      {startIcon && (
        <span
          aria-hidden="true"
          className="inline-flex shrink-0 items-center justify-center"
        >
          {startIcon}
        </span>
      )}
      {children}
      {endIcon && (
        <span
          aria-hidden="true"
          className="inline-flex shrink-0 items-center justify-center"
        >
          {endIcon}
        </span>
      )}
    </button>
  );
};

export default Button;
