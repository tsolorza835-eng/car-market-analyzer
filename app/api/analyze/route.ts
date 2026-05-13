import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ApifyClient } from "apify-client";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ======================
// 🔥 HELPERS
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

// ======================
// 🌎 SCRAPER SEGURO
// ======================

async function scrapeMarketplaceData(url: string) {
  try {
    const apify = new ApifyClient({
      token: process.env.APIFY_TOKEN,
    });

    const run = await apify.actor("apify/facebook-marketplace-scraper").call({
      startUrls: [{ url }],
      maxItems: 1,
    });

    const datasetId = run.defaultDatasetId;
    if (!datasetId) throw new Error("No dataset");

    const { items } = await apify.dataset(datasetId).listItems();

    const item: any = items?.[0];

    if (!item) {
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

    // 🔥 FIX CRÍTICO: UNIFICAR TODO EN TEXTO REAL
    const rawText = [
      item?.title,
      item?.name,
      item?.price,
      item?.description,
      item?.text,
      item?.primaryText,
      item?.body
    ]
      .filter(Boolean)
      .join(" ");

    // 🔥 si no hay texto real, no inventar nada
    if (!rawText || rawText.trim().length < 3) {
      return {
        titulo: item?.title || "No detectado",
        precio: "",
        precioNum: null,
        modelo: null,
        anio: null,
        descripcion: "",
        ubicacion: "",
        url,
      };
    }

    return {
      titulo: item?.title || extractModel(rawText) || "No detectado",
      precio: rawText,
      precioNum: extractPrice(rawText),
      modelo: extractModel(rawText),
      anio: extractYear(rawText),
      descripcion: item?.description || "",
      ubicacion: item?.location || "",
      url,
    };

  } catch {
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
}

// ======================
// 📊 MERCADO
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
        ].filter(Boolean).join(" ");

        return extractPrice(raw);
      })
      .filter((p): p is number => typeof p === "number");

  } catch {
    return [];
  }
}

// ======================
// 🚀 API
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
⚠️ RIESGOS (solo si existen)
🏁 VEREDICTO
`
        },
        {
          role: "user",
          content: `
DATOS REALES:

${JSON.stringify(carData, null, 2)}

📊 MERCADO:
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