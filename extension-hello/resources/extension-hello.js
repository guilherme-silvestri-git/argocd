((window) => {
  if (!window.extensionsAPI) {
    console.error("[Hello Extension] ArgoExtensionAPI não encontrado!");
    return;
  }

  console.log("[Hello Extension] Registrando aba para Application...");

  // Define o componente React
  const HelloAppTab = (props) => {
    const e = React.createElement;
    return e("div", { style: { padding: "16px" } }, [
      e("h2", { key: "title" }, "👋 Olá do Argo CD Extension!"),
      e("p", { key: "text" }, `App: ${props?.application?.metadata?.name}`),
      e("p", { key: "desc" }, "Esta aba foi registrada como Resource Extension 🎉")
    ]);
  };

  // Registra como uma aba de Application
  window.extensionsAPI.registerResourceExtension(
    HelloAppTab,        // componente React
    "argoproj.io",      // group
    "Application",      // kind
    "Hello Tab",        // título da aba
    { icon: "fa-smile-o" } // ícone opcional
  );

  console.log("[Hello Extension] ✅ Registrado com sucesso como ResourceExtension para Application!");
})(window);
