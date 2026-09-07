/* Blog estático: arquivos Markdown e rotas por hash, compatíveis com GitHub Pages. */
(() => {
  "use strict";
  const cfg = window.siteConfig;
  const content = document.getElementById("content");
  const themeButton = document.getElementById("themeToggle");
  let version = 0;
  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
  const safeURL = value => {
    try {
      const url = new URL(value, location.href);
      return ["http:", "https:", "mailto:"].includes(url.protocol) ? escapeHTML(value) : "";
    } catch (_) { return ""; }
  };
  const formatDate = (date, short = false) => new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: short ? "short" : "long", ...(short ? {} : { year: "numeric" }), timeZone: "UTC"
  }).format(new Date(date + "T12:00:00Z"));

  function syncTheme() {
    themeButton.setAttribute("aria-pressed", String(document.documentElement.classList.contains("dark")));
  }
  themeButton.addEventListener("click", () => {
    const dark = document.documentElement.classList.toggle("dark");
    try { localStorage.setItem("tema", dark ? "dark" : "light"); } catch (_) {}
    syncTheme();
  });
  syncTheme();

  if (!cfg) {
    content.innerHTML = '<h1>Blog indisponível</h1><p>Não foi possível carregar a configuração. Tente atualizar a página.</p>';
    content.setAttribute("aria-busy", "false");
    return;
  }

  function blog() {
    const posts = [...cfg.posts].sort((a, b) => b.date.localeCompare(a.date));
    let list = "", year = "";
    for (const post of posts) {
      const postYear = post.date.slice(0, 4);
      if (year !== postYear) {
        if (year) list += "</ul></section>";
        year = postYear;
        list += `<section aria-label="Posts de ${escapeHTML(year)}"><h3 class="post-year">${escapeHTML(year)}</h3><ul class="post-list">`;
      }
      list += `<li><a href="#/blog/${encodeURIComponent(post.slug)}"><span>${escapeHTML(post.title)}</span><time datetime="${escapeHTML(post.date)}">${formatDate(post.date, true)}</time></a></li>`;
    }
    if (year) list += "</ul></section>";
    return `<header class="blog-heading"><h1>${escapeHTML(cfg.title)}</h1><p>${escapeHTML(cfg.description)}</p></header><h2 class="archive-title">Blog</h2>${list || "<p>Nenhum artigo publicado ainda.</p>"}`;
  }

  function contact() {
    const links = [];
    if (cfg.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.email)) {
      links.push(`<li>E-mail: <a href="mailto:${escapeHTML(cfg.email)}">${escapeHTML(cfg.email)}</a></li>`);
    }
    if (cfg.github && safeURL(cfg.github)) links.push(`<li>GitHub: <a href="${safeURL(cfg.github)}">${escapeHTML(cfg.github.replace(/^https?:\/\//, ""))}</a></li>`);
    return `<h1>Contact</h1>${links.length ? `<ul class="contact-links">${links.join("")}</ul>` : "<p>Informações de contato em breve.</p>"}`;
  }

  function cv() {
    return `<h1>CV</h1>${cfg.cvUrl && safeURL(cfg.cvUrl) ? `<p><a href="${safeURL(cfg.cvUrl)}">Abrir currículo</a></p>` : "<p>Currículo em breve.</p>"}`;
  }

  function notFound() {
    document.title = "Página não encontrada — " + cfg.title;
    return '<h1>Página não encontrada</h1><p>O endereço não corresponde a uma página deste site.</p><p><a href="#/blog">Voltar ao blog</a></p>';
  }

  async function render() {
    const token = ++version;
    const route = location.hash.replace(/^#\/?/, "").split("~")[0].replace(/\/$/, "") || "blog";
    const section = route.split("/")[0];
    document.querySelectorAll("[data-nav]").forEach(link => {
      if (link.dataset.nav === section) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    content.setAttribute("aria-busy", "true");
    document.title = ({ blog: "Blog", contact: "Contact", cv: "CV" }[section] || "Página") + " — " + cfg.title;
    try {
      if (route === "blog") content.innerHTML = blog();
      else if (route === "contact") content.innerHTML = contact();
      else if (route === "cv") content.innerHTML = cv();
      else if (route.startsWith("blog/")) {
        const slug = decodeURIComponent(route.slice(5));
        const post = cfg.posts.find(item => item.slug === slug);
        if (!post) content.innerHTML = notFound();
        else {
          content.innerHTML = '<p class="state" role="status">Carregando artigo…</p>';
          const response = await fetch(post.path);
          if (!response.ok) throw new Error("Post unavailable");
          const markdown = await response.text();
          if (token !== version) return;
          if (!window.marked) throw new Error("Markdown unavailable");
          document.title = post.title + " — " + cfg.title;
          content.innerHTML = `<a class="back-link" href="#/blog">← Blog</a><header><p class="post-meta"><time datetime="${escapeHTML(post.date)}">${formatDate(post.date)}</time></p><h1>${escapeHTML(post.title)}</h1></header>${window.marked.parse(markdown, { gfm: true })}<p class="post-return"><a href="#/blog">← Voltar ao blog</a></p>`;
          content.querySelectorAll("table").forEach(table => {
            const wrapper = document.createElement("div");
            wrapper.className = "table-scroll";
            wrapper.tabIndex = 0;
            wrapper.setAttribute("role", "region");
            wrapper.setAttribute("aria-label", "Tabela com rolagem horizontal");
            table.replaceWith(wrapper);
            wrapper.append(table);
          });
          window.Prism?.highlightAllUnder(content);
        }
      } else content.innerHTML = notFound();
    } catch (_) {
      if (token !== version) return;
      content.innerHTML = '<h1>Não foi possível abrir esta página</h1><p>Tente atualizar a página ou voltar ao blog.</p><p><a href="#/blog">Voltar ao blog</a></p>';
    } finally {
      if (token === version) {
        content.setAttribute("aria-busy", "false");
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    }
  }

  window.addEventListener("hashchange", () => {
    if (!location.hash || location.hash.startsWith("#/")) render();
  });
  render();
})();
