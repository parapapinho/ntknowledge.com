## Introdução

Para quem acompanhava os tutoriais de unpacking no Tuts4You ou no CrackLatinos, o nome Enigma Protector traz boas lembranças. Eram horas no debugger, muitas horas de tracing e tentando entender o que ainda faltava para aquele dump funcionar com IAT corrigida. Revisitar esse tipo de proteção tem um pouco dessa nostalgia. O que me chamou a atenção recentemente, porém, foi encontrar o Enigma novamente em pesquisas sobre operações de malware.

Em junho de 2026, a [ESET documentou o uso de Enigma e Themida em ferramentas para desativar EDRs mantidas pelo grupo The Gentlemen](https://www.welivesecurity.com/en/eset-research/killing-me-gently-inside-gentlemens-edr-killer-framework/). Entre as amostras identificadas está uma variante do GentleKiller protegida com Enigma. Em 2025, a [Aryaka também registrou o uso de Enigma Protector em uma campanha atribuída ao Kimsuky](https://www.aryaka.com/docs/reports/aryaka-kimsuky-apt-operational-blueprint.pdf), no mapeamento de técnicas apresentado ao final do relatório. Essas referências mostram por que conhecer um protector comercial ainda faz diferença no trabalho de análise.

Foi esse uso por atores maliciosos que me motivou a revisitar o Enigma e escrever este tutorial — sim, vou chamar de tutorial. Para quem analisa malware, a proteção pode ocupar boa parte do trabalho antes que seja possível examinar a lógica da amostra. Entender onde termina o loader e começa o código da aplicação ajuda a interpretar o que aparece no debugger e a reconhecer quais comportamentos pertencem a cada um.

A ideia é fazer isso como nos velhos tempos: debugger aberto, acompanhando a execução e explicando o raciocínio (ou não ;) ) por trás de cada etapa. Ao longo do texto, vamos observar as checagens anti-debugging, chegar ao Original Entry Point (OEP), fazer o dump e reconstruir a Import Address Table (IAT). Também vou mostrar como conferimos os resultados: alcançar o OEP é uma etapa, e ainda há trabalho para transformar a imagem em memória em um executável que inicialize corretamente.

## Anti-debugger, OEP, dump e reconstrução da IAT

Para começarmos utilizei a versão 7.40 do Enigma

