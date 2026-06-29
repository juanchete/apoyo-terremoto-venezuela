interface IGoFundMeBadgeProps {
  size?: "sm" | "md";
}

// Marca de origen: la campaña viene de una página oficial de GoFundMe.
export function GoFundMeBadge({ size = "sm" }: IGoFundMeBadgeProps) {
  const text = size === "sm" ? "text-xs" : "text-sm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-background border border-border px-2.5 py-1 font-medium ${text}`}
      title="Campaña alojada en GoFundMe"
    >
      <span aria-hidden className="size-2 rounded-full bg-[#02a95c]" />
      GoFundMe
    </span>
  );
}
