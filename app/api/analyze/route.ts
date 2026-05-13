import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ApifyClient } from "apify-client";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ======================
// 🧱 HELPERS
// ======================

function cleanText(input: any): string {
  return input ? String(input) : "";
}

function extractPrice(input: any): number | null {
  const text = cleanText(input);
  if (!text) return null;

  const matches = text.match(/\d{1,3}(\.\d{3})+|\d{6,}/g);
  if (!matches) return null;

  const numbers = matches
    .map(n => parseInt(n.replace(/\./g, "")))
    .filter(n => !isNaN(n));

  return numbers.length ? Math.min(...numbers) : null;
}

function extractModel(text: string): string | null {
  const t = cleanText(text);

  const match = t.match(
    /(nissan|toyota|chevrolet|mazda|hyundai|kia|subaru|bmw|audi|suzuki|ford)\s+[a-z0-9\-]+/i
  );

  return match ? match[0] : null;
}

function extractYear(text: string): number | null {
  const t = cleanText(text);

  const match = t.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0]) : null;
}

function emptyResult(url: string) {
  return {
    titulo: "No detectado",
    precio: "",
    precioNum: null,
    modelo: null,
    anio: null,
    descripcion: "",
    ubicacion: "",
    url,
  };
}

// ======================
// 🚗 SCRAPER POST INDIVIDUAL (BLINDADO)
// ======================

async function scrapeMarketplaceData(url: string) {
  try {
    const apify = new ApifyClient({
      token: process.env.APIFY_TOKEN,
    });

    const run = await apify.actor("apify/facebook-marketplace-scraper").call({
      startUrls: [{ url }],
      maxItems: 5,
    });

    const datasetId = run.defaultDatasetId;
    if (!datasetId) return emptyResult(url);

    const { items } = await apify.dataset(datasetId).listItems();

    if (!items || items.length === 0) return emptyResult(url);

    const bestItem =
      items.find((i: any) =>
        i?.title || i?.price || i?.description || i?.text
      ) || items[0];

    const rawText = [
      bestItem?.title,
      bestItem?.name,
      bestItem?.price,
      bestItem?.description,
      bestItem?.text,
      bestItem?.primaryText,
      bestItem?.body,
      JSON.stringify(bestItem)
    ]
      .filter(Boolean)
      .join(" ");

    if (!rawText || rawText.trim().length < 3) {
      return emptyResult(url);
    }

    return {
      titulo: extractModel(rawText) || bestItem?.title || "No detectado",
      precio: rawText,
      precioNum: extractPrice(rawText),
      modelo: extractModel(rawText),
      anio: extractYear(rawText),
      descripcion: bestItem?.description || "",
      ubicacion: bestItem?.location || "",
      url,
    };

  } catch {
    return emptyResult(url);
  }
}

// ======================
// 📊 MERCADO REAL (FIX IMPORTANTE)
// ======================

async function scrapeMarketComparisonByModel(model: string | null, year: number | null) {
  try {
    if (!model) return [];

    const apify = new ApifyClient({
      token: process.env.APIFY_TOKEN,
    });

    const searchQuery = `${model} ${year ?? ""} chile`;

    const run = await apify.actor("apify/facebook-marketplace-scraper").call({
      search: searchQuery,
      maxItems: 50,
    });

    const datasetId = run.defaultDatasetId;
    if (!datasetId) return [];

    const { items } = await apify.dataset(datasetId).listItems();

    return (items || [])
      .map((item: any) => {
        const raw = [
          item?.price,
          item?.title,
          item?.description
        ]
          .filter(Boolean)
          .join(" ");

        return extractPrice(raw);
      })
      .filter((p): p is number => typeof p === "number");

  } catch {
    return [];
  }
}

// ======================
// 🚀 API PRINCIPAL
// ======================

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    // 🚗 1. POST INDIVIDUAL
    const carData = await scrapeMarketplaceData(url);

    // 📊 2. MERCADO REAL (POR MODELO, NO POR URL)
    const marketData = await scrapeMarketComparisonByModel(
      carData.modelo,
      carData.anio
    );

    const prices = marketData.filter(
      (p): p is number => typeof p === "number"
    );

    const avgMarket =
      prices.length > 0
        ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
        : null;

    // 🤖 3. IA ANALYST
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Eres un analista de autos en Chile.

REGLAS:
- NO inventes datos
- NO inventes riesgos
- Si falta info → "No disponible"

FORMATO:

🚗 MODELO
📅 AÑO
💰 PRECIO PUBLICACIÓN
📊 PROMEDIO MERCADO
📉 PRECIO JUSTO COMPRA
⚖️ DIFERENCIA %
🎯 GANANCIA
⚠️ RIESGOS (solo si existen datos reales)
🏁 VEREDICTO
`
        },
        {
          role: "user",
          content: `
DATOS VEHÍCULO:

${JSON.stringify(carData, null, 2)}

📊 MERCADO:
${avgMarket ?? "No disponible"}
`
        }
      ],
      temperature: 0.2,
    });

    return NextResponse.json({
      success: true,
      data: carData,
      analysis: completion.choices[0]?.message?.content || "",
      modeloDetectado: carData.modelo,
      anioDetectado: carData.anio,
      avgMarketPrice: avgMarket,
      marketCount: prices.length,
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}