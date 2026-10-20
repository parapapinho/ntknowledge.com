## Introdução

Para quem acompanhava os tutoriais de unpacking no CrackLatinos ou no Tuts4You, o nome Enigma Protector traz boas lembranças — ou péssimas, dependendo da sua skill, rsrs. Eram horas no debugger, fazendo tracing e tentando entender o que ainda faltava para aquele dump funcionar com a IAT corrigida. Revisitar esse tipo de proteção me traz muita nostalgia. Contudo, o que me chamou a atenção recentemente foi encontrar o Enigma novamente em pesquisas sobre operações de malware.

Em junho de 2026, a [ESET documentou o uso de Enigma e Themida em ferramentas para desativar EDRs mantidas pelo grupo The Gentlemen](https://www.welivesecurity.com/en/eset-research/killing-me-gently-inside-gentlemens-edr-killer-framework/). Entre as amostras identificadas está uma variante do GentleKiller protegida com Enigma. Em 2025, a [Aryaka também registrou o uso de Enigma Protector em uma campanha atribuída ao Kimsuky](https://www.aryaka.com/docs/reports/aryaka-kimsuky-apt-operational-blueprint.pdf), no mapeamento de técnicas apresentado ao final do relatório. Essas referências mostram por que conhecer um protector comercial ainda faz diferença no trabalho de análise.

Foi esse uso por atores maliciosos que me motivou a revisitar o Enigma e escrever este tutorial — sim, vou chamar de tutorial. Para quem analisa malware, a proteção pode ocupar boa parte do trabalho antes que seja possível examinar a lógica da amostra. Entender onde termina o loader e começa o código da aplicação ajuda a interpretar o que aparece no debugger e a reconhecer quais comportamentos pertencem a cada um.

A ideia é fazer isso como nos velhos tempos: debugger aberto, acompanhando a execução e explicando o raciocínio (ou não ;) ) por trás de cada etapa. Ao longo do texto, vamos observar as checagens anti-debugging, chegar ao Original Entry Point (OEP), fazer o dump e reconstruir a Import Address Table (IAT).

## 1. Preparando o executável

Para começar, utilizei a versão 7.40 do Enigma.

> ![Janela About do Enigma Protector x64 7.40, build 20230424](/assets/images/enigma/eng1.png)
>

É possível notar que o Enigma possui diversas opções de configuração:

> ![Tela Input do Enigma Protector com os arquivos de entrada e saída e as categorias de configuração](/assets/images/enigma/eng2.png)
>

Para este estudo, foquei nas opções de anti-debugging e de emulação de APIs. As imagens abaixo mostram as configurações utilizadas:

> ![Opções de anti-debugging ativadas, incluindo checagem em runtime e mensagem antes do encerramento](/assets/images/enigma/eng3.png)
>
> ![Import Protection com Emulate WinAPI functions ativado e Redirect WinAPI functions desativado](/assets/images/enigma/eng4.png)

O instalador do Enigma inclui um executável de teste, então utilizei esse arquivo como exemplo. Protegi o executável com as configurações das imagens acima e parti para o debugging.

A primeira coisa que eu gosto de fazer ao debugar qualquer programa é executá-lo e verificar se ocorre algum problema na execução. Para os testes de debugging, utilizei o IDA Pro 9.4 e o x64dbg, ambos sem plugins de anti-anti-debugging.

## 2. Sendo detectado

Primeiro, executei o programa no x64dbg. Logo surgiu a janela **Debugger warning**. A lista inicial de imports continha `MessageBoxA`, mas o breakpoint que coloquei nessa API não foi atingido antes de o aviso aparecer. Só a presença da função na tabela de imports não era suficiente para identificar o caminho usado para exibir aquela mensagem.

> ![Aviso Debugger warning informando que o programa não será executado enquanto houver um debugger ativo](/assets/images/enigma/eng5.png)
>
> ![Lista de imports no x64dbg com user32.MessageBoxA em destaque](/assets/images/enigma/eng6.png)

Bem, tentei retornar ao código do programa pelo debugger, mas não consegui. Então pausei a execução e encontrei, na visualização da pilha, um ponteiro para a string `CheckRemoteDebuggerPresent`. Segundo a [documentação da Microsoft](https://learn.microsoft.com/en-us/windows/win32/api/debugapi/nf-debugapi-checkremotedebuggerpresent), essa API verifica se o processo especificado está sendo depurado. Era uma boa pista de uma possível checagem anti-debugging, embora a string, sozinha, ainda não comprovasse uma chamada. Pelo menos eu já tinha por onde começar.

> ![Visualização da pilha com ponteiros para as strings kernel32.dll e CheckRemoteDebuggerPresent](/assets/images/enigma/eng7.png)

Para confirmar o uso de `CheckRemoteDebuggerPresent`, coloquei um breakpoint de software na API e, em outra execução, testei um breakpoint de hardware (HBP). O resultado chamou minha atenção: com o breakpoint de software, o x64dbg registrou o encerramento do processo com o código `0x80000003` (`STATUS_BREAKPOINT`); com o HBP, o código foi `0x80000004` (`STATUS_SINGLE_STEP`).

Esses códigos correspondem a exceções de breakpoint e de single-step, respectivamente. Em x86/x64, um breakpoint de software normalmente usa a instrução `INT3`; um breakpoint de hardware pode gerar uma exceção de single-step, assim como a execução passo a passo. Portanto, esses códigos não significam, por si só, que o programa detectou o debugger ou inspecionou os breakpoints.

As imagens abaixo mostram os códigos de saída registrados nas duas tentativas:

> ![Log do x64dbg mostrando o encerramento do processo com o código 0x80000003, STATUS_BREAKPOINT](/assets/images/enigma/eng8.png)
>
> ![Log do x64dbg mostrando o encerramento do processo com o código 0x80000004, STATUS_SINGLE_STEP](/assets/images/enigma/eng9.png)

Minha suspeita era que alguma proteção estivesse interferindo na depuração. O comportamento merecia investigação, mas eu ainda precisava descobrir onde a falha ocorria e por que não conseguia parar na API.

Eu queria confirmar se a exceção ocorria exatamente no endereço em que havia colocado o breakpoint em `kernel32!CheckRemoteDebuggerPresent`. Para isso, precisava distinguir duas informações: o **código da exceção**, que identifica seu tipo, e o **endereço da exceção**, que indica onde ela ocorreu.

Antes de continuar a execução, abri a aba **Log** do x64dbg, cliquei com o botão direito e escolhi **Redirect Log**. Selecionei um arquivo `.txt` para gravar as novas mensagens.

Em seguida, configurei breakpoints de exceção e mensagens de log com os comandos abaixo:

```text
SetExceptionBPX 80000003, all
SetExceptionBreakpointLog 80000003, "CODIGO={x:ex.code()} ENDERECO={a:ex.addr()}"
SetExceptionBPX 80000004, all
SetExceptionBreakpointLog 80000004, "CODIGO={x:ex.code()} ENDERECO={a:ex.addr()}"
```

O argumento `all` configura a captura de exceções de primeira e segunda chance. As mensagens registram o código e o endereço quando o breakpoint de exceção é atingido. As referências dos comandos estão na documentação do x64dbg: [SetExceptionBPX](https://help.x64dbg.com/en/latest/commands/breakpoint-control/SetExceptionBPX.html) e [SetExceptionBreakpointLog](https://help.x64dbg.com/en/latest/commands/conditional-breakpoint-control/SetExceptionBreakpointLog.html).

Porém, ao continuar a execução com o breakpoint na API, a aplicação encerrava sem que eu obtivesse o registro esperado do endereço da exceção. Os breakpoints estavam configurados como mostra a imagem:

> ![Breakpoints habilitados no x64dbg: CheckRemoteDebuggerPresent em 0x7FFAD8B15180 e as exceções 0x80000003 e 0x80000004](/assets/images/enigma/eng10.png)

Se o x64dbg parar em uma exceção, o comando [`exinfo`](https://help.x64dbg.com/en/latest/commands/analysis/exinfo.html) permite consultar os dados da última exceção recebida pelo debugger, incluindo `ExceptionCode` e `ExceptionAddress`. Vale registrar essa saída antes de continuar a execução. O comando depende das informações recebidas pelo debugger; ele não reconstrói uma exceção que não foi entregue a ele.

E agora? Apelei para o log de eventos do Windows. Repeti o teste e abri o **Visualizador de Eventos**, em **Logs do Windows > Aplicativo**, para procurar o registro da falha:

> ![Evento 1000, Application Error, com exceção 0x80000003 em KERNEL32.DLL e deslocamento de falha 0x45180](/assets/images/enigma/eng11.png)

O evento identificou `KERNEL32.DLL` como o módulo com falha, o código de exceção `0x80000003` e o deslocamento `0x45180`. Esse deslocamento é relativo à base da DLL carregada, não à base do executável protegido. No x64dbg, a entrada de `kernel32!CheckRemoteDebuggerPresent` também aparecia no RVA `0x45180`:

> ![Disassembly de kernel32.CheckRemoteDebuggerPresent no endereço 0x7FFAD8B15180, com RVA 0x45180](/assets/images/enigma/eng12.png)

Com a base de `kernel32.dll` daquela execução, a conta ficou:

```text
Base de kernel32.dll:  0x7FFAD8AD0000
Deslocamento da falha:         0x45180
Endereço da falha:     0x7FFAD8B15180
```

O resultado coincide com o endereço em que coloquei o breakpoint na API. Assim, o registro de falha permitiu localizar a exceção mesmo sem o log esperado do x64dbg. Isso confirmou o local da falha nesse teste.

## 3. Primeiro obstáculo: `ThreadHideFromDebugger`

Os breakpoints em `CheckRemoteDebuggerPresent` provocavam uma exceção, mas o debugger não conseguia parar normalmente naquela thread. Isso levantou uma hipótese: o loader poderia tê-la ocultado dos eventos de debugging?

Para averiguar isso, criei um script em Python que recebe o ID de uma thread e consulta se ela está oculta do debugger. O script abre um handle com `OpenThread` e chama `NtQueryInformationThread`, passando a classe `ThreadHideFromDebugger` (`0x11`). Nessa consulta, o buffer de saída recebe um `BOOLEAN` de um byte: `1` indica que a thread está oculta; `0`, que não está. Esse resultado deve ser interpretado depois de conferir o `NTSTATUS` retornado pela chamada. A definição dessa classe pode ser consultada nos [headers do projeto phnt](https://github.com/winsiderss/phnt/blob/master/ntpsapi.h).

Primeiro, identifiquei a thread principal no x64dbg. Naquela execução, seu ID era `8196`:

> ![Lista de threads no x64dbg com a thread principal, de ID 8196, em destaque](/assets/images/enigma/eng13.png)

Em seguida, executei o script para consultar essa thread:

> ![Execução de query_hidden_thread.py para o TID 8196, com NTSTATUS=0x00000000 e hidden=1](/assets/images/enigma/eng14.png)

A consulta retornou `NTSTATUS=0x00000000` e `hidden=1`. Isso confirmou que a thread principal estava oculta naquele momento. Na execução seguinte, coloquei um breakpoint em `ntdll!NtSetInformationThread` e observei a chamada do loader com `RCX=-2`, o pseudo-handle da thread atual, e `RDX=0x11`, correspondente a `ThreadHideFromDebugger`:

> ![Entrada de NtSetInformationThread com RCX=FFFFFFFFFFFFFFFE e RDX=0x11](/assets/images/enigma/eng15.png)

Então eu precisava impedir essa chamada de ocultar a thread, para conseguir parar em `CheckRemoteDebuggerPresent`.

Havia várias formas de fazer isso. Escolhi substituir os três primeiros bytes de `NtSetInformationThread`, **na memória do processo depurado**, por um retorno imediato de sucesso:

```asm
ntdll!NtSetInformationThread
antes:  4C 8B D1      ; mov r10,rcx
depois: 31 C0 C3      ; xor eax,eax / ret
```

O `xor eax,eax` prepara o retorno `STATUS_SUCCESS` (`0`), e o `ret` devolve o controle ao chamador sem executar a chamada de sistema. Esse patch não filtra a classe `0x11`: enquanto estiver aplicado, ele faz qualquer chamada que passe por essa entrada retornar sucesso sem realizar a operação.

A ordem aqui importa: o patch precisa ser aplicado **antes de a thread ser ocultada**. Ele não desfaz uma ocultação que já ocorreu. Como a alteração é feita apenas na memória, também precisa ser reaplicada após reiniciar o processo.

Reiniciei o programa, configurei dois breakpoints de execução por hardware — um em `NtSetInformationThread` e outro em `CheckRemoteDebuggerPresent` — e continuei a execução:

> ![Breakpoints habilitados em kernel32.CheckRemoteDebuggerPresent e na entrada de ntdll identificada como ZwSetInformationThread](/assets/images/enigma/eng16.png)

Nas capturas, o x64dbg identifica a entrada de `ntdll` como `ZwSetInformationThread`. Esse é o rótulo exibido no endereço usado para o patch.

Na primeira parada, substituí os bytes na entrada da função:

> ![Entrada de NtSetInformationThread alterada em memória para xor eax,eax seguido de ret](/assets/images/enigma/eng17.png)

Em seguida, continuei a execução. Dessa vez, consegui parar em `CheckRemoteDebuggerPresent`:

> ![Parada em kernel32.CheckRemoteDebuggerPresent com RCX=-1 e RDX=0x23FFD08](/assets/images/enigma/eng18.png)

Nesse ponto, anotei o **valor de `RDX`**, que era `0x23FFD08`. Ele apontava para o `BOOL` de saída em que a API escreveria a resposta sobre a presença do debugger. Esse `BOOL` ocupa quatro bytes, diferentemente do `BOOLEAN` de um byte usado na consulta anterior.

Continuei até o `ret` mostrado na imagem abaixo. Nesse ponto, a API já havia escrito `01 00 00 00` no endereço salvo, indicando a presença do debugger. Antes de retornar ao chamador, alterei esses quatro bytes para `00 00 00 00`:

> ![Parada no ret de CheckRemoteDebuggerPresent em KERNELBASE, com o BOOL em 0x23FFD08 contendo 01 00 00 00 antes da alteração](/assets/images/enigma/eng19.png)

É importante guardar o ponteiro na entrada da API: `RDX` é volátil e pode ter outro valor ao final da chamada. A alteração é feita no conteúdo do endereço salvo, não no registrador. O retorno de sucesso da API deve ser preservado: conforme a [documentação de CheckRemoteDebuggerPresent](https://learn.microsoft.com/en-us/windows/win32/api/debugapi/nf-debugapi-checkremotedebuggerpresent), o valor retornado indica se a consulta teve sucesso; a resposta sobre o debugger fica no `BOOL` de saída.

Por fim, continuei a execução e a janela do aplicativo abriu sob o debugger:

> ![Janela Notepad do aplicativo de teste aberta sob o debugger após o patch e a alteração do BOOL de saída](/assets/images/enigma/eng20.png)

Com isso, consegui atravessar a checagem inicial e abrir o programa nesse teste. A checagem em runtime, quando ativada, ainda pode repetir a consulta. Mas agora sabemos como burlar.

## 4. Encontrando o OEP do programa

Depois de contornar a checagem de `CheckRemoteDebuggerPresent`, o próximo passo foi localizar o **Original Entry Point (OEP)** do programa. É nesse ponto que quero parar para fazer o dump e, depois, reconstruir a IAT.

Quem já analisou packers acaba reconhecendo alguns padrões na transferência de controle para o código original. Ainda assim, não existe uma técnica única que funcione em todos os casos: encontrar esse ponto exige tracing e investigação. Para não alongar o tutorial com todo o rastreio, vou mostrar o trecho final que encontrei nesta amostra.

Coloquei um breakpoint de execução por hardware em `0x1002EAF78` e parei na sequência que prepara o salto:

> ![Sequência em 0x1002EAF78 que carrega RAX, restaura RSP e executa jmp rax em 0x1002EAF80](/assets/images/enigma/eng21.png)

```asm
0x1002EAF78  mov rax, qword ptr [rbp-20h]
0x1002EAF7C  mov rsp, qword ptr [rbp-8]
0x1002EAF80  jmp rax
```

A primeira instrução carrega em `RAX` o endereço de destino. A segunda restaura `RSP` a partir do valor salvo em `[RBP-8]`. Por fim, o `jmp rax` transfere o controle para esse destino. O breakpoint está no início da sequência; o salto propriamente dito ocorre em `0x1002EAF80`.

Para quem já está pensando em automatizar a busca, os bytes dessa sequência são:

```text
48 8B 45 E0 48 8B 65 F8 FF E0
```

> ![Byte pattern da sequência anterior ao OEP: 48 8B 45 E0 48 8B 65 F8 FF E0](/assets/images/enigma/eng22.png)

Esse pattern serve como ponto de partida para localizar a sequência nesta amostra. Encontrar os mesmos bytes em outro executável não garante que se trate do salto para o OEP: ainda é preciso acompanhar a execução e conferir o destino.

Ao executar o `jmp rax`, cheguei a `0x1000162B0`, o OEP identificado para o aplicativo de teste:

> ![Código no OEP 0x1000162B0, começando por uma instrução LEA que ajusta RSP](/assets/images/enigma/eng23.png)

Nesta execução, a imagem estava carregada na base `0x100000000`. Assim, o RVA do salto é `0x2EAF80`, e o do OEP é `0x162B0`. Se essa mesma imagem for carregada em outra base, os endereços virtuais devem ser recalculados como `VA = base da imagem + RVA`.

## 5.Achando IAT, dumpando e finalizando

Pois bem, uma vez que cheguemos ao OEP, os próximos passos são:

1. Achar a IAT ou fazer uma nova.
2. Desobrir o tamanho exato que ela poderia ter.
3. Fazer o dump corrigindo quaisquer erros.

Logo abaixo do OEP, podemos notar uma chamada para GetModuleHandle e é nela que vamos entrar:

> ![Código no OEP 0x1000162B0, começando por uma instrução LEA que ajusta RSP](/assets/images/enigma/eng23.png)

Uma vez dentro da call, é possível notar uma grande quantidade de jmps indiretos:

> ![Código no OEP 0x1000162B0, começando por uma instrução LEA que ajusta RSP](/assets/images/enigma/eng24.png)
>
> ![Código no OEP 0x1000162B0, começando por uma instrução LEA que ajusta RSP](/assets/images/enigma/eng25.png)

Seguindo o valor no dump, é possível ver centenas de entradas indiretas:

> ![Código no OEP 0x1000162B0, começando por uma instrução LEA que ajusta RSP](/assets/images/enigma/eng26.png)

Logo, se fizermos a conta aonde termina essas entradas menos o endereço da onde começa a IAT, vamos ter o size que precisamos.

Então já temos algumas informações:

1. OEP = 00000001000162b0
2. Endereço do começo da IAT = 0000000100290e3c
3. Size da IAT = 0xD88
