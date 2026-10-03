import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const URL = import.meta.env.VITE_SUPABASE_URL || "";
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user?: {
    id: string;
    email?: string;
  };
};

async function supabaseAuth(
  email: string,
  password: string
): Promise<AuthSession> {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const data = await r.json();

  if (!r.ok) {
    throw new Error(
      data?.error_description ||
        data?.msg ||
        data?.message ||
        "Não foi possível autenticar."
    );
  }

  return data;
}

async function refreshAuth(
  refreshToken: string
): Promise<AuthSession> {
  const r = await fetch(
    `${URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    }
  );

  const data = await r.json();

  if (!r.ok) {
    throw new Error("Sessão expirada.");
  }

  return data;
}

async function getJarvisSession(
  authSession: AuthSession
): Promise<string> {
  const userId = authSession.user?.id;

  if (!userId) {
    throw new Error("Usuário autenticado não encontrado.");
  }

  const params = new URLSearchParams({
    select: "*",
    user_id: `eq.${userId}`,
    status: "eq.active",
    expires_at: `gt.${new Date().toISOString()}`,
    order: "expires_at.desc",
    limit: "1",
  });

  const r = await fetch(
    `${URL}/rest/v1/jarvis_sessions?${params.toString()}`,
    {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${authSession.access_token}`,
      },
    }
  );

  if (!r.ok) {
    throw new Error(await r.text());
  }

  const rows = await r.json();

  if (!rows?.length) {
    throw new Error(
      "Nenhuma sessão JARVIS ativa foi encontrada."
    );
  }

  return rows[0].id;
}

async function rpc(
  sessionId: string,
  action: string,
  payload: any = {},
  accessToken?: string
) {
  const r = await fetch(`${URL}/rest/v1/rpc/jarvis_command`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${accessToken || KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_session_id: sessionId,
      p_action: action,
      p_payload: payload,
    }),
  });

  if (!r.ok) {
    throw new Error(await r.text());
  }

  return r.json();
}

function Login({
  onLogin,
}: {
  onLogin: (session: AuthSession) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const session = await supabaseAuth(email, password);

      localStorage.setItem(
        "jarvis_auth_session",
        JSON.stringify(session)
      );

      onLogin(session);
    } catch (err: any) {
      setError(
        err?.message || "Falha ao entrar no JARVIS."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleLogin}>
        <div className="login-brand">
          <div className="orb">✦</div>

          <div>
            <b>JARVIS</b>
            <span>BRODE OS</span>
          </div>
        </div>

        <div className="login-title">
          <small>SECURE ACCESS</small>
          <h1>Bem-vindo, Senhor.</h1>
          <p>
            Entre para acessar o estado operacional do BRODE OS.
          </p>
        </div>

        {error && (
          <div className="alert">
            ⚠ {error}
          </div>
        )}

        <label>
          <span>E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            autoComplete="email"
            required
          />
        </label>

        <label>
          <span>Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </label>

        <button
          className="primary login-button"
          type="submit"
          disabled={loading}
        >
          {loading ? "Autenticando…" : "Entrar no JARVIS →"}
        </button>
      </form>
    </div>
  );
}

function App() {
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [jarvisSession, setJarvisSession] = useState<string | null>(
    null
  );

  const [b, setB] = useState<any>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState("Visão geral");
  const [cmd, setCmd] = useState("");

  async function boot(authSession: AuthSession) {
    setLoading(true);
    setErr("");

    try {
      let currentAuth = authSession;

      /*
       * Renova o token caso ele esteja próximo de expirar.
       */
      if (
        currentAuth.expires_at &&
        currentAuth.expires_at * 1000 <
          Date.now() + 60_000 &&
        currentAuth.refresh_token
      ) {
        currentAuth = await refreshAuth(
          currentAuth.refresh_token
        );

        localStorage.setItem(
          "jarvis_auth_session",
          JSON.stringify(currentAuth)
        );

        setAuth(currentAuth);
      }

      const sessionId = await getJarvisSession(currentAuth);

      setJarvisSession(sessionId);

      const data = await rpc(
        sessionId,
        "briefing_core",
        {},
        currentAuth.access_token
      );

      setB(data?.data ?? data);
    } catch (e: any) {
      console.error(e);

      setErr(
        e?.message ||
          "Falha ao sincronizar o BRODE OS."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem(
      "jarvis_auth_session"
    );

    if (!saved) {
      setLoading(false);
      return;
    }

    try {
      const session = JSON.parse(saved);

      setAuth(session);
      boot(session);
    } catch {
      localStorage.removeItem(
        "jarvis_auth_session"
      );

      setLoading(false);
    }
  }, []);

  if (!auth) {
    return (
      <Login
        onLogin={(session) => {
          setAuth(session);
          boot(session);
        }}
      />
    );
  }

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
              <i>
                {["⌂", "◈", "✉", "◉", "◇", "⌁"][i]}
              </i>

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
              O BRODE OS está pronto. Aqui está o que merece
              sua atenção.
            </p>
          </div>

          <div className="status">
            <span className="dot" /> ONLINE
          </div>
        </header>

        {err && (
          <div className="alert">
            ⚠ {err}
          </div>
        )}

        {loading ? (
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

                    <h2>
                      O que merece atenção
                    </h2>
                  </div>

                  <span className="badge yellow">
                    revisar
                  </span>
                </div>

                <div className="attention">
                  <span className="signal y">
                    !
                  </span>

                  <div>
                    <b>
                      Outreach aguardando revisão
                    </b>

                    <p>
                      Existe uma mensagem pronta para
                      análise antes de qualquer ação
                      externa.
                    </p>
                  </div>
                </div>

                <div className="attention">
                  <span className="signal bl">
                    ◈
                  </span>

                  <div>
                    <b>
                      Prospects aguardando
                      qualificação
                    </b>

                    <p>
                      {b?.pending_prospects ?? 0} empresas
                      estão na fila de prospecção.
                    </p>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panelhead">
                  <div>
                    <small>JARVIS</small>

                    <h2>
                      Estado do sistema
                    </h2>
                  </div>

                  <span className="badge green">
                    estável
                  </span>
                </div>

                {[
                  [
                    "Prospecting Queue",
                    "Funcionando",
                  ],
                  [
                    "Outreach Queue",
                    "Funcionando",
                  ],
                  [
                    "Command Router",
                    "Em evolução",
                  ],
                ].map((x) => (
                  <div
                    className="systemline"
                    key={x[0]}
                  >
                    <span>{x[0]}</span>

                    <b>{x[1]}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel next">
              <div>
                <small>PRÓXIMO PASSO</small>

                <h2>
                  Revisar a fila de Outreach
                </h2>

                <p>
                  JARVIS não envia nada externamente
                  sem sua aprovação.
                </p>
              </div>

              <button
                className="primary"
                onClick={() =>
                  setActive("Outreach")
                }
              >
                Abrir Outreach →
              </button>
            </div>

            <div className="command">
              <small>COMMAND CENTER</small>

              <h2>
                O que devo fazer, Senhor?
              </h2>

              <div className="commandrow">
                <input
                  value={cmd}
                  onChange={(e) =>
                    setCmd(e.target.value)
                  }
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

createRoot(
  document.getElementById("root")!
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
