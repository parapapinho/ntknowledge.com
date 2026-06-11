/* =========================================================================
   MOTOR DO LIVRO
   Carrega arquivos .md, renderiza, monta o índice lateral, navegação,
   busca, modo escuro e roteamento por URL. Você não precisa editar este
   arquivo para escrever o livro — só mexa em book-config.js e nos .md.
   ========================================================================= */

(function () {
  "use strict";

  const cfg = window.bookConfig;
  const pages = cfg.flatPages;

  // Caminho RELATIVO ao index.html. Assim funciona igual em:
  //   - localhost                       (http://localhost:8000/)
  //   - site de projeto                 (usuario.github.io/livro-windows/)
  //   - site de usuário/organização     (usuario.github.io/)
  //   - domínio próprio                 (meulivro.com.br/)
  // sem precisar configurar nada.
  const contentBase = cfg.contentDir + "/";

  const els = {
    sidebar:   document.getElementById("sidebar"),
    toc:       document.getElementById("toc"),
    content:   document.getElementById("content"),
    crumbs:    document.getElementById("crumbs"),
    pager:     document.getElementById("pager"),
    onthispage:document.getElementById("onthispage"),
    search:    document.getElementById("searchInput"),
  };

  // ---- marked: configuração + caixas de nota ----------------------------
  marked.setOptions({ gfm: true, breaks: false });

  // Transforma blockquotes que começam com [!NOTA], [!AVISO] ou [!DICA]
  // em caixas estilizadas.
  function applyCallouts(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    tmp.querySelectorAll("blockquote").forEach((bq) => {
      const first = bq.querySelector("p");
      if (!first) return;
      const m = first.innerHTML.match(/^\[!(NOTA|AVISO|DICA)\]\s*/i);
      if (!m) return;
      const kind = m[1].toLowerCase();
      const labels = { nota: "Nota", aviso: "Aviso", dica: "Dica" };
      first.innerHTML = first.innerHTML.replace(m[0], "");
      const box = document.createElement("div");
      box.className = "callout callout--" + kind;
      box.innerHTML =
        '<div class="callout__title">' + labels[kind] + "</div>" + bq.innerHTML;
      bq.replaceWith(box);
    });
    return tmp.innerHTML;
  }

  // ---- slug a partir do caminho do arquivo ------------------------------
  function slugFor(path) {
    return path
      .replace(/\.md$/i, "")
      .replace(/[\/\\]/g, "-")
      .replace(/[^a-z0-9\-_.]/gi, "")
      .toLowerCase();
  }

  function indexFromHash() {
    const hash = location.hash.replace(/^#\/?/, "");
    if (!hash) return 0;
    const i = pages.findIndex((p) => slugFor(p.path) === hash);
    return i < 0 ? 0 : i;
  }

  let current = indexFromHash();

  // ---- montagem do índice lateral ---------------------------------------
  function buildSidebar() {
    let chapterCounter = 0;
    let html = "";
    cfg.parts.forEach((part) => {
      html += `<div class="toc__part">${part.part}</div>`;
      part.chapters.forEach((chap) => {
        chapterCounter += 1;
        const num = String(chapterCounter).padStart(2, "0");
        const items = chap.pages
          .map((page) => {
            const gi = pages.findIndex((p) => p.path === page.path);
            return `<li><a class="toc__page" data-index="${gi}" href="#/${slugFor(
              page.path
            )}">${page.title}</a></li>`;
          })
          .join("");
        html += `
          <details class="toc__chapter" open>
            <summary class="toc__chaptbtn">
              <span class="toc__num">${num}</span>
              <span>${chap.title}</span>
              <svg class="toc__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </summary>
            <ul class="toc__pages">${items}</ul>
          </details>`;
      });
    });
    els.toc.innerHTML = html;
  }

  function markActive() {
    els.toc.querySelectorAll(".toc__page").forEach((a) => {
      const isActive = Number(a.dataset.index) === current;
      a.classList.toggle("active", isActive);
      if (isActive) {
        const det = a.closest("details");
        if (det) det.open = true;
      }
    });
  }

  // ---- "Nesta página" (h2/h3 do conteúdo) -------------------------------
  function buildOnThisPage() {
    const heads = els.content.querySelectorAll("h2, h3");
    if (heads.length < 2) {
      els.onthispage.innerHTML = "";
      return;
    }
    let html = "<h6>Nesta página</h6>";
    heads.forEach((h, i) => {
      if (!h.id) h.id = "sec-" + i;
      const lvl = h.tagName === "H3" ? "lvl3" : "";
      html += `<a class="${lvl}" href="#${h.id}">${h.textContent}</a>`;
    });
    els.onthispage.innerHTML = html;

    // Destaca a seção visível
    const links = els.onthispage.querySelectorAll("a");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            links.forEach((l) =>
              l.classList.toggle("active", l.getAttribute("href") === "#" + e.target.id)
            );
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    heads.forEach((h) => obs.observe(h));
  }

  // ---- navegação inferior (anterior / próxima) --------------------------
  function buildPager() {
    const prev = pages[current - 1];
    const next = pages[current + 1];
    const link = (p, dir, label) =>
      p
        ? `<a class="${dir}" href="#/${slugFor(p.path)}">
             <span class="pager__label">${label}</span>
             <span class="pager__title">${p.title}</span>
           </a>`
        : `<a class="${dir} placeholder"></a>`;
    els.pager.innerHTML =
      link(prev, "prev", "← Anterior") + link(next, "next", "Próxima →");
  }

  // ---- carregamento de uma página ---------------------------------------
  async function loadPage() {
    const page = pages[current];
    els.crumbs.innerHTML = `${page.chapterTitle} <span>/</span> ${page.title}`;
    els.content.innerHTML = `<div class="state">Carregando…</div>`;
    document.title = page.title + " — " + cfg.title;

    try {
      const res = await fetch(contentBase + page.path, { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const md = await res.text();
      els.content.innerHTML = applyCallouts(marked.parse(md));
      if (window.Prism) Prism.highlightAllUnder(els.content);
      buildOnThisPage();
      buildPager();
      markActive();
      window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    } catch (err) {
      showError(page, err);
    }
  }

  function showError(page, err) {
    const isFileProtocol = location.protocol === "file:";
    els.content.innerHTML = `
      <div class="state">
        <h2 style="font-family:var(--font-display);color:var(--ink)">Não consegui carregar este capítulo</h2>
        ${
          isFileProtocol
            ? `<p>Você abriu o arquivo direto pelo navegador (<code>file://</code>).
               Por segurança, o navegador bloqueia a leitura dos <code>.md</code> assim.</p>
               <p><strong>Rode um servidor local</strong> na pasta do livro e abra pelo endereço que aparecer:</p>
               <pre># com Python já instalado:
python3 -m http.server 8000

# depois abra:
http://localhost:8000</pre>`
            : `<p>Arquivo esperado: <code>${page.path}</code></p>
               <pre>${String(err)}</pre>`
        }
      </div>`;
    buildPager();
    markActive();
  }

  // ---- busca ------------------------------------------------------------
  function wireSearch() {
    els.search.addEventListener("input", () => {
      const q = els.search.value.trim().toLowerCase();
      els.toc.querySelectorAll(".toc__chapter").forEach((det) => {
        let anyVisible = false;
        det.querySelectorAll(".toc__page").forEach((a) => {
          const li = a.parentElement;
          const hit = !q || a.textContent.toLowerCase().includes(q);
          li.style.display = hit ? "" : "none";
          if (hit) anyVisible = true;
        });
        det.style.display = anyVisible ? "" : "none";
        if (q) det.open = true;
      });
    });
  }

  // ---- modo escuro ------------------------------------------------------
  function initTheme() {
    const saved = localStorage.getItem("tema");
    const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
    if (saved === "dark" || (!saved && prefersDark)) {
      document.documentElement.classList.add("dark");
    }
  }
  function toggleTheme() {
    const dark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("tema", dark ? "dark" : "light");
  }

  // ---- menu mobile ------------------------------------------------------
  function wireMobileNav() {
    const open = () => document.body.classList.add("nav-open");
    const close = () => document.body.classList.remove("nav-open");
    document.getElementById("menuToggle").addEventListener("click", () =>
      document.body.classList.toggle("nav-open")
    );
    document.getElementById("scrim").addEventListener("click", close);
    els.toc.addEventListener("click", (e) => {
      if (e.target.closest(".toc__page")) close();
    });
  }

  // ---- roteamento -------------------------------------------------------
  function wireRouting() {
    window.addEventListener("hashchange", () => {
      // Ignora âncoras internas (#sec-…); só reage a rotas de página (#/…)
      if (/^#\/?/.test(location.hash) && !location.hash.startsWith("#sec-")) {
        const i = indexFromHash();
        if (i !== current) {
          current = i;
          loadPage();
        }
      }
    });
  }

  // ---- inicialização ----------------------------------------------------
  initTheme();
  document.getElementById("themeToggle").addEventListener("click", toggleTheme);
  buildSidebar();
  wireSearch();
  wireMobileNav();
  wireRouting();
  loadPage();
})();
