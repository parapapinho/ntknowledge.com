# NT Knowledge — blog pessoal

Site estático com os menus **Blog**, **Contact** e **CV**, inspirado no visual de xusheng.dev. Inclui um único post de teste e modo claro/escuro. Não exige Hugo nem compilação.

## Ver no computador

Na pasta do projeto:

```bash
python3 -m http.server 8000
```

Abra `http://localhost:8000`. Não abra `index.html` com dois cliques: o carregamento de Markdown precisa de um servidor HTTP.

## Escrever um post

1. Crie um arquivo em `posts/`, por exemplo `posts/meu-primeiro-artigo.md`.
2. Escreva o texto em Markdown. O título principal e a data são mostrados automaticamente; comece o arquivo pelo texto do artigo.
3. Acrescente uma entrada na lista `posts` de `site-config.js`:

```js
{
  title: "Meu primeiro artigo",
  slug: "meu-primeiro-artigo",
  date: "2026-09-07",
  path: "posts/meu-primeiro-artigo.md"
}
```

Separe as entradas com vírgulas. Use um slug único com letras minúsculas, números e hífens, e uma data válida no formato `AAAA-MM-DD`. Os artigos aparecem do mais recente para o mais antigo. Para remover o teste, retire sua entrada da lista e remova `posts/post-de-teste.md`.

Use somente Markdown e HTML de sua autoria ou de uma fonte confiável: o renderizador aceita HTML dentro dos posts.

## Contact e CV

Edite `site-config.js`:

- `github`: endereço público do seu perfil.
- `email`: seu e-mail público. Vazio, não aparece no site.
- `cvUrl`: caminho para seu currículo, por exemplo `assets/cv.pdf`. Adicione o PDF nesse caminho. Enquanto o campo estiver vazio, a página mostra “Currículo em breve”.

Não há formulário de contato nem currículo fictício.

## Aparência

- `index.html`: cabeçalho, menus e rodapé.
- `styles.css`: cores, fontes e espaçamento.
- `site-config.js`: título, descrição, contato, currículo e lista de posts.
- `site.js`: navegação e renderização.

Os antigos arquivos em `conteudo/` foram preservados como fonte, mas não fazem parte da navegação nem são carregados pelo blog.

## GitHub Pages

Publique os arquivos na raiz do repositório, mantendo o `CNAME` existente. As rotas usam hash (`#/blog`, `#/contact`, `#/cv`), portanto funcionam no domínio próprio e no GitHub Pages sem configuração de rotas no servidor. A fonte Inter e as bibliotecas de Markdown e destaque de código são carregadas por CDN.