> ![Anti-debug function in IDA's pseudocode view](/assets/images/enigma/eng1.png)
>

No primeiro protegido, o PE continuou sendo AMD64/PE32+ com `ImageBase=0x100000000`, mas o entry point passou de RVA `0x162B0` para `0x129DE44`, e a contagem de seções passou de oito para onze. Por isso o x64dbg começou em `0x10129DE44`, dentro do loader do Enigma. O OEP esperado pela comparação com o original era `0x1000162B0`; mais tarde, confirmamos sua execução.

**VA e RVA:** neste carregamento, `VA = 0x100000000 + RVA`. Os endereços de `ntdll`, `kernel32`, pilha e outras DLLs podem mudar ao reiniciar o processo ou o Windows. Use os nomes das APIs e confirme os bytes, em vez de copiar os endereços dessas DLLs cegamente.

## 2. A primeira reação: aviso de debugger

Ao continuar o primeiro protegido no x64dbg, surgiu a janela **Debugger warning** e a aplicação não chegou ao OEP. A lista inicial de imports continha `MessageBoxA`, mas um breakpoint nessa API não parou no caminho do aviso. Isso mostrou que uma importação estática não identifica necessariamente a função usada para exibir a mensagem.

Na pilha havia a string `CheckRemoteDebuggerPresent`, ainda insuficiente para provar uma chamada. Para confirmar, passamos a observar a API e o valor de saída que ela escreveu. Um breakpoint de software ou hardware nessa API, antes de resolver a ocultação de thread, podia terminar em `STATUS_BREAKPOINT` (`0x80000003`) ou `STATUS_SINGLE_STEP` (`0x80000004`) sem uma parada útil no IDA. Naquele experimento, isso **não provou** que o Enigma verificava o byte `INT3`.

## 3. Primeiro obstáculo: `ThreadHideFromDebugger`

O loader chamou `ntdll!NtSetInformationThread` a partir de `0x1002EACBE`. Na entrada da chamada da thread principal, observamos:

```text
RCX = -2       ; thread atual
RDX = 0x11     ; ThreadHideFromDebugger
comprimento = 0
```

Uma consulta externa encontrou a thread principal com `hidden=1` depois da inicialização. Ao desviar a chamada apenas na memória, `hidden` permaneceu `0` e o breakpoint em `CheckRemoteDebuggerPresent` passou a funcionar. O retorno do call em `0x1002EACC1` não testava o status.

A forma de repetir o desvio que usamos nos ensaios posteriores foi trocar os três bytes iniciais da exportação **na memória do processo depurado**:

```asm
ntdll!NtSetInformationThread
antes:  4C 8B D1
depois: 31 C0 C3      ; xor eax,eax / ret
```

O stub retorna `STATUS_SUCCESS` sem ocultar a thread. Faça isso com o depurado parado antes do loader executar; o arquivo em disco e a DLL do sistema em disco não foram modificados. Neste Windows, a exportação estava em `0x7FFB3F421E30`, endereço que deve ser resolvido de novo em outra sessão.

**O que os controles mostraram:** a mesma chamada `ThreadHideFromDebugger` ocorreu com o checkbox **Check-Up > AntiDebugger** desligado e ligado. Portanto, nesse par de projetos, ela pertence à proteção geral do loader e não foi acrescentada pelo checkbox AntiDebugger.

## 4. A checagem inicial do Check-Up

Com a thread visível, o breakpoint em `kernel32!CheckRemoteDebuggerPresent` disparou. Na amostra inicial, a chamada recebeu:

```text
RCX = -1                 ; processo atual
RDX = 0x23FFD08          ; endereço de um BOOL de saída
[RSP] = 0x100E7B604     ; retorno ao código protegido, nesta execução
```

No retorno, `RAX=1` significava **que a chamada à API teve sucesso**. A resposta sobre o depurador estava nos quatro bytes do **endereço de saída salvo na entrada** (`0x23FFD08` nesta execução): `01 00 00 00`. O registrador `RDX` é volátil e não precisa conservar esse ponteiro após o retorno. Depois de trocar somente aqueles quatro bytes para `00 00 00 00`, mantendo `RAX=1`, o loader seguiu até o OEP. Alterar apenas `RAX` seria interpretar errado a interface dessa API.

### Roteiro manual no debugger

1. Pare antes do loader e neutralize `NtSetInformationThread` como na seção anterior.
2. Coloque um breakpoint de execução em `kernel32!CheckRemoteDebuggerPresent` e outro no OEP candidato `0x1000162B0`. O endereço de `kernel32` deve vir dos símbolos do processo depurado.
3. Na entrada da API, anote o valor de `RDX` e o endereço de retorno em `[RSP]`. Coloque um breakpoint temporário nesse endereço de retorno (`0x100E7B604` nesta execução) e prossiga até ele. Se for de hardware, libere antes um dos poucos registradores de breakpoint, se necessário.
4. Confira `RAX=1` e o `DWORD` no **endereço que você salvou de `RDX` na entrada**. No nosso caso, mude `1` para `0` e prossiga.
5. Confira se o breakpoint do OEP dispara e se os bytes no endereço correspondem ao aplicativo original.

O próprio `KERNELBASE` chamou `ntdll!NtQueryInformationProcess` com classe `7` (`ProcessDebugPort`) dentro da implementação de `CheckRemoteDebuggerPresent`. Isso compõe **a mesma** checagem; não contamos como uma segunda sondagem independente do Enigma.

Para separar efeito da opção de coincidência do runtime, geramos dois builds de controle a partir do mesmo projeto, alterando somente `CheckUp/AntiDebugger/Enabled` e o caminho obrigatório de saída. `CheckRemoteDebuggerPresent` foi observada antes do OEP no build **ligado**, e não no **desligado**. Assim atribuímos essa chamada inicial ao checkbox nos controles comparáveis. Os projetos e executáveis de controle foram mantidos no laboratório local.

### Onde o resultado virou uma decisão

Na primeira amostra, um watchpoint em leitura/escrita no `BOOL` mostrou uma leitura real em `0x10066AEDC` (`mov eax,[rax]`), dentro do interpretador da máquina virtual do loader. A instrução virtual em `0x100E851AE` (`opcode 0x5B`, índice `2009`) escolheu dois destinos:

| `BOOL` | Próximo índice virtual | Caminho observado |
| ---: | ---: | --- |
| `1` | `22355` | Aviso de debugger; OEP não alcançado |
| `0` | `21761` | Loader prosseguiu; OEP alcançado |

Alteramos apenas a resposta da API entre os dois rastreios. Isso confirma a relação causal para este caminho, sem exigir que se desmonte toda a VM.

## 5. Quando `Check debugger in runtime` também está ligado

Criamos outro controle com `CheckAtRuntime=True`, deixando as demais opções iguais. Após atravessar a primeira checagem e alcançar o OEP, uma thread auxiliar voltou a chamar `CheckRemoteDebuggerPresent`. O controle com runtime desligado permaneceu aberto por mais de 20 segundos sem nova chamada. Quando deixamos a consulta posterior receber a resposta real `BOOL=1`, o processo com runtime ligado encerrou com código `1` poucos segundos após o OEP.

No `teste_protectd2.EXE` do usuário, também com runtime ativado, o entry point protegido foi `0x1012AFDF8` e o OEP continuou `0x1000162B0`. Para cobrir as chamadas repetidas, em vez de editar cada `BOOL` manualmente, aplicamos no processo depurado um stub na exportação de `kernel32` **antes** de executar o loader:

```asm
kernel32!CheckRemoteDebuggerPresent
antes:  48 FF 25 71 47 04 00
depois: 31 C0 89 02 FF C0 C3
        xor eax,eax
        mov dword ptr [rdx],eax   ; BOOL = FALSE
        inc eax                   ; retorno BOOL = TRUE
        ret
```

Junto com o stub de `NtSetInformationThread`, esse patch foi verificado por leitura dos bytes de volta. A checagem inicial retornou `RAX=1, BOOL=0`; depois do OEP, uma thread auxiliar fez chamadas repetidas e recebeu a mesma resposta. Removidos os breakpoints, a janela principal `teste_protectd2` abriu e respondeu sob o IDA. O script IDAPython local `analysis/bypass_runtime_ida.py` exige que o processo esteja pausado no entry point protegido, confere nome do arquivo, símbolos e bytes anteriores e modifica somente sua memória.

Na primeira amostra, também confirmamos a abertura da janela `teste_protectd` sob o IDA e sua resposta após mais de dez segundos. Esse era nosso critério de sucesso para o bypass de inicialização. As funções internas da aplicação não foram exercitadas.

### Atalho usado no x64dbg para a primeira amostra

Para repetir o teste do OEP e da IAT no x64dbg, também usamos o script local `analysis/patch_debuggee_apis.py` com o processo parado no entry point do packer:

```powershell
python analysis\patch_debuggee_apis.py <PID_DO_DEPURADO>
```

O script exige o caminho exato de `teste_protectd.EXE`, confere os bytes originais das duas exportações, escreve os dois stubs acima e relê os bytes. Ele foi ensaiado no processo depurado desta máquina. Para localizar as APIs, usa as bases das DLLs no processo Python; se as bases diferirem no depurado, a conferência dos bytes remotos falhará. Os bytes de origem também dependem desta versão do Windows. Nesses casos, resolva novamente os símbolos no próprio debugger antes de repetir o patch.

## 6. PEB e outras pistas: o que investigamos sem transformar em “prova”

Colocamos watchpoints de hardware em `PEB.BeingDebugged` (`PEB+2`) e `PEB.NtGlobalFlag` (`PEB+0xBC`), filtrando as paradas para o código protegido. Nos caminhos testados da entrada do packer até o OEP, não observamos leitura direta desses dois campos pelo Enigma. Eles continuaram `BeingDebugged=1` e `NtGlobalFlag=0x70` enquanto o loader chegou ao OEP depois de zerarmos apenas o `BOOL` de `CheckRemoteDebuggerPresent`.

Isso é um resultado **limitado ao caminho observado**, não uma prova de que o Enigma nunca use PEB. Também investigamos chamadas a outras APIs frequentemente associadas a anti-debug. Chamadas como `IsDebuggerPresent` por `uxtheme.dll` e `RtlQueryProcessDebugInformation` dentro de `CreateToolhelp32Snapshot` tinham chamadores do Windows, não uma decisão independente atribuível ao loader. Um snapshot com flag `0x8` enumerava módulos do processo atual, não a lista de processos (`0x2`). Busca de bytes como `RDTSC`, `CPUID` ou `INT 2D` no arquivo empacotado também não demonstra que foram executados.

## 7. Do loader ao OEP: encontrar o “magic jump”

Com o bypass aplicado à primeira amostra e o processo parado no entry point do packer, usamos breakpoint de execução por hardware no x64dbg:

```text
bphws 0x1002EAF80, x, 1
run
```

No ponto de parada, o disassembly foi:

```asm
0x1002EAF78  mov rax, qword ptr [rbp-20h]
0x1002EAF7C  mov rsp, qword ptr [rbp-8]
0x1002EAF80  jmp rax
```

`RAX` continha `0x1000162B0`. Removemos esse breakpoint temporário com `bphwc 0x1002EAF80` e usamos **F7**. O `RIP` passou diretamente a `0x1000162B0`, onde os bytes começavam com `48 8D 64 24 D8` (`lea rsp,[rsp-28h]`). Os primeiros 64 bytes coincidiam com o original. Portanto, **`0x1002EAF80` é o salto final ao OEP desta primeira amostra**. Se a imagem for carregada em outra base, o RVA correspondente do salto é `0x2EAF80` e o do OEP é `0x162B0`.

Durante a busca, o `jmp rax` em `0x10129E3D4`, dentro do stub do entry point protegido, pareceu promissor após decodificação estática, mas seu breakpoint não disparou no caminho observado. Não é o magic jump confirmado. O retorno da ponte da VM em `0x100669F7B` também voltou a outro estágio, não diretamente ao OEP.

Breakpoints de hardware evitam gravar `INT3` no código; no x64dbg, `bphws endereço, x, 1` configura execução por hardware. Eles usam os registradores de debug, que são poucos: se já houver outros breakpoints salvos, anote-os antes de liberar um slot e restaure-os depois. [Referência do x64dbg](https://help.x64dbg.com/en/latest/commands/breakpoint-control/SetHardwareBreakpoint.html).

## 8. Dump no OEP: ainda falta reconstruir o PE

Com a primeira amostra parada em `0x1000162B0`, fizemos o dump com OllyDumpEx. O arquivo local `analysis/dumps/teste_protectd_olly_oep.exe` teve SHA-256 `8fe8d05e760d29a24f0be57e835deb39a03f6ec11b4ab3792a9ba1fcd8440b2c`; seu OEP no cabeçalho é RVA `0x162B0`. O rótulo exato do comando de dump usado na interface não foi registrado; ao reproduzir, confira que o OEP do arquivo salvo seja mesmo esse RVA.

**Nota sobre “Restore packed base”:** antes, o IDA havia encerrado inesperadamente. Ao reabrir o banco de dados, escolhemos essa opção no **diálogo de recuperação do IDA**. Ela restaura a base de análise e não substitui o dump do processo nem repara a IAT. Não é um botão do OllyDumpEx. Consulte a [ajuda do IDA sobre banco não fechado](https://docs.hex-rays.com/ida-9.2/user-guide/general-concepts/various-dialog-help-messages#database-is-not-closed).

O dump capturou a imagem em memória, mas não constituiu por si só um EXE autônomo. A comparação com o original mostrou `.text`, `.rdata` e `.CRT` inteiras; `.data` diferia em 17 bytes de estado; `.pdata` estava zerada no RVA original; `.idata` perdera descritores e strings; e parte de `.rsrc` também estava zerada. Os ponteiros resolvidos da IAT continuavam na memória. O cabeçalho ainda conservava diretórios e seções do packer. É por isso que “achei o OEP” e “fiz o dump” não encerraram o unpacking.

## 9. Como identificamos a IAT verdadeira

No arquivo protegido, o diretório `Import` apontava para RVA `0xF7FF3C` (tamanho `0x2A4`), uma tabela pequena do packer. O diretório IAT estava zerado. A aplicação original, porém, usava `Import` em RVA `0x290000` (tamanho `0xB4`) e IAT em RVA `0x290E3C` (tamanho `0xD88`). No dump do OEP, essa área continha **433 QWORDs**: 425 endereços de funções e oito zeros, um terminador para cada grupo de DLL.

Percorremos esses ponteiros e as exportações dos módulos carregados, registradas no mapa local `analysis/iat_export_map.json`. Houve 407 nomes de API únicos, 18 endereços com nomes alias/forwarded ambíguos e nenhum slot sem candidato. Nos 18 casos ambíguos, o ponteiro sozinho não dizia qual nome tinha sido importado originalmente; usamos `test64.exe` para selecionar o nome correto. Os oito grupos recuperados foram:

| DLL | Quantidade |
| --- | ---: |
| `kernel32.dll` | 101 |
| `oleaut32.dll` | 16 |
| `user32.dll` | 172 |
| `ole32.dll` | 2 |
| `gdi32.dll` | 108 |
| `version.dll` | 3 |
| `shell32.dll` | 4 |
| `comctl32.dll` | 19 |

**E o “API redirect”?** Nesta configuração, no instante do OEP, nenhum dos 425 slots da IAT apontava para a imagem do Enigma: todos levavam diretamente a exportações de DLLs carregadas. Os 425 thunks `FF 25` do aplicativo também eram byte a byte iguais aos do original. Portanto, não havia aqui um trampoline global do Enigma na IAT que precisássemos seguir para achar nomes. O `jmp rax` da seção anterior era a **transferência ao OEP**, não o redirecionamento de uma API. O [manual do Enigma](https://www.enigmaprotector.com/en/help/manual/programoverview-protectionfeatures-importprotection) trata **Emulate WinAPI functions** e **Redirect WinAPI functions** como opções diferentes. Nossa observação no OEP não exclui emulação interna em outros momentos, nem descreve builds com Redirect ativado.

## 10. Reparando os imports e produzindo o EXE de teste

O script local `analysis/rebuild_iat.py` usa o dump do OEP e o mapa das exportações para refazer as estruturas PE. Ele é específico desta amostra; seus caminhos e RVAs estão fixados no arquivo. Na pasta do laboratório, a execução foi:

```powershell
python analysis\rebuild_iat.py
```

Em termos de PE, o procedimento foi:

1. Validar hash do dump, base, OEP, RVAs, tamanho da IAT, número de seções e contagem de slots.
2. Para cada um dos oito grupos, escrever `IMAGE_IMPORT_DESCRIPTOR`, uma **Import Lookup Table**, uma **Import Address Table**, estruturas `IMAGE_IMPORT_BY_NAME` e nomes de DLL. Cada grupo termina com um QWORD zero.
3. Atualizar os diretórios `Import` (`RVA 0x290000`, tamanho `0xB4`) e `IAT` (`RVA 0x290E3C`, tamanho `0xD88`).
4. Gerar um primeiro arquivo com os imports reparados: `analysis/dumps/teste_protectd_iat_restored.exe`. Ele ainda contém onze seções e metadados do packer; é **intermediário**.
5. Para o ensaio de execução autônoma, repor do original `.data` e `.rsrc`, completar `.pdata`, zerar `.bss`, corrigir os diretórios PE e deixar somente as oito seções do aplicativo na tabela. O resultado local foi `analysis/dumps/teste_protectd_recovered.exe`. O relatório local `analysis/dumps/iat_rebuild_result.json` guarda os hashes e contagens.

O parser PE encontrou oito descritores e 425 imports, com nomes, ordem e posições ILT/IAT iguais aos do original, sem avisos. As demais seções do aplicativo coincidiram com o original nas áreas virtuais; `.idata` tem outro arranjo de bytes porque as strings foram reconstruídas, mas a interpretação dos imports é a mesma. O arquivo recuperado tem 2.768.896 bytes e SHA-256 `2d6c90b631af0c335e359c6c2b09c34cc69e1432016aa53071eb01aed8f88392`. Fora do debugger, ele iniciou e abriu a janela **Notepad** com controle `Edit`.

## 11. O que este resultado comprova — e o que ainda falta

**Confirmado nos caminhos executados:** o loader oculta thread via `NtSetInformationThread(0x11)`; a opção Check-Up acrescenta a consulta inicial a `CheckRemoteDebuggerPresent` nos builds de controle; a VM consome o `BOOL`; com runtime ligado a consulta se repete em thread auxiliar; os stubs em memória permitiram abrir os dois protegidos sob o debugger; o primeiro build passa por `0x1002EAF80: jmp rax` para o OEP; e seus 425 imports puderam ser reconstruídos e validados.

**Limite essencial:** o executável recuperado dependeu do `test64.exe` **sem proteção** para os 18 aliases, os grupos e layout da IAT, seções incompletas e metadados PE. É uma demonstração controlada nesta amostra conhecida, não um unpacker genérico que recupere qualquer arquivo sem original. O arquivo com somente a IAT reparada não foi validado como executável autônomo. A abertura da janela prova inicialização e interface, não todas as funções do programa. Também não afirmamos ter mapeado todas as possíveis técnicas antidebugger da versão 7.40 ou o intervalo exato da checagem em runtime.

O x64dbg foi deixado pausado no OEP após o experimento, e seus três breakpoints de hardware que já existiam (`0x1000162AF`, `0x100362941`, `0x100F5CA44`) foram restaurados.

---

**Notas adicionais:** os relatórios locais `analysis/antidebugger-740.md`, `analysis/iat-recovery-740.md` e `analysis/test64-primeiro-build.md` guardam rastreios e detalhes desta sessão; os binários, projetos de proteção, dumps e scripts específicos do ambiente não fazem parte da versão publicada deste tutorial. **Referências externas:** [manual Anti Debugger do Enigma](https://www.enigmaprotector.com/en/help/manual/programoverview-checkup-antidebugger), [manual Import Protection do Enigma](https://www.enigmaprotector.com/en/help/manual/programoverview-protectionfeatures-importprotection), [comandos de breakpoint do x64dbg](https://help.x64dbg.com/en/latest/commands/breakpoint-control/SetHardwareBreakpoint.html).
