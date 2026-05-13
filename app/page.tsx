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
      setDots((prev) => (prev === "..." ? "." : prev + "."));
    }, 500);

    return () => clearInterval(interval);
  }, [loading]);

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
      alert("Ingresa un link de Facebook Marketplace.");
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

      if (data?.data?.modelo) {
        setCarModel(`${data.data.marca} ${data.data.modelo}`);
      }

      if (data.success) {
        setResult(data.analysis || "Sin resultado.");
      } else {
        setResult(data.error || "Error.");
      }
    } catch {
      setResult("Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  const renderMarkdown = (text: string) => {
    let html = text;

    // links markdown
    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
      '<a href="$2" target="_blank" style="color:#4da6ff;text-decoration:underline;font-weight:bold;">$1</a>'
    );

    // encabezados
    html = html
      .replace(/^### (.*)$/gm, "<h3>$1</h3>")
      .replace(/^## (.*)$/gm, "<h2>$1</h2>")
      .replace(/^# (.*)$/gm, "<h1>$1</h1>");

    // negritas
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // URLs (VERSIÓN SEGURA PARA IPHONE)
    html = html.replace(
      /(https?:\/\/[^\s<"]+)/g,
      '<a href="$1" target="_blank" style="color:#4da6ff;text-decoration:underline;font-weight:bold;">$1</a>'
    );

    // saltos de línea
    html = html.replace(/\n/g, "<br />");

    return html;
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#111",
        color: "white",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "900px",
          background: "#222",
          padding: "40px",
          borderRadius: "20px",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            fontSize: "2.5rem",
            marginBottom: "20px",
          }}
        >
          {loading ? (
            <>
              <img
                src="/lucas.png"
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: "50%",
                }}
              />
              <div>
                Señor Lucas está investigando{" "}
                {carModel ? `tu próximo ${carModel}` : ""}{dots}
              </div>
            </>
          ) : (
            "🚗 Analizador de Autos"
          )}
        </h1>

        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link del auto"
          style={{ width: "100%", padding: 15, marginBottom: 10 }}
        />

        <input
          value={patente}
          onChange={(e) => setPatente(e.target.value)}
          placeholder="Patente (opcional)"
          style={{ width: "100%", padding: 15, marginBottom: 10 }}
        />

        <button
          onClick={handleAnalyze}
          style={{
            width: "100%",
            padding: 15,
            background: "#0070f3",
            color: "white",
            fontSize: 18,
          }}
        >
          {loading ? "Analizando..." : "Analizar"}
        </button>

        {result && (
          <div
            style={{
              marginTop: 20,
              background: "#333",
              padding: 20,
              borderRadius: 10,
            }}
          >
            <div
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(result),
              }}
            />
          </div>
        )}
      </div>
    </main>
  );
}