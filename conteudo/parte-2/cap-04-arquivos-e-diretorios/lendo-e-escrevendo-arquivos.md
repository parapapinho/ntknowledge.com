# Lendo e escrevendo arquivos

A entrada e saída de arquivos é o ponto de partida natural para aprender a API do Windows. Quase todo programa precisa ler ou gravar dados, e ao fazê-lo você encontra, de forma concreta, os três conceitos que sustentam o restante da plataforma: o **handle** como referência a um recurso do sistema, o **Unicode** como representação nativa de texto, e o **tratamento de erros** baseado em código de retorno mais `GetLastError`. Dominar esse capítulo é dominar o vocabulário que todos os outros vão reutilizar.

Vamos construir o entendimento de baixo para cima: primeiro como o Windows enxerga um arquivo, depois como abri-lo, ler, escrever e fechá-lo, e por fim como lidar corretamente com texto e com os erros que inevitavelmente surgem.

## O modelo de arquivo no Windows

No Windows, um arquivo aberto é representado por um **handle** — um valor opaco do tipo `HANDLE` que identifica o recurso dentro do sistema. Você nunca manipula o arquivo diretamente; você obtém um handle ao abri-lo e o apresenta de volta ao sistema em cada operação subsequente. Esse mesmo padrão vale para processos, threads, eventos, chaves de registro e praticamente todo objeto do kernel.

Um detalhe importante: o `HANDLE` de arquivo participa do **modelo de segurança** desde o primeiro instante. Quando você abre um arquivo, o sistema realiza uma verificação de acesso contra a lista de controle de acesso (a DACL) do arquivo, usando o token do seu processo. Se a verificação falha, você não recebe handle algum. Voltaremos a esse mecanismo em profundidade na Parte V; por ora, basta saber que **todo handle que você obtém já passou por uma decisão de autorização**.

> [!NOTA]
> Há um valor especial, `INVALID_HANDLE_VALUE`, que sinaliza falha ao abrir ou criar um arquivo. Ele **não** é o mesmo que `NULL`. Confundir os dois é uma fonte clássica de bugs: funções de arquivo retornam `INVALID_HANDLE_VALUE` em caso de erro, enquanto muitas outras funções do Windows retornam `NULL`. Verifique sempre o valor certo para a função que você está usando.

## Abrindo e criando arquivos: `CreateFile`

Apesar do nome, a função `CreateFileW` é a porta de entrada tanto para **criar** quanto para **abrir** arquivos existentes — o comportamento é controlado por um de seus parâmetros. É uma função com muitos argumentos, mas cada um tem um papel claro:

```c
HANDLE CreateFileW(
    LPCWSTR               lpFileName,            // caminho do arquivo
    DWORD                 dwDesiredAccess,       // leitura, escrita, ou ambos
    DWORD                 dwShareMode,           // o que outros podem fazer enquanto está aberto
    LPSECURITY_ATTRIBUTES lpSecurityAttributes,  // segurança (NULL = padrao)
    DWORD                 dwCreationDisposition, // criar novo? abrir existente?
    DWORD                 dwFlagsAndAttributes,  // atributos e flags de comportamento
    HANDLE                hTemplateFile          // modelo (quase sempre NULL)
);
```

Os parâmetros que você ajusta no dia a dia são os quatro primeiros depois do nome. Vamos a eles.

### Acesso desejado (`dwDesiredAccess`)

Define o que você pretende fazer com o arquivo. Os valores mais comuns são `GENERIC_READ`, `GENERIC_WRITE`, ou a combinação dos dois com o operador OR:

```c
GENERIC_READ                    // so leitura
GENERIC_WRITE                   // so escrita
GENERIC_READ | GENERIC_WRITE    // leitura e escrita
```

