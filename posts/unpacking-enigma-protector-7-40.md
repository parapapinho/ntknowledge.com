## Introdução

Em junho de 2026, a ESET documentou o uso de Enigma e Themida em ferramentas para desativar EDRs mantidas pelo grupo The Gentlemen. Entre as amostras identificadas está uma variante do GentleKiller protegida com Enigma. [[1]](https://www.welivesecurity.com/en/eset-research/killing-me-gently-inside-gentlemens-edr-killer-framework/) Em 2025, a Aryaka também registrou o uso de Enigma Protector em uma campanha atribuída ao Kimsuky, no mapeamento de técnicas apresentado ao final do relatório. [[2]](https://www.aryaka.com/docs/reports/aryaka-kimsuky-apt-operational-blueprint.pdf) Essas referências mostram por que conhecer um protector comercial ainda faz diferença no trabalho de análise.

Foi esse uso por atores maliciosos que me motivou a revisitar o Enigma e escrever este tutorial — sim, vou chamar de tutorial. Para quem analisa malware, a proteção pode ocupar boa parte do trabalho antes que seja possível examinar a lógica da amostra. Entender onde termina o loader e começa o código da aplicação ajuda a interpretar o que aparece no debugger e a reconhecer quais comportamentos pertencem a cada um.

## 1. Preparando o executável

Para começar, utilizei a versão x64 7.40 do Enigma.

> ![Janela About do Enigma Protector x64 7.40, build 20230424](/assets/images/enigma/eng1.png)

É possível notar que o Enigma possui diversas opções de configuração:

> ![Tela Input do Enigma Protector com os arquivos de entrada e saída e as categorias de configuração](/assets/images/enigma/eng2.png)

Para este estudo, foquei nas opções de anti-debugging e de emulação de APIs, descritas no manual do Enigma. [[3]](https://www.enigmaprotector.com/en/help/manual/programoverview-checkup-antidebugger) [[4]](https://www.enigmaprotector.com/en/help/manual/programoverview-protectionfeatures-importprotection) As imagens abaixo mostram as configurações utilizadas:

> ![Opções de anti-debugging ativadas, incluindo checagem em runtime e mensagem antes do encerramento](/assets/images/enigma/eng3.png)

> ![Import Protection com Emulate WinAPI functions ativado e Redirect WinAPI functions desativado](/assets/images/enigma/eng4.png)

O instalador do Enigma inclui um executável de teste, o **test64.exe**, então utilizei esse arquivo como exemplo. Protegi o executável com as configurações das imagens acima e parti para o debugging. Mantive o original sem proteção para comparar o código e as estruturas PE ao longo da análise.

A primeira coisa que eu gosto de fazer ao debugar qualquer programa é executá-lo e verificar se ocorre algum problema na execução. Para os testes de debugging, utilizei o IDA Pro 9.4 e o x64dbg, ambos sem plugins de anti-anti-debugging. Na etapa de reconstrução, usei o Scylla x64 e o PE-bear.

Os endereços das capturas pertencem às respectivas sessões. Ao repetir o procedimento, resolva as APIs no seu processo e confira a base dos módulos; os endereços absolutos podem mudar.

## 2. Sendo detectado

Primeiro, executei o programa no x64dbg. Logo surgiu a janela **Debugger warning**. A lista inicial de imports continha **MessageBoxA**, mas o breakpoint que coloquei nessa API não foi atingido antes de o aviso aparecer. Só a presença da função na tabela de imports não era suficiente para identificar o caminho usado para exibir aquela mensagem.

> ![Aviso Debugger warning informando que o programa não será executado enquanto houver um debugger ativo](/assets/images/enigma/eng5.png)

> ![Lista de imports no x64dbg com user32.MessageBoxA em destaque](/assets/images/enigma/eng6.png)

Bem, tentei retornar ao código do programa pelo debugger, mas não consegui. Então pausei a execução e encontrei, na visualização da pilha, um ponteiro para a string **CheckRemoteDebuggerPresent**. Segundo a documentação da Microsoft, essa API verifica se o processo especificado está sendo depurado. [[5]](https://learn.microsoft.com/en-us/windows/win32/api/debugapi/nf-debugapi-checkremotedebuggerpresent) Era uma boa pista de uma possível checagem anti-debugging, embora a string, sozinha, ainda não comprovasse uma chamada. Pelo menos eu já tinha por onde começar.

> ![Visualização da pilha com ponteiros para as strings kernel32.dll e CheckRemoteDebuggerPresent](/assets/images/enigma/eng7.png)

Para confirmar o uso de **CheckRemoteDebuggerPresent**, coloquei um breakpoint de software na API e, em outra execução, testei um breakpoint de hardware (HBP). O resultado chamou minha atenção: com o breakpoint de software, o x64dbg registrou o encerramento do processo com o código **0x80000003** (**STATUS_BREAKPOINT**); com o HBP, o código foi **0x80000004** (**STATUS_SINGLE_STEP**).

Esses códigos correspondem a exceções de breakpoint e de single-step, respectivamente. [[6]](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-exception_record) Em x86/x64, um breakpoint de software normalmente usa a instrução **INT3**; um breakpoint de hardware pode gerar uma exceção de single-step, assim como a execução passo a passo. Portanto, esses códigos não significam, por si só, que o programa detectou o debugger ou inspecionou os breakpoints.

As imagens abaixo mostram os códigos de saída registrados nas duas tentativas:

> ![Log do x64dbg mostrando o encerramento do processo com o código 0x80000003, STATUS_BREAKPOINT](/assets/images/enigma/eng8.png)

> ![Log do x64dbg mostrando o encerramento do processo com o código 0x80000004, STATUS_SINGLE_STEP](/assets/images/enigma/eng9.png)

Minha suspeita era que alguma proteção estivesse interferindo na depuração. O comportamento merecia investigação, mas eu ainda precisava descobrir onde a falha ocorria e por que não conseguia parar na API.

Eu queria confirmar se a exceção ocorria exatamente no endereço em que havia colocado o breakpoint em **kernel32!CheckRemoteDebuggerPresent**. Para isso, precisava distinguir duas informações: o **código da exceção**, que identifica seu tipo, e o **endereço da exceção**, que indica onde ela ocorreu. [[6]](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-exception_record)

Antes de continuar a execução, abri a aba **Log** do x64dbg, cliquei com o botão direito e escolhi **Redirect Log**. Selecionei um arquivo **.txt** para gravar as novas mensagens.

Em seguida, configurei breakpoints de exceção e mensagens de log com os comandos abaixo:

```text
SetExceptionBPX 80000003, all
SetExceptionBreakpointLog 80000003, "CODIGO={x:ex.code()} ENDERECO={a:ex.addr()}"
SetExceptionBPX 80000004, all
SetExceptionBreakpointLog 80000004, "CODIGO={x:ex.code()} ENDERECO={a:ex.addr()}"
```

O argumento **all** configura a captura de exceções de primeira e segunda chance. [[7]](https://help.x64dbg.com/en/latest/commands/breakpoint-control/SetExceptionBPX.html) As mensagens registram o código e o endereço quando o breakpoint de exceção é atingido. [[8]](https://help.x64dbg.com/en/latest/commands/conditional-breakpoint-control/SetExceptionBreakpointLog.html)

Porém, ao continuar a execução com o breakpoint na API, a aplicação encerrava sem que eu obtivesse o registro esperado do endereço da exceção. Os breakpoints estavam configurados como mostra a imagem:

> ![Breakpoints habilitados no x64dbg: CheckRemoteDebuggerPresent em 0x7FFAD8B15180 e as exceções 0x80000003 e 0x80000004](/assets/images/enigma/eng10.png)

Se o x64dbg parar em uma exceção, o comando **exinfo** permite consultar os dados da última exceção recebida pelo debugger, incluindo **ExceptionCode** e **ExceptionAddress**. [[9]](https://help.x64dbg.com/en/latest/commands/analysis/exinfo.html) Vale registrar essa saída antes de continuar a execução. O comando depende das informações recebidas pelo debugger; no fim nada foi registrado e o debugger simplesmente fechou.

E agora? Apelei para o log de eventos do Windows. Repeti o teste e abri o **Visualizador de Eventos**, em **Logs do Windows > Aplicativo**, para procurar o registro da falha:

> ![Evento 1000, Application Error, com exceção 0x80000003 em KERNEL32.DLL e deslocamento de falha 0x45180](/assets/images/enigma/eng11.png)

O evento identificou **KERNEL32.DLL** como o módulo com falha, o código de exceção **0x80000003** e o deslocamento **0x45180**. Esse deslocamento é relativo à base da DLL carregada, não à base do executável protegido. No x64dbg, a entrada de **kernel32!CheckRemoteDebuggerPresent** também aparecia no RVA **0x45180**:

> ![Disassembly de kernel32.CheckRemoteDebuggerPresent no endereço 0x7FFAD8B15180, com RVA 0x45180](/assets/images/enigma/eng12.png)

Com a base de **kernel32.dll** daquela execução, a conta ficou:

```text
Base de kernel32.dll:  0x7FFAD8AD0000
Deslocamento da falha:         0x45180
Endereço da falha:     0x7FFAD8B15180
```

O resultado coincide com o endereço em que coloquei o breakpoint na API. Assim, o registro de falha permitiu localizar a exceção mesmo sem o log esperado do x64dbg. Isso confirmou o local da falha nesse teste.

## 3. Primeiro obstáculo: **ThreadHideFromDebugger**

Os breakpoints em **CheckRemoteDebuggerPresent** provocavam uma exceção, mas o debugger não conseguia parar normalmente naquela thread. Isso levantou uma hipótese: o loader poderia ter ocultado essa thread do debugger, impedindo a entrega dos seus eventos?

Para averiguar isso, criei um script em Python que recebe o ID de uma thread e consulta se ela está oculta do debugger. O script abre um handle com **OpenThread** e chama **NtQueryInformationThread**, passando a classe **ThreadHideFromDebugger** (**0x11**). Nessa consulta, o buffer de saída recebe um **BOOLEAN** de um byte: **1** indica que a thread está oculta; **0**, que não está. Esse resultado deve ser interpretado depois de conferir o **NTSTATUS** retornado pela chamada. A definição dessa classe pode ser consultada nos headers do projeto phnt. [[10]](https://github.com/winsiderss/phnt/blob/master/ntpsapi.h)

Primeiro, identifiquei a thread principal no x64dbg. Naquela execução, seu ID era **8196**:

> ![Lista de threads no x64dbg com a thread principal, de ID 8196, em destaque](/assets/images/enigma/eng13.png)

Em seguida, executei o script para consultar essa thread:

> ![Execução de query_hidden_thread.py para o TID 8196, com NTSTATUS=0x00000000 e hidden=1](/assets/images/enigma/eng14.png)

A consulta retornou **NTSTATUS=0x00000000** e **hidden=1**. Isso confirmou que a thread principal estava oculta naquele momento. Na execução seguinte, coloquei um breakpoint em **ntdll!NtSetInformationThread** e observei a chamada do loader com **RCX=-2**, o pseudo-handle da thread atual, e **RDX=0x11**, correspondente a **ThreadHideFromDebugger**:

> ![Entrada de NtSetInformationThread com RCX=FFFFFFFFFFFFFFFE e RDX=0x11](/assets/images/enigma/eng15.png)

Então eu precisava impedir essa chamada de ocultar a thread, para conseguir parar em **CheckRemoteDebuggerPresent**.

Havia várias formas de fazer isso. Escolhi substituir os três primeiros bytes de **NtSetInformationThread**, **na memória do processo depurado**, por um retorno imediato de sucesso:

```asm
ntdll!NtSetInformationThread
antes:  4C 8B D1      ; mov r10,rcx
depois: 31 C0 C3      ; xor eax,eax / ret
```

O **xor eax,eax** prepara o retorno **STATUS_SUCCESS** (**0**), e o **ret** devolve o controle ao chamador sem executar a chamada de sistema. Esse patch não filtra a classe **0x11**: enquanto estiver aplicado, ele faz qualquer chamada que passe por essa entrada retornar sucesso sem realizar a operação.

A ordem aqui importa: o patch precisa ser aplicado **antes de a thread ser ocultada**. Ele não desfaz uma ocultação que já ocorreu. Como a alteração é feita apenas na memória, também precisa ser reaplicada após reiniciar o processo.

Reiniciei o programa, configurei dois breakpoints de execução por hardware — um em **NtSetInformationThread** e outro em **CheckRemoteDebuggerPresent** — e continuei a execução:

> ![Breakpoints habilitados em kernel32.CheckRemoteDebuggerPresent e na entrada de ntdll identificada como ZwSetInformationThread](/assets/images/enigma/eng16.png)

Nas capturas, o x64dbg identifica a entrada de **ntdll** como **ZwSetInformationThread**. Esse é o rótulo exibido no endereço usado para o patch.

Na primeira parada, substituí os bytes na entrada da função:

> ![Entrada de NtSetInformationThread alterada em memória para xor eax,eax seguido de ret](/assets/images/enigma/eng17.png)

Em seguida, continuei a execução. Dessa vez, consegui parar em **CheckRemoteDebuggerPresent**:

> ![Parada em kernel32.CheckRemoteDebuggerPresent com RCX=-1 e RDX=0x23FFD08](/assets/images/enigma/eng18.png)

Nesse ponto, anotei o **valor de RDX**, que era **0x23FFD08**. Ele apontava para o **BOOL** de saída em que a API escreveria a resposta sobre a presença do debugger. Esse **BOOL** ocupa quatro bytes, diferentemente do **BOOLEAN** de um byte usado na consulta anterior. [[11]](https://learn.microsoft.com/en-us/windows/win32/winprog/windows-data-types)

Continuei até o **ret** mostrado na imagem abaixo. Nesse ponto, a API já havia escrito **01 00 00 00** no endereço salvo, indicando a presença do debugger. Antes de retornar ao chamador, alterei esses quatro bytes para **00 00 00 00**:

> ![Parada no ret de CheckRemoteDebuggerPresent em KERNELBASE, com o BOOL em 0x23FFD08 contendo 01 00 00 00 antes da alteração](/assets/images/enigma/eng19.png)

É importante guardar o ponteiro na entrada da API: **RDX** é volátil e pode ter outro valor ao final da chamada. [[12]](https://learn.microsoft.com/en-us/cpp/build/x64-calling-convention?view=msvc-170) A alteração é feita no conteúdo do endereço salvo, não no registrador. O retorno de sucesso da API deve ser preservado: conforme a documentação de CheckRemoteDebuggerPresent, o valor retornado indica se a consulta teve sucesso; a resposta sobre o debugger fica no **BOOL** de saída. [[5]](https://learn.microsoft.com/en-us/windows/win32/api/debugapi/nf-debugapi-checkremotedebuggerpresent)

Por fim, continuei a execução e a janela do aplicativo abriu sob o debugger:

> ![Janela Notepad do aplicativo de teste aberta sob o debugger após o patch e a alteração do BOOL de saída](/assets/images/enigma/eng20.png)

Com isso, consegui atravessar a checagem inicial e abrir o programa nesse teste. A checagem em runtime, quando ativada, ainda pode repetir a consulta. [[3]](https://www.enigmaprotector.com/en/help/manual/programoverview-checkup-antidebugger) Já sabemos onde intervir, mas alterar uma resposta não modifica as seguintes: é preciso tratar cada nova chamada.

## 4. Encontrando o OEP do programa

Depois de contornar a checagem de **CheckRemoteDebuggerPresent**, o próximo passo foi localizar o **Original Entry Point (OEP)** do programa. É nesse ponto que quero parar para fazer o dump e, depois, reconstruir a IAT.

Quem já analisou packers acaba reconhecendo alguns padrões na transferência de controle para o código original. Ainda assim, não existe uma técnica única que funcione em todos os casos: encontrar esse ponto exige tracing e investigação. Para não alongar o tutorial com todo o rastreio, vou mostrar o trecho final que encontrei nesta amostra.

Coloquei um breakpoint de execução por hardware em **0x1002EAF78** e parei na sequência que prepara o salto:

> ![Sequência em 0x1002EAF78 que carrega RAX, restaura RSP e executa jmp rax em 0x1002EAF80](/assets/images/enigma/eng21.png)

```asm
0x1002EAF78  mov rax, qword ptr [rbp-20h]
0x1002EAF7C  mov rsp, qword ptr [rbp-8]
0x1002EAF80  jmp rax
```

A primeira instrução carrega em **RAX** o endereço de destino. A segunda restaura **RSP** a partir do valor salvo em **[RBP-8]**. Por fim, o **jmp rax** transfere o controle para esse destino. O breakpoint está no início da sequência; o salto propriamente dito ocorre em **0x1002EAF80**.

Para quem já está pensando em automatizar a busca, os bytes dessa sequência são:

```text
48 8B 45 E0 48 8B 65 F8 FF E0
```

> ![Byte pattern da sequência anterior ao OEP: 48 8B 45 E0 48 8B 65 F8 FF E0](/assets/images/enigma/eng22.png)

Esse pattern serve como ponto de partida para localizar a sequência nesta amostra. Encontrar os mesmos bytes em outro executável não garante que se trate do salto para o OEP: ainda é preciso acompanhar a execução e conferir o destino.

Ao executar o **jmp rax**, cheguei a **0x1000162B0**, o OEP identificado para o aplicativo de teste:

> ![Código no OEP 0x1000162B0, começando por uma instrução LEA que ajusta RSP](/assets/images/enigma/eng23.png)

Nesta execução, a imagem estava carregada na base **0x100000000**. Assim, o RVA do salto é **0x2EAF80**, e o do OEP é **0x162B0**. Se essa mesma imagem for carregada em outra base, os endereços virtuais devem ser recalculados como **VA = base da imagem + RVA**. [[13]](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)

## 5. Encontrando a IAT, fazendo o dump e finalizando

Pois bem, depois de localizar o OEP, faltam três etapas:

1. Identificar a IAT em memória e delimitar seu tamanho.
2. Fazer o dump e reconstruir as estruturas de importação.
3. Testar o executável resultante e corrigir eventuais problemas no PE.

### Seguindo os thunks até a IAT

Pouco depois do OEP, encontrei uma chamada que o x64dbg identifica como **GetModuleHandleA**. Entrei nela para acompanhar como o programa chegava à API:

> ![Chamada em 0x1000162F0 para o thunk de GetModuleHandleA](/assets/images/enigma/eng24.png)

O destino imediato era um **thunk de importação**: um pequeno trecho de código que salta para a API por meio de um ponteiro armazenado na IAT. Ao redor dele, apareciam outros thunks para funções como **WriteFile**, **ReadFile** e **CloseHandle**:

> ![Thunks com saltos indiretos para GetModuleHandleA, WriteFile, ReadFile e CloseHandle](/assets/images/enigma/eng25.png)

Aqui é importante distinguir o código do ponteiro. A instrução **jmp qword ptr [...]** está no thunk; o endereço de memória referenciado por ela contém uma entrada da IAT. Segui esse endereço na janela de dump e encontrei a sequência de ponteiros para as APIs:

> ![Entradas da IAT em memória, com endereços de APIs e um terminador nulo entre grupos de imports](/assets/images/enigma/eng26.png)

Como o executável é x64, cada entrada ocupa oito bytes, um **QWORD**. Um terminador nulo encerra o grupo de imports de uma DLL; ele não marca necessariamente o fim de toda a IAT. [[13]](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format) Nesta amostra, os grupos estavam contíguos, e o intervalo usado para a reconstrução tinha **0xD88** bytes.

Para calcular o tamanho, considerei o endereço inicial e o primeiro endereço após a tabela, incluindo o último terminador:

```text
Início da IAT:          0x100290E3C
Fim exclusivo:         0x100291BC4
Tamanho:               0x100291BC4 - 0x100290E3C = 0xD88
```

Os valores usados no Scylla foram:

| Informação | Valor |
| --- | --- |
| OEP — endereço virtual | **0x1000162B0** |
| Início da IAT — endereço virtual | **0x100290E3C** |
| Tamanho da IAT, em bytes | **0xD88** |

Na base **0x100000000**, os RVAs correspondentes são **0x162B0** para o OEP e **0x290E3C** para a IAT. Os campos **OEP** e **VA** da interface mostrada abaixo recebem os endereços virtuais; o campo **Size** recebe o tamanho em hexadecimal.

### Reconstruindo os imports com o Scylla

Com esses valores, usei o Scylla para ler os imports e reconstruí-los no dump. [[14]](https://github.com/NtQuery/Scylla) Na interface, a sequência é:

1. Selecionar o processo correto, preencher **OEP**, **VA** e **Size** e usar **Get Imports** para ler a IAT.
2. Conferir os imports identificados e usar **Dump** para salvar a imagem do executável.
3. Usar **Fix Dump** e selecionar o arquivo salvo para reconstruir suas estruturas de importação.

> ![Scylla x64 com OEP 0x1000162B0, IAT em 0x100290E3C, tamanho 0xD88 e 425 imports válidos; o log informa Import Rebuild success](/assets/images/enigma/eng27.png)

A captura mostra 425 imports distribuídos entre oito DLLs, sem entradas marcadas como inválidas. A contagem também é compatível com o intervalo informado: 425 ponteiros mais oito terminadores nulos correspondem a 433 entradas de oito bytes, ou **0xD88**.

O log registrou **Import Rebuild success**, mas ainda faltava testar o arquivo fora do debugger. Foi aí que apareceu o próximo problema.

### Por que o executável abria e fechava: a seção **.bss**

Depois da reconstrução dos imports, o executável abria, mas fechava cerca de dois segundos depois. Passei bastante tempo tentando entender o motivo. Pensei em todo tipo de maluquice, mas a diferença que resolveu o problema estava na reconstrução de uma seção: a **.bss**.

A **.bss** normalmente reúne dados sem inicialização explícita, como variáveis globais que devem começar em zero. No original, ela ocupava espaço na imagem em memória, mas não tinha conteúdo armazenado no arquivo. A especificação PE da Microsoft descreve esse caso: uma seção contendo apenas dados não inicializados tem **SizeOfRawData** e **PointerToRawData** iguais a zero; o espaço virtual é preenchido com zeros no carregamento. [[13]](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)

Ao comparar o original com o dump após a reconstrução dos imports, encontrei estes valores:

| Campo | **test64.exe** original | Dump após o Scylla, antes do ajuste da **.bss** |
| --- | --- | --- |
| RVA da seção | **0x288000** | **0x288000** |
| **VirtualSize** | **0x6614** | **0x7000** |
| **SizeOfRawData** | **0** | **0x4A00** |
| **PointerToRawData** | **0** | **0x268A00** |

O dump analisado nessa etapa havia sido feito depois que o programa já executara. A **.bss** continha estado daquela execução: encontrei bytes não nulos e valores como **0x100012AE0**. Ao registrar **SizeOfRawData = 0x4A00**, o arquivo passou a fornecer esse conteúdo como dados iniciais da seção. Na próxima abertura, aquela região já não começava inteiramente zerada.

No PE-bear [[15]](https://github.com/hasherezade/pe-bear), localizei a seção pelo RVA **0x288000**, pois seu nome estava vazio no dump. Restaurei o nome **.bss** e o **VirtualSize** do original e ajustei os campos abaixo:

```text
VirtualSize      = 0x6614
SizeOfRawData    = 0
PointerToRawData = 0
```
> ![Scylla x64 com OEP 0x1000162B0, IAT em 0x100290E3C, tamanho 0xD88 e 425 imports válidos; o log informa Import Rebuild success](/assets/images/enigma/eng28.png)

Restaurar o nome facilita a identificação da seção; são os campos de tamanho e de conteúdo em disco que determinam o tratamento descrito aqui. Com os dois campos de dados brutos zerados, os bytes capturados deixam de ser carregados como conteúdo inicial dessa seção.

Com a reconstrução dos imports já aplicada, testei novamente o executável, que permaneceu aberto após esse ajuste. Não rastreei a instrução exata que provocava o fechamento; o resultado observado foi que restaurar esses campos da **.bss** resolveu o comportamento nesse teste.

O problema encontrado não demonstra uma técnica antidump intencional do Enigma. Foi um erro de reconstrução: o estado de uma execução anterior acabou incorporado ao arquivo como se fosse seu estado inicial. A comparação com o **test64.exe** sem proteção foi importante para identificar a diferença.

### Fechando o teste

Com isso, consegui atravessar as checagens descritas, chegar ao OEP, reconstruir os imports e manter o executável recuperado aberto fora do debugger. Esse foi o critério de sucesso do teste; a abertura da janela não valida, por si só, todas as funções do aplicativo.

A parte que mais me tomou tempo veio depois do dump. Encontrar o OEP e recuperar a IAT foram etapas importantes, mas conferir o estado inicial das seções do PE foi o que permitiu concluir esse caso.

## Referências

**[1]** [ESET — Jakub Souček. Killing me gently: Inside Gentlemen’s EDR killer framework (18 jun. 2026).](https://www.welivesecurity.com/en/eset-research/killing-me-gently-inside-gentlemens-edr-killer-framework/) Uso de Enigma e Themida nas ferramentas do grupo Gentlemen.

**[2]** [Aryaka Threat Research Lab. From Reconnaissance to Control: The Operational Blueprint of Kimsuky APT for Cyber Espionage — Report 2 (2025).](https://www.aryaka.com/docs/reports/aryaka-kimsuky-apt-operational-blueprint.pdf) Apêndice B, página 30: Software Packing (Enigma Protector).

**[3]** [The Enigma Protector. Manual — Anti Debugger.](https://www.enigmaprotector.com/en/help/manual/programoverview-checkup-antidebugger) Opções de checagem inicial, checagem em runtime e mensagem de detecção.

**[4]** [The Enigma Protector. Manual — Import Protection.](https://www.enigmaprotector.com/en/help/manual/programoverview-protectionfeatures-importprotection) Opções de proteção dos imports, redirecionamento e emulação de WinAPI.

**[5]** [Microsoft Learn. CheckRemoteDebuggerPresent.](https://learn.microsoft.com/en-us/windows/win32/api/debugapi/nf-debugapi-checkremotedebuggerpresent) Parâmetros, BOOL de saída e valor de retorno da API.

**[6]** [Microsoft Learn. EXCEPTION_RECORD.](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-exception_record) Código, endereço e tipos de exceção.

**[7]** [x64dbg. SetExceptionBPX.](https://help.x64dbg.com/en/latest/commands/breakpoint-control/SetExceptionBPX.html) Breakpoints de exceção de primeira e segunda chance.

**[8]** [x64dbg. SetExceptionBreakpointLog.](https://help.x64dbg.com/en/latest/commands/conditional-breakpoint-control/SetExceptionBreakpointLog.html) Configuração das mensagens de log dos breakpoints de exceção.

**[9]** [x64dbg. exinfo.](https://help.x64dbg.com/en/latest/commands/analysis/exinfo.html) Consulta dos dados da última exceção recebida pelo debugger.

**[10]** [System Informer / phnt. ntpsapi.h.](https://github.com/winsiderss/phnt/blob/master/ntpsapi.h) Definições da Native API, incluindo THREADINFOCLASS e ThreadHideFromDebugger.

**[11]** [Microsoft Learn. Windows Data Types.](https://learn.microsoft.com/en-us/windows/win32/winprog/windows-data-types) Definições de BOOL, BOOLEAN e dos demais tipos usados pelas APIs.

**[12]** [Microsoft Learn. x64 calling convention.](https://learn.microsoft.com/en-us/cpp/build/x64-calling-convention?view=msvc-170) Passagem de argumentos e registradores voláteis, incluindo RDX.

**[13]** [Microsoft Learn. PE Format.](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format) VA e RVA, tabelas de importação e campos dos cabeçalhos de seção.

**[14]** [NtQuery. Scylla — Imports Reconstructor.](https://github.com/NtQuery/Scylla) Repositório da ferramenta de reconstrução de imports.

**[15]** [hasherezade. PE-bear.](https://github.com/hasherezade/pe-bear) Repositório da ferramenta usada para inspecionar e editar o PE.
