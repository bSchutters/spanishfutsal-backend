import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const boxStyle: React.CSSProperties = {
  backgroundColor: "#1B1F2A",
  border: "1px solid #2E3241",
  borderRadius: "8px",
  padding: "20px",
  margin: "20px",
  color: "#FFFFFF",
  fontSize: "18px",
};

const titleStyle: React.CSSProperties = {
  fontSize: "30px",
  fontWeight: "bold",
  marginBottom: "10px",
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: "#4F46E5",
  color: "#FFFFFF",
  border: "none",
  borderRadius: "4px",
  padding: "8px 12px",
  cursor: "pointer",
  marginRight: "10px",
};

const HomePage = () => {
  const [lastMatchUpdate, setLastMatchUpdate] = useState<string | null>(null);
  const [lastRankingUpdate, setLastRankingUpdate] = useState<string | null>(
    null
  );

  const strongStyle: React.CSSProperties = {
    textTransform: "capitalize",
  };

  useEffect(() => {
    fetch("/api/lffs-update")
      .then((res) => res.json())
      .then((data) => {
        const match = data?.find((item: any) => item.type === "matches");
        const ranking = data?.find((item: any) => item.type === "ranking");

        setLastMatchUpdate(
          match?.updatedAt
            ? format(
                new Date(match.updatedAt),
                "EEEE, dd MMMM yyyy - HH'h'mm",
                {
                  locale: fr,
                }
              )
            : null
        );

        setLastRankingUpdate(
          ranking?.updatedAt
            ? format(
                new Date(ranking.updatedAt),
                "EEEE, dd MMMM yyyy - HH'h'mm",
                {
                  locale: fr,
                }
              )
            : null
        );
      })
      .catch((err) => {
        console.error("❌ Erreur lors du fetch de /api/lffs-update :", err);
      });
  }, []);

  const launchImport = async (type: "matchs" | "ranking") => {
    const res = await fetch(`/api/lffs/import-${type}`, { method: "GET" });
    const data = await res.json();
    alert(data?.message || `Import ${type} terminé.`);
  };

  return (
    <div style={boxStyle}>
      <div style={titleStyle}>📡 LFFS API</div>

      <p>
        Dernière importation des matchs :{" "}
        <strong style={strongStyle}>{lastMatchUpdate ?? "—"}</strong>
      </p>
      <p>
        Dernière importation du classement :{" "}
        <strong style={strongStyle}>{lastRankingUpdate ?? "—"}</strong>
      </p>

      <div style={{ marginTop: "10px" }}>
        <button style={buttonStyle} onClick={() => launchImport("matchs")}>
          Importer les matchs
        </button>
        <button style={buttonStyle} onClick={() => launchImport("ranking")}>
          Importer le classement
        </button>
      </div>
    </div>
  );
};

export default HomePage;