Esse pedido de acesso é exatamente o que o sistema confronta com a DACL do arquivo. Peça **apenas o acesso de que você realmente precisa** — um programa que só vai ler um arquivo deve pedir `GENERIC_READ`, e não a combinação completa. Isso não é só boa etiqueta: é uma aplicação direta do princípio do menor privilégio, tema central da Parte VII.

### Modo de compartilhamento (`dwShareMode`)

Controla o que **outros processos** podem fazer com o arquivo enquanto o seu o mantém aberto. É um aspecto que costuma surpreender quem vem de UNIX, onde o compartilhamento é mais permissivo por padrão.

| Valor                | Significado                                          |
| -------------------- | ---------------------------------------------------- |
| `0`                  | acesso exclusivo: ninguém mais pode abrir o arquivo  |
| `FILE_SHARE_READ`    | outros podem abrir para leitura                      |
| `FILE_SHARE_WRITE`   | outros podem abrir para escrita                      |
| `FILE_SHARE_DELETE`  | outros podem marcar o arquivo para exclusão          |

Esses valores também se combinam com OR. Se você abre um arquivo com modo de compartilhamento `0`, qualquer outra tentativa de abri-lo falhará até você fechar o handle.

### Disposição de criação (`dwCreationDisposition`)

É aqui que se decide entre criar e abrir. Os cinco valores possíveis:

| Valor                | Comportamento                                                     |
| -------------------- | ----------------------------------------------------------------- |
| `CREATE_NEW`         | cria; **falha** se o arquivo já existe                            |
| `CREATE_ALWAYS`      | cria; **sobrescreve** se já existe                                |
| `OPEN_EXISTING`      | abre; **falha** se não existe                                     |
| `OPEN_ALWAYS`        | abre se existe; **cria** se não existe                            |
| `TRUNCATE_EXISTING`  | abre e zera o conteúdo; falha se não existe                       |

A escolha certa depende da intenção. Para ler um arquivo que deve existir, use `OPEN_EXISTING`. Para gravar um arquivo novo do zero, `CREATE_ALWAYS`. A diferença entre `CREATE_NEW` e `CREATE_ALWAYS` é particularmente relevante para segurança: `CREATE_NEW` evita sobrescrever acidentalmente um arquivo existente, o que é desejável quando você não quer correr o risco de uma condição de corrida em que outro processo cria o arquivo entre a sua verificação e a sua escrita.

### Atributos e flags (`dwFlagsAndAttributes`)

Para a maioria dos casos, `FILE_ATTRIBUTE_NORMAL` basta. Esse parâmetro carrega também flags poderosas para I/O assíncrono (`FILE_FLAG_OVERLAPPED`) e outros comportamentos avançados, que veremos no capítulo de I/O avançado.

### Abrindo um arquivo para leitura, na prática

Reunindo tudo, eis a forma idiomática de abrir um arquivo existente para leitura:

```c
HANDLE hArquivo = CreateFileW(
    L"dados.txt",                  // caminho (string wide)
    GENERIC_READ,                  // so vamos ler
    FILE_SHARE_READ,               // outros podem ler ao mesmo tempo
    NULL,                          // seguranca padrao
    OPEN_EXISTING,                 // o arquivo deve existir
    FILE_ATTRIBUTE_NORMAL,         // sem atributos especiais
    NULL);                         // sem template

if (hArquivo == INVALID_HANDLE_VALUE) {
    DWORD erro = GetLastError();
    wprintf(L"Falha ao abrir o arquivo. Codigo de erro: %lu\n", erro);
    return 1;
}

// ... use o arquivo ...

CloseHandle(hArquivo);             // sempre feche o que abriu
```

Repare em três coisas que vão se repetir por todo o livro: a string do caminho é **wide** (prefixo `L`), o retorno é verificado contra `INVALID_HANDLE_VALUE`, e o erro detalhado vem de `GetLastError`. E, ao final, o handle é liberado com `CloseHandle` — todo recurso que você abre deve ser fechado.

## Lendo dados: `ReadFile`

Com um handle válido em mãos, a leitura é feita por `ReadFile`. A função preenche um buffer que você fornece e informa quantos bytes foram efetivamente lidos:

```c
BOOL ReadFile(
    HANDLE       hFile,                // o handle do arquivo
    LPVOID       lpBuffer,             // buffer de destino
    DWORD        nNumberOfBytesToRead, // quantos bytes tentar ler
    LPDWORD      lpNumberOfBytesRead,  // saida: quantos foram lidos
    LPOVERLAPPED lpOverlapped          // NULL para I/O sincrono
);
```

O formato é o padrão "você fornece um buffer e recebe uma contagem", já visto no console. A função retorna um `BOOL`: diferente de zero em caso de sucesso, zero em caso de falha. Um exemplo de leitura em blocos:

```c
char  buffer[4096];
DWORD lidos = 0;

while (ReadFile(hArquivo, buffer, sizeof(buffer), &lidos, NULL) && lidos > 0) {
    // processe os primeiros 'lidos' bytes de buffer
    // (atencao: o buffer NAO e terminado em zero automaticamente)
}
```

> [!AVISO]
> O fim do arquivo **não** é um erro. Quando `ReadFile` chega ao fim, ela retorna sucesso (valor diferente de zero) com `lidos == 0`. Por isso o laço acima testa as duas condições: a chamada teve sucesso **e** ainda veio algum dado. Tratar fim de arquivo como erro — ou esquecer de checar `lidos` — produz leituras infinitas ou que param cedo demais.

Outro ponto sutil: `ReadFile` pode retornar **menos** bytes do que você pediu, mesmo sem ser fim de arquivo, dependendo da fonte (um pipe ou um soquete, por exemplo). Código robusto nunca assume que uma única leitura trouxe tudo; ele usa a contagem real devolvida em `lidos`.

## Escrevendo dados: `WriteFile`

A escrita é simétrica à leitura:

```c
BOOL WriteFile(
    HANDLE       hFile,                  // o handle do arquivo
    LPCVOID      lpBuffer,               // dados a gravar
    DWORD        nNumberOfBytesToWrite,  // quantos bytes gravar
    LPDWORD      lpNumberOfBytesWritten, // saida: quantos foram gravados
    LPOVERLAPPED lpOverlapped            // NULL para I/O sincrono
);
```

Um exemplo completo que cria um arquivo e grava uma linha de texto nele:

```c
HANDLE hSaida = CreateFileW(
    L"saida.txt",
    GENERIC_WRITE,
    0,                          // acesso exclusivo durante a escrita
    NULL,
    CREATE_ALWAYS,              // cria do zero (sobrescreve se existir)
    FILE_ATTRIBUTE_NORMAL,
    NULL);

if (hSaida == INVALID_HANDLE_VALUE) {
    wprintf(L"Erro ao criar arquivo: %lu\n", GetLastError());
    return 1;
}

const char *texto = "Primeira linha do arquivo.\r\n";
DWORD escritos = 0;

if (!WriteFile(hSaida, texto, (DWORD)strlen(texto), &escritos, NULL)) {
    wprintf(L"Erro ao escrever: %lu\n", GetLastError());
}

CloseHandle(hSaida);
```

> [!DICA]
> Assim como na leitura, em fontes que não são arquivos de disco (pipes, soquetes) `WriteFile` pode gravar menos bytes do que o pedido. Para garantir que tudo foi escrito, compare `escritos` com o tamanho solicitado e, se necessário, repita a chamada para os bytes restantes.

## Texto, bytes e Unicode

Até aqui tratamos o conteúdo como uma sequência crua de **bytes** — e é exatamente isso que `ReadFile` e `WriteFile` manipulam. Elas não sabem nada sobre "texto"; transferem bytes. A interpretação desses bytes como caracteres é responsabilidade sua, e é onde o tema de **character I/O** se cruza com o Unicode.

