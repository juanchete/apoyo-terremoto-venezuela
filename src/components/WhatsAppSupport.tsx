import { WHATSAPP_SUPPORT_NUMBER } from "@/lib/constants";

interface IWhatsAppSupportProps {
  message?: string;
}

// Botón de soporte directo para guiar a las familias (PRD, sección 4).
// Solo se muestra si hay un número configurado (NEXT_PUBLIC_WHATSAPP_SUPPORT).
export function WhatsAppSupport({
  message = "Hola, necesito ayuda para crear mi campaña de GoFundMe por el terremoto.",
}: IWhatsAppSupportProps) {
  if (!WHATSAPP_SUPPORT_NUMBER) return null;

  const href = `https://wa.me/${WHATSAPP_SUPPORT_NUMBER}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-trust/40 bg-trust/5 p-4 hover:bg-trust/10 transition-colors"
    >
      <span aria-hidden className="text-2xl">💬</span>
      <span className="text-sm">
        <strong className="block">¿Necesitas ayuda para crear tu campaña?</strong>
        <span className="text-muted">
          Un voluntario te guía paso a paso por WhatsApp.
        </span>
      </span>
    </a>
  );
}
