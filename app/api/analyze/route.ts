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
      datosCompletos: item,
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

Tu tarea es analizar vehículos publicados en Facebook Marketplace y entregar una recomendación orientada a un revendedor.

OBJETIVO:
El usuario compra autos para revenderlos y busca obtener un margen de ganancia entre 20% y 30%.

REGLAS:
1. Determina el valor de mercado estimado del vehículo en Chile.
2. Calcula un PRECIO MÁXIMO DE COMPRA recomendado para permitir una utilidad entre 20% y 30%.
3. Considera costos adicionales de transferencia, mantención básica, limpieza y posibles reparaciones menores.
4. Si existe un precio publicado, compáralo con el precio máximo de compra.
5. Indica claramente si conviene comprar o negociar.
6. Nunca digas que no es posible analizar por falta de información; usa el título, descripción y tu conocimiento del mercado.
7. Si faltan datos, infiere marca, modelo, versión y año a partir del título y la descripción.

FÓRMULA:
- Valor de mercado estimado = precio probable de reventa.
- Precio máximo de compra = valor de mercado × 0.70 a 0.80.
- Considera un margen de seguridad adicional si hay incertidumbre.

Entrega siempre un análisis práctico y orientado a la rentabilidad.
          `,
        },
        {
          role: "user",
          content: `
Analiza el siguiente vehículo publicado en Facebook Marketplace.

DATOS EXTRAÍDOS:
${JSON.stringify(carData, null, 2)}

INSTRUCCIONES:
- Identifica automáticamente marca, modelo, versión y año.
- Estima el valor de mercado actual en Chile.
- Calcula el PRECIO MÁXIMO DE COMPRA recomendado para revender con un margen del 20% al 30%.
- Compara el precio publicado con ese precio máximo.
- Indica cuánto potencial de utilidad existe.
- Señala riesgos, costos estimados y estrategia de negociación.
- Entrega una recomendación clara y directa.

FORMATO DE RESPUESTA:
🚗 Vehículo:
💰 Precio publicado:
📈 Valor de mercado estimado:
🎯 Precio máximo de compra recomendado:
💵 Utilidad potencial estimada:
📊 Evaluación del negocio:
🤝 Estrategia de negociación sugerida:
⚠️ Riesgos:
✅ Recomendación final:
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