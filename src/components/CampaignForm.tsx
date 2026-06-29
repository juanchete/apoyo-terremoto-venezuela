"use client";

import { useState, useTransition } from "react";
import { createCampaign, updateCampaign } from "@/lib/actions/campaigns";
import { extractCampaign } from "@/lib/actions/ingest";
import { VENEZUELA_REGIONS, NEED_CATEGORIES } from "@/lib/constants";
import type { ICampaign, TNeedCategory } from "@/types";

interface ICampaignFormProps {
  campaign?: ICampaign;
}

interface IFormState {
  donation_url: string;
  title: string;
  region: string;
  category: TNeedCategory | "";
  description: string;
  payment_details: string;
  image_url: string;
  goal_amount: string;
  raised_amount: string;
  currency: string;
}

const fieldClass =
  "w-full rounded-lg border border-border bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

function initialState(campaign?: ICampaign): IFormState {
  return {
    donation_url: campaign?.donation_url ?? "",
    title: campaign?.title ?? "",
    region: campaign?.region ?? "",
    category: campaign?.category ?? "",
    description: campaign?.description ?? "",
    payment_details: campaign?.payment_details ?? "",
    image_url: campaign?.image_url ?? "",
    goal_amount: campaign?.goal_amount != null ? String(campaign.goal_amount) : "",
    raised_amount:
      campaign?.raised_amount != null ? String(campaign.raised_amount) : "",
    currency: campaign?.currency ?? "USD",
  };
}

export function CampaignForm({ campaign }: ICampaignFormProps) {
  const isEdit = Boolean(campaign);
  const [form, setForm] = useState<IFormState>(initialState(campaign));
  const [error, setError] = useState<string | null>(null);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);
  const [isExtracting, startExtract] = useTransition();
  const [isSaving, startSave] = useTransition();

  function set<K extends keyof IFormState>(key: K, value: IFormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleExtract(): void {
    setError(null);
    setExtractMsg(null);
    startExtract(async () => {
      const result = await extractCampaign(form.donation_url);
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
      }));
      setExtractMsg("Datos autocompletados. Revísalos y completa lo que falte.");
    });
  }

  function handleSubmit(formData: FormData): void {
    setError(null);
    startSave(async () => {
      const result = campaign
        ? await updateCampaign(campaign.id, formData)
        : await createCampaign(formData);
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
            placeholder="https://gofundme.com/f/..."
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
        {extractMsg && <p className="text-xs text-muted">{extractMsg}</p>}
      </div>

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
          Imagen <span className="text-muted font-normal">(URL, opcional)</span>
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
