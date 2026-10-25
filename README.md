# JAVAS EFFECTS LAB — Akatsuki

Pacote estático preparado a partir do site.zip fornecido. O ZIP original permanece intacto. O editor e o servidor local continuam apenas no original; não fazem parte deste pacote.

## Publicação

1. Crie `yzkbr/javas-effects-lab` como **privado**, sem README inicial nem outros arquivos. Se já existir, confira seu conteúdo antes de enviar este pacote.
2. Em Settings → Pages, escolha **GitHub Actions** como origem. A conta precisa de um plano que permita Pages em repositórios privados. Não torne o repositório público sem autorização do proprietário.
3. Envie esta pasta inteira, incluindo `.github/workflows/pages.yml`, para a branch `main`. O fluxo publica somente `public/`.
4. Aguarde o fluxo no Actions e use a URL efetivamente retornada pelo deploy. Confira o site, o áudio do Itachi e `/editor.html` (deve retornar 404).

Para continuar pelo computador, instale o GitHub CLI seguindo https://cli.github.com/ e abra um novo terminal. Autentique sem compartilhar tokens no chat:

```powershell
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
gh auth status
```

Informe ao assistente quando a autenticação estiver concluída para que ele confira o repositório e prossiga. Não execute comandos para sobrescrever um repositório existente.

## PWA e armazenamento

Manifesto com ícones PNG 192/512, início e escopo relativos. Service worker guarda os arquivos públicos, imagens, bibliotecas e MP3 em Cache Storage após a primeira visita online bem-sucedida. O catálogo de áudio é persistido em IndexedDB; configurações legadas continuam em localStorage para preservar o comportamento existente.

O botão **Limpar dados locais** pede confirmação e remove apenas as chaves, o banco e os caches identificados como pertencentes a este aplicativo. Feche outras abas se a limpeza ficar bloqueada. Desinstalar um PWA não garante a remoção dos dados do navegador.

Ao atualizar os arquivos, altere a versão `v1` do cache em `public/sw.js` para que caches antigos sejam descartados após a ativação da nova versão. A instalação e o funcionamento offline ainda precisam ser verificados na URL HTTPS publicada e nos navegadores de destino.

Bibliotecas originais: GSAP (distribuição @3 baixada do CDN usado no original) e Three.js 0.160.1, agora servidas localmente. Os avisos de licença presentes nos arquivos foram preservados. Não foram criados novos desenhos de personagens.
