(function() {
  console.log("[Hello Extension] Inicializando para ArgoCD 3.1.x...");

  let attempts = 0;

  function registerExtension() {
    attempts++;

    if (!window.extensionsAPI || !window.extensionsAPI.registerAppViewExtension) {
      console.warn(`[Hello Extension] API ainda não disponível (tentativa ${attempts})...`);
      return setTimeout(registerExtension, 1000);
    }

    console.log("[Hello Extension] ✅ API detectada! Registrando aba Hello...");

    const HelloAppView = () => {
      const e = React.createElement;
      return e("div", { style: { padding: "16px" } }, [
        e("h2", { key: "title" }, "👋 Olá do Argo CD 3.1.x Extension!"),
        e("p", { key: "text" }, "Aba registrada com sucesso via registerAppViewExtension 🎉"),
        e("small", { key: "note", style: { color: '#888' } }, `Registrada após ${attempts} tentativas`)
      ]);
    };

    // Este é o método novo em ArgoCD >=3.0
    window.extensionsAPI.registerAppViewExtension(
      {
        title: "Hello",
        icon: "fa fa-smile-o",
        component: HelloAppView
      },
      "application" // tipo de view: pode ser 'application', 'project', etc.
    );

    console.log(`[Hello Extension] ✅ Registro concluído após ${attempts} tentativas!`);
  }

  registerExtension();
})();
