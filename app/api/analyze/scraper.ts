export async function scrapeMarketplace(url: string) {
  try {
    if (!url) {
      throw new Error("URL requerida");
    }

    // 🔥 AQUÍ VA TU SCRAPING REAL (por ahora básico seguro)
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error("No se pudo acceder al contenido");
    }

    const text = await res.text();

    // 🔎 DETECCIÓN SIMPLE DE PRECIO (fallback estable)
    const priceMatch = text.match(/\d{1,3}(\.\d{3})+|\d{5,}/g);

    const price = priceMatch
      ? Number(priceMatch[0].replace(/\./g, ""))
      : null;

    return {
      title: "Auto detectado",
      price,
      avgMarket: null,
      location: "Concepción",
    };
  } catch (error) {
    console.error("Scraper error:", error);

    return {
      title: null,
      price: null,
      avgMarket: null,
      location: null,
    };
  }
}