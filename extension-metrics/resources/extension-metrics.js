(function () {
  if (!window.extensionsAPI) {
    console.error("[Metrics Extension] API não encontrada, aguardando...");
    setTimeout(arguments.callee, 2000);
    return;
  }

  console.log("[Metrics Extension] Registrando aba Metrics...");

  const MetricsTab = (props) => {
    const e = React.createElement;
    const appName = props?.application?.metadata?.name || "unknown";
    const resources = props?.tree?.nodes || [];
    const [metrics, setMetrics] = React.useState(null);
    const [loading, setLoading] = React.useState(false);

    // 🔍 procura Deployment dentro da árvore da Application
    const deploymentNode = resources.find((r) => r.kind === "Deployment");
    const deploymentName = deploymentNode?.name;
    const namespace = deploymentNode?.namespace || props?.application?.metadata?.namespace || "default";

    const PROM_URL = "http://localhost:9090/api/v1/query"; // 🔸 ou use o NodePort

    const fetchMetrics = async () => {
      if (!deploymentName) return;
      setLoading(true);

      try {
        // 🔹 Busca os pods que pertencem ao deployment (prefixo do nome)
        const podPrefix = deploymentName;

        // CPU e Memória por pod
        const cpuQuery = `sum(rate(container_cpu_usage_seconds_total{namespace="${namespace}", pod=~"${podPrefix}.*"}[5m]))`;
        const memQuery = `sum(container_memory_usage_bytes{namespace="${namespace}", pod=~"${podPrefix}.*"})`;

        const [cpuRes, memRes] = await Promise.all([
          fetch(`${PROM_URL}?query=${encodeURIComponent(cpuQuery)}`).then((r) => r.json()),
          fetch(`${PROM_URL}?query=${encodeURIComponent(memQuery)}`).then((r) => r.json())
        ]);

        setMetrics({
          cpu: cpuRes.data?.result?.[0]?.value?.[1] ?? "0",
          mem: memRes.data?.result?.[0]?.value?.[1] ?? "0"
        });
      } catch (err) {
        console.error("[Metrics Extension] Erro ao buscar métricas:", err);
      } finally {
        setLoading(false);
      }
    };

    React.useEffect(() => {
      fetchMetrics();
    }, [deploymentName]);

    if (!deploymentName) {
      return e("div", null, `Nenhum Deployment encontrado na aplicação ${appName}`);
    }

    if (loading) return e("div", null, "Carregando métricas do Prometheus...");

    return e("div", { style: { padding: "16px" } }, [
      e("h2", { key: "title" }, `📊 Métricas do Deployment: ${deploymentName}`),
      metrics
        ? e("ul", { key: "metrics" }, [
            e("li", { key: "cpu" }, `CPU: ${parseFloat(metrics.cpu).toFixed(4)} cores`),
            e("li", { key: "mem" }, `Memória: ${(metrics.mem / 1024 / 1024).toFixed(2)} MB`)
          ])
        : e("p", { key: "empty" }, "Nenhum dado encontrado no Prometheus.")
    ]);
  };

  window.extensionsAPI.registerResourceExtension(
    MetricsTab,
    "argoproj.io",
    "Application",
    "Metrics"
  );
})();
