(function() {
  console.log("[Hello Extension] Inicializando registro em múltiplas views...");

  let attempts = 0;
  const possibleViews = [
    "applications",
    "application-tree",
    "application-summary",
    "application-resources",
    "application-details",
    "projects",
    "system"
  ];

  function registerExtension() {
    attempts++;
    if (!window.extensionsAPI || !window.extensionsAPI.registerAppViewExtension) {
      console.warn(`[Hello Extension] API ainda não disponível (tentativa ${attempts})...`);
      return setTimeout(registerExtension, 1000);
    }

    console.log("[Hello Extension] ✅ API detectada! Registrando aba Hello em várias views...");

    const HelloAppView = () => {
      const e = React.createElement;
      return e("div", { style: { padding: "16px" } }, [
        e("h2", { key: "title" }, "👋 Olá do Argo CD Extension!"),
        e("p", { key: "text" }, "Aba registrada em múltiplos contextos 🎉"),
        e("small", { key: "note", style: { color: '#888' } }, `Tentativas: ${attempts}`)
      ]);
    };

    possibleViews.forEach(view => {
      try {
        window.extensionsAPI.registerAppViewExtension(
          {
            title: `Hello (${view})`,
            icon: "fa fa-smile-o",
            component: HelloAppView,
          },
          view
        );
        console.log(`[Hello Extension] 🔹 Registrado com sucesso em '${view}'`);
      } catch (err) {
        console.warn(`[Hello Extension] ⚠️ Falha ao registrar em '${view}':`, err);
      }
    });

    console.log(`[Hello Extension] ✅ Registro finalizado após ${attempts} tentativas!`);
  }

  registerExtension();
})();
