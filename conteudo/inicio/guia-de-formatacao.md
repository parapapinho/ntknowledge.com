# Guia de formatação

Esta página existe para você **copiar a sintaxe**. Cada bloco abaixo mostra o que escrever no `.md` e como fica na tela. Abra este mesmo arquivo (`conteudo/inicio/guia-de-formatacao.md`) num editor para ver o texto-fonte.

## Títulos

Use `#` para os níveis. O `#` de cima (título 1) é o nome do capítulo; use `##` e `###` para as seções dentro dele — elas aparecem automaticamente no menu "Nesta página", à direita.

```markdown
# Título do capítulo
## Uma seção
### Uma subseção
```

## Ênfase e listas

Você pode usar **negrito**, *itálico* e `código curto` no meio do texto.

- Item de lista
- Outro item
  - Item aninhado
- Mais um

E listas numeradas:

1. Primeiro passo
2. Segundo passo
3. Terceiro passo

## Blocos de código com cores

Coloque o nome da linguagem após as três crases para ligar o **destaque de sintaxe**:

````markdown
```c
#include <windows.h>

int WINAPI wWinMain(HINSTANCE h, HINSTANCE p, PWSTR cmd, int show) {
    MessageBoxW(NULL, L"Olá, Windows!", L"Exemplo", MB_OK);
    return 0;
}
```
````

Resultado:

```c
#include <windows.h>

int WINAPI wWinMain(HINSTANCE h, HINSTANCE p, PWSTR cmd, int show) {
    MessageBoxW(NULL, L"Olá, Windows!", L"Exemplo", MB_OK);
    return 0;
}
```

Funciona para várias linguagens (`c`, `cpp`, `bash`, `bat`, `python`, `csharp`…).

## Tabelas

```markdown
| Função        | Biblioteca   |
| ------------- | ------------ |
| CreateWindow  | user32.dll   |
| CreateFile    | kernel32.dll |
```

Vira:

| Função        | Biblioteca   |
| ------------- | ------------ |
| CreateWindow  | user32.dll   |
| CreateFile    | kernel32.dll |

## Caixas de destaque

Um recurso extra deste modelo: comece uma citação com `[!NOTA]`, `[!AVISO]` ou `[!DICA]` para criar uma caixa colorida.

```markdown
> [!NOTA]
> Texto informativo, para explicar um detalhe importante.

> [!AVISO]
> Texto de alerta, para erros comuns ou armadilhas.

> [!DICA]
> Texto com uma sugestão prática.
```

Resultado:

> [!NOTA]
> Texto informativo, para explicar um detalhe importante.

> [!AVISO]
> Texto de alerta, para erros comuns ou armadilhas.

> [!DICA]
> Texto com uma sugestão prática.

## Citação simples e linha divisória

> Uma citação comum, sem marcação especial, fica assim.

---

Com isso você já tem tudo para escrever os capítulos. Bom trabalho!
