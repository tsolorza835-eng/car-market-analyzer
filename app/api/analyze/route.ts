import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ApifyClient } from "apify-client";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🔥 extracción robusta de precios
function extractPrice(input: any): number | null {
  if (!input) return null;

  const text = String(input);

  const matches = text.match(/\d{1,3}(\.\d{3})+|\d{5,}/g);

  if (!matches || matches.length === 0) return null;

  const numbers = matches.map((n) =>
    parseInt(n.replace(/\./g, "").replace(/,/g, ""))
  );

  const valid = numbers.filter((n) => !isNaN(n));

  if (valid.length === 0) return null;

  return Math.max(...valid);
}

// 🌎 scrape vehículo principal
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
      "";

    return {
      titulo: item?.title || "",
      precio: rawText,
      precioNum: extractPrice(rawText),
      descripcion: item?.description || "",
      ubicacion: item?.location || "",
      kilometraje: item?.mileage || "",
      anio: item?.year || "",
      marca: item?.make || "",
      modelo: item?.model || "",
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

// 📊 mercado general Chile
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

        const precio = extractPrice(raw);

        return typeof precio === "number" ? precio : null;
      })
      .filter((p): p is number => typeof p === "number" && !isNaN(p));

  } catch {
    return [];
  }
}

// 📈 proyecciones inversión
function projectValue(base: number, years: number) {
  const growthRate = 0.05; // mercado
  const depreciationRate = 0.07; // desgaste

  return Math.round(
    base * Math.pow(1 + growthRate - depreciationRate, years)
  );
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

    // 📊 promedio mercado Chile
    const prices: number[] = marketData.filter(
      (p): p is number => typeof p === "number" && !isNaN(p)
    );

    const avgMarket =
      prices.length > 0
        ? Math.round(
            prices.reduce((a, b) => a + b, 0) / prices.length
          )
        : null;

    // 📈 proyecciones
    const projection2026 = avgMarket
      ? projectValue(avgMarket, 1)
      : null;

    const projection2028 = avgMarket
      ? projectValue(avgMarket, 3)
      : null;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Eres un analista de inversión automotriz en Chile (modo 2026).

NO eres vendedor, eres inversionista.

DEBES ANALIZAR:

1. Precio actual del vehículo
2. Valor de mercado en Chile
3. Depreciación del modelo
4. Proyección 2026 y 2028
5. Liquidez del modelo (qué tan fácil se vende)
6. Riesgo de inversión

CLASIFICA COMO:
- inversión positiva
- inversión neutra
- inversión negativa

FORMATO:

🚗 MODELO: ...
📅 AÑO: ...
💰 PRECIO ACTUAL: ...
📊 VALOR MERCADO: ...
📉 DEPRECIACIÓN: ...
📈 PROYECCIÓN 2026: ...
📈 PROYECCIÓN 2028: ...
⚖️ LIQUIDEZ: alta/media/baja
💹 POTENCIAL DE INVERSIÓN: ...
⚠️ RIESGOS: ...
🏁 VEREDICTO FINAL: ...
`
        },
        {
          role: "user",
          content: `
VEHÍCULO:
${JSON.stringify(fullData, null, 2)}

📊 MERCADO CHILE:
${avgMarket ?? "No disponible"}

📈 PROYECCIÓN 2026:
${projection2026 ?? "No disponible"}

📈 PROYECCIÓN 2028:
${projection2028 ?? "No disponible"}
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

🔗 VERIFICACIÓN

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
      projection2026,
      projection2028,
      marketCount: prices.length,
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}