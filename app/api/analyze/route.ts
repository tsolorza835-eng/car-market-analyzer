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

Tu cliente compra vehículos para revenderlos y necesita saber exactamente cuánto debe pagar como máximo para obtener una utilidad mínima del 20% y una utilidad ideal del 30%.

Si se proporciona una patente, debes utilizarla como referencia adicional para contrastar la información del vehículo y orientar las verificaciones legales y técnicas.

OBJETIVO PRINCIPAL:
Determinar un PRECIO MÁXIMO DE COMPRA concreto y numérico.

REGLAS OBLIGATORIAS:
- Nunca digas que faltan datos o que no es posible analizar.
- Siempre entrega montos en pesos chilenos (CLP).
- Usa toda la información disponible.
- Si faltan datos, realiza estimaciones razonables.

METODOLOGÍA:
- Valor de mercado estimado = precio probable de reventa en Chile.
- Precio máximo conservador = valor de mercado × 0.70
- Precio máximo recomendado = valor de mercado × 0.75
- Precio máximo agresivo = valor de mercado × 0.80

IMPORTANTE:
La prioridad absoluta es indicar con claridad cuánto debe pagarse como máximo para comprar el vehículo y revenderlo con rentabilidad.
          `,
        },
        {
          role: "user",
          content: `
Analiza el siguiente vehículo publicado en Facebook Marketplace.

DATOS DISPONIBLES:
${JSON.stringify(fullData, null, 2)}

FORMATO OBLIGATORIO DE RESPUESTA:

🚗 Vehículo identificado:
🔢 Patente:
💰 Precio publicado:
📈 Valor de mercado estimado:
🎯 Precio máximo conservador:
🎯 Precio máximo recomendado:
🎯 Precio máximo agresivo:
💵 Utilidad potencial estimada:
📊 Evaluación del negocio:
🔍 Coherencia del kilometraje:

📋 Revisión Técnica (PRT):
- Indica si, según el año del vehículo, es altamente probable que deba contar con revisión técnica vigente.
- Estima el riesgo económico si la revisión técnica estuviera vencida o rechazada.
- Menciona los costos aproximados de regularización en Chile.
- Señala si este factor afecta el precio máximo de compra recomendado.

🚦 Multas y observaciones:
- Indica qué riesgos legales deben revisarse con la patente.
- Explica cómo podrían afectar el negocio.

🔒 Prendas y limitaciones al dominio:
- Evalúa el impacto económico y legal si existieran.

🛣️ TAG y otras deudas:
- Explica cómo podrían afectar la rentabilidad.

🔧 Posibles costos y reparaciones:
🤝 Estrategia de negociación sugerida:
⚠️ Señales de alerta:
🏆 Veredicto final:
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