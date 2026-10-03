"use client";

import { useState, type ComponentProps } from "react";

type ZeroClearingNumberInputProps = Omit<
  ComponentProps<"input">,
  "onBlur" | "onChange" | "onFocus" | "type" | "value"
> & {
  value: number;
  onValueChange(value: number): void;
};

export function ZeroClearingNumberInput({
  value,
  onValueChange,
  ...props
}: ZeroClearingNumberInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      {...props}
      type="number"
      value={focused && value === 0 ? "" : value}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) => onValueChange(Number(event.currentTarget.value))}
    />
  );
}
