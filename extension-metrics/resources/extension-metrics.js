(function () {
  if (!window.extensionsAPI) {
    console.error("[Metrics Extension] extensionsAPI não disponível. Tentando novamente...");
    setTimeout(arguments.callee, 1000);
    return;
  }

  console.log("[Metrics Extension] Registrando aba Metrics (via Proxy Extension)...");

  const MetricsTab = (props) => {
    const e = React.createElement;

    // --- Descoberta de Deployment / Namespace ---
    const resources = props?.tree?.nodes || [];
    const appName = props?.application?.metadata?.name || "unknown";
    const deploymentNode = resources.find((r) => r.kind === "Deployment");
    const deploymentName = deploymentNode?.name;
    const namespace = deploymentNode?.namespace || props?.application?.metadata?.namespace || "default";

    // --- Configuração do Proxy Prometheus ---
    // Usando o endpoint seguro exposto pelo ArgoCD API server
    const PROM_QUERY_RANGE = "/extensions/prometheus/api/v1/query_range";
    const PROM_QUERY = "/extensions/prometheus/api/v1/query";
    const RANGE = 10 * 60; // 10 minutos
    const STEP = 30;       // 30 segundos

    const [series, setSeries] = React.useState({
      cpu: [], mem: [], net_rx: [], net_tx: [], fs_write: []
    });
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);

    // --- Monta as queries ---
    function buildQueries(ns, dep) {
      const podRegex = `${dep}.*`;
      return {
        cpu: `sum(rate(container_cpu_usage_seconds_total{namespace="${ns}",pod=~"${podRegex}"}[2m]))`,
        mem: `sum(container_memory_usage_bytes{namespace="${ns}",pod=~"${podRegex}"})`,
        net_rx: `sum(rate(container_network_receive_bytes_total{namespace="${ns}",pod=~"${podRegex}"}[2m]))`,
        net_tx: `sum(rate(container_network_transmit_bytes_total{namespace="${ns}",pod=~"${podRegex}"}[2m]))`,
        fs_write: `sum(rate(container_fs_writes_bytes_total{namespace="${ns}",pod=~"${podRegex}"}[2m]))`
      };
    }

    // --- Consulta ao Prometheus via proxy ---
    async function fetchRange(query) {
      const end = Math.floor(Date.now() / 1000);
      const start = end - RANGE;
      const url = `${PROM_QUERY_RANGE}?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${STEP}`;

      const res = await fetch(url, {
        credentials: "include", // importante para o cookie do ArgoCD
        headers: {
          "Content-Type": "application/json"
        }
      });

      const json = await res.json();
      if (json.status !== "success") throw new Error(json.error || "Falha na query Prometheus");
      const values = json.data?.result?.[0]?.values || [];
      return values.map(([t, v]) => ({
        time: new Date(t * 1000).toLocaleTimeString(),
        value: parseFloat(v) || 0
      }));
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
        setSeries({ cpu, mem, net_rx, net_tx, fs_write });
      } catch (err) {
        console.error("[Metrics Extension] Erro ao buscar métricas:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    React.useEffect(() => {
      load();
      const id = setInterval(load, 15000);
      return () => clearInterval(id);
    }, [deploymentName, namespace]);

    // --- UI Helpers ---
    const hasRecharts = !!window.Recharts;
    const R = window.Recharts || {};
    const Section = (title, children) =>
      e("div", { key: title, style: { marginBottom: "24px" } }, [
        e("h3", { style: { color: "#0088cc", marginBottom: "8px" } }, title),
        children
      ]);

    const Chart = (data, title, unit) => {
      if (!hasRecharts) {
        const last = data.length ? data[data.length - 1].value : 0;
        const min = data.length ? Math.min(...data.map(d => d.value)) : 0;
        const max = data.length ? Math.max(...data.map(d => d.value)) : 0;
        return Section(title, e("div", null, [
          e("div", null, `last: ${last.toFixed(2)} ${unit}`),
          e("div", null, `min: ${min.toFixed(2)} ${unit}`),
          e("div", null, `max: ${max.toFixed(2)} ${unit}`)
        ]));
      }

      const { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer } = R;
      return e("div", { key: title, style: { height: "260px", marginBottom: "24px" } }, [
        e("h3", { style: { color: "#0088cc" } }, title),
        e(ResponsiveContainer, { width: "100%", height: 200 },
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
    };

    // --- Renderização final ---
    if (!deploymentName)
      return e("div", { style: { padding: "16px" } }, `Nenhum Deployment encontrado para ${appName}`);
    if (loading && !Object.values(series).some(s => s.length))
      return e("div", { style: { padding: "16px" } }, "⏳ Carregando métricas...");
    if (error)
      return e("div", { style: { color: "red", padding: "16px" } }, `Erro: ${error}`);

    return e("div", { style: { padding: "16px" } }, [
      e("h2", null, `📊 Métricas de ${deploymentName}`),
      Chart(series.cpu, "CPU (cores)", "cores"),
      Chart(series.mem, "Memória (bytes)", "B"),
      Chart(series.net_rx, "Rede RX (bytes/s)", "B/s"),
      Chart(series.net_tx, "Rede TX (bytes/s)", "B/s"),
      Chart(series.fs_write, "Escrita em disco (bytes/s)", "B/s")
    ]);
  };

  // --- Registro ---
  window.extensionsAPI.registerResourceExtension(
    MetricsTab,
    "argoproj.io",
    "Application",
    "Metrics",
    { icon: "fa-chart-line" }
  );

  console.log("[Metrics Extension] ✅ Registrada com proxy Prometheus.");
})();
