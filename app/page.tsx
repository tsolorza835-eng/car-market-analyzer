"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [patente, setPatente] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [dots, setDots] = useState(".");

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

  const handleAnalyze = async () => {
    if (!url.trim()) {
      alert("Por favor ingresa un enlace de Facebook Marketplace.");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          patente: patente.trim().toUpperCase(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.analysis || "No se recibió análisis.");
      } else {
        setResult(data.error || "Error al analizar.");
      }
    } catch (error) {
      setResult("Error de conexión.");
    } finally {
      setLoading(false);
    }
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
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "900px",
          background: "#222",
          padding: "40px",
          borderRadius: "20px",
          boxShadow: "0 0 30px rgba(0,0,0,0.5)",
        }}
      >
        {/* TÍTULO */}
        <h1
          style={{
            textAlign: "center",
            fontSize: "3rem",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          {loading ? (
            <>
              <img
                src="/lucas.png"
                alt="Señor Lucas"
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "3px solid #00aaff",
                  boxShadow: "0 0 20px rgba(0,170,255,0.5)",
                }}
              />
              <span>{`Señor Lucas está analizando${dots}`}</span>
            </>
          ) : (
            <>
              <span>🚗</span>
              <span>Analizador de Precios de Autos</span>
            </>
          )}
        </h1>

        {/* DESCRIPCIÓN */}
        <p
          style={{
            textAlign: "center",
            fontSize: "1.5rem",
            marginBottom: "30px",
            lineHeight: "1.6",
          }}
        >
          Pega un enlace de Facebook Marketplace y, si la tienes, ingresa la
          patente para obtener un análisis más completo.
        </p>

        {/* INPUT URL */}
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Pega aquí el enlace del vehículo"
          style={{
            width: "100%",
            padding: "20px",
            fontSize: "1.4rem",
            borderRadius: "12px",
            border: "1px solid #555",
            marginBottom: "20px",
            background: "#333",
            color: "white",
            boxSizing: "border-box",
          }}
        />

        {/* INPUT PATENTE */}
        <input
          type="text"
          value={patente}
          onChange={(e) => setPatente(e.target.value)}
          placeholder="Patente (opcional)"
          maxLength={8}
          style={{
            width: "100%",
            padding: "20px",
            fontSize: "1.4rem",
            borderRadius: "12px",
            border: "1px solid #555",
            marginBottom: "20px",
            background: "#333",
            color: "white",
            textTransform: "uppercase",
            boxSizing: "border-box",
          }}
        />

        {/* BOTÓN */}
        <button
          onClick={handleAnalyze}
          disabled={loading}
          style={{
            width: "100%",
            padding: "20px",
            fontSize: "1.6rem",
            fontWeight: "bold",
            borderRadius: "12px",
            border: "none",
            background: loading
              ? "linear-gradient(90deg, #555, #777)"
              : "linear-gradient(90deg, #0070f3, #00aaff)",
            color: "white",
            cursor: loading ? "not-allowed" : "pointer",
            marginBottom: "30px",
          }}
        >
          {loading
            ? `Señor Lucas está analizando${dots}`
            : "Chúpalo José Ignacio"}
        </button>

        {/* RESULTADO */}
        {result && (
          <div
            style={{
              background: "#2d2d2d",
              padding: "30px",
              borderRadius: "15px",
              lineHeight: "1.8",
              fontSize: "1.25rem",
              whiteSpace: "normal",
              border: "1px solid #444",
            }}
          >
            <div
              dangerouslySetInnerHTML={{
                __html: result
                  // Enlaces Markdown [Texto](https://...)
                  .replace(
                    /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
                    '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#4da6ff; text-decoration: underline; font-weight: bold;">$1</a>'
                  )
                  // URLs sueltas
                  .replace(
                    /(https?:\/\/[^\s<]+)/g,
                    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#4da6ff; text-decoration: underline; font-weight: bold;">$1</a>'
                  )
                  // Encabezados Markdown
                  .replace(/^### (.*)$/gm, "<h3>$1</h3>")
                  .replace(/^## (.*)$/gm, "<h2>$1</h2>")
                  .replace(/^# (.*)$/gm, "<h1>$1</h1>")
                  // Negritas
                  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                  // Cursivas
                  .replace(/\*(.*?)\*/g, "<em>$1</em>")
                  // Saltos de línea
                  .replace(/\n/g, "<br />"),
              }}
            />
          </div>
        )}
      </div>
    </main>
  );
}