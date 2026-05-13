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

export async function POST(request: Request) {
  try {
    const { url, patente } = await request.json();

    const carData = await scrapeMarketplaceData(url);

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
Eres un experto en autos en Chile.

OBLIGATORIO:
- Debes identificar SOLO el MODELO del vehículo.
- No incluyas marca ni año.
- Si no es claro, infiérelo.
- Responde así:

MODELO: Corolla
`,
        },
        {
          role: "user",
          content: JSON.stringify(fullData),
        },
      ],
      temperature: 0.2,
    });

    const analysis =
      completion.choices[0]?.message?.content || "";

    // 🔥 EXTRAER SOLO MODELO
    const modeloDetectado =
      analysis.match(/MODELO[:\- ]*(.*)/i)?.[1]?.trim() || "";

    let finalAnalysis = analysis;

    if (patente) {
      finalAnalysis += `

## 🔗 Enlaces útiles

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
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error" },
      { status: 500 }
    );
  }
}