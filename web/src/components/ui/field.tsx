import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Shared look for Input, Select and Textarea. aria-invalid turns the border red.
const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted transition-colors hover:border-border-strong focus-visible:border-ring disabled:opacity-50 aria-[invalid=true]:border-danger";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(FIELD, "h-9", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(FIELD, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(FIELD, "min-h-20 py-2", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-xs font-semibold text-foreground", className)} {...props} />;
}

// Renders nothing without a message. Point the field's aria-describedby at its id.
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="text-xs text-danger">
      {message}
    </p>
  );
}

// A form-level message (not tied to one field). role="alert" announces it when it appears.
export function FormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p role="alert" className="text-xs text-danger">
      {message}
    </p>
  );
}
