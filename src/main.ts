import { mount } from "svelte";
import App from "./App.svelte";

// CSP violation listener — logs any Content Security Policy violations for diagnostics
document.addEventListener("securitypolicyviolation", (e) => {
  console.warn(
    `[CSP violation] directive: ${e.violatedDirective}, blocked: ${e.blockedURI}, source: ${e.sourceFile}:${e.lineNumber}`
  );
});

const app = mount(App, { target: document.getElementById("app")! });
export default app;
