export async function scrapeMarketplaceData(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    const html = await response.text();

    const priceMatch = html.match(/\$[\d\.,]+/);
    const yearMatch = html.match(/\b(19|20)\d{2}\b/);
    const kmMatch = html.match(/([\d\.]+)\s*(km|kms|kilómetros)/i);

    return {
      price: priceMatch ? priceMatch[0] : "No encontrado",
      year: yearMatch ? yearMatch[0] : "No encontrado",
      mileage: kmMatch ? kmMatch[0] : "No encontrado",
      description: html.substring(0, 5000),
    };
  } catch (error) {
    return {
      price: "No encontrado",
      year: "No encontrado",
      mileage: "No encontrado",
      description: "No se pudo obtener información del aviso.",
    };
  }
}