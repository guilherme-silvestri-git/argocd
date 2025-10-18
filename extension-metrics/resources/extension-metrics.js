(function () {
  if (!window.extensionsAPI) {
    console.error("[Metrics Extension] extensionsAPI não disponível. Tentando novamente...");
    setTimeout(arguments.callee, 1000);
    return;
  }

  console.log("[Metrics Extension] Registrando aba Metrics (com fallback sem gráficos)...");

  const MetricsTab = (props) => {
    const e = React.createElement;

    // Descoberta do Deployment/namespace a partir da árvore da Application
    const resources = props?.tree?.nodes || [];
    const appName = props?.application?.metadata?.name || "unknown";
    const deploymentNode = resources.find((r) => r.kind === "Deployment");
    const deploymentName = deploymentNode?.name;
    const namespace = deploymentNode?.namespace || props?.application?.metadata?.namespace || "default";

    // Config Prometheus
    const PROM_QUERY_RANGE = "http://localhost:9090/api/v1/query_range"; // ajuste se usar NodePort/Ingress
    const PROM_QUERY = "http://localhost:9090/api/v1/query";             // para links rápidos
    const RANGE = 10 * 60;  // 10 min
    const STEP  = 30;       // 30s

    const [series, setSeries] = React.useState({
      cpu: [], mem: [], net_rx: [], net_tx: [], fs_write: []
    });
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);

    // Monta queries por Deployment (usa pod prefix = deploymentName)
    function buildQueries(ns, dep) {
      const podRegex = `${dep}.*`;
      return {
        cpu    : `sum(rate(container_cpu_usage_seconds_total{namespace="${ns}",pod=~"${podRegex}"}[2m]))`,
        mem    : `sum(container_memory_usage_bytes{namespace="${ns}",pod=~"${podRegex}"})`,
        net_rx : `sum(rate(container_network_receive_bytes_total{namespace="${ns}",pod=~"${podRegex}"}[2m]))`,
        net_tx : `sum(rate(container_network_transmit_bytes_total{namespace="${ns}",pod=~"${podRegex}"}[2m]))`,
        fs_write: `sum(rate(container_fs_writes_bytes_total{namespace="${ns}",pod=~"${podRegex}"}[2m]))`
      };
    }

    async function fetchRange(query) {
      const end = Math.floor(Date.now() / 1000);
      const start = end - RANGE;
      const url = `${PROM_QUERY_RANGE}?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${STEP}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.error || "Prometheus query failed");
      const values = (json.data?.result?.[0]?.values) || [];
      return values.map(([t, v]) => ({ time: new Date(t * 1000).toLocaleTimeString(), value: Number(v) || 0 }));
    }

    async function load() {
      if (!deploymentName) return;
      setLoading(true);
      setError(null);
      try {
        const q = buildQueries(namespace, deploymentName);
        const [cpu, mem, net_rx, net_tx, fs_write] = await Promise.all([
          fetchRange(q.cpu),
          fetchRange(q.mem),
          fetchRange(q.net_rx),
          fetchRange(q.net_tx),
          fetchRange(q.fs_write)
        ]);
        setSeries({
          cpu: cpu || [],
          mem: mem || [],
          net_rx: net_rx || [],
          net_tx: net_tx || [],
          fs_write: fs_write || []
        });
      } catch (err) {
        console.error("[Metrics Extension] Erro no fetch:", err);
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    }

    React.useEffect(() => {
      load();
      const id = setInterval(load, 10000);
      return () => clearInterval(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deploymentName, namespace]);

    // --------- UI helpers ----------
    const hasRecharts = !!window.Recharts;
    const R = window.Recharts || {};
    const ensureArray = (arr) => Array.isArray(arr) ? arr : [];

    const Section = (title, children) =>
      e("div", { key: title, style: { marginBottom: "24px" } }, [
        e("h3", { style: { color: "#0088cc", marginBottom: "8px" } }, title),
        children
      ]);

    function Chart(data, title, unit) {
      data = ensureArray(data);
      if (!hasRecharts) {
        // Fallback simples: min/max/last + link para abrir a query
        const last = data.length ? data[data.length - 1].value : 0;
        const min = data.length ? Math.min(...data.map(d => d.value)) : 0;
        const max = data.length ? Math.max(...data.map(d => d.value)) : 0;
        return Section(title,
          e("div", null, [
            e("div", null, `last: ${last.toFixed(2)} ${unit}`),
            e("div", null, `min: ${min.toFixed(2)} ${unit}`),
            e("div", null, `max: ${max.toFixed(2)} ${unit}`)
          ])
        );
      }

      // Com Recharts
      const { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer } = R;
      return e("div", { key: title, style: { height: "260px", marginBottom: "24px" } }, [
        e("h3", { style: { color: "#0088cc" } }, title),
        e(R.ResponsiveContainer, { width: "100%", height: 200 },
          e(LineChart, { data },
            e(CartesianGrid, { strokeDasharray: "3 3" }),
            e(XAxis, { dataKey: "time" }),
            e(YAxis, { domain: ["auto", "auto"] }),
            e(Tooltip, { formatter: (v) => `${Number(v).toFixed(2)} ${unit}` }),
            e(Legend),
            e(Line, { type: "monotone", dataKey: "value", stroke: "#82ca9d", dot: false })
          )
        )
      ]);
    }

    // --------- RENDER ----------
    if (!deploymentName) {
      return e("div", { style: { padding: "16px" } },
        `Nenhum Deployment encontrado para a aplicação ${appName}.`);
    }
    if (loading && !Object.values(series).some(a => a && a.length)) {
      return e("div", { style: { padding: "16px" } }, "⏳ Carregando métricas do Prometheus...");
    }
    if (error) {
      return e("div", { style: { color: "red", padding: "16px" } },
        `Erro ao consultar Prometheus: ${error}`);
    }

    return e("div", { style: { padding: "16px" } }, [
      e("h2", { key: "title" }, `📈 Métricas do Deployment: ${deploymentName} ${hasRecharts ? "" : "(visualização simples)"}`),

      Chart(series.cpu, "CPU (cores)", "cores"),
      Chart(series.mem, "Memória (bytes)", "B"),
      Chart(series.net_rx, "Rede RX (bytes/s)", "B/s"),
      Chart(series.net_tx, "Rede TX (bytes/s)", "B/s"),
      Chart(series.fs_write, "Escrita em disco (bytes/s)", "B/s"),

      // Links úteis para abrir no Prometheus (debug)
      e("div", { key: "links", style: { marginTop: "12px", fontSize: "12px", color: "#666" } }, [
        e("div", null, "Dica: se não aparecer gráfico, verifique CORS/porta e teste as queries no Prometheus."),
        e("div", null, `Prometheus (range): ${PROM_QUERY_RANGE}`),
        e("div", null, `Prometheus (instant): ${PROM_QUERY}`)
      ])
    ]);
  };

  window.extensionsAPI.registerResourceExtension(
    MetricsTab,
    "argoproj.io",
    "Application",
    "Metrics",
    { icon: "fa-chart-line" }
  );

  console.log("[Metrics Extension] ✅ Registrada (com fallback).");
})();
