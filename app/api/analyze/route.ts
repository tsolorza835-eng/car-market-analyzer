import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ApifyClient } from "apify-client";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🔥 limpiar precio correctamente
function extractPrice(price: any): number | null {
  if (!price) return null;

  const cleaned = String(price).replace(/[^0-9]/g, "");
  const num = parseInt(cleaned);

  return isNaN(num) ? null : num;
}

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
    const item: any = items[0];

    return {
      titulo: item.title || "",
      precio: item.price || "",
      precioNum: extractPrice(item.price),
      descripcion: item.description || "",
      ubicacion: item.location || "",
      kilometraje: item.mileage || "",
      anio: item.year || "",
      marca: item.make || "",
      modelo: item.model || "",
      url,
    };
  } catch {
    return {
      titulo: "",
      precio: "",
      precioNum: null,
      descripcion: "",
      ubicacion: "",
      kilometraje: "",
      anio: "",
      marca: "",
      modelo: "",
      url,
    };
  }
}

// 🌎 mercado completo Chile
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

    if (!items || items.length === 0) return [];

    // 🔥 limpiar precios válidos
    const cleaned = items
      .map((item: any) => ({
        precio: extractPrice(item.price),
      }))
      .filter((x: any) => typeof x.precio === "number" && !isNaN(x.precio));

    return cleaned;
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

    // 🔥 FIX DEFINITIVO TYPESCRIPT SAFE
    const prices: number[] = marketData
      .map((x) => x.precio)
      .filter((p): p is number => typeof p === "number" && !isNaN(p));

    const avgMarket =
      prices.length > 0
        ? Math.round(
            prices.reduce((a, b) => a + b, 0) / prices.length
          )
        : null;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Eres un experto en compra y venta de autos en Chile.

OBLIGATORIO:
- Detectar precio del post
- Comparar con promedio real del mercado chileno (Facebook Marketplace)
- Calcular diferencia en porcentaje
- Dar precio máximo con 20–30% ganancia

FORMATO:

🚗 MODELO: ...
📅 AÑO: ...
💰 PRECIO PUBLICACIÓN: ...
📊 PROMEDIO MERCADO CHILE: ...
⚖️ DIFERENCIA (%): ...
🎯 PRECIO MÁXIMO COMPRA: ...
⚠️ RIESGOS: ...
🏁 VEREDICTO: ...
`
        },
        {
          role: "user",
          content: `
VEHÍCULO:
${JSON.stringify(fullData, null, 2)}

📊 PROMEDIO MERCADO CHILE:
${avgMarket ?? "No disponible"}
`
        }
      ],
      temperature: 0.2,
    });

    const analysis =
      completion.choices[0]?.message?.content || "";

    const modeloDetectado =
      analysis.match(/MODELO[:\- ]*(.*)/i)?.[1]?.trim() ||
      fullData.modelo ||
      fullData.marca ||
      "";

    let finalAnalysis = analysis;

    if (patente) {
      finalAnalysis += `

🔗 ENLACES

🔍 Alerta Vehículo:
https://alertavehiculo.cl

🛡️ AACH:
https://www.aach.cl/CONREMATE/
`;
    }

    return NextResponse.json({
      success: true,
      data: fullData,
      analysis: finalAnalysis,
      modeloDetectado,
      avgMarketPrice: avgMarket,
      marketCount: marketData.length,
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}