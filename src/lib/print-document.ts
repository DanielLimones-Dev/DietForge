const PRINT_SCRIPT = '<script>window.opener=null;window.addEventListener("load",()=>setTimeout(()=>window.print(),250));</script>';

export function printDocumentHtml(html: string): string {
  if (/window\.print\s*\(/.test(html)) return html;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${PRINT_SCRIPT}</body>`) : `${html}${PRINT_SCRIPT}`;
}

export function openPrintDocument(html: string): Window {
  const url = URL.createObjectURL(new Blob([printDocumentHtml(html)], { type: "text/html;charset=utf-8" }));
  const win = window.open(url, "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error("El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio.");
  }
  win.opener = null;
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return win;
}
