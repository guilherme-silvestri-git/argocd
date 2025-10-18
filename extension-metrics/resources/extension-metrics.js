(function () {
  async function ensureRecharts() {
    if (window.Recharts) {
      console.log("[Metrics Extension] Recharts já disponível.");
      return;
    }

    console.log("[Metrics Extension] Carregando Recharts local...");
    const script = document.createElement("script");
    // ⚠️ O caminho aqui é RELATIVO ao /tmp/extensions/resources/
    script.src = "extensions/resources/recharts.min.js";
    script.type = "text/javascript";
    script.onload = () => console.log("[Metrics Extension] Recharts carregado!");
    script.onerror = (err) => console.error("[Metrics Extension] Falha ao carregar Recharts local", err);
    document.head.appendChild(script);

    await new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.Recharts) {
          clearInterval(check);
          resolve();
        }
      }, 500);
    });
  }

  async function init() {
    await ensureRecharts();

    if (!window.extensionsAPI) {
      console.log("[Metrics Extension] Esperando extensionsAPI...");
      setTimeout(init, 1500);
      return;
    }

    console.log("[Metrics Extension] Registrando aba Metrics...");

    const MetricsTab = (props) => {
      const e = React.createElement;
      const resources = props?.tree?.nodes || [];
      const [metrics, setMetrics] = React.useState({});
      const [error, setError] = React.useState(null);

      const deploymentNode = resources.find((r) => r.kind === "Deployment");
      const deploymentName = deploymentNode?.name;
      const namespace = deploymentNode?.namespace || "default";

      const PROM_URL = "http://localhost:9090/api/v1/query_range";
      const RANGE = 600;
      const STEP = 30;

      const fetchMetrics = async () => {
        try {
          const podRegex = `${deploymentName}.*`;
          const end = Math.floor(Date.now() / 1000);
          const start = end - RANGE;

          const queries = {
            cpu: `sum(rate(container_cpu_usage_seconds_total{namespace="${namespace}",pod=~"${podRegex}"}[2m]))`,
            mem: `sum(container_memory_usage_bytes{namespace="${namespace}",pod=~"${podRegex}"})`,
            net_rx: `sum(rate(container_network_receive_bytes_total{namespace="${namespace}",pod=~"${podRegex}"}[2m]))`,
            net_tx: `sum(rate(container_network_transmit_bytes_total{namespace="${namespace}",pod=~"${podRegex}"}[2m]))`,
          };

          const results = {};
          for (const [key, query] of Object.entries(queries)) {
            const res = await fetch(`${PROM_URL}?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${STEP}`);
            const json = await res.json();
            results[key] = json.data?.result?.[0]?.values?.map(([t, v]) => ({
              time: new Date(t * 1000).toLocaleTimeString(),
              value: parseFloat(v),
            })) ?? [];
          }
          setMetrics(results);
        } catch (err) {
          console.error("[Metrics Extension] Erro ao buscar métricas:", err);
          setError(err.message);
        }
      };

      React.useEffect(() => {
        fetchMetrics();
        const i = setInterval(fetchMetrics, 10000);
        return () => clearInterval(i);
      }, [deploymentName]);

      const { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } = window.Recharts || {};

      if (!deploymentName) return e("div", null, "Nenhum Deployment encontrado.");
      if (error) return e("div", { style: { color: "red" } }, error);

      const chart = (data, title, color, unit) =>
        e("div", { key: title, style: { height: "250px", marginBottom: "30px" } }, [
          e("h3", { style: { color: "#00bcd4" } }, title),
          e(ResponsiveContainer, { width: "100%", height: 200 },
            e(LineChart, { data },
              e(CartesianGrid, { strokeDasharray: "3 3" }),
              e(XAxis, { dataKey: "time", hide: true }),
              e(YAxis, { domain: ["auto", "auto"] }),
              e(Tooltip, { formatter: (v) => `${v.toFixed(2)} ${unit}` }),
              e(Line, { type: "monotone", dataKey: "value", stroke: color, dot: false })
            )
          )
        ]);

      return e("div", { style: { padding: "16px" } }, [
        e("h2", null, `📊 Métricas de ${deploymentName}`),
        chart(metrics.cpu, "CPU (cores)", "#f44336", "cores"),
        chart(metrics.mem, "Memória (bytes)", "#2196f3", "B"),
        chart(metrics.net_rx, "Rede RX (bytes/s)", "#4caf50", "B/s"),
        chart(metrics.net_tx, "Rede TX (bytes/s)", "#ff9800", "B/s"),
      ]);
    };

    window.extensionsAPI.registerResourceExtension(
      MetricsTab,
      "argoproj.io",
      "Application",
      "Metrics"
    );

    console.log("[Metrics Extension] ✅ Registrada com gráficos locais!");
  }

  init();
})();
