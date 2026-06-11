# Guia de formatação (para o autor)

> [!DICA]
> Esta página é uma referência rápida da sintaxe enquanto você escreve. Quando o livro estiver maduro, você pode removê-la do `book-config.js`.

## Títulos

`#` é o título do capítulo; use `##` e `###` para as seções — elas aparecem sozinhas no menu "Nesta página", à direita.

## Ênfase, listas e código curto

**negrito**, *itálico* e `código curto` no meio do texto. Listas:

- Item
- Outro item
  - Aninhado

## Blocos de código com cores

Coloque a linguagem após as crases para ligar o destaque:

```c
#include <windows.h>

int wmain(void) {
    MessageBoxW(NULL, L"Olá!", L"Exemplo", MB_OK);
    return 0;
}
```

Funciona com `c`, `cpp`, `csharp`, `bash`, `bat`, `python`, etc.

## Tabelas

| Função        | Biblioteca   |
| ------------- | ------------ |
| AccessCheck   | advapi32.dll |
| CreateFile    | kernel32.dll |

## Caixas de destaque

Comece uma citação com `[!NOTA]`, `[!AVISO]` ou `[!DICA]`:

> [!NOTA]
> Observação importante.

> [!AVISO]
> Alerta sobre um erro comum.

> [!DICA]
> Sugestão prática.
