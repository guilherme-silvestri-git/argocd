(function () {
  // ---- Carrega Recharts dinamicamente via CDN ----
  async function ensureRecharts() {
    if (window.Recharts) {
      console.log("[Metrics Extension] Recharts já carregado.");
      return;
    }

    console.log("[Metrics Extension] Carregando Recharts via CDN...");
    const script = document.createElement("script");
    script.src = "https://unpkg.com/recharts@2.12.1/umd/Recharts.min.js";
    document.head.appendChild(script);

    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => reject("Falha ao carregar Recharts via CDN");
    });
  }

  // ---- Inicializa a extensão ----
  async function init() {
    await ensureRecharts();

    if (!window.extensionsAPI) {
      console.warn("[Metrics Extension] extensionsAPI ainda não disponível, tentando novamente...");
      setTimeout(init, 2000);
      return;
    }

    console.log("[Metrics Extension] Registrando aba Metrics com gráficos...");

    const MetricsTab = (props) => {
      const e = React.createElement;
      const appName = props?.application?.metadata?.name || "unknown";
      const resources = props?.tree?.nodes || [];
      const [metrics, setMetrics] = React.useState({});
      const [loading, setLoading] = React.useState(false);
      const [error, setError] = React.useState(null);

      const deploymentNode = resources.find((r) => r.kind === "Deployment");
      const deploymentName = deploymentNode?.name;
      const namespace = deploymentNode?.namespace || props?.application?.metadata?.namespace || "default";

      // 🔹 Endpoint Prometheus local (ajuste se estiver fora do Kind)
      const PROM_URL = "http://localhost:9090/api/v1/query_range";
      const RANGE = 600; // 10 min
      const STEP = 30;   // intervalo 30s

      const fetchMetrics = async () => {
        if (!deploymentName) return;
        setLoading(true);
        setError(null);

        try {
          const podRegex = `${deploymentName}.*`;
          const end = Math.floor(Date.now() / 1000);
          const start = end - RANGE;

          const queries = {
            cpu: `sum(rate(container_cpu_usage_seconds_total{namespace="${namespace}",pod=~"${podRegex}"}[2m]))`,
            mem: `sum(container_memory_usage_bytes{namespace="${namespace}",pod=~"${podRegex}"})`,
            net_rx: `sum(rate(container_network_receive_bytes_total{namespace="${namespace}",pod=~"${podRegex}"}[2m]))`,
            net_tx: `sum(rate(container_network_transmit_bytes_total{namespace="${namespace}",pod=~"${podRegex}"}[2m]))`,
            fs_write: `sum(rate(container_fs_writes_bytes_total{namespace="${namespace}",pod=~"${podRegex}"}[2m]))`
          };

          const results = {};
          for (const [key, query] of Object.entries(queries)) {
            const url = `${PROM_URL}?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${STEP}`;
            const res = await fetch(url);
            const json = await res.json();
            results[key] = json.data?.result?.[0]?.values?.map(([t, v]) => ({
              time: new Date(t * 1000).toLocaleTimeString(),
              value: parseFloat(v)
            })) ?? [];
          }

          setMetrics(results);
        } catch (err) {
          setError(err.message);
          console.error("[Metrics Extension] Erro ao buscar métricas:", err);
        } finally {
          setLoading(false);
        }
      };

      React.useEffect(() => {
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 10000);
        return () => clearInterval(interval);
      }, [deploymentName]);

      // ---- Recharts Components ----
      const { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer } = window.Recharts;

      if (!deploymentName)
        return e("div", null, `Nenhum Deployment encontrado para ${appName}`);
      if (loading && !Object.keys(metrics).length)
        return e("div", null, "Carregando métricas do Prometheus...");
      if (error)
        return e("div", { style: { color: "red" } }, `Erro: ${error}`);

      const chart = (data, title, unit, color) =>
        e("div", { key: title, style: { height: "250px", marginBottom: "30px" } }, [
          e("h3", { style: { color: "#00bcd4" } }, title),
          e(ResponsiveContainer, { width: "100%", height: 200 },
            e(LineChart, { data },
              e(CartesianGrid, { strokeDasharray: "3 3" }),
              e(XAxis, { dataKey: "time", hide: true }),
              e(YAxis, { domain: ["auto", "auto"], tickFormatter: (v) => `${v.toFixed(2)}` }),
              e(Tooltip, { formatter: (v) => `${v.toFixed(2)} ${unit}` }),
              e(Legend),
              e(Line, { type: "monotone", dataKey: "value", stroke: color, dot: false })
            )
          )
        ]);

      return e("div", { style: { padding: "16px" } }, [
        e("h2", { key: "title" }, `📊 Métricas do Deployment: ${deploymentName}`),
        chart(metrics.cpu, "Uso de CPU (cores)", "cores", "#f44336"),
        chart(metrics.mem, "Uso de Memória (bytes)", "B", "#2196f3"),
        chart(metrics.net_rx, "Rede RX (bytes/s)", "B/s", "#4caf50"),
        chart(metrics.net_tx, "Rede TX (bytes/s)", "B/s", "#ff9800"),
        chart(metrics.fs_write, "Escrita em Disco (bytes/s)", "B/s", "#9c27b0")
      ]);
    };

    window.extensionsAPI.registerResourceExtension(
      MetricsTab,
      "argoproj.io",
      "Application",
      "Metrics"
    );

    console.log("[Metrics Extension] ✅ Registrada com gráficos!");
  }

  init();
})();
