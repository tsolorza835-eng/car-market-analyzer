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
      precio: item.price || "",
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
      precio: "",
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

// 🔥 COMPARACIÓN REAL (20 EN MISMA ZONA)
async function scrapeMarketComparison(url: string, location?: string) {
  try {
    const apify = new ApifyClient({
      token: process.env.APIFY_TOKEN,
    });

    const run = await apify.actor("apify/facebook-marketplace-scraper").call({
      startUrls: [{ url }],
      maxItems: 50, // 🔥 traemos más para filtrar bien
    });

    const datasetId = run.defaultDatasetId;
    if (!datasetId) return [];

    const { items } = await apify.dataset(datasetId).listItems();

    // 🔥 FILTRO POR ZONA
    let filtered = items;

    if (location) {
      filtered = items.filter((item: any) => {
        if (!item.location) return false;

        return item.location
          .toLowerCase()
          .includes(location.toLowerCase());
      });
    }

    // 🔥 SOLO 20 RESULTADOS FINALES
    return filtered.slice(0, 20).map((item: any) => ({
      titulo: item.title || "",
      precio: item.price || 0,
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
- Comparar con autos similares del MISMO MODELO y MISMA ZONA
- Usar hasta 20 publicaciones del mercado
- Indicar cuántas publicaciones se usaron
- Calcular promedio de mercado
- Definir precio máximo para ganar 20% a 30%

FORMATO:

MODELO: ...
AÑO: ...
KILOMETRAJE: ...
VALOR MERCADO: ...
COMPARACIÓN: (número de autos usados + análisis de promedio)
PRECIO MÁXIMO COMPRA: ...
RIESGOS: ...
VEREDICTO: ...
`,
        },
        {
          role: "user",
          content: `
VEHÍCULO PRINCIPAL:
${JSON.stringify(fullData, null, 2)}

MERCADO EN MISMA ZONA (hasta 20 autos):
${JSON.stringify(marketData, null, 2)}
`,
        },
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

## 🔗 Enlaces de verificación

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
      marketCount: marketData.length, // 🔥 cuántos comparó realmente
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error interno" },
      { status: 500 }
    );
  }
}