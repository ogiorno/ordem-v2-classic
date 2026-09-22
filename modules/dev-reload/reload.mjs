// Conecta no servidor de reload do `npm run dev` (porta 35729) e dá F5 quando mandarem.
const es = new EventSource("http://127.0.0.1:35729/");
let dropped = false;

es.addEventListener("reload", () => location.reload());
es.addEventListener("error", () => { dropped = true; });
// conexão voltou depois de cair = servidor reiniciou
es.addEventListener("open", () => { if (dropped) location.reload(); });
console.log("dev-reload | conectado");
