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

    // Ejecuta el actor de Apify para extraer datos del anuncio
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

    // Mostrar en logs de Vercel exactamente qué datos devolvió Apify
    console.log("Datos extraídos desde Apify:", JSON.stringify(item, null, 2));

    return {
      titulo: item.title || "No encontrado",
      precio: item.price || "No encontrado",
      descripcion:
        item.description || "No se encontró descripción.",
      ubicacion: item.location || "No encontrado",
      kilometraje: item.mileage || "No encontrado",
      anio: item.year || "No encontrado",
      url,
    };
  } catch (error) {
    console.error("Error en Apify:", error);

    return {
      titulo: "No encontrado",
      precio: "No encontrado",
      descripcion:
        "No se pudo extraer información del anuncio.",
      ubicacion: "No encontrado",
      kilometraje: "No encontrado",
      anio: "No encontrado",
      url,
    };
  }
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

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

    // Log para verificar qué datos finalmente se enviarán a OpenAI
    console.log(
      "Datos enviados a OpenAI:",
      JSON.stringify(carData, null, 2)
    );

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Eres un experto en compra y venta de autos usados en Chile. Si existen datos concretos como precio, año o kilometraje, debes utilizarlos explícitamente en el análisis. Si faltan datos, realiza una estimación razonable, pero prioriza siempre la información real extraída del anuncio.",
        },
        {
          role: "user",
          content: `
Analiza este vehículo publicado en Facebook Marketplace.

Datos extraídos:
${JSON.stringify(carData, null, 2)}

Instrucciones:
- Usa el precio exacto si está disponible.
- Usa año, kilometraje, ubicación y descripción si existen.
- Indica si el precio está bajo, justo o sobre el mercado chileno.
- Entrega un rango estimado de mercado.
- Calcula una diferencia aproximada si es posible.
- Señala ventajas, riesgos y una recomendación final.

Formato de respuesta:
🚗 Vehículo:
💰 Precio publicado:
💰 Precio estimado de mercado:
📊 Evaluación:
📈 Diferencia estimada:
✅ Recomendación:
⚠️ Riesgos:
          `,
        },
      ],
      temperature: 0.2,
    });

    const analysis =
      completion.choices[0]?.message?.content ||
      "No se pudo generar el análisis.";

    return NextResponse.json({
      success: true,
      data: carData,
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