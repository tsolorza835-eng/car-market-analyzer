import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ApifyClient } from "apify-client";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ======================
// 🔥 UTILIDADES BASE
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

// 🚗 modelo robusto
function extractModel(text: string): string | null {
  const t = cleanText(text);

  const match = t.match(
    /(nissan|toyota|chevrolet|mazda|hyundai|kia|subaru|bmw|audi|suzuki|ford)\s+[a-z0-9\-]+/i
  );

  return match ? match[0] : null;
}

// 📅 año robusto
function extractYear(text: string): number | null {
  const t = cleanText(text);
  const match = t.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0]) : null;
}

// ======================
// 🌎 SCRAPER ROBUSTO
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
    const item: any = items?.[0] || {};

    const rawText =
      item?.price ||
      item?.title ||
      item?.description ||
      item?.primaryText ||
      item?.body ||
      item?.text ||
      "";

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
      titulo: "",
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
        const raw =
          item?.price ||
          item?.title ||
          item?.description ||
          "";

        return extractPrice(raw);
      })
      .filter((p): p is number => typeof p === "number");
  } catch {
    return [];
  }
}

// ======================
// 🚨 SANITIZADOR FINAL
// (EVITA INVENTOS DE IA)
// ======================

function sanitizeAnalysis(text: string) {
  return text
    .replace(/vehículo para desarme/gi, "venta normal")
    .replace(/desarme/gi, "uso general")
    .replace(/inscripción anulada/gi, "no verificado")
    .replace(/problemas legales/gi, "información no disponible");
}

// ======================
// 🚀 API MAIN
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

    // ======================
    // 🧠 IA CONTROLADA
    // ======================

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Eres un analista profesional de autos en Chile.

REGLAS OBLIGATORIAS:
- NO inventes riesgos legales
- NO asumas "desarme"
- NO asumas problemas mecánicos
- Si no hay datos → "No disponible"

Solo analiza información REAL entregada.

FORMATO:

🚗 MODELO
📅 AÑO
💰 PRECIO PUBLICACIÓN
📊 PROMEDIO MERCADO
📉 PRECIO JUSTO COMPRA (70–80%)
⚖️ DIFERENCIA %
🎯 GANANCIA ESTIMADA
⚠️ RIESGOS (solo si están en datos)
🏁 VEREDICTO
`
        },
        {
          role: "user",
          content: `
VEHÍCULO (DATOS REALES):

Modelo: ${carData.modelo ?? "No disponible"}
Año: ${carData.anio ?? "No disponible"}
Precio: ${carData.precioNum ?? "No disponible"}
Descripción: ${carData.descripcion ?? "No disponible"}
Ubicación: ${carData.ubicacion ?? "No disponible"}

📊 MERCADO PROMEDIO:
${avgMarket ?? "No disponible"}
`
        }
      ],
      temperature: 0.2,
    });

    let analysis =
      completion.choices[0]?.message?.content || "";

    // ======================
    // 🧹 LIMPIEZA FINAL
    // ======================

    analysis = sanitizeAnalysis(analysis);

    const finalModel = carData.modelo || "No detectado";
    const finalYear = carData.anio || null;

    if (patente) {
      analysis += `

🔗 VERIFICACIÓN
https://alertavehiculo.cl
https://www.aach.cl/CONREMATE/
`;
    }

    return NextResponse.json({
      success: true,
      data: carData,
      analysis,
      modeloDetectado: finalModel,
      anioDetectado: finalYear,
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