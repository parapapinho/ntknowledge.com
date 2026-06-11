/* =========================================================================
   CONFIGURAÇÃO DO LIVRO
   -------------------------------------------------------------------------
   Este é o ÚNICO arquivo que você precisa editar para mudar a ESTRUTURA.

   Como adicionar uma página:
     1. Crie um arquivo .md dentro da pasta "conteudo".
     2. Adicione uma linha { title: "...", path: "..." } no capítulo certo.

   Como adicionar um capítulo:
     Copie um bloco { title, pages: [...] } inteiro e troque os textos.

   Como adicionar uma parte:
     Copie um bloco { part, chapters: [...] } inteiro.
   ========================================================================= */

const bookConfig = {
  title: "Windows System Programming for Hackers and Masochists",
  subtitle: "",
  author: "Filipe Oliveira",

  // (Opcional) só informativo. O site usa caminhos relativos, então
  // funciona em qualquer endereço sem precisar configurar isto.
  repo: "livro-windows",

  // Pasta onde ficam os arquivos .md
  contentDir: "conteudo",

  // Estrutura do livro: partes -> capítulos -> páginas
  parts: [
    {
      part: "Começando",
      chapters: [
        {
          title: "Sobre este modelo",
          pages: [
            { title: "Bem-vindo",            path: "inicio/bem-vindo.md" },
            { title: "Guia de formatação",   path: "inicio/guia-de-formatacao.md" },
          ]
        },
      ]
    },
    {
      part: "Parte I — Fundamentos",
      chapters: [
        {
          title: "Introdução à programação Windows",
          pages: [
            { title: "Modelo de capítulo",   path: "parte-1/cap-1-introducao/modelo-de-capitulo.md" },
            // Vá adicionando suas páginas aqui:
            // { title: "O que é a API Win32", path: "parte-1/cap-1-introducao/o-que-e-win32.md" },
          ]
        },
        // Copie o bloco acima para criar o capítulo 2, 3, ...
      ]
    },
  ]
};

/* ----------------------------------------------------------------------- */
/* A partir daqui é uso interno — não precisa mexer.                       */
bookConfig.flatPages = (() => {
  const list = [];
  bookConfig.parts.forEach((part, pi) => {
    part.chapters.forEach((chap, ci) => {
      chap.pages.forEach((page, pgi) => {
        list.push({
          ...page,
          partTitle: part.part,
          chapterTitle: chap.title,
          partIndex: pi,
          chapterIndex: ci,
          pageIndex: pgi,
        });
      });
    });
  });
  return list;
})();
