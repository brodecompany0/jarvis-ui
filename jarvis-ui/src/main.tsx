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

type Prospect = {
  id: string;
  company_name?: string;
  website?: string;
  domain?: string;
  industry?: string;
  company_size?: number;
  location?: string;
  fit_status?: string;
  fit_confidence?: number;
  review_status?: string;
  icp_fit_status?: string;
  icp_confidence?: number;
  gaps?: string[];
  recommendations?: string[];
  signal_count?: number;
  contact_count?: number;
  outreach_count?: number;
};

type Outreach = {
  id: string;
  status?: string;
  channel?: string;
  objective?: string;
  angle?: string;
  hook?: string;
  message?: string;
  call_to_action?: string;
  personalization_points?: string[];
  requires_approval?: boolean;
  created_at?: string;
  company_name?: string;
  website?: string;
  fit_status?: string;
  fit_confidence?: number;
  location?: string;
  contact_id?: string;
  full_name?: string;
  job_title?: string;
  department?: string;
  contact_status?: string;
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
    expires_at: `gt.${new Date().toISOString()}`,
    revoked_at: "is.null",
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
    const text = await r.text();

    try {
      const parsed = JSON.parse(text);
      throw new Error(
        parsed?.message ||
          parsed?.error ||
          text
      );
    } catch {
      throw new Error(text);
    }
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
        err?.message ||
          "Falha ao entrar no JARVIS."
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
            Entre para acessar o estado operacional
            do BRODE OS.
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
            onChange={(e) =>
              setEmail(e.target.value)
            }
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
            onChange={(e) =>
              setPassword(e.target.value)
            }
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
          {loading
            ? "Autenticando…"
            : "Entrar no JARVIS →"}
        </button>
      </form>
    </div>
  );
}

