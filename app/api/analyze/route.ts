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

// Detecta una patente chilena en el título o descripción si el usuario no la ingresa
function detectarPatente(texto: string): string | null {
  if (!texto) return null;

  const limpio = texto.toUpperCase().replace(/[^A-Z0-9]/g, " ");

  // Formatos comunes: ABCD12 o AB1234
  const patrones = [
    /\b[A-Z]{4}[0-9]{2}\b/,
    /\b[A-Z]{2}[0-9]{4}\b/,
  ];

  for (const patron of patrones) {
    const match = limpio.match(patron);
    if (match) {
      return match[0];
    }
  }

  return null;
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

    // Detectar patente automáticamente si el usuario no la ingresó
    let patenteFinal = patente?.trim().toUpperCase();

    if (!patenteFinal) {
      const textoBusqueda = `${carData.titulo} ${carData.descripcion}`;
      patenteFinal = detectarPatente(textoBusqueda) || "";
    }

    const fullData = {
      ...carData,
      patente: patenteFinal || "No proporcionada",
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

    // Usar la patente detectada automáticamente para los enlaces
    if (patenteFinal) {
      analysis += `

## 🔗 Enlaces útiles para verificación

📱 Alerta Vehículo (abrir app):
alertavehiculo://buscar?patente=${patenteFinal}

🌐 Alerta Vehículo (sitio web):
https://alertavehiculo.cl

🛡️ AACH - Consulta de remates:
https://www.aach.cl/CONREMATE/
`;
    }

    return NextResponse.json({
      success: true,
      data: fullData,
      analysis,
      patenteDetectada: patenteFinal || null,
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