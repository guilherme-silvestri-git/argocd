(function() {
  if (!window.extensionsAPI) {
    console.error("[Hello Extension] ArgoExtensionAPI não encontrado.");
    return;
  }

  console.log("[Hello Extension] Registrando...");

  const HelloTab = () => {
    const e = React.createElement;
    return e("div", { style: { padding: "16px" } }, [
      e("h2", { key: "title" }, "👋 Olá do Argo CD Extension!"),
      e("p", { key: "text" }, "Extensão simples carregada com sucesso 🎉"),
      e("small", { key: "note", style: { color: '#888' } }, "Renderizada via React global")
    ]);
  };

  window.extensionsAPI.registerResourceExtension(
    { title: "Hello", component: HelloTab },
    "*",
    "*"
  );
})();
