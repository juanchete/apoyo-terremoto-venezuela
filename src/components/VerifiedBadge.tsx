interface IVerifiedBadgeProps {
  size?: "sm" | "md";
}

export function VerifiedBadge({ size = "sm" }: IVerifiedBadgeProps) {
  const text = size === "sm" ? "text-xs" : "text-sm";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-verified/10 text-verified font-medium px-2 py-0.5 ${text}`}
      title="Sello de verificación humana otorgado por el equipo de voluntarios"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="w-3.5 h-3.5 fill-current"
      >
        <path d="M12 2l2.4 1.8 3 .1 1 2.8 2.4 1.7-.9 2.9.9 2.9-2.4 1.7-1 2.8-3 .1L12 22l-2.4-1.8-3-.1-1-2.8L3.2 15l.9-2.9-.9-2.9 2.4-1.7 1-2.8 3-.1L12 2zm-1.1 13.2l5-5-1.4-1.4-3.6 3.6-1.6-1.6L7.9 12l3 3.2z" />
      </svg>
      Verificación humana
    </span>
  );
}
