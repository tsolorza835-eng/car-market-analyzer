import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { extraerDatosMarketplace } from "@/lib/scraper";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // Obtener la URL enviada desde el frontend
    const { url } = await request.json();

    // Limpiar espacios al inicio y al final
    const cleanUrl = url?.trim();

    // Validar que exista una URL y que sea de Facebook
    // Acepta:
    // - https://www.facebook.com/marketplace/item/...
    // - https://www.facebook.com/share/...
    // - https://facebook.com/...
    // - https://m.facebook.com/...
    if (
      !cleanUrl ||
      !(
        cleanUrl.includes("facebook.com") ||
        cleanUrl.includes("fb.com")
      )
    ) {
      return NextResponse.json(
        {
          error: "Debes proporcionar un enlace válido.",
        },
        {
          status: 400,
        }
      );
    }

    // Extraer automáticamente el contenido del anuncio
    const datos = await extraerDatosMarketplace(cleanUrl);

    // Crear el prompt para OpenAI
    const prompt = `
Analiza el siguiente aviso de Facebook Marketplace y determina si el precio del vehículo está bajo, justo o alto respecto al mercado chileno.

Título del aviso:
${datos.titulo}

Contenido del aviso:
${datos.texto}

Entrega el análisis exactamente en este formato:

🚗 Vehículo:
💰 Precio estimado de mercado:
📊 Evaluación: (Bajo precio / Precio justo / Sobrevalorado)
📉 Diferencia estimada:
✅ Recomendación:
`;

    // Enviar el prompt a OpenAI
    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: prompt,
    });

    // Obtener el texto de la respuesta
    const text = response.output_text;

    // Retornar el resultado al frontend
    return NextResponse.json({
      raw: text,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Ocurrió un error al analizar el vehículo.",
      },
      {
        status: 500,
      }
    );
  }
}