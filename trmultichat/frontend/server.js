//simple express server to run frontend production build;
const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 9089;

// Cache para assets estáticos: em dev, desabilita; em prod, immutable
const staticOpts = (process.env.NODE_ENV === "development")
  ? { setHeaders: (res) => res.setHeader("Cache-Control", "no-store") }
  : { immutable: true, maxAge: "1y" };
app.use("/static", express.static(path.join(__dirname, "build", "static"), staticOpts));

// Demais arquivos do build (sem cache agressivo)
app.use(express.static(path.join(__dirname, "build")));

// Responder index.html com substituição do título
function sendIndex(req, res) {
  try {
    const filePath = path.join(__dirname, "build", "index.html");
    let html = require("fs").readFileSync(filePath, "utf8");
    const title = process.env.REACT_APP_TITLE || "TR TECNOLOGIAS";
    html = html.replace(/%REACT_APP_TITLE%/g, title);
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(html);
  } catch (e) {
    res.status(500).send("<!doctype html><html><head><title>TR TECNOLOGIAS</title></head><body>Erro ao carregar.</body></html>");
  }
}

// Desabilitar cache para index.html
app.get("/", sendIndex);

// Fallback SPA
app.get("/*", sendIndex);

app.listen(PORT, () => {
  console.log(`Frontend listening on http://localhost:${PORT}`);
});

