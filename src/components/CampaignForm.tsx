"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createCampaign, updateCampaign } from "@/lib/actions/campaigns";
import { extractCampaign } from "@/lib/actions/ingest";
import { VENEZUELA_REGIONS, NEED_CATEGORIES, CAMPAIGN_TAGS } from "@/lib/constants";
import { formatMoney, formatPct } from "@/lib/format";
import type { ICampaign, TCampaignTag, TNeedCategory } from "@/types";

interface ICampaignRef {
  id: string;
  title: string;
}

function toNumber(raw: string): number {
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

interface ICampaignFormProps {
  campaign?: ICampaign;
}

interface IFormState {
  donation_url: string;
  title: string;
  region: string;
  category: TNeedCategory | "";
  tags: TCampaignTag[];
  description: string;
  payment_details: string;
  image_url: string;
  goal_amount: string;
  raised_amount: string;
  currency: string;
  // Baseline de los montos que leyó la IA al autocompletar (no editable por
  // el usuario). Se manda oculto para detectar manipulación posterior.
  ai_goal_amount: string;
  ai_raised_amount: string;
}

const fieldClass =
  "w-full rounded-lg border border-border bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

function initialState(campaign?: ICampaign): IFormState {
  return {
    donation_url: campaign?.donation_url ?? "",
    title: campaign?.title ?? "",
    region: campaign?.region ?? "",
    category: campaign?.category ?? "",
    tags: campaign?.tags ?? [],
    description: campaign?.description ?? "",
    payment_details: campaign?.payment_details ?? "",
    image_url: campaign?.image_url ?? "",
    goal_amount: campaign?.goal_amount != null ? String(campaign.goal_amount) : "",
    raised_amount:
      campaign?.raised_amount != null ? String(campaign.raised_amount) : "",
    currency: campaign?.currency ?? "USD",
    ai_goal_amount:
      campaign?.ai_goal_amount != null ? String(campaign.ai_goal_amount) : "",
    ai_raised_amount:
      campaign?.ai_raised_amount != null ? String(campaign.ai_raised_amount) : "",
  };
}

export function CampaignForm({ campaign }: ICampaignFormProps) {
  const isEdit = Boolean(campaign);
  const [form, setForm] = useState<IFormState>(initialState(campaign));
  const [error, setError] = useState<string | null>(null);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<ICampaignRef | null>(null);
  const [isExtracting, startExtract] = useTransition();
  const [isSaving, startSave] = useTransition();

  // Vista previa en vivo del progreso (recaudado vs meta).
  const goalNum = toNumber(form.goal_amount);
  const raisedNum = toNumber(form.raised_amount);
  const livePct = goalNum > 0 ? Math.min(raisedNum / goalNum, 1) : null;

  function set<K extends keyof IFormState>(key: K, value: IFormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTag(tag: TCampaignTag): void {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  }

  function handleExtract(): void {
    setError(null);
    setExtractMsg(null);
    setDuplicate(null);
    startExtract(async () => {
      const result = await extractCampaign(form.donation_url);
      setDuplicate(result.duplicate ?? null);
      if (result.error) {
        setExtractMsg(result.error);
        return;
      }
      const d = result.data!;
      setForm((prev) => ({
        ...prev,
        title: d.title ?? prev.title,
        description: d.description ?? prev.description,
        image_url: d.image_url ?? prev.image_url,
        goal_amount: d.goal_amount != null ? String(d.goal_amount) : prev.goal_amount,
        raised_amount:
          d.raised_amount != null ? String(d.raised_amount) : prev.raised_amount,
        currency: d.currency ?? prev.currency,
        // Congela lo que leyó la IA como referencia para el equipo moderador.
        ai_goal_amount:
          d.goal_amount != null ? String(d.goal_amount) : prev.ai_goal_amount,
        ai_raised_amount:
          d.raised_amount != null ? String(d.raised_amount) : prev.ai_raised_amount,
      }));
      setExtractMsg("Datos autocompletados. Revísalos y completa lo que falte.");
    });
  }

  function handleSubmit(formData: FormData): void {
    setError(null);
    setDuplicate(null);
    startSave(async () => {
      const result = campaign
        ? await updateCampaign(campaign.id, formData)
        : await createCampaign(formData);
      if (result?.existing) setDuplicate(result.existing);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {/* Ingesta simplificada: pegar enlace de GoFundMe y autocompletar */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
        <label htmlFor="donation_url" className="block text-sm font-medium">
          Enlace de GoFundMe
        </label>
        <div className="flex gap-2">
          <input
            id="donation_url"
            name="donation_url"
            type="text"
            inputMode="url"
            value={form.donation_url}
            onChange={(e) => set("donation_url", e.target.value)}
            placeholder="https://gofundme.com/f/… o https://gofund.me/…"
            className={fieldClass}
          />
          <button
            type="button"
            onClick={handleExtract}
            disabled={isExtracting || !form.donation_url.trim()}
            className="shrink-0 rounded-lg bg-primary text-primary-foreground px-4 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {isExtracting ? "Leyendo…" : "Autocompletar"}
          </button>
        </div>
        <p className="text-xs text-muted">
          Trae automáticamente el <strong>título</strong>, la{" "}
          <strong>imagen</strong> y los <strong>montos</strong> de tu GoFundMe.
          Luego puedes editarlos.
        </p>
        {extractMsg && <p className="text-xs text-trust">{extractMsg}</p>}
      </div>

      {duplicate && (
        <div
          className="rounded-xl border border-distrust/40 bg-distrust/5 p-3 text-sm"
          role="alert"
        >
          <p className="font-medium text-distrust">
            Esta campaña de GoFundMe ya está publicada.
          </p>
          <p className="text-muted mt-0.5">
            Para evitar duplicados, no se puede montar dos veces.{" "}
            <Link
              href={`/campana/${duplicate.id}`}
              className="text-primary underline underline-offset-2"
            >
              Ver «{duplicate.title}»
            </Link>
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="title" className="block text-sm font-medium">
          Título de la campaña
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          minLength={5}
          maxLength={140}
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Ej: Ayuda para familias en Mérida"
          className={fieldClass}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="category" className="block text-sm font-medium">
            Categoría de necesidad
          </label>
          <select
            id="category"
            name="category"
            required
            value={form.category}
            onChange={(e) => set("category", e.target.value as TNeedCategory)}
            className={fieldClass}
          >
            <option value="" disabled>
              Selecciona
            </option>
            {NEED_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="region" className="block text-sm font-medium">
            Región afectada
          </label>
          <select
            id="region"
            name="region"
            required
            value={form.region}
            onChange={(e) => set("region", e.target.value)}
            className={fieldClass}
          >
            <option value="" disabled>
              Selecciona un estado
            </option>
            {VENEZUELA_REGIONS.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Etiquetas{" "}
          <span className="text-muted font-normal">
            (opcional — subclasifican la campaña)
          </span>
        </legend>
        <p className="text-xs text-muted">
          Marca las que apliquen. Ayudan a quien busca un caso específico (p.
          ej. servicios funerarios de un niño o de un adulto mayor).
        </p>
        {/* Viajan en el envío como múltiples campos name="tags". */}
        {form.tags.map((tag) => (
          <input key={tag} type="hidden" name="tags" value={tag} />
        ))}
        <div className="flex flex-wrap gap-2">
          {CAMPAIGN_TAGS.map((t) => {
            const active = form.tags.includes(t.value);
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => toggleTag(t.value)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border bg-card text-muted hover:border-primary/50"
                }`}
              >
                <span aria-hidden>{t.emoji}</span> {t.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="description" className="block text-sm font-medium">
          Descripción
        </label>
        <textarea
          id="description"
          name="description"
          required
          minLength={20}
          maxLength={5000}
          rows={6}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Explica a quién ayuda, qué se necesita y cómo se usarán los fondos."
          className={`${fieldClass} resize-y`}
        />
      </div>

      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-3">
        {/* Baseline IA: no editable, viaja oculto para moderación. */}
        <input type="hidden" name="ai_goal_amount" value={form.ai_goal_amount} />
        <input
          type="hidden"
          name="ai_raised_amount"
          value={form.ai_raised_amount}
        />
        <div>
          <p className="text-sm font-medium">Meta y recaudado</p>
          <p className="text-xs text-muted">
            Clave para los donantes: muestra cuánto falta. Prioriza las
            campañas más lejos de su meta.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="goal_amount" className="block text-sm font-medium">
              Meta
            </label>
            <input
              id="goal_amount"
              name="goal_amount"
              type="text"
              inputMode="decimal"
              value={form.goal_amount}
              onChange={(e) => set("goal_amount", e.target.value)}
              placeholder="5000"
              className={fieldClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="raised_amount" className="block text-sm font-medium">
              Recaudado
            </label>
            <input
              id="raised_amount"
              name="raised_amount"
              type="text"
              inputMode="decimal"
              value={form.raised_amount}
              onChange={(e) => set("raised_amount", e.target.value)}
              placeholder="0"
              className={fieldClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="currency" className="block text-sm font-medium">
              Moneda
            </label>
            <input
              id="currency"
              name="currency"
              type="text"
              maxLength={3}
              value={form.currency}
              onChange={(e) => set("currency", e.target.value.toUpperCase())}
              placeholder="USD"
              className={fieldClass}
            />
          </div>
        </div>

        {goalNum > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="h-2 w-full rounded-full bg-background overflow-hidden border border-border">
              <div
                className="h-full rounded-full bg-trust transition-[width] duration-300"
                style={{ width: `${Math.round((livePct ?? 0) * 100)}%` }}
              />
            </div>
            <p className="text-xs tabular-nums">
              <span className="text-trust font-semibold">
                {formatMoney(raisedNum, form.currency || "USD")}
              </span>{" "}
              <span className="text-muted">
                de {formatMoney(goalNum, form.currency || "USD")} ·{" "}
                {livePct !== null ? formatPct(livePct) : ""} de la meta
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="payment_details" className="block text-sm font-medium">
          Datos de pago alternativos{" "}
          <span className="text-muted font-normal">
            (pago móvil, Zelle… opcional)
          </span>
        </label>
        <textarea
          id="payment_details"
          name="payment_details"
          rows={2}
          value={form.payment_details}
          onChange={(e) => set("payment_details", e.target.value)}
          placeholder="Ej: Pago móvil 0414-1234567 · Banesco · C.I. V-12.345.678"
          className={`${fieldClass} resize-y`}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="image_url" className="block text-sm font-medium">
          Imagen{" "}
          <span className="text-muted font-normal">
            — la de tu GoFundMe, o pega otra URL
          </span>
        </label>
        <input
          id="image_url"
          name="image_url"
          type="text"
          inputMode="url"
          value={form.image_url}
          onChange={(e) => set("image_url", e.target.value)}
          placeholder="https://..."
          className={fieldClass}
        />
        {form.image_url.trim() ? (
          <figure className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={form.image_url}
              src={form.image_url}
              alt="Vista previa de la imagen de la campaña"
              className="w-full max-h-56 object-cover rounded-xl border border-border"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <figcaption className="text-xs text-muted mt-1">
              Así se verá la imagen de tu campaña.
            </figcaption>
          </figure>
        ) : (
          <p className="text-xs text-muted">
            Sin imagen se mostrará un ícono según la categoría.
          </p>
        )}
      </div>

      <p className="text-xs text-muted">
        Debes incluir un enlace de GoFundMe o datos de pago alternativos. Al
        publicar, un filtro de IA revisa la relevancia y posibles duplicados
        antes de la verificación humana.
      </p>

      {error && (
        <p className="text-sm text-distrust" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSaving}
        className="w-full rounded-lg bg-primary text-primary-foreground py-3 font-medium hover:opacity-90 disabled:opacity-50"
      >
        {isSaving
          ? "Guardando…"
          : isEdit
            ? "Guardar cambios"
            : "Publicar campaña"}
      </button>
    </form>
  );
}
