import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ApifyClient } from "apify-client";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type CarData = {
  titulo: string;
  precio: string;
  precioNum: number | null;
  modelo: string | null;
  anio: number | null;
  descripcion: string;
  ubicacion: string;
  url: string;
};

// 🔥 EXTRACCIÓN DE TEXTO LIMPIO
function cleanText(input: any): string {
  return input ? String(input) : "";
}

// 💰 EXTRACCIÓN ROBUSTA DE PRECIO
function extractPrice(input: any): number | null {
  const text = cleanText(input);
  if (!text) return null;

  const matches = text.match(/\d{1,3}(\.\d{3})+|\d{6,}/g);
  if (!matches) return null;

  const numbers = matches
    .map(n => parseInt(n.replace(/\./g, "")))
    .filter(n => !isNaN(n));

  if (!numbers.length) return null;

  return Math.min(...numbers);
}

// 🚗 DETECTAR MODELO
function extractModel(text: string): string | null {
  const t = cleanText(text);

  const match = t.match(
    /(nissan|toyota|chevrolet|mazda|hyundai|kia|subaru|bmw|audi|suzuki)\s+[a-z0-9\-]+/i
  );

  return match ? match[0] : null;
}

// 📅 DETECTAR AÑO
function extractYear(text: string): number | null {
  const t = cleanText(text);

  const match = t.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0]) : null;
}

// 🌎 SCRAPER ROBUSTO
async function scrapeMarketplaceData(url: string): Promise<CarData> {
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

// 📊 MERCADO CHILE
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

        const price = extractPrice(raw);
        return typeof price === "number" ? price : null;
      })
      .filter((p): p is number => typeof p === "number");
  } catch {
    return [];
  }
}

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

DEBES:
- Detectar modelo real
- Detectar año
- Detectar precio aunque venga oculto
- Comparar con mercado

FORMATO:

🚗 MODELO
📅 AÑO
💰 PRECIO PUBLICACIÓN
📊 PROMEDIO MERCADO
📉 PRECIO JUSTO COMPRA (70–80%)
⚖️ DIFERENCIA %
🎯 GANANCIA ESTIMADA
⚠️ RIESGOS
🏁 VEREDICTO
`
        },
        {
          role: "user",
          content: `
VEHÍCULO:
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

    const finalModel =
      carData.modelo ||
      extractModel(analysis) ||
      "No detectado";

    const finalYear =
      carData.anio ||
      extractYear(analysis) ||
      null;

    let finalAnalysis = analysis;

    if (patente) {
      finalAnalysis += `

🔗 VERIFICACIÓN
https://alertavehiculo.cl
https://www.aach.cl/CONREMATE/
`;
    }

    return NextResponse.json({
      success: true,
      data: carData,
      analysis: finalAnalysis,
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