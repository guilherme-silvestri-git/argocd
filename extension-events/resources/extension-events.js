(function () {
  async function init() {
    if (!window.extensionsAPI) {
      console.log("[Events Extension] Esperando extensionsAPI...");
      setTimeout(init, 1500);
      return;
    }

    console.log("[Events Extension] Registrando aba Events...");

    const EventsTab = (props) => {
      const e = React.createElement;
      const appName = props?.application?.metadata?.name;
      const namespace =
        props?.application?.metadata?.namespace || "default";

      const [events, setEvents] = React.useState([]);
      const [error, setError] = React.useState(null);

      const fetchEvents = async () => {
        try {
          // ⚠️ Isso supõe que o ArgoCD tem acesso ao Kubernetes API via proxy
          const response = await fetch(
            `/api/v1/namespaces/${namespace}/events`
          );
          if (!response.ok)
            throw new Error(`Erro HTTP ${response.status}`);
          const json = await response.json();

          const filtered = json.items
            .filter((ev) =>
              ev?.involvedObject?.name?.startsWith(appName)
            )
            .sort(
              (a, b) =>
                new Date(b.lastTimestamp) - new Date(a.lastTimestamp)
            )
            .slice(0, 30);

          setEvents(filtered);
        } catch (err) {
          console.error("[Events Extension] Erro:", err);
          setError(err.message);
        }
      };

      React.useEffect(() => {
        fetchEvents();
        const interval = setInterval(fetchEvents, 10000);
        return () => clearInterval(interval);
      }, [namespace]);

      if (error)
        return e("div", { style: { color: "red" } }, `Erro: ${error}`);

      if (!events.length)
        return e("div", null, "Nenhum evento encontrado.");

      const tableStyle = {
        borderCollapse: "collapse",
        width: "100%",
        fontSize: "13px",
      };
      const thStyle = {
        textAlign: "left",
        padding: "8px",
        borderBottom: "1px solid #333",
        background: "#1e1e1e",
        color: "#00bcd4",
      };
      const tdStyle = {
        padding: "8px",
        borderBottom: "1px solid #222",
        color: "#ddd",
      };

      return e("div", { style: { padding: "16px" } }, [
        e("h2", null, `🧩 Últimos eventos em ${namespace}`),
        e("table", { style: tableStyle }, [
          e(
            "thead",
            null,
            e("tr", null, [
              e("th", { style: thStyle }, "Tipo"),
              e("th", { style: thStyle }, "Razão"),
              e("th", { style: thStyle }, "Objeto"),
              e("th", { style: thStyle }, "Mensagem"),
              e("th", { style: thStyle }, "Hora"),
            ])
          ),
          e(
            "tbody",
            null,
            events.map((ev, idx) =>
              e("tr", { key: idx }, [
                e(
                  "td",
                  {
                    style: {
                      ...tdStyle,
                      color:
                        ev.type === "Warning" ? "#ff5252" : "#4caf50",
                    },
                  },
                  ev.type
                ),
                e("td", { style: tdStyle }, ev.reason),
                e(
                  "td",
                  { style: tdStyle },
                  `${ev.involvedObject.kind}/${ev.involvedObject.name}`
                ),
                e("td", { style: tdStyle }, ev.message || "-"),
                e(
                  "td",
                  { style: tdStyle },
                  new Date(
                    ev.lastTimestamp || ev.eventTime
                  ).toLocaleTimeString()
                ),
              ])
            )
          ),
        ]),
      ]);
    };

    window.extensionsAPI.registerResourceExtension(
      EventsTab,
      "argoproj.io",
      "Application",
      "Events"
    );

    console.log("[Events Extension] ✅ Registrada!");
  }

  init();
})();
