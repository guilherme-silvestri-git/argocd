(function() {
  if (!window.extensionsAPI) {
    console.error("[Hello Extension] ArgoExtensionAPI não encontrado.");
    return;
  }

  console.log("[Hello Extension] Registrando ApplicationTab...");

  const HelloAppTab = () => {
    const e = React.createElement;
    return e("div", { style: { padding: "16px" } }, [
      e("h2", { key: "title" }, "👋 Olá do Argo CD Application Extension!"),
      e("p", { key: "text" }, "Esta aba foi registrada como uma Application Tab Extension 🎉"),
      e("small", { key: "note", style: { color: '#888' } }, "Renderizada diretamente na tela da aplicação")
    ]);
  };

  // 🔹 Altera o tipo de registro para aparecer nas abas da Application
  window.extensionsAPI.registerApplicationDetailsExtension({
    title: "Hello",
    icon: "fa fa-smile-o",
    component: HelloAppTab
  });
})();
