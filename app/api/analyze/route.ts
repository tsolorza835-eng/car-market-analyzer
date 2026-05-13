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

Tu tarea es analizar vehículos publicados en Facebook Marketplace para una persona que compra autos para revenderlos con un margen de ganancia entre 20% y 30%.

OBJETIVOS:
1. Estimar el valor de mercado actual del vehículo en Chile.
2. Calcular el PRECIO MÁXIMO DE COMPRA recomendado para lograr ese margen.
3. Evaluar si el kilometraje es coherente con el año del vehículo.
4. Detectar posibles señales de odómetro adulterado.
5. Indicar revisiones legales esenciales: multas, TAG, prenda y limitaciones al dominio.
6. Señalar riesgos mecánicos probables y costos potenciales.
7. Recomendar una estrategia de negociación.

REGLAS IMPORTANTES:
- Usa siempre toda la información disponible.
- Si faltan campos, infiere marca, modelo, versión y año a partir del título y la descripción.
- Nunca respondas diciendo que no es posible analizar por falta de información.
- Entrega siempre una recomendación concreta y útil.

FÓRMULA:
- Valor de mercado estimado = precio probable de reventa.
- Precio máximo de compra = valor de mercado × 0.70 a 0.80.
- Considera un margen de seguridad si existe incertidumbre.
          `,
        },
        {
          role: "user",
          content: `
Analiza el siguiente vehículo publicado en Facebook Marketplace.

DATOS EXTRAÍDOS:
${JSON.stringify(carData, null, 2)}

FORMATO DE RESPUESTA:
🚗 Vehículo:
💰 Precio publicado:
📈 Valor de mercado estimado:
🎯 Precio máximo de compra recomendado:
💵 Utilidad potencial estimada:
📊 Evaluación del negocio:
🔍 Coherencia del kilometraje:
🚨 Riesgo de odómetro adulterado:
🧾 Revisiones legales sugeridas:
🔧 Posibles costos y reparaciones:
🤝 Estrategia de negociación sugerida:
⚠️ Señales de alerta:
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