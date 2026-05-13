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
      titulo: item.title || "No encontrado",
      precio: item.price || "No encontrado",
      descripcion: item.description || "No se encontró descripción.",
      ubicacion: item.location || "No encontrado",
      kilometraje: item.mileage || "No encontrado",
      anio: item.year || "No encontrado",
      marca: item.make || "No encontrado",
      modelo: item.model || "No encontrado",
      combustible: item.fuelType || "No encontrado",
      transmision: item.transmission || "No encontrado",
      url,
    };
  } catch (error) {
    return {
      titulo: "No encontrado",
      precio: "No encontrado",
      descripcion: "Error scraping",
      ubicacion: "No encontrado",
      kilometraje: "No encontrado",
      anio: "No encontrado",
      marca: "No encontrado",
      modelo: "No encontrado",
      combustible: "No encontrado",
      transmision: "No encontrado",
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
          content:
            "Eres un experto en compra y venta de autos en Chile. Entrega precio máximo de compra.",
        },
        {
          role: "user",
          content: JSON.stringify(fullData),
        },
      ],
    });

    let analysis =
      completion.choices[0]?.message?.content ||
      "Sin análisis";

    // 🔗 LINKS
    if (patente) {
      analysis += `

## 🔗 Enlaces útiles

🔍 Alerta Vehículo:
https://alertavehiculo.cl

🛡️ AACH:
https://www.aach.cl/CONREMATE/
`;
    }

    // 🔥 MODELO DETECTADO PARA FRONTEND
    const modeloDetectado =
      fullData.marca && fullData.modelo
        ? `${fullData.marca} ${fullData.modelo}`
        : fullData.modelo;

    return NextResponse.json({
      success: true,
      data: fullData,
      analysis,
      modeloDetectado,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error" },
      { status: 500 }
    );
  }
}