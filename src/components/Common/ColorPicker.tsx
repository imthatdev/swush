import { useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  TAG_COLOR_PALETTE,
  normalizeHexColor,
} from "@/lib/tag-colors";

type Props = {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  hint?: string;
};

export default function ColorPicker({
  id,
  label,
  value,
  onChange,
  disabled,
  hint,
}: Props) {
  const normalized = useMemo(
    () => normalizeHexColor(value) ?? "",
    [value]
  );
  const inputRef = useRef<HTMLInputElement | null>(null);

  const emit = (next: string | null) => {
    onChange(normalizeHexColor(next) ?? null);
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {value && (
          <button
            type="button"
            onClick={() => emit(null)}
            disabled={disabled}
            className="text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {TAG_COLOR_PALETTE.map((swatch) => {
          const selected = normalized === swatch.value;
          return (
            <button
              key={swatch.value}
              type="button"
              onClick={() => emit(swatch.value)}
              disabled={disabled}
              aria-pressed={selected}
              title={swatch.name}
              className={cn(
                "h-7 w-7 rounded-full border transition",
                selected
                  ? "ring-2 ring-foreground/70 border-foreground/40"
                  : "border-border/70 hover:scale-105",
                disabled && "opacity-50"
              )}
              style={{ backgroundColor: swatch.value }}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <Input
          ref={inputRef}
          id={id}
          type="color"
          value={normalized || "#000000"}
          onChange={(e) => emit(e.target.value)}
          disabled={disabled}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          aria-label={`${label} color picker`}
          className={cn(
            "h-10 w-10 rounded-full border border-border/70 shadow-sm transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            disabled && "opacity-50"
          )}
          style={{ backgroundColor: normalized || "#0f172a" }}
        />
        <div className="text-xs text-muted-foreground font-mono">
          {normalized || "No color"}
        </div>
      </div>
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