function App() {
  const [auth, setAuth] =
    useState<AuthSession | null>(null);

  const [jarvisSession, setJarvisSession] =
    useState<string | null>(null);

  const [briefing, setBriefing] =
    useState<any>(null);

  const [prospects, setProspects] =
    useState<Prospect[]>([]);

  const [outreach, setOutreach] =
    useState<Outreach[]>([]);

  const [projects, setProjects] =
    useState<any[]>([]);

  const [memory, setMemory] =
    useState<any[]>([]);

  const [tasks, setTasks] =
    useState<any[]>([]);

  const [active, setActive] =
    useState("Visão geral");

  const [loading, setLoading] =
    useState(true);

  const [pageLoading, setPageLoading] =
    useState(false);

  const [err, setErr] =
    useState("");

  const [cmd, setCmd] =
    useState("");

  const [commandResult, setCommandResult] =
    useState<any>(null);

  const [commandLoading, setCommandLoading] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState<string | null>(null);

  async function loadBriefing(sessionId: string, token: string) {
    const data = await rpc(
      sessionId,
      "briefing_core",
      {},
      token
    );

    setBriefing(data?.data ?? data);
  }

  async function loadProspects(
    sessionId: string,
    token: string
  ) {
    const data = await rpc(
      sessionId,
      "get_prospecting_queue",
      { limit: 50 },
      token
    );

    setProspects(
      data?.items ??
        data?.data?.items ??
        []
    );
  }

  async function loadOutreach(
    sessionId: string,
    token: string
  ) {
    const data = await rpc(
      sessionId,
      "get_outreach_queue",
      { limit: 50 },
      token
    );

    setOutreach(
      data?.items ??
        data?.data?.items ??
        []
    );
  }

  async function loadCommandCenter(
    sessionId: string,
    token: string
  ) {
    const data = await rpc(
      sessionId,
      "command_center",
      {},
      token
    );

    const result =
      data?.data ?? data;

    setProjects(
      result?.projects ?? []
    );

    setTasks(
      result?.tasks ?? []
    );

    if (result?.briefing) {
      setBriefing(
        result.briefing?.data ??
          result.briefing
      );
    }

    if (result?.prospects) {
      setProspects(
        result.prospects?.items ??
          result.prospects ??
          []
      );
    }

    if (result?.outreach) {
      setOutreach(
        result.outreach?.items ??
          result.outreach ??
          []
      );
    }

    return result;
  }

  async function loadMemory(
    sessionId: string,
    token: string
  ) {
    const data = await rpc(
      sessionId,
      "boot_context",
      {},
      token
    );

    const result =
      data?.data ?? data;

    setMemory(
      result?.memory ?? []
    );

    setProjects(
      result?.projects ?? []
    );

    setTasks(
      result?.pending_tasks ?? []
    );
  }

  async function boot(
    authSession: AuthSession
  ) {
    setLoading(true);
    setErr("");

    try {
      let currentAuth =
        authSession;

      if (
        currentAuth.expires_at &&
        currentAuth.expires_at * 1000 <
          Date.now() + 60_000 &&
        currentAuth.refresh_token
      ) {
        currentAuth =
          await refreshAuth(
            currentAuth.refresh_token
          );

        localStorage.setItem(
          "jarvis_auth_session",
          JSON.stringify(currentAuth)
        );

        setAuth(currentAuth);
      }

      const sessionId =
        await getJarvisSession(
          currentAuth
        );

      setJarvisSession(
        sessionId
      );

      await loadBriefing(
        sessionId,
        currentAuth.access_token
      );

      await loadCommandCenter(
        sessionId,
        currentAuth.access_token
      );
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
    const saved =
      localStorage.getItem(
        "jarvis_auth_session"
      );

    if (!saved) {
      setLoading(false);
      return;
    }

    try {
      const session =
        JSON.parse(saved);

      setAuth(session);
      boot(session);
    } catch {
      localStorage.removeItem(
        "jarvis_auth_session"
      );

      setLoading(false);
    }
  }, []);

  async function navigate(
    page: string
  ) {
    setActive(page);
    setErr("");

    if (
      !jarvisSession ||
      !auth?.access_token
    ) {
      return;
    }

    setPageLoading(true);

    try {
      if (page === "Prospecção") {
        await loadProspects(
          jarvisSession,
          auth.access_token
        );
      }

      if (page === "Outreach") {
        await loadOutreach(
          jarvisSession,
          auth.access_token
        );
      }

      if (page === "Projetos") {
        await loadCommandCenter(
          jarvisSession,
          auth.access_token
        );
      }

      if (page === "Memória") {
        await loadMemory(
          jarvisSession,
          auth.access_token
        );
      }

      if (page === "Command Center") {
        await loadCommandCenter(
          jarvisSession,
          auth.access_token
        );
      }
    } catch (e: any) {
      setErr(
        e?.message ||
          "Não foi possível carregar esta seção."
      );
    } finally {
      setPageLoading(false);
    }
  }

  async function runCommand() {
    const text =
      cmd.trim();

    if (!text) return;

    if (
      !jarvisSession ||
      !auth?.access_token
    ) {
      setErr(
        "Sessão JARVIS não encontrada."
      );
      return;
    }

    setCommandLoading(true);
    setCommandResult(null);
    setErr("");

    try {
      const lower =
        text.toLowerCase();

      let action =
        "briefing_core";

      let payload: any = {};

      if (
        lower.includes("prospect") ||
        lower.includes("lead") ||
        lower.includes("prospecção")
      ) {
        action =
          "get_prospecting_queue";

        payload = {
          limit: 50,
        };
      }

      if (
        lower.includes("outreach") ||
        lower.includes("mensagem") ||
        lower.includes("abordagem")
      ) {
        action =
          "get_outreach_queue";

        payload = {
          limit: 50,
        };
      }

      if (
        lower.includes("projeto") ||
        lower.includes("projetos")
      ) {
        action =
          "command_center";
      }

      if (
        lower.includes("memória") ||
        lower.includes("memoria") ||
        lower.includes("contexto")
      ) {
        action =
          "boot_context";
      }

      if (
        lower.includes("atenção") ||
        lower.includes("atencao") ||
        lower.includes("status") ||
        lower.includes("briefing")
      ) {
        action =
          "briefing_core";
      }

      const result =
        await rpc(
          jarvisSession,
          action,
          payload,
          auth.access_token
        );

      const normalized =
        result?.data ??
        result;

      setCommandResult({
        action,
        data: normalized,
      });

      if (
        action ===
        "get_prospecting_queue"
      ) {
        setProspects(
          normalized?.items ??
            []
        );
      }

      if (
        action ===
        "get_outreach_queue"
      ) {
        setOutreach(
          normalized?.items ??
            []
        );
      }

      if (
        action ===
        "briefing_core"
      ) {
        setBriefing(
          normalized
        );
      }

      if (
        action ===
        "command_center"
      ) {
        setProjects(
          normalized?.projects ??
            []
        );

        setTasks(
          normalized?.tasks ??
            []
        );
      }

      if (
        action ===
        "boot_context"
      ) {
        setMemory(
          normalized?.memory ??
            []
        );
      }
    } catch (e: any) {
      setErr(
        e?.message ||
          "Não foi possível executar o comando."
      );
    } finally {
      setCommandLoading(false);
    }
  }

  async function reviewProspect(
    id: string,
    status: "approved" | "rejected"
  ) {
    if (
      !jarvisSession ||
      !auth?.access_token
    ) {
      return;
    }

    setActionLoading(id);
    setErr("");

    try {
      await rpc(
        jarvisSession,
        "review_prospect",
        {
          result_id: id,
          review_status: status,
        },
        auth.access_token
      );

      await loadProspects(
        jarvisSession,
        auth.access_token
      );

      await loadBriefing(
        jarvisSession,
        auth.access_token
      );
    } catch (e: any) {
      setErr(
        e?.message ||
          "Não foi possível revisar o prospect."
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function analyzeProspect(
    id: string
  ) {
    if (
      !jarvisSession ||
      !auth?.access_token
    ) {
      return;
    }

    setActionLoading(
      `analyze-${id}`
    );

    try {
      await rpc(
        jarvisSession,
        "analyze_prospect_icp",
        {
          result_id: id,
        },
        auth.access_token
      );

      await loadProspects(
        jarvisSession,
        auth.access_token
      );
    } catch (e: any) {
      setErr(
        e?.message ||
          "Não foi possível analisar o prospect."
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function reviewOutreach(
    id: string,
    status:
      | "approved"
      | "rejected"
  ) {
    if (
      !jarvisSession ||
      !auth?.access_token
    ) {
      return;
    }

    setActionLoading(id);
    setErr("");

    try {
      await rpc(
        jarvisSession,
        "review_outreach",
        {
          outreach_id: id,
          status,
        },
        auth.access_token
      );

      await loadOutreach(
        jarvisSession,
        auth.access_token
      );

      await loadBriefing(
        jarvisSession,
        auth.access_token
      );
    } catch (e: any) {
      setErr(
        e?.message ||
          "Não foi possível revisar o outreach."
      );
    } finally {
      setActionLoading(null);
    }
  }

  function formatConfidence(
    value?: number
  ) {
    if (
      value === null ||
      value === undefined
    ) {
      return "—";
    }

    const n =
      Number(value);

    if (n <= 1) {
      return `${Math.round(
        n * 100
      )}%`;
    }

    return `${Math.round(n)}%`;
  }

  function formatDate(
    value?: string
  ) {
    if (!value) return "";

    try {
      return new Date(
        value
      ).toLocaleString(
        "pt-BR",
        {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }
      );
    } catch {
      return "";
    }
  }

  function statusLabel(
    value?: string
  ) {
    if (!value) return "—";

    const labels: Record<
      string,
      string
    > = {
      qualified: "Qualificado",
      partial: "Parcial",
      unconfirmed: "Não confirmado",
      not_fit: "Fora do ICP",
      approved: "Aprovado",
      rejected: "Rejeitado",
      pending: "Pendente",
      draft: "Rascunho",
      review: "Em revisão",
    };

    return (
      labels[value] ||
      value
    );
  }

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

  const metrics = [
    [
      "Ações abertas",
      briefing?.open_actions ?? "—",
    ],
    [
      "Prospects pendentes",
      briefing?.pending_prospects ?? "—",
    ],
    [
      "Outreach em revisão",
      briefing?.outreach_review ?? "—",
    ],
    [
      "Projetos ativos",
      briefing?.active_projects ?? "—",
    ],
  ];

  function renderOverview() {
    return (
      <section>
        <div className="grid">
          {metrics.map(
            ([label, value]) => (
              <div
                className="metric"
                key={label}
              >
                <span>{label}</span>

                <strong>{value}</strong>
              </div>
            )
          )}
        </div>

        <div className="cols">
          <div className="panel">
            <div className="panelhead">
              <div>
                <small>
                  ATENÇÃO
                </small>

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
                  Outreach aguardando
                  revisão
                </b>

                <p>
                  Existe mensagem pronta
                  para análise antes de
                  qualquer ação externa.
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
                  {briefing?.pending_prospects ??
                    0}{" "}
                  empresas estão na fila
                  de prospecção.
                </p>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panelhead">
              <div>
                <small>
                  JARVIS
                </small>

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
                "Operacional",
              ],
            ].map(
              ([name, status]) => (
                <div
                  className="systemline"
                  key={name}
                >
                  <span>{name}</span>

                  <b>{status}</b>
                </div>
              )
            )}
          </div>
        </div>

        <div className="panel next">
          <div>
            <small>
              PRÓXIMO PASSO
            </small>

            <h2>
              Revisar a fila de Outreach
            </h2>

            <p>
              JARVIS não envia nada
              externamente sem sua
              aprovação.
            </p>
          </div>

          <button
            className="primary"
            onClick={() =>
              navigate("Outreach")
            }
          >
            Abrir Outreach →
          </button>
        </div>

        <CommandBox />
      </section>
    );
  }

  function renderProspecting() {
    return (
      <section>
        <div className="panel">
          <div className="panelhead">
            <div>
              <small>
                PROSPECÇÃO
              </small>

              <h2>
                Fila de prospects
              </h2>
            </div>

            <span className="badge blue">
              {prospects.length} pendentes
            </span>
          </div>

          {prospects.length === 0 ? (
            <div className="loading">
              Nenhum prospect pendente.
            </div>
          ) : (
            prospects.map(
              (p) => (
                <div
                  className="attention"
                  key={p.id}
                  style={{
                    alignItems:
                      "flex-start",
                  }}
                >
                  <span className="signal bl">
                    ◈
                  </span>

                  <div
                    style={{
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: "16px",
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <div>
                        <b>
                          {p.company_name ||
                            "Empresa sem nome"}
                        </b>

                        <p>
                          {p.industry ||
                            "Setor não informado"}
                          {" · "}
                          {p.location ||
                            "Localização não confirmada"}
                        </p>
                      </div>

                      <span className="badge yellow">
                        {statusLabel(
                          p.fit_status
                        )}
                      </span>
                    </div>

                    <p>
                      Confiança ICP:{" "}
                      <b>
                        {formatConfidence(
                          p.fit_confidence
                        )}
                      </b>
                    </p>

                    {p.gaps &&
                      p.gaps.length > 0 && (
                        <p>
                          <b>
                            Lacuna:
                          </b>{" "}
                          {p.gaps.join(
                            " · "
                          )}
                        </p>
                      )}

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginTop:
                          "12px",
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <button
                        className="primary"
                        disabled={
                          actionLoading ===
                          `analyze-${p.id}`
                        }
                        onClick={() =>
                          analyzeProspect(
                            p.id
                          )
                        }
                      >
                        {actionLoading ===
                        `analyze-${p.id}`
                          ? "Analisando…"
                          : "Analisar ICP"}
                      </button>

                      <button
                        className="primary"
                        disabled={
                          actionLoading ===
                          p.id
                        }
                        onClick={() =>
                          reviewProspect(
                            p.id,
                            "approved"
                          )
                        }
                      >
                        Aprovar
                      </button>

                      <button
                        disabled={
                          actionLoading ===
                          p.id
                        }
                        onClick={() =>
                          reviewProspect(
                            p.id,
                            "rejected"
                          )
                        }
                      >
                        Rejeitar
                      </button>
                    </div>
                  </div>
                </div>
              )
            )
          )}
        </div>

        <CommandBox />
      </section>
    );
  }

  function renderOutreach() {
    return (
      <section>
        <div className="panel">
          <div className="panelhead">
            <div>
              <small>
                OUTREACH
              </small>

              <h2>
                Fila de abordagens
              </h2>
            </div>

            <span className="badge yellow">
              {outreach.length} em revisão
            </span>
          </div>

          {outreach.length === 0 ? (
            <div className="loading">
              Nenhum outreach aguardando
              revisão.
            </div>
          ) : (
            outreach.map(
              (o) => (
                <div
                  className="attention"
                  key={o.id}
                  style={{
                    alignItems:
                      "flex-start",
                  }}
                >
                  <span className="signal y">
                    !
                  </span>

                  <div
                    style={{
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: "16px",
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <div>
                        <b>
                          {o.company_name ||
                            "Empresa"}
                        </b>

                        <p>
                          {o.full_name
                            ? `${o.full_name}${
                                o.job_title
                                  ? ` · ${o.job_title}`
                                  : ""
                              }`
                            : "Contato ainda não definido"}
                        </p>
                      </div>

                      <span className="badge yellow">
                        {statusLabel(
                          o.status
                        )}
                      </span>
                    </div>

                    <p>
                      <b>
                        Ângulo:
                      </b>{" "}
                      {o.angle ||
                        "Não informado"}
                    </p>

                    {o.hook && (
                      <p>
                        <b>
                          Hook:
                        </b>{" "}
                        {o.hook}
                      </p>
                    )}

                    {o.message && (
                      <div
                        style={{
                          marginTop:
                            "12px",
                          padding:
                            "14px",
                          border:
                            "1px solid rgba(255,255,255,.08)",
                          borderRadius:
                            "10px",
                          background:
                            "rgba(255,255,255,.02)",
                        }}
                      >
                        <p
                          style={{
                            whiteSpace:
                              "pre-wrap",
                          }}
                        >
                          {o.message}
                        </p>
                      </div>
                    )}

                    {o.call_to_action && (
                      <p>
                        <b>
                          CTA:
                        </b>{" "}
                        {o.call_to_action}
                      </p>
                    )}

                    <p>
                      Criado em{" "}
                      {formatDate(
                        o.created_at
                      )}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginTop:
                          "12px",
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <button
                        className="primary"
                        disabled={
                          actionLoading ===
                          o.id
                        }
                        onClick={() =>
                          reviewOutreach(
                            o.id,
                            "approved"
                          )
                        }
                      >
                        Aprovar
                      </button>

                      <button
                        disabled={
                          actionLoading ===
                          o.id
                        }
                        onClick={() =>
                          reviewOutreach(
                            o.id,
                            "rejected"
                          )
                        }
                      >
                        Rejeitar
                      </button>
                    </div>
                  </div>
                </div>
              )
            )
          )}
        </div>

        <CommandBox />
      </section>
    );
  }

  function renderProjects() {
    return (
      <section>
        <div className="cols">
          <div className="panel">
            <div className="panelhead">
              <div>
                <small>
                  PROJETOS
                </small>

                <h2>
                  Projetos ativos
                </h2>
              </div>

              <span className="badge green">
                {projects.length}
              </span>
            </div>

            {projects.length === 0 ? (
              <div className="loading">
                Nenhum projeto ativo.
              </div>
            ) : (
              projects.map(
                (p) => (
                  <div
                    className="attention"
                    key={p.id}
                  >
                    <span className="signal bl">
                      ◉
                    </span>

                    <div>
                      <b>
                        {p.name}
                      </b>

                      <p>
                        {p.objective ||
                          p.description ||
                          "Sem objetivo definido."}
                      </p>

                      <p>
                        Estado:{" "}
                        {p.current_state ||
                          "Não informado"}
                      </p>

                      <p>
                        Próximo passo:{" "}
                        {p.next_action ||
                          "Não definido"}
                      </p>
                    </div>
                  </div>
                )
              )
            )}
          </div>

          <div className="panel">
            <div className="panelhead">
              <div>
                <small>
                  TAREFAS
                </small>

                <h2>
                  Próximas tarefas
                </h2>
              </div>

              <span className="badge yellow">
                {tasks.length}
              </span>
            </div>

            {tasks.length === 0 ? (
              <div className="loading">
                Nenhuma tarefa pendente.
              </div>
            ) : (
              tasks.map(
                (t) => (
                  <div
                    className="systemline"
                    key={t.id}
                  >
                    <span>
                      {t.title}
                    </span>

                    <b>
                      {t.priority ||
                        "normal"}
                    </b>
                  </div>
                )
              )
            )}
          </div>
        </div>

        <CommandBox />
      </section>
    );
  }

  function renderMemory() {
    return (
      <section>
        <div className="panel">
          <div className="panelhead">
            <div>
              <small>
                MEMÓRIA
              </small>

              <h2>
                Memória operacional
              </h2>
            </div>

            <span className="badge blue">
              {memory.length}
            </span>
          </div>

          {memory.length === 0 ? (
            <div className="loading">
              Nenhuma memória encontrada.
            </div>
          ) : (
            memory.map(
              (m) => (
                <div
                  className="attention"
                  key={m.id}
                >
                  <span className="signal bl">
                    ◇
                  </span>

                  <div>
                    <b>
                      {m.title ||
                        "Memória"}
                    </b>

                    <p>
                      {m.summary ||
                        m.content ||
                        "Sem conteúdo."}
                    </p>

                    {m.importance && (
                      <p>
                        Importância:{" "}
                        {m.importance}
                      </p>
                    )}
                  </div>
                </div>
              )
            )
          )}
        </div>

        <CommandBox />
      </section>
    );
  }

  function renderCommandCenter() {
    return (
      <section>
        <div className="panel">
          <div className="panelhead">
            <div>
              <small>
                COMMAND CENTER
              </small>

              <h2>
                Centro de comando
              </h2>
            </div>

            <span className="badge green">
              operacional
            </span>
          </div>

          <p>
            Dê uma instrução em linguagem natural.
            O JARVIS traduz comandos simples para
            as ações disponíveis no BRODE OS.
          </p>

          <CommandBox />

          {commandResult && (
            <div
              className="attention"
              style={{
                alignItems:
                  "flex-start",
                marginTop:
                  "20px",
              }}
            >
              <span className="signal bl">
                ✦
              </span>

              <div
                style={{
                  width: "100%",
                }}
              >
                <b>
                  Comando executado
                </b>

                <p>
                  Ação:{" "}
                  <strong>
                    {commandResult.action}
                  </strong>
                </p>

                <pre
                  style={{
                    whiteSpace:
                      "pre-wrap",
                    wordBreak:
                      "break-word",
                    marginTop:
                      "12px",
                    opacity:
                      0.85,
                  }}
                >
                  {JSON.stringify(
                    commandResult.data,
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  function CommandBox() {
    return (
      <div className="command">
        <small>
          COMMAND CENTER
        </small>

        <h2>
          O que devo fazer, Senhor?
        </h2>

        <div className="commandrow">
          <input
            value={cmd}
            onChange={(e) =>
              setCmd(e.target.value)
            }
            onKeyDown={(e) => {
              if (
                e.key === "Enter"
              ) {
                runCommand();
              }
            }}
            placeholder="Ex.: mostre os prospects pendentes…"
          />

          <button
            className="primary"
            disabled={commandLoading}
            onClick={runCommand}
          >
            {commandLoading
              ? "Executando…"
              : "Executar"}
          </button>
        </div>

        <p
          style={{
            marginTop: "10px",
            opacity: 0.6,
            fontSize: "12px",
          }}
        >
          Exemplos: “mostre os prospects” ·
          “abra o outreach” · “mostre os projetos”
          · “mostre minha memória”
        </p>
      </div>
    );
  }

  let content =
    renderOverview();

  if (active === "Prospecção") {
    content =
      renderProspecting();
  }

  if (active === "Outreach") {
    content =
      renderOutreach();
  }

  if (active === "Projetos") {
    content =
      renderProjects();
  }

  if (active === "Memória") {
    content =
      renderMemory();
  }

  if (
    active ===
    "Command Center"
  ) {
    content =
      renderCommandCenter();
  }

  return (
    <div className="app">
      <aside>
        <div className="brand">
          <div className="orb">
            ✦
          </div>

          <div>
            <b>
              JARVIS
            </b>

            <span>
              BRODE OS
            </span>
          </div>
        </div>

        <nav>
          {nav.map(
            (n, i) => (
              <button
                className={
                  active === n
                    ? "active"
                    : ""
                }
                onClick={() =>
                  navigate(n)
                }
                key={n}
              >
                <i>
                  {
                    [
                      "⌂",
                      "◈",
                      "✉",
                      "◉",
                      "◇",
                      "⌁",
                    ][i]
                  }
                </i>

                {n}
              </button>
            )
          )}
        </nav>

        <div className="sidefoot">
          <span className="dot" />

          Sistema operacional
          conectado

          <button
            style={{
              marginTop: "12px",
              background:
                "transparent",
              border: 0,
              color:
                "rgba(255,255,255,.45)",
              cursor:
                "pointer",
              fontSize:
                "11px",
            }}
            onClick={() => {
              localStorage.removeItem(
                "jarvis_auth_session"
              );

              setAuth(null);
              setJarvisSession(
                null
              );
            }}
          >
            Encerrar sessão
          </button>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <small>
              {active ===
              "Visão geral"
                ? "COMMAND CENTER"
                : active.toUpperCase()}
            </small>

            <h1>
              {active ===
              "Visão geral"
                ? "Boa tarde, Senhor."
                : active}
            </h1>

            <p>
              {active ===
              "Visão geral"
                ? "O BRODE OS está pronto. Aqui está o que merece sua atenção."
                : "Estado operacional conectado ao BRODE OS."}
            </p>
          </div>

          <div className="status">
            <span className="dot" />

            ONLINE
          </div>
        </header>

        {err && (
          <div className="alert">
            ⚠ {err}
          </div>
        )}

        {loading ? (
          <div className="loading">
            Sincronizando estado
            operacional…
          </div>
        ) : pageLoading ? (
          <div className="loading">
            Carregando
            {active ===
            "Prospecção"
              ? " prospects"
              : active ===
                "Outreach"
              ? " outreach"
              : active ===
                "Projetos"
              ? " projetos"
              : active ===
                "Memória"
              ? " memória"
              : ""}…
          </div>
        ) : (
          content
        )}
      </main>
    </div>
  );
}

createRoot(
  document.getElementById(
    "root"
  )!
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
