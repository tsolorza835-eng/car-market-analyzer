import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ApifyClient } from "apify-client";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ======================
// 🧱 HELPERS BASE
// ======================

function cleanText(input: any): string {
  return input ? String(input) : "";
}

// 💰 precio robusto
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

// 🚗 modelo
function extractModel(text: string): string | null {
  const t = cleanText(text);

  const match = t.match(
    /(nissan|toyota|chevrolet|mazda|hyundai|kia|subaru|bmw|audi|suzuki|ford)\s+[a-z0-9\-]+/i
  );

  return match ? match[0] : null;
}

// 📅 año
function extractYear(text: string): number | null {
  const t = cleanText(text);

  const match = t.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0]) : null;
}

// 🧱 fallback vacío seguro
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
// 🛡️ SCRAPER BLINDADO
// ======================

async function scrapeMarketplaceData(url: string) {
  try {
    const apify = new ApifyClient({
      token: process.env.APIFY_TOKEN,
    });

    const run = await apify.actor("apify/facebook-marketplace-scraper").call({
      startUrls: [{ url }],
      maxItems: 5, // 🔥 importante: varios items
    });

    const datasetId = run.defaultDatasetId;
    if (!datasetId) return emptyResult(url);

    const { items } = await apify.dataset(datasetId).listItems();

    if (!items || items.length === 0) {
      return emptyResult(url);
    }

    // 🔥 1. seleccionar mejor item disponible
    const bestItem =
      items.find((i: any) =>
        i?.title ||
        i?.price ||
        i?.description ||
        i?.text
      ) || items[0];

    // 🔥 2. unificar TODO el contenido posible
    const rawText = [
      bestItem?.title,
      bestItem?.name,
      bestItem?.price,
      bestItem?.description,
      bestItem?.text,
      bestItem?.primaryText,
      bestItem?.body,
      JSON.stringify(bestItem) // último fallback extremo
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
// 📊 MERCADO BLINDADO
// ======================

async function scrapeMarketComparison(url: string) {
  try {
    const apify = new ApifyClient({
      token: process.env.APIFY_TOKEN,
    });

    const run = await apify.actor("apify/facebook-marketplace-scraper").call({
      startUrls: [{ url }],
      maxItems: 80,
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
    const { url, patente } = await request.json();

    const carData = await scrapeMarketplaceData(url);
    const marketData = await scrapeMarketComparison(url);

    const prices = marketData.filter(
      (p): p is number => typeof p === "number"
    );

    const avgMarket =
      prices.length > 0
        ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
        : null;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Eres un analista profesional de autos en Chile.

REGLAS:
- NO inventes datos
- NO inventes riesgos
- NO inventes problemas legales
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
DATOS REALES DEL VEHÍCULO:

${JSON.stringify(carData, null, 2)}

📊 PROMEDIO MERCADO:
${avgMarket ?? "No disponible"}
`
        }
      ],
      temperature: 0.2,
    });

    const analysis =
      completion.choices[0]?.message?.content || "";

    return NextResponse.json({
      success: true,
      data: carData,
      analysis,
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