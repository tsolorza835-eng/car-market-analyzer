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

    if (!datasetId) {
      throw new Error("Apify no devolvió un dataset.");
    }

    const { items } = await apify.dataset(datasetId).listItems();

    if (!items.length) {
      throw new Error("No se encontraron datos.");
    }

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
      datosCompletos: item,
    };
  } catch (error) {
    console.error("Error en Apify:", error);

    return {
      titulo: "No encontrado",
      precio: "No encontrado",
      descripcion: "No se pudo extraer información del anuncio.",
      ubicacion: "No encontrado",
      kilometraje: "No encontrado",
      anio: "No encontrado",
      marca: "No encontrado",
      modelo: "No encontrado",
      combustible: "No encontrado",
      transmision: "No encontrado",
      url,
      datosCompletos: {},
    };
  }
}

export async function POST(request: Request) {
  try {
    const { url, patente } = await request.json();

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error: "No se proporcionó un enlace.",
        },
        { status: 400 }
      );
    }

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
Eres un experto profesional en compra y venta de autos usados en Chile.
Debes determinar cuánto pagar como máximo para revender con utilidad del 20% al 30%.
Todos los montos deben expresarse en pesos chilenos (CLP).
Nunca digas que no es posible analizar.
`,
        },
        {
          role: "user",
          content: `
Analiza el siguiente vehículo:

${JSON.stringify(fullData, null, 2)}

Incluye:
- Valor de mercado estimado
- Precio máximo recomendado
- Riesgo de remate
- Multas
- PRT
- TAG
- Señales de alerta
- Veredicto final
`,
        },
      ],
      temperature: 0.2,
    });

    let analysis =
      completion.choices[0]?.message?.content ||
      "No se pudo generar el análisis.";

    // Enlaces útiles
    if (patente && patente.trim() !== "") {
      analysis += `

## 🔗 Enlaces útiles para verificación

🔍 Alerta Vehículo:
https://alertavehiculo.cl

🛡️ AACH - Asociación de Aseguradores de Chile:
https://www.aach.cl
`;
    }

    return NextResponse.json({
      success: true,
      data: fullData,
      analysis,
    });
  } catch (error) {
    console.error("Error en análisis:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor.",
      },
      { status: 500 }
    );
  }
}