Internamente, o Windows representa texto em **UTF-16** (cada caractere ocupa, em geral, dois bytes, no tipo `wchar_t`). Mas um arquivo de texto em disco pode estar codificado de várias formas — UTF-8, UTF-16, ou uma página de código legada. Não existe mágica: os bytes do arquivo só viram caracteres corretos se você souber (ou detectar) a codificação e converter adequadamente.

### Quebras de linha

Uma diferença prática em relação a UNIX e Linux: a convenção de fim de linha no Windows é **`\r\n`** (retorno de carro seguido de avanço de linha), não apenas `\n`. Foi por isso que, no exemplo de escrita acima, a string terminou em `\r\n`. Ao gerar arquivos de texto destinados a ferramentas Windows, respeitar essa convenção evita que todo o conteúdo apareça em uma única linha em editores mais antigos.

### Convertendo entre UTF-8 e UTF-16

Como `ReadFile` entrega bytes, um arquivo UTF-8 lido do disco chega como bytes UTF-8. Para transformá-los em texto wide (`wchar_t`) que o restante da API do Windows entende, usa-se `MultiByteToWideChar`; para o caminho inverso, `WideCharToMultiByte`:

```c
// Converte bytes UTF-8 (em 'utf8', com 'nBytes' bytes) para UTF-16.
int nWide = MultiByteToWideChar(CP_UTF8, 0, utf8, nBytes, NULL, 0);
wchar_t *wide = malloc(nWide * sizeof(wchar_t));
MultiByteToWideChar(CP_UTF8, 0, utf8, nBytes, wide, nWide);

// ... use 'wide' ...

free(wide);
```

O padrão de chamada dupla é comum no Windows: primeiro você chama com buffer nulo para **descobrir o tamanho necessário**, aloca a memória, e chama de novo para **preencher**. Veremos esse mesmo padrão repetidamente nas funções de segurança da Parte V, onde estruturas como tokens e descriptors têm tamanho variável.

> [!NOTA]
> Os fluxos padrão de console (que vimos no capítulo anterior, com `WriteConsole`) e os arquivos de disco compartilham a ideia de handle, mas têm comportamentos distintos quanto a codificação. Escrever em um arquivo é transferência pura de bytes; escrever no console envolve a tabela de codificação atual do terminal. Não presuma que o que aparece corretamente no console será gravado de forma idêntica em um arquivo, e vice-versa.

## Tratamento de erros: o padrão do Windows

Você já viu `GetLastError` em ação várias vezes. Vale formalizar o padrão, porque ele é universal na API:

1. A maioria das funções sinaliza falha pelo **valor de retorno** — `INVALID_HANDLE_VALUE`, `NULL`, ou `FALSE`, conforme a função.
2. Quando há falha, o **código de erro detalhado** é obtido com `GetLastError`, que retorna um `DWORD`.
3. Esse código pode ser traduzido para uma mensagem legível com `FormatMessage`.

Um ponto crucial sobre o **momento** de chamar `GetLastError`:

> [!AVISO]
> Chame `GetLastError` **imediatamente** após a função que falhou, antes de qualquer outra chamada à API. Muitas funções do Windows sobrescrevem o código de erro do thread, inclusive algumas que tiveram sucesso. Se você intercalar outra chamada — até mesmo um `wprintf` — entre a falha e a leitura do erro, pode acabar lendo um código que não tem relação com o problema real.

Para transformar o código numérico em texto, `FormatMessage` faz o trabalho pesado:

```c
void mostrar_erro(const wchar_t *contexto) {
    DWORD codigo = GetLastError();
    wchar_t *mensagem = NULL;

    FormatMessageW(
        FORMAT_MESSAGE_ALLOCATE_BUFFER |
        FORMAT_MESSAGE_FROM_SYSTEM     |
        FORMAT_MESSAGE_IGNORE_INSERTS,
        NULL,
        codigo,
        0,
        (LPWSTR)&mensagem,             // FormatMessage aloca o buffer
        0,
        NULL);

    wprintf(L"%s falhou (erro %lu): %s", contexto, codigo, mensagem);
    LocalFree(mensagem);              // libere o buffer alocado por FormatMessage
}
```

