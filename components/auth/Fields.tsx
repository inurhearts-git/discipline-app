"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
}

// Labelled input for the sign-in screens. Password fields get a show/hide toggle.
export function Field({ label, hint, type = "text", id, ...rest }: FieldProps) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const fieldId = id ?? `f-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div className="au-field">
      <label className="au-label" htmlFor={fieldId}>
        {label}
      </label>
      <input id={fieldId} className={`au-input${isPassword ? " has-trail" : ""}`} type={isPassword && show ? "text" : type} {...rest} />
      {isPassword && (
        <button type="button" className="au-trail" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
      {hint && <p className="au-hint">{hint}</p>}
    </div>
  );
}

export function SubmitButton({ loading, children, loadingText, disabled }: { loading: boolean; children: ReactNode; loadingText: string; disabled?: boolean }) {
  return (
    <button type="submit" className="au-btn" disabled={disabled || loading} aria-busy={loading}>
      {loading && <span className="au-spinner" aria-hidden />}
      {loading ? loadingText : children}
    </button>
  );
}

// Re-keyed on each new message so the shake replays.
export function FormError({ message, attempt }: { message: string; attempt: number }) {
  if (!message) return null;
  return (
    <p key={attempt} className="au-error" role="alert">
      {message}
    </p>
  );
}
