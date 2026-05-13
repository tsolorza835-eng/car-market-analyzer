"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [patente, setPatente] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [dots, setDots] = useState(".");
  const [carModel, setCarModel] = useState("");

  useEffect(() => {
    if (!loading) {
      setDots(".");
      return;
    }

    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === "...") return ".";
        return prev + ".";
      });
    }, 500);

    return () => clearInterval(interval);
  }, [loading]);

  // Extrae una aproximación del modelo desde el texto del resultado
  useEffect(() => {
    if (!result) return;

    const patterns = [
      /Vehículo identificado:\s*([^\n]+)/i,
      /modelo[:\s]+([^\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = result.match(pattern);
      if (match && match[1]) {
        const detected = match[1]
          .replace(/[*#:_-]/g, "")
          .trim()
          .split(" ")
          .slice(0, 3)
          .join(" ");

        if (detected.length > 0) {
          setCarModel(detected);
          return;
        }
      }
    }
  }, [result]);

  const normalizeFacebookUrl = (input: string) => {
    let cleaned = input.trim();

    cleaned = cleaned
      .replace("m.facebook.com", "www.facebook.com")
      .replace("web.facebook.com", "www.facebook.com");

    const shareMatch = cleaned.match(/facebook\.com\/share\/[^/]+\/([^/?]+)/);
    if (shareMatch && shareMatch[1]) {
      cleaned = `https://www.facebook.com/marketplace/item/${shareMatch[1]}/`;
    }

    return cleaned;
  };

  const handleAnalyze = async () => {
    if (!url.trim()) {
      alert("Por favor ingresa un enlace de Facebook Marketplace.");
      return;
    }

    setLoading(true);
    setResult("");
    setCarModel("");

    try {
      const normalizedUrl = normalizeFacebookUrl(url);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: normalizedUrl,
          patente: patente.trim().toUpperCase(),
        }),
      });

      const data = await response.json();

      // Detectar el modelo directamente desde los datos del scraper
      if (data?.data?.modelo && data.data.modelo !== "No encontrado") {
        setCarModel(data.data.modelo);
      } else if (
        data?.data?.marca &&
        data?.data?.modelo &&
        data.data.modelo !== "No encontrado"
      ) {
        setCarModel(`${data.data.marca} ${data.data.modelo}`);
      }

      if (data.success) {
        setResult(data.analysis || "No se recibió análisis.");
      } else {
        setResult(data.error || "Error al analizar.");
      }
    } catch {
      setResult("Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  const renderMarkdown = (text: string) => {
    let html = text;

    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#4da6ff; text-decoration: underline; font-weight: bold;">$1</a>'
    );

    html = html
      .replace(/^### (.*)$/gm, "<h3>$1</h3>")
      .replace(/^## (.*)$/gm, "<h2>$1</h2>")
      .replace(/^# (.*)$/gm, "<h1>$1</h1>");

    html = html
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");

    html = html.replace(
      /(?<!href=")(https?:\/\/[^\s<"]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#4da6ff; text-decoration: underline; font-weight: bold;">$1</a>'
    );

    html = html.replace(/\n/g, "<br />");

    return html;
  };

  return (
    <main>{/* Mantén todo tu JSX actual igual */}</main>
  );
}

// REEMPLAZA SOLO ESTA PARTE DENTRO DEL <h1>:

/*
{loading ? (
  <>
    <img ... />
    <span>
      {carModel
        ? `Señor Lucas está investigando tu próximo ${carModel}${dots}`
        : `Señor Lucas está investigando${dots}`}
    </span>
  </>
) : (
  ...
)}
*/