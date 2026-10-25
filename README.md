# JAVAS EFFECTS LAB — Akatsuki

Aplicação estática hospedada exclusivamente no GitHub Pages: https://yzkbr.github.io/javas-effects-lab/ . Animações, personagens, imagens e MP3 originais preservados.

## Configurações e editor

O editor original em public/editor.html usa login Google via Supabase e autorização por UID no banco. HTML e JavaScript são públicos; autenticação e políticas RLS concedem permissão para gravar. Não existe servidor Node publicado.

A ativação do Google e a aprovação inicial do UID estão descritas em [SUPABASE-SETUP.md](./SUPABASE-SETUP.md). O acesso começa bloqueado, sem administradores pré-cadastrados. Cadastre credenciais OAuth apenas no painel Supabase. O navegador recebe somente URL e chave publishable.

Configurações públicas e caminhos MP3 são compartilhados via Supabase. IndexedDB mantém cache e rascunhos por UID. Salvar publica com controle de versão; conflitos preservam as edições locais. Os MP3 continuam hospedados no Pages.

## PWA

Manifesto, ícones e service worker preservados. O site principal permite recarga offline após uma visita online. O editor exige validação online para abrir uma sessão. Respostas Supabase, URLs com parâmetros e a página do editor ficam fora do cache de navegação pública. A limpeza pede confirmação adicional quando há rascunhos. Desinstalar o PWA não garante limpeza dos dados.

## Publicação e verificações

O fluxo .github/workflows/pages.yml publica apenas public/ ao atualizar main. Mantenha GitHub Actions como origem em Settings → Pages. Incremente a versão do cache em public/sw.js ao alterar recursos estáticos.

Execute os testes com: node --test tests/config-sync.test.mjs . O arquivo tests/rls.sql verifica autorização em uma transação revertida; use apenas como administrador em ambiente controlado. A migração em supabase/migrations corresponde à versão aplicada via MCP.

Supabase JS fixado em 2.118.0; GSAP e Three.js locais. Avisos de licença presentes nos arquivos distribuídos preservados.
