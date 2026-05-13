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

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Eres un experto profesional en compra y venta de autos usados en Chile.

Tu cliente compra vehículos para revenderlos y necesita saber exactamente cuánto debe pagar como máximo para obtener una utilidad mínima del 20% y una utilidad ideal del 30%.

TU OBJETIVO PRINCIPAL:
Determinar un PRECIO MÁXIMO DE COMPRA concreto y numérico, basado en la información del anuncio y en tu conocimiento del mercado chileno.

INSTRUCCIONES OBLIGATORIAS:

1. Nunca digas:
- "No es posible analizar"
- "No se dispone de información suficiente"
- "No se puede determinar"
- "Faltan datos"
- "Es difícil estimar"

2. Siempre debes inferir:
- Marca
- Modelo
- Año
- Tipo de vehículo
- Valor probable de mercado en Chile

3. Usa toda la información disponible:
- Título del anuncio
- Descripción
- Precio
- Kilometraje
- Año
- Ubicación

4. Aunque falten algunos datos, debes continuar y entregar estimaciones razonables.

5. Todos los montos deben expresarse en pesos chilenos (CLP).

METODOLOGÍA:

- Valor de mercado estimado = precio probable de reventa en Chile.
- Precio máximo conservador = valor de mercado × 0.70
- Precio máximo recomendado = valor de mercado × 0.75
- Precio máximo agresivo = valor de mercado × 0.80

FORMATO OBLIGATORIO DE RESPUESTA:

🚗 Vehículo identificado:
💰 Precio publicado:
📈 Valor de mercado estimado:
🎯 Precio máximo conservador:
🎯 Precio máximo recomendado:
🎯 Precio máximo agresivo:
💵 Utilidad potencial estimada:
📊 Evaluación del negocio:
🔍 Coherencia del kilometraje:
🚨 Riesgo de odómetro adulterado:
🧾 Revisiones legales sugeridas:
🔧 Posibles costos y reparaciones:
🤝 Estrategia de negociación sugerida:
⚠️ Señales de alerta:
🏆 Veredicto final:
📝 Comentarios adicionales:

REGLA FINAL:
La prioridad absoluta es indicar con claridad cuál es el precio máximo que debe pagarse para comprar el vehículo con fines de reventa.
          `,
        },
        {
          role: "user",
          content: `
Analiza el siguiente vehículo publicado en Facebook Marketplace.

DATOS EXTRAÍDOS:
${JSON.stringify(carData, null, 2)}
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