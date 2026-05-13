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

// 🔥 DOBLE MERCADO: general + concepción
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
    if (!datasetId) return { general: [], concepcion: [] };

    const { items } = await apify.dataset(datasetId).listItems();

    if (!items || items.length === 0) {
      return { general: [], concepcion: [] };
    }

    // 🌎 MERCADO GENERAL (FACEBOOK COMPLETO)
    const general = items.slice(0, 30).map((item: any) => ({
      titulo: item.title || "",
      precio: item.price || "No indicado",
      kilometraje: item.mileage || "",
      marca: item.make || "",
      modelo: item.model || "",
      año: item.year || "",
      ubicacion: item.location || "",
    }));

    // 📍 MERCADO CONCEPCIÓN (VIII REGIÓN)
    const concepcionFiltered = items.filter((item: any) => {
      const loc = item.location?.toLowerCase() || "";
      return (
        loc.includes("concepcion") ||
        loc.includes("concepción") ||
        loc.includes("biobio") ||
        loc.includes("biobío")
      );
    });

    const concepcion = concepcionFiltered.slice(0, 20).map((item: any) => ({
      titulo: item.title || "",
      precio: item.price || "No indicado",
      kilometraje: item.mileage || "",
      marca: item.make || "",
      modelo: item.model || "",
      año: item.year || "",
      ubicacion: item.location || "",
    }));

    return { general, concepcion };

  } catch {
    return { general: [], concepcion: [] };
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

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Eres un experto en compra y venta de autos en Chile.

OBLIGATORIO:

1. Analizar el vehículo principal
2. Comparar con MERCADO GENERAL de Facebook Marketplace
3. Comparar con MERCADO CONCEPCIÓN (VIII Región)
4. Mostrar diferencias entre ambos mercados
5. Calcular precio máximo para 20–30% ganancia

FORMATO CON EMOJIS:

🚗 MODELO: ...
📅 AÑO: ...
📊 KILOMETRAJE: ...
💰 PRECIO PUBLICACIÓN: ...

🌎 MERCADO FACEBOOK (GENERAL):
- promedio
- rango

📍 MERCADO CONCEPCIÓN (VIII REGIÓN):
- promedio
- rango

⚖️ COMPARACIÓN ENTRE MERCADOS:
...

🎯 PRECIO MÁXIMO COMPRA:
...

⚠️ RIESGOS:
...

🏁 VEREDICTO:
`
        },
        {
          role: "user",
          content: `
VEHÍCULO PRINCIPAL:
${JSON.stringify(fullData, null, 2)}

🌎 MERCADO GENERAL FACEBOOK:
${JSON.stringify(marketData.general, null, 2)}

📍 MERCADO CONCEPCIÓN (VIII REGIÓN):
${JSON.stringify(marketData.concepcion, null, 2)}
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
      marketGeneralCount: marketData.general.length,
      marketConcepcionCount: marketData.concepcion.length
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error interno" },
      { status: 500 }
    );
  }
}