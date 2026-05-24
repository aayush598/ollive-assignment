import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
        <input
          ref={ref}
          className={`block w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 ${
            error ? "border-red-500" : "border-gray-300"
          } ${className}`}
          {...props}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";
