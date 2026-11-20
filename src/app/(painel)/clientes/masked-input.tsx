"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Input com máscara aplicada a cada digitação. O valor enviado ao servidor é o
 * texto formatado — as actions normalizam com `onlyDigits` antes de gravar.
 */
export function MaskedInput({
  id,
  label,
  name,
  mask,
  defaultValue = "",
  placeholder,
  inputMode = "numeric",
  required,
  onDigitsChange,
  hint,
}: {
  id: string;
  label: string;
  name: string;
  mask: (value: string) => string;
  defaultValue?: string | null;
  placeholder?: string;
  inputMode?: "numeric" | "text" | "tel";
  required?: boolean;
  /** Recebe a quantidade de dígitos sempre que o valor muda. */
  onDigitsChange?: (digits: string) => void;
  hint?: string;
}) {
  const [valor, setValor] = useState(() => mask(defaultValue ?? ""));

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        value={valor}
        onChange={(event) => {
          const formatado = mask(event.target.value);
          setValor(formatado);
          onDigitsChange?.(formatado.replace(/\D/g, ""));
        }}
        placeholder={placeholder}
        inputMode={inputMode}
        required={required}
        className="h-11"
      />
      {hint ? <p className="text-xs text-dim">{hint}</p> : null}
    </div>
  );
}
