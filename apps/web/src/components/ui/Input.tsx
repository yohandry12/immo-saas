import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { useId } from "react";

const fieldBase =
  "block w-full rounded-lg border border-bebe bg-white px-12 h-40 text-[14px] text-hof placeholder:text-grey-500 focus:outline-none focus:border-hof disabled:bg-faint disabled:text-foggy";

type WithLabel = { label?: string; error?: string };

export function Input({
  label,
  error,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & WithLabel) {
  const id = useId();
  return (
    <div className="flex flex-col gap-4">
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-hof">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`${fieldBase} ${error ? "border-rausch-600" : ""} ${className}`}
        {...props}
      />
      {error && <p className="text-[12px] text-rausch-600">{error}</p>}
    </div>
  );
}

export function Select({
  label,
  error,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & WithLabel) {
  const id = useId();
  return (
    <div className="flex flex-col gap-4">
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-hof">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`${fieldBase} ${error ? "border-rausch-600" : ""} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-[12px] text-rausch-600">{error}</p>}
    </div>
  );
}
