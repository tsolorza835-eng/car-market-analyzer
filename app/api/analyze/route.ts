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

    // Guardamos TODA la información que entregue Apify
    const carData = {
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
      datosCompletos: item, // Todo lo que Apify devuelve
    };

    console.log(
      "Datos extraídos desde Apify:",
      JSON.stringify(carData, null, 2)
    );

    return carData;
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

    console.log(
      "Datos enviados a OpenAI:",
      JSON.stringify(carData, null, 2)
    );

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Eres un experto en compra y venta de autos usados en Chile.

Tu tarea es analizar vehículos publicados en Facebook Marketplace.

REGLAS IMPORTANTES:
1. Debes utilizar TODA la información disponible.
2. Si el precio existe, úsalo explícitamente.
3. Si faltan campos estructurados, analiza el título y la descripción.
4. Si el título contiene datos como marca, modelo, año o versión, debes identificarlos.
5. Si solo existe el nombre del vehículo, utiliza tu conocimiento del mercado chileno para estimar el valor de mercado.
6. Nunca respondas diciendo que no es posible analizar por falta de información.
7. Siempre entrega un análisis concreto y útil.
          `,
        },
        {
          role: "user",
          content: `
Analiza el siguiente vehículo publicado en Facebook Marketplace.

DATOS EXTRAÍDOS:
${JSON.stringify(carData, null, 2)}

INSTRUCCIONES:
- Identifica automáticamente marca, modelo, versión y año desde el título o descripción.
- Usa tu conocimiento del mercado chileno para estimar el precio de mercado.
- Si existe un precio publicado, compáralo con el mercado.
- Si no existe un precio, estima igualmente cuánto debería costar.
- Considera kilometraje, equipamiento y ubicación si están disponibles.
- Indica si la publicación parece barata, justa o cara.
- Señala riesgos y recomendaciones para el comprador.

FORMATO DE RESPUESTA:
🚗 Vehículo:
💰 Precio publicado:
💰 Precio estimado de mercado:
📊 Evaluación:
📈 Diferencia estimada:
✅ Recomendación:
⚠️ Riesgos:
📝 Comentarios adicionales:
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