# Livro digital — modelo de site

Um modelo pronto para escrever um livro digital (no estilo daquele site que você mandou): índice lateral, navegação entre páginas, busca, modo claro/escuro, destaque de código e menu "Nesta página". Você escreve em **Markdown** e o site monta tudo sozinho.

---

## 1. Ver o site no seu computador

Os capítulos são arquivos `.md` que o site carrega na hora. Por segurança, o navegador **não** deixa ler esses arquivos se você abrir o `index.html` com dois cliques (`file://`). Então rode um servidor local — é um comando só.

Com o **Python** instalado, abra o terminal na pasta do projeto e rode:

```bash
python3 -m http.server 8000
```

Depois abra no navegador:

```
http://localhost:8000
```

Pronto. Toda vez que quiser ver o livro, é esse comando.

> Não tem Python? Outra opção, se tiver Node.js: `npx serve` na pasta do projeto.

---

## 2. Estrutura dos arquivos

```
livro-windows/
├── index.html          → a página (não precisa mexer)
├── styles.css          → cores e fontes (mexa só se quiser mudar a aparência)
├── book-config.js      → AQUI você define os capítulos
├── book-viewer.js      → o motor do site (não precisa mexer)
├── LEIA-ME.md          → este guia
└── conteudo/           → AQUI ficam seus textos (.md)
    ├── inicio/
    │   ├── bem-vindo.md
    │   └── guia-de-formatacao.md
    └── parte-1/
        └── cap-1-introducao/
            └── modelo-de-capitulo.md
```

Você só mexe em **dois lugares**: a pasta `conteudo/` (seus textos) e o `book-config.js` (a lista de capítulos).

---

## 3. Adicionar uma página nova

São dois passos:

**Passo 1 — crie o arquivo.** Por exemplo, crie:

```
conteudo/parte-1/cap-1-introducao/o-que-e-win32.md
```

e escreva nele em Markdown (veja a página "Guia de formatação" no site para a sintaxe).

**Passo 2 — cadastre no `book-config.js`.** Encontre o capítulo certo e adicione uma linha em `pages`:

```js
{
  title: "Introdução à programação Windows",
  pages: [
    { title: "Modelo de capítulo", path: "parte-1/cap-1-introducao/modelo-de-capitulo.md" },
    { title: "O que é a API Win32", path: "parte-1/cap-1-introducao/o-que-e-win32.md" },  // ← nova
  ]
},
```

Recarregue a página. A nova página aparece no índice lateral.

> O `title` é o que aparece no menu. O `path` é o caminho do arquivo **a partir de** `conteudo/`.

---

## 4. Adicionar um capítulo ou uma parte

No `book-config.js`:

- **Novo capítulo:** copie um bloco inteiro `{ title: "...", pages: [...] }` e troque os textos.
- **Nova parte:** copie um bloco inteiro `{ part: "...", chapters: [...] }`.

A numeração dos capítulos no índice é automática.

---

## 5. Mudar título, autor e aparência

- **Título e autor do livro:** no começo do `book-config.js` (campos `title`, `subtitle`, `author`).
- **Título no topo da página:** no `index.html`, dentro do elemento com `id="brandTitle"`.
- **Cores e fontes:** no topo do `styles.css`, na seção `:root` (modo claro) e `html.dark` (modo escuro). Os nomes das cores são autoexplicativos (`--accent` é a cor de destaque, `--paper` é o fundo, etc.).

---

## 6. Publicar de graça no GitHub Pages

Você tem três formatos de endereço possíveis:

**a) Site de projeto** — `https://seu-usuario.github.io/livro-windows/`
   O mais simples. Crie um repositório com o nome que quiser (ex.: `livro-windows`),
   envie os arquivos, e em **Settings → Pages** escolha a branch `main` e a pasta `/ (root)`.

**b) Site de usuário** — `https://seu-usuario.github.io/`
   URL mais limpa, sem subpasta. Para isso o repositório precisa se chamar
   **exatamente** `seu-usuario.github.io`. Você só pode ter **um** site assim por conta.

**c) Domínio próprio** — `https://meulivro.com.br/`
   Você compra um domínio e aponta para o GitHub Pages em **Settings → Pages →
   Custom domain**. Tem o melhor visual, mas custa o preço do domínio.

> [!NOTA]
> Este modelo usa caminhos relativos, então **funciona nos três casos sem mexer em nada**.
> Não precisa fazer o `repo` "bater" com nada — é só publicar.

> O arquivo `.nojekyll` já vem incluído — ele evita um problema comum do GitHub Pages com pastas. Não apague.

---

## 7. Recursos extras de formatação

Além do Markdown comum, este modelo tem **caixas de destaque**. Comece uma citação com uma destas marcações:

```markdown
> [!NOTA]
> Uma observação importante.

> [!AVISO]
> Um alerta sobre um erro comum.

> [!DICA]
> Uma sugestão prática.
```

A página "Guia de formatação" (já incluída) mostra todos os recursos com exemplos prontos para copiar.

---

Bom livro! Quando tiver os primeiros capítulos, é só ir cadastrando no `book-config.js`.
