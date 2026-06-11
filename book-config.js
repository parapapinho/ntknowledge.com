/* =========================================================================
   CONFIGURAÇÃO DO LIVRO  —  SUMÁRIO-MESTRE
   -------------------------------------------------------------------------
   Estrutura completa da obra. Cada página já tem um arquivo .md correspondente
   na pasta "conteudo" (por enquanto com um aviso de "em construção").

   Para ESCREVER: abra o .md indicado em "path" e troque o conteúdo.
   Para REORDENAR/RENOMEAR: edite os títulos e a ordem aqui.
   Para ADICIONAR: crie um novo .md e acrescente uma linha { title, path }.
   ========================================================================= */

const bookConfig = {
  title: "Programação Windows",
  subtitle: "Segurança, autenticação e autorização",
  author: "parapapinho",
  repo: "ntknowledge.com",       // só informativo (o site usa caminhos relativos)
  contentDir: "conteudo",

  parts: [
    {
      part: "Sobre o livro",
      chapters: [
        {
          title: "Introdução",
          pages: [
            { title: "Prefácio", path: "sobre/cap-01-introducao/prefacio.md" },
            { title: "Como este livro está organizado", path: "sobre/cap-01-introducao/como-este-livro-esta-organizado.md" },
            { title: "Guia de formatação (para o autor)", path: "sobre/cap-01-introducao/guia-de-formatacao-para-o-autor.md" },
          ]
        },
      ]
    },
    {
      part: "Parte I — Fundamentos do Windows e da API",
      chapters: [
        {
          title: "O ecossistema Windows",
          pages: [
            { title: "Arquitetura do Windows: user mode e kernel mode", path: "parte-1/cap-02-o-ecossistema-windows/arquitetura-do-windows-user-mode-e-kernel-mode.md" },
            { title: "A API Win32 e Win64", path: "parte-1/cap-02-o-ecossistema-windows/a-api-win32-e-win64.md" },
            { title: "Unicode e os tipos de dados do Windows", path: "parte-1/cap-02-o-ecossistema-windows/unicode-e-os-tipos-de-dados-do-windows.md" },
            { title: "Preparando o ambiente de desenvolvimento", path: "parte-1/cap-02-o-ecossistema-windows/preparando-o-ambiente-de-desenvolvimento.md" },
          ]
        },
        {
          title: "Conceitos centrais",
          pages: [
            { title: "Handles e objetos do kernel", path: "parte-1/cap-03-conceitos-centrais/handles-e-objetos-do-kernel.md" },
            { title: "Tratamento de erros e GetLastError", path: "parte-1/cap-03-conceitos-centrais/tratamento-de-erros-e-getlasterror.md" },
            { title: "O modelo de segurança em visão geral", path: "parte-1/cap-03-conceitos-centrais/o-modelo-de-seguranca-em-visao-geral.md" },
          ]
        },
      ]
    },
    {
      part: "Parte II — Sistema de arquivos e I/O",
      chapters: [
        {
          title: "Arquivos e diretórios",
          pages: [
            { title: "Lendo e escrevendo arquivos", path: "parte-2/cap-04-arquivos-e-diretorios/lendo-e-escrevendo-arquivos.md" },
            { title: "Atributos e metadados de arquivos", path: "parte-2/cap-04-arquivos-e-diretorios/atributos-e-metadados-de-arquivos.md" },
            { title: "Navegando por diretórios", path: "parte-2/cap-04-arquivos-e-diretorios/navegando-por-diretorios.md" },
          ]
        },
        {
          title: "I/O avançado",
          pages: [
            { title: "I/O assíncrono (overlapped)", path: "parte-2/cap-05-i-o-avancado/i-o-assincrono-overlapped.md" },
            { title: "Arquivos mapeados em memória", path: "parte-2/cap-05-i-o-avancado/arquivos-mapeados-em-memoria.md" },
            { title: "Introdução aos pipes", path: "parte-2/cap-05-i-o-avancado/introducao-aos-pipes.md" },
          ]
        },
      ]
    },
    {
      part: "Parte III — Processos, threads e sincronização",
      chapters: [
        {
          title: "Processos",
          pages: [
            { title: "Criando e encerrando processos", path: "parte-3/cap-06-processos/criando-e-encerrando-processos.md" },
            { title: "O token de um processo (introdução)", path: "parte-3/cap-06-processos/o-token-de-um-processo-introducao.md" },
            { title: "Variáveis de ambiente e linha de comando", path: "parte-3/cap-06-processos/variaveis-de-ambiente-e-linha-de-comando.md" },
          ]
        },
        {
          title: "Threads",
          pages: [
            { title: "Criando e gerenciando threads", path: "parte-3/cap-07-threads/criando-e-gerenciando-threads.md" },
            { title: "Armazenamento local de thread (TLS)", path: "parte-3/cap-07-threads/armazenamento-local-de-thread-tls.md" },
            { title: "Prioridades e agendamento", path: "parte-3/cap-07-threads/prioridades-e-agendamento.md" },
          ]
        },
        {
          title: "Sincronização",
          pages: [
            { title: "Seções críticas e mutexes", path: "parte-3/cap-08-sincronizacao/secoes-criticas-e-mutexes.md" },
            { title: "Semáforos e eventos", path: "parte-3/cap-08-sincronizacao/semaforos-e-eventos.md" },
            { title: "SRW locks e variáveis de condição", path: "parte-3/cap-08-sincronizacao/srw-locks-e-variaveis-de-condicao.md" },
          ]
        },
      ]
    },
    {
      part: "Parte IV — Comunicação entre processos e rede",
      chapters: [
        {
          title: "Comunicação entre processos (IPC)",
          pages: [
            { title: "Named pipes", path: "parte-4/cap-09-comunicacao-entre-processos-ipc/named-pipes.md" },
            { title: "Memória compartilhada", path: "parte-4/cap-09-comunicacao-entre-processos-ipc/memoria-compartilhada.md" },
            { title: "Mailslots", path: "parte-4/cap-09-comunicacao-entre-processos-ipc/mailslots.md" },
          ]
        },
        {
          title: "Programação de rede",
          pages: [
            { title: "Sockets no Windows (Winsock)", path: "parte-4/cap-10-programacao-de-rede/sockets-no-windows-winsock.md" },
            { title: "Cliente e servidor TCP", path: "parte-4/cap-10-programacao-de-rede/cliente-e-servidor-tcp.md" },
            { title: "Segurança na comunicação de rede", path: "parte-4/cap-10-programacao-de-rede/seguranca-na-comunicacao-de-rede.md" },
          ]
        },
      ]
    },
    {
      part: "Parte V — O modelo de segurança do Windows",
      chapters: [
        {
          title: "Arquitetura de segurança",
          pages: [
            { title: "O Security Reference Monitor", path: "parte-5/cap-11-arquitetura-de-seguranca/o-security-reference-monitor.md" },
            { title: "Security Identifiers (SIDs)", path: "parte-5/cap-11-arquitetura-de-seguranca/security-identifiers-sids.md" },
            { title: "A Local Security Authority (LSA)", path: "parte-5/cap-11-arquitetura-de-seguranca/a-local-security-authority-lsa.md" },
            { title: "Well-known SIDs e contas internas", path: "parte-5/cap-11-arquitetura-de-seguranca/well-known-sids-e-contas-internas.md" },
          ]
        },
        {
          title: "Access tokens",
          pages: [
            { title: "Anatomia de um access token", path: "parte-5/cap-12-access-tokens/anatomia-de-um-access-token.md" },
            { title: "Tokens primários e de impersonation", path: "parte-5/cap-12-access-tokens/tokens-primarios-e-de-impersonation.md" },
            { title: "Privilégios e como ajustá-los", path: "parte-5/cap-12-access-tokens/privilegios-e-como-ajusta-los.md" },
            { title: "Níveis de integridade (Integrity Levels)", path: "parte-5/cap-12-access-tokens/niveis-de-integridade-integrity-levels.md" },
            { title: "Restricted tokens", path: "parte-5/cap-12-access-tokens/restricted-tokens.md" },
          ]
        },
        {
          title: "Security descriptors",
          pages: [
            { title: "A estrutura de um security descriptor", path: "parte-5/cap-13-security-descriptors/a-estrutura-de-um-security-descriptor.md" },
            { title: "Owner e primary group", path: "parte-5/cap-13-security-descriptors/owner-e-primary-group.md" },
            { title: "DACL e SACL", path: "parte-5/cap-13-security-descriptors/dacl-e-sacl.md" },
            { title: "Formato absoluto e self-relative", path: "parte-5/cap-13-security-descriptors/formato-absoluto-e-self-relative.md" },
            { title: "Criando e manipulando descriptors em código", path: "parte-5/cap-13-security-descriptors/criando-e-manipulando-descriptors-em-codigo.md" },
          ]
        },
        {
          title: "ACLs e ACEs",
          pages: [
            { title: "Anatomia de uma ACL", path: "parte-5/cap-14-acls-e-aces/anatomia-de-uma-acl.md" },
            { title: "Tipos de ACE", path: "parte-5/cap-14-acls-e-aces/tipos-de-ace.md" },
            { title: "A ordem correta das ACEs", path: "parte-5/cap-14-acls-e-aces/a-ordem-correta-das-aces.md" },
            { title: "Herança de ACEs", path: "parte-5/cap-14-acls-e-aces/heranca-de-aces.md" },
            { title: "Access masks e direitos de acesso", path: "parte-5/cap-14-acls-e-aces/access-masks-e-direitos-de-acesso.md" },
          ]
        },
        {
          title: "Verificação de acesso",
          pages: [
            { title: "Como o AccessCheck funciona", path: "parte-5/cap-15-verificacao-de-acesso/como-o-accesscheck-funciona.md" },
            { title: "Programando o AccessCheck", path: "parte-5/cap-15-verificacao-de-acesso/programando-o-accesscheck.md" },
            { title: "Mandatory Integrity Control na prática", path: "parte-5/cap-15-verificacao-de-acesso/mandatory-integrity-control-na-pratica.md" },
          ]
        },
      ]
    },
    {
      part: "Parte VI — Autenticação e autorização",
      chapters: [
        {
          title: "Autenticação no Windows",
          pages: [
            { title: "Logon, sessões e estações de trabalho", path: "parte-6/cap-16-autenticacao-no-windows/logon-sessoes-e-estacoes-de-trabalho.md" },
            { title: "Onde ficam as credenciais: SAM e Active Directory", path: "parte-6/cap-16-autenticacao-no-windows/onde-ficam-as-credenciais-sam-e-active-directory.md" },
            { title: "LogonUser e a obtenção de tokens", path: "parte-6/cap-16-autenticacao-no-windows/logonuser-e-a-obtencao-de-tokens.md" },
            { title: "Pacotes de autenticação: NTLM e Kerberos (visão geral)", path: "parte-6/cap-16-autenticacao-no-windows/pacotes-de-autenticacao-ntlm-e-kerberos-visao-geral.md" },
          ]
        },
        {
          title: "Autorização na prática",
          pages: [
            { title: "Impersonation de clientes", path: "parte-6/cap-17-autorizacao-na-pratica/impersonation-de-clientes.md" },
            { title: "Verificando os direitos de um usuário", path: "parte-6/cap-17-autorizacao-na-pratica/verificando-os-direitos-de-um-usuario.md" },
            { title: "Concedendo e revogando privilégios", path: "parte-6/cap-17-autorizacao-na-pratica/concedendo-e-revogando-privilegios.md" },
            { title: "Trabalhando com contas e grupos", path: "parte-6/cap-17-autorizacao-na-pratica/trabalhando-com-contas-e-grupos.md" },
          ]
        },
        {
          title: "Políticas e direitos de conta",
          pages: [
            { title: "Account rights e a política da LSA", path: "parte-6/cap-18-politicas-e-direitos-de-conta/account-rights-e-a-politica-da-lsa.md" },
            { title: "Grupos, aninhamento e avaliação de pertencimento", path: "parte-6/cap-18-politicas-e-direitos-de-conta/grupos-aninhamento-e-avaliacao-de-pertencimento.md" },
            { title: "Contas de serviço e contas gerenciadas", path: "parte-6/cap-18-politicas-e-direitos-de-conta/contas-de-servico-e-contas-gerenciadas.md" },
          ]
        },
      ]
    },
    {
      part: "Parte VII — Escrevendo código seguro",
      chapters: [
        {
          title: "Princípios de código seguro",
          pages: [
            { title: "O princípio do menor privilégio", path: "parte-7/cap-19-principios-de-codigo-seguro/o-principio-do-menor-privilegio.md" },
            { title: "Validação de entrada e limites", path: "parte-7/cap-19-principios-de-codigo-seguro/validacao-de-entrada-e-limites.md" },
            { title: "Categorias comuns de vulnerabilidade (panorama defensivo)", path: "parte-7/cap-19-principios-de-codigo-seguro/categorias-comuns-de-vulnerabilidade-panorama-defensivo.md" },
          ]
        },
        {
          title: "Protegendo recursos",
          pages: [
            { title: "Aplicando ACLs corretas aos seus objetos", path: "parte-7/cap-20-protegendo-recursos/aplicando-acls-corretas-aos-seus-objetos.md" },
            { title: "Segurança de arquivos e do registro", path: "parte-7/cap-20-protegendo-recursos/seguranca-de-arquivos-e-do-registro.md" },
            { title: "Segurança de objetos nomeados do kernel", path: "parte-7/cap-20-protegendo-recursos/seguranca-de-objetos-nomeados-do-kernel.md" },
            { title: "Herança e propagação seguras de permissões", path: "parte-7/cap-20-protegendo-recursos/heranca-e-propagacao-seguras-de-permissoes.md" },
          ]
        },
        {
          title: "Fortalecendo a aplicação (hardening)",
          pages: [
            { title: "Habilitando mitigações de exploração (DEP, ASLR, CFG)", path: "parte-7/cap-21-fortalecendo-a-aplicacao-hardening/habilitando-mitigacoes-de-exploracao-dep-aslr-cfg.md" },
            { title: "Assinatura de código (code signing)", path: "parte-7/cap-21-fortalecendo-a-aplicacao-hardening/assinatura-de-codigo-code-signing.md" },
            { title: "AppContainer e isolamento (sandboxing)", path: "parte-7/cap-21-fortalecendo-a-aplicacao-hardening/appcontainer-e-isolamento-sandboxing.md" },
          ]
        },
      ]
    },
    {
      part: "Parte VIII — Auditoria e diagnóstico",
      chapters: [
        {
          title: "Auditoria de segurança",
          pages: [
            { title: "SACLs e a geração de eventos de auditoria", path: "parte-8/cap-22-auditoria-de-seguranca/sacls-e-a-geracao-de-eventos-de-auditoria.md" },
            { title: "Lendo o log de eventos de segurança", path: "parte-8/cap-22-auditoria-de-seguranca/lendo-o-log-de-eventos-de-seguranca.md" },
          ]
        },
        {
          title: "Ferramentas e diagnóstico",
          pages: [
            { title: "Ferramentas Sysinternals para inspeção de segurança", path: "parte-8/cap-23-ferramentas-e-diagnostico/ferramentas-sysinternals-para-inspecao-de-seguranca.md" },
            { title: "Depurando erros de acesso negado", path: "parte-8/cap-23-ferramentas-e-diagnostico/depurando-erros-de-acesso-negado.md" },
          ]
        },
      ]
    },
  ]
};

/* ----------------------------------------------------------------------- */
/* Uso interno — não precisa mexer.                                        */
bookConfig.flatPages = (() => {
  const list = [];
  bookConfig.parts.forEach((part, pi) => {
    part.chapters.forEach((chap, ci) => {
      chap.pages.forEach((page, pgi) => {
        list.push({ ...page, partTitle: part.part, chapterTitle: chap.title,
          partIndex: pi, chapterIndex: ci, pageIndex: pgi });
      });
    });
  });
  return list;
})();

/* Expõe a configuração globalmente para o book-viewer.js.
   (Necessário porque 'const' no topo do script NÃO cria window.bookConfig.) */
window.bookConfig = bookConfig;