Com `FORMAT_MESSAGE_ALLOCATE_BUFFER`, é a própria função que aloca a memória da mensagem — por isso você a libera depois com `LocalFree`, e não com `free`. Detalhes como esse (quem aloca, quem libera, e com qual função) são recorrentes na API e merecem atenção, sobretudo nas estruturas de segurança que veremos adiante no livro.

## Um exemplo completo: copiando um arquivo

Para amarrar todos os conceitos, eis um programa mínimo que copia um arquivo lendo-o em blocos e gravando-os no destino. Ele exercita `CreateFile` nas duas modalidades, o laço de `ReadFile`/`WriteFile`, o tratamento de fim de arquivo e a verificação de erros:

```c
#include <windows.h>
#include <stdio.h>

int wmain(int argc, wchar_t *argv[]) {
    if (argc != 3) {
        wprintf(L"Uso: copiar <origem> <destino>\n");
        return 1;
    }

    HANDLE hEntrada = CreateFileW(argv[1], GENERIC_READ, FILE_SHARE_READ,
                                  NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hEntrada == INVALID_HANDLE_VALUE) {
        wprintf(L"Nao foi possivel abrir a origem: %lu\n", GetLastError());
        return 1;
    }

    HANDLE hSaida = CreateFileW(argv[2], GENERIC_WRITE, 0,
                                NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hSaida == INVALID_HANDLE_VALUE) {
        wprintf(L"Nao foi possivel criar o destino: %lu\n", GetLastError());
        CloseHandle(hEntrada);
        return 1;
    }

    char  buffer[8192];
    DWORD lidos = 0, escritos = 0;
    BOOL  ok = TRUE;

    while (ReadFile(hEntrada, buffer, sizeof(buffer), &lidos, NULL) && lidos > 0) {
        if (!WriteFile(hSaida, buffer, lidos, &escritos, NULL) || escritos != lidos) {
            wprintf(L"Falha na escrita: %lu\n", GetLastError());
            ok = FALSE;
            break;
        }
    }

    CloseHandle(hEntrada);
    CloseHandle(hSaida);

    if (ok) wprintf(L"Copia concluida.\n");
    return ok ? 0 : 1;
}
```

Compile e execute:

Compile no **Developer Command Prompt for VS** (que configura o ambiente do compilador):

```bat
cl copiar.c
copiar.exe dados.txt copia.txt
```

Esse pequeno programa contém, em essência, tudo o que este capítulo apresentou: handles abertos com a disposição correta, um laço de leitura que respeita o fim de arquivo, escrita verificada byte a byte, erros consultados no momento certo e — não menos importante — **todos os handles fechados** ao final, inclusive no caminho de erro.

## O que aprendemos

- Arquivos abertos são representados por **handles**, que já carregam uma decisão de autorização tomada contra a DACL do arquivo.
- `CreateFile` abre e cria arquivos; seus parâmetros de **acesso**, **compartilhamento** e **disposição** determinam o comportamento e têm implicações de segurança.
- `ReadFile` e `WriteFile` transferem **bytes**, não texto; o fim de arquivo é sinalizado por sucesso com contagem zero, não por erro.
- A interpretação de bytes como **texto** exige atenção à codificação (UTF-8 vs UTF-16) e à convenção de quebra de linha `\r\n` do Windows.
- O **tratamento de erros** segue o padrão "valor de retorno indica falha, `GetLastError` dá o detalhe", e o código de erro deve ser lido imediatamente após a falha.

Esses fundamentos reaparecerão constantemente. No próximo tópico veremos como inspecionar **atributos e metadados** de arquivos — tamanho, datas, e os atributos que, mais adiante, se conectarão diretamente às permissões e ao modelo de segurança do Windows.
