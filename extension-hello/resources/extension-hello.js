(function registerWhenReady() {
  function tryRegister() {
    if (!window.extensionsAPI || !window.extensionsAPI.registerApplicationDetailsExtension) {
      console.warn("[Hello Extension] API ainda não disponível, aguardando...");
      setTimeout(tryRegister, 500);
      return;
    }

    console.log("[Hello Extension] API disponível, registrando aba Hello...");

    const HelloAppTab = () => {
      const e = React.createElement;
      return e("div", { style: { padding: "16px" } }, [
        e("h2", { key: "title" }, "👋 Olá do Argo CD Application Extension!"),
        e("p", { key: "text" }, "Agora esta aba aparece direto na tela da Application."),
        e("small", { key: "note", style: { color: '#888' } }, "Renderizada via React global")
      ]);
    };

    window.extensionsAPI.registerApplicationDetailsExtension({
      title: "Hello",
      icon: "fa fa-smile-o",
      component: HelloAppTab,
    });

    console.log("[Hello Extension] Registro concluído!");
  }

  tryRegister();
})();
