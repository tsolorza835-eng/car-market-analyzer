import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ApifyClient } from "apify-client";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🔥 EXTRACCIÓN ROBUSTA DE PRECIO
function extractPrice(input: any): number | null {
  if (!input) return null;

  const text = String(input);

  const matches = text.match(/\d{1,3}(\.\d{3})+|\d{6,}/g);

  if (!matches || matches.length === 0) return null;

  const numbers = matches.map(n => parseInt(n.replace(/\./g, "")));

  const valid = numbers.filter(n => !isNaN(n));

  if (valid.length === 0) return null;

  return Math.min(...valid);
}

// 🚗 DETECTAR MODELO + MARCA
function extractModel(text: string): string | null {
  if (!text) return null;

  const match = text.match(
    /(nissan|toyota|chevrolet|mazda|hyundai|kia|subaru|bmw|audi|suzuki)\s+[a-z0-9\-]+/i
  );

  return match ? match[0] : null;
}

// 📅 DETECTAR AÑO
function extractYear(text: string): number | null {
  if (!text) return null;

  const match = text.match(/\b(19|20)\d{2}\b/);

  return match ? parseInt(match[0]) : null;
}

// 🌎 SCRAPER PRINCIPAL
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

    const rawText =
      item?.price ||
      item?.title ||
      item?.description ||
      item?.primaryText ||
      item?.body ||
      item?.text ||
      "";

    return {
      titulo: item?.title || extractModel(rawText) || "",
      precio: rawText,
      precioNum: extractPrice(rawText),
      modelo: extractModel(rawText),
      anio: extractYear(rawText),
      descripcion: item?.description || "",
      ubicacion: item?.location || "",
      kilometraje: item?.mileage || "",
      marca: item?.make || "",
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
      kilometraje: "",
      marca: "",
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
      maxItems: 100,
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
      .filter((p): p is number => typeof p === "number" && !isNaN(p));

  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const { url, patente } = await request.json();

    const carData = await scrapeMarketplaceData(url);
    const marketData = await scrapeMarketComparison(url);

    const fullData = {
      ...carData,
      patente: patente || "No proporcionada",
    };

    // 📊 PROMEDIO MERCADO
    const prices: number[] = marketData.filter(
      (p): p is number => typeof p === "number" && !isNaN(p)
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
Eres un experto en análisis de autos en Chile.

DEBES:
- Detectar modelo
- Detectar año
- Detectar precio real
- Comparar con mercado

FORMATO:

🚗 MODELO: ...
📅 AÑO: ...
💰 PRECIO PUBLICACIÓN: ...
📊 PROMEDIO MERCADO CHILE: ...
📉 PRECIO JUSTO DE COMPRA: ...
⚖️ DIFERENCIA (%): ...
🎯 GANANCIA ESTIMADA: ...
⚠️ RIESGOS: ...
🏁 VEREDICTO: ...
`
        },
        {
          role: "user",
          content: `
DATOS DEL VEHÍCULO:
${JSON.stringify(fullData, null, 2)}

📊 MERCADO:
${avgMarket ?? "No disponible"}
`
        }
      ],
      temperature: 0.2,
    });

    const analysis =
      completion.choices[0]?.message?.content || "";

    const modeloDetectado =
      fullData.modelo ||
      analysis.match(/MODELO[:\- ]*(.*)/i)?.[1]?.trim() ||
      "";

    const anioDetectado =
      fullData.anio ||
      analysis.match(/AÑO[:\- ]*(.*)/i)?.[1]?.trim() ||
      "";

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
      data: fullData,
      analysis: finalAnalysis,
      modeloDetectado,
      anioDetectado,
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