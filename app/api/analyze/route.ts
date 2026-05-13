import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ApifyClient } from "apify-client";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
      precio: item.price || "No indicado",
      descripcion: item.description || "",
      ubicacion: item.location || "",
      kilometraje: item.mileage || "",
      anio: item.year || "",
      marca: item.make || "",
      modelo: item.model || "",
      combustible: item.fuelType || "",
      transmision: item.transmission || "",
      url,
    };
  } catch {
    return {
      titulo: "",
      precio: "No indicado",
      descripcion: "",
      ubicacion: "",
      kilometraje: "",
      anio: "",
      marca: "",
      modelo: "",
      combustible: "",
      transmision: "",
      url,
    };
  }
}

async function scrapeMarketComparison(url: string, location?: string) {
  try {
    const apify = new ApifyClient({
      token: process.env.APIFY_TOKEN,
    });

    const run = await apify.actor("apify/facebook-marketplace-scraper").call({
      startUrls: [{ url }],
      maxItems: 100, // 🔥 máximo posible razonable
    });

    const datasetId = run.defaultDatasetId;
    if (!datasetId) return [];

    const { items } = await apify.dataset(datasetId).listItems();

    if (!items || items.length === 0) return [];

    let filtered = items;

    // 📍 filtro Concepción (VIII región)
    if (location && location.trim() !== "") {
      const city = location.toLowerCase();

      const cityFiltered = items.filter((item: any) =>
        item.location?.toLowerCase().includes(city)
      );

      // 🔥 si hay pocos resultados, usamos todo igual
      filtered = cityFiltered.length > 3 ? cityFiltered : items;
    }

    return filtered.map((item: any) => ({
      titulo: item.title || "",
      precio: item.price || "No indicado",
      kilometraje: item.mileage || "",
      marca: item.make || "",
      modelo: item.model || "",
      año: item.year || "",
      ubicacion: item.location || "",
    }));
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const { url, patente } = await request.json();

    const carData = await scrapeMarketplaceData(url);

    const marketData = await scrapeMarketComparison(
      url,
      carData.ubicacion
    );

    const fullData = {
      ...carData,
      patente: patente || "No proporcionada",
    };

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Eres un experto en compra y venta de autos en Chile.

OBLIGATORIO:
- Analizar vehículo principal
- Comparar con mercado REAL disponible (sin limitar cantidad)
- Usar toda la data disponible (pueden ser 5, 20, 50 o más autos)
- Indicar cuántos autos se usaron
- Estimar rango en Concepción (VIII región)
- Dar precio máximo para ganar 20% a 30%

FORMATO CON EMOJIS:

🚗 MODELO: ...
📅 AÑO: ...
📊 KILOMETRAJE: ...
💰 PRECIO PUBLICACIÓN: ...
📍 PRECIO EN CONCEPCIÓN (RANGO): ...
📈 VALOR MERCADO PROMEDIO: ...
⚖️ COMPARACIÓN: (cantidad de autos usados + análisis)
🎯 PRECIO MÁXIMO COMPRA: ...
⚠️ RIESGOS: ...
🏁 VEREDICTO: ...
`
        },
        {
          role: "user",
          content: `
VEHÍCULO PRINCIPAL:
${JSON.stringify(fullData, null, 2)}

MERCADO DISPONIBLE (sin límite fijo, puede variar):
${JSON.stringify(marketData, null, 2)}
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

🔗 ENLACES DE VERIFICACIÓN

🔍 Alerta Vehículo:
https://alertavehiculo.cl

🛡️ AACH - CONREMATE:
https://www.aach.cl/CONREMATE/
`;
    }

    return NextResponse.json({
      success: true,
      data: fullData,
      analysis: finalAnalysis,
      modeloDetectado,
      marketCount: marketData.length, // 🔥 cuántos se usaron realmente
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error interno" },
      { status: 500 }
    );
  }
}