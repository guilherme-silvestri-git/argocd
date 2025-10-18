(function() {
  console.log("[Hello Extension] Inicializando...");

  let attempts = 0;

  function registerExtension() {
    attempts++;

    if (!window.extensionsAPI || !window.extensionsAPI.registerApplicationDetailsExtension) {
      console.warn(`[Hello Extension] API ainda não disponível (tentativa ${attempts})...`);
      return setTimeout(registerExtension, 1000); // tenta de novo a cada 1s
    }

    console.log("[Hello Extension] ✅ API disponível! Registrando aba Hello...");

    const HelloAppTab = () => {
      const e = React.createElement;
      return e("div", { style: { padding: "16px" } }, [
        e("h2", { key: "title" }, "👋 Olá do Argo CD Application Extension!"),
        e("p", { key: "text" }, "Aba carregada com sucesso na tela da aplicação 🎉"),
        e("small", { key: "note", style: { color: '#888' } }, `Registro após ${attempts} tentativas`)
      ]);
    };

    window.extensionsAPI.registerApplicationDetailsExtension({
      title: "Hello",
      icon: "fa fa-smile-o",
      component: HelloAppTab,
    });

    console.log(`[Hello Extension] ✅ Registro concluído após ${attempts} tentativas!`);
  }

  registerExtension();
})();
