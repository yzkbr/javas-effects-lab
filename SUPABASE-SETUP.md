# Ativação do Google — JAVAS EFFECTS LAB

Projeto: `javas-effects-lab`, organização `ibcody`, região `sa-east-1`, referência `ljjdxwbcysxkowymomql`.

## Etapas que exigem acesso do proprietário

1. No Google Cloud, crie ou selecione o projeto OAuth e um cliente do tipo **Aplicativo da Web**. Configure consentimento com os escopos `openid`, `email` e `profile`. Se estiver em modo de teste, adicione a conta administrativa como usuário de teste.
2. Origem JavaScript: `https://yzkbr.github.io`.
3. URI de redirecionamento autorizado no Google:
   `https://ljjdxwbcysxkowymomql.supabase.co/auth/v1/callback`
4. No [Supabase Authentication](https://supabase.com/dashboard/project/ljjdxwbcysxkowymomql/auth/providers), habilite Google e cadastre o Client ID e Client Secret. O segredo fica somente no painel Supabase; não o envie ao chat nem ao repositório.
5. Em [URL Configuration](https://supabase.com/dashboard/project/ljjdxwbcysxkowymomql/auth/url-configuration), use Site URL `https://yzkbr.github.io/javas-effects-lab/` e adicione o Redirect URL exato `https://yzkbr.github.io/javas-effects-lab/editor.html`.
6. Abra o editor publicado e entre com a conta autorizada. O primeiro acesso ficará negado até a aprovação do UID no banco. Avise o assistente após entrar; ele deve conferir `auth.users` e a identidade Google verificada antes de vincular o UID em `jel_private.administrators`. Nenhuma conta deve ser aprovada com base em `user_metadata` ou em um email informado pelo navegador.

## Comportamento de segurança

O HTML e os scripts do editor são públicos, como qualquer arquivo de GitHub Pages. A autorização real está nas políticas RLS: somente o UID aprovado, com identidade Google verificada, pode escrever. O cliente usa apenas chave publishable. A tabela de administradores está em schema não exposto, sem acesso direto para anon/authenticated. O aviso informativo do advisor sobre a ausência de políticas nessa tabela é intencional: nenhum acesso direto é permitido.

Somente `site` e `audio_catalog`, explicitamente marcados como públicos, são lidos pelos visitantes. Nunca grave senhas, tokens ou configurações privadas nesses dois registros. A tabela suporta registros privados, mas o editor não os consulta nem os mantém no cache público.

## Sincronização

As configurações públicas são armazenadas em IndexedDB e buscadas novamente ao abrir, ao voltar à conexão e a cada 30 segundos enquanto a página está visível. O editor mantém rascunhos por UID; **Salvar** coloca as alterações na fila e tenta publicá-las. Gravações usam comparação da versão no servidor; conflitos preservam o rascunho e exigem decisão explícita. Use Exportar JSON e Exportar biblioteca antes de carregar a versão remota se quiser conservar seus rascunhos.

O service worker armazena somente recursos estáticos da mesma origem, ignora parâmetros de consulta e não intercepta respostas Supabase. A página de autenticação/editor não é armazenada para abertura offline. Uma sessão já aberta pode manter rascunhos offline; uma nova sessão exige validação online. A limpeza de dados locais pede confirmação adicional se houver rascunhos e também remove a sessão local deste app. Desinstalar o PWA não garante exclusão dos dados.

Os MP3 continuam hospedados na pasta audio do GitHub Pages. A sincronização compartilha os caminhos, sem fazer upload de arquivos.

Documentação: [Google OAuth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
