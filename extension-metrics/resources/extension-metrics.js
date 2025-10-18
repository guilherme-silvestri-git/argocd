((window) => {
  if (!window.extensionsAPI) {
    console.error("[Metrics Extension] ArgoExtensionAPI não encontrado!");
    return;
  }

  console.log("[Metrics Extension] Registrando aba de métricas...");

  const MetricsTab = (props) => {
    const e = React.createElement;
    const [data, setData] = React.useState({ cpu: "0", memory: "0" });
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    // 🧠 URL do Prometheus — altere conforme seu ambiente
    // Se o ArgoCD estiver dentro do cluster kind, use:
    const PROM_URL = "http://localhost:9090/api/v1/query";

    // Nome da Application (vem do Argo)
    const appName = props?.application?.metadata?.name;

    // Queries PromQL
    const queries = {
      cpu: `sum(rate(container_cpu_usage_seconds_total{namespace="argocd",pod=~"${appName}.*"}[5m]))`,
      memory: `sum(container_memory_usage_bytes{namespace="argocd",pod=~"${appName}.*"}) / (1024*1024)`,
    };

    // Função que busca métricas do Prometheus
    async function fetchMetrics() {
      try {
        setLoading(true);
        const [cpuResp, memResp] = await Promise.all([
          fetch(`${PROM_URL}?query=${encodeURIComponent(queries.cpu)}`),
          fetch(`${PROM_URL}?query=${encodeURIComponent(queries.memory)}`),
        ]);

        const cpuData = await cpuResp.json();
        const memData = await memResp.json();

        setData({
          cpu: cpuData.data?.result?.[0]?.value?.[1] || "0",
          memory: memData.data?.result?.[0]?.value?.[1] || "0",
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    React.useEffect(() => {
      fetchMetrics();
      const interval = setInterval(fetchMetrics, 10000);
      return () => clearInterval(interval);
    }, [appName]);

    if (loading) return e("p", {}, "⏳ Carregando métricas...");
    if (error) return e("p", { style: { color: "red" } }, `Erro: ${error}`);

    return e("div", { style: { padding: "16px" } }, [
      e("h2", { key: "title" }, `📊 Métricas de ${appName}`),
      e("p", { key: "cpu" }, `CPU (5m média): ${Number(data.cpu).toFixed(3)} cores`),
      e("p", { key: "mem" }, `Memória: ${Number(data.memory).toFixed(2)} MiB`),
      e("small", { key: "note", style: { color: "#888" } }, "Atualiza a cada 10 segundos."),
    ]);
  };

  // Registra a aba no Argo CD
  window.extensionsAPI.registerResourceExtension(
    MetricsTab,
    "argoproj.io",
    "Application",
    "Metrics",
    { icon: "fa-chart-line" }
  );

  console.log("[Metrics Extension] ✅ Aba de métricas registrada com sucesso!");
})(window);
