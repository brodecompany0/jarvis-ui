import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const URL = import.meta.env.VITE_SUPABASE_URL || "";
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

async function rpc(sessionId: string, action: string, payload: any = {}) {
  const r = await fetch(`${URL}/rest/v1/rpc/jarvis_command`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_session_id: sessionId,
      p_action: action,
      p_payload: payload,
    }),
  });

  if (!r.ok) throw Error(await r.text());
  return r.json();
}

function App() {
  const [b, setB] = useState<any>(null);
  const [err, setErr] = useState("");
  const [active, setActive] = useState("Visão geral");
  const [cmd, setCmd] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const s = localStorage.getItem("jarvis_session");

        if (!s) {
          throw Error("Sessão JARVIS não encontrada.");
        }

        const d = await rpc(s, "briefing_core");
        setB(d?.data ?? d);
      } catch (e: any) {
        setErr(e.message || "Falha ao carregar o BRODE OS.");
      }
    })();
  }, []);

  const nav = [
    "Visão geral",
    "Prospecção",
    "Outreach",
    "Projetos",
    "Memória",
    "Command Center",
  ];

  const ms = [
    ["Ações abertas", b?.open_actions ?? "—"],
    ["Prospects pendentes", b?.pending_prospects ?? "—"],
    ["Outreach em revisão", b?.outreach_review ?? "—"],
    ["Projetos ativos", b?.active_projects ?? "—"],
  ];

  return (
    <div className="app">
      <aside>
        <div className="brand">
          <div className="orb">✦</div>
          <div>
            <b>JARVIS</b>
            <span>BRODE OS</span>
          </div>
        </div>

        <nav>
          {nav.map((n, i) => (
            <button
              className={active === n ? "active" : ""}
              onClick={() => setActive(n)}
              key={n}
            >
              <i>{["⌂", "◈", "✉", "◉", "◇", "⌁"][i]}</i>
              {n}
            </button>
          ))}
        </nav>

        <div className="sidefoot">
          <span className="dot" />
          Sistema operacional conectado
        </div>
      </aside>

      <main>
        <header>
          <div>
            <small>COMMAND CENTER</small>
            <h1>Boa tarde, Senhor.</h1>
            <p>
              O BRODE OS está pronto. Aqui está o que merece sua atenção.
            </p>
          </div>

          <div className="status">
            <span className="dot" /> ONLINE
          </div>
        </header>

        {err && <div className="alert">⚠ {err}</div>}

        {!b && !err ? (
          <div className="loading">
            Sincronizando estado operacional…
          </div>
        ) : (
          <section>
            <div className="grid">
              {ms.map(([l, v]) => (
                <div className="metric" key={l}>
                  <span>{l}</span>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>

            <div className="cols">
              <div className="panel">
                <div className="panelhead">
                  <div>
                    <small>ATENÇÃO</small>
                    <h2>O que merece atenção</h2>
                  </div>

                  <span className="badge yellow">revisar</span>
                </div>

                <div className="attention">
                  <span className="signal y">!</span>

                  <div>
                    <b>Outreach aguardando revisão</b>
                    <p>
                      Existe uma mensagem pronta para análise antes de
                      qualquer ação externa.
                    </p>
                  </div>
                </div>

                <div className="attention">
                  <span className="signal bl">◈</span>

                  <div>
                    <b>Prospects aguardando qualificação</b>
                    <p>
                      {b?.pending_prospects ?? 0} empresas estão na fila de
                      prospecção.
                    </p>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panelhead">
                  <div>
                    <small>JARVIS</small>
                    <h2>Estado do sistema</h2>
                  </div>

                  <span className="badge green">estável</span>
                </div>

                {[
                  ["Prospecting Queue", "Funcionando"],
                  ["Outreach Queue", "Funcionando"],
                  ["Command Router", "Em evolução"],
                ].map((x) => (
                  <div className="systemline" key={x[0]}>
                    <span>{x[0]}</span>
                    <b>{x[1]}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel next">
              <div>
                <small>PRÓXIMO PASSO</small>
                <h2>Revisar a fila de Outreach</h2>
                <p>
                  JARVIS não envia nada externamente sem sua aprovação.
                </p>
              </div>

              <button
                className="primary"
                onClick={() => setActive("Outreach")}
              >
                Abrir Outreach →
              </button>
            </div>

            <div className="command">
              <small>COMMAND CENTER</small>
              <h2>O que devo fazer, Senhor?</h2>

              <div className="commandrow">
                <input
                  value={cmd}
                  onChange={(e) => setCmd(e.target.value)}
                  placeholder="Ex.: prepare os próximos leads para prospecção…"
                />

                <button
                  className="primary"
                  onClick={() => setCmd("")}
                >
                  Executar
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
