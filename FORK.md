# Fork attlhjd/muse (bot Discord « Lupin »)

Fork de [museofficial/muse](https://github.com/museofficial/muse). La branche déployée est `lupin`, partie de la version `v2.12.0`. `master` reste une copie de l'amont, sans modification.

## Différences avec Muse

- Commande `/miaou` ([src/commands/miaou.ts](src/commands/miaou.ts)) : joue un miaou au hasard dans le salon vocal et poste une image de chat de cataas.com (sans image si cataas ne répond pas en 5 s).
- `Player.playSoundEffect` ([src/services/player.ts](src/services/player.ts)) : si le bot est déjà connecté, il emprunte la connexion. La musique se met alors en pause d'elle-même, sans abonné, et reprend avec un compteur de position juste. Sinon, il rejoint le salon de l'utilisateur, miaule et repart.
- Sons : [assets/miaous/](assets/miaous/), 13 extraits CC0 ou du domaine public (sources dans `CREDITS.md`), à −16 LUFS en Ogg Opus 48 kHz stéréo. Pour en ajouter un, il suffit de déposer un `.ogg` Opus dans ce dossier, il sera pris en compte au prochain déploiement.
- Tests : [tests/sound-effect.test.ts](tests/sound-effect.test.ts).

## Déploiement (Coolify, serveur localhost)

- Application `muse-lupin` (uuid `qrsvg4diw9feuftvmohfk9q0`), projet « Musique Discord ». Elle est construite avec le `Dockerfile` du dépôt, branche `lupin`, sans domaine ni port public.
- Pour mettre à jour : `git push origin lupin`, puis `POST /api/v1/deploy {"uuid":"qrsvg4diw9feuftvmohfk9q0"}`.
- Variables, toutes en exécution seulement, jamais au build : `DISCORD_TOKEN`, `YOUTUBE_API_KEY`, `YT_DLP_AUTO_UPDATE=true`, `YT_DLP_COOKIES_PATH=/run/secrets/youtube-cookies.txt`, `CACHE_LIMIT=2GB`.
- Stockages :
  - le volume `eugkyedm65dcjgeqczsitrok_muse-data` sur `/data`, repris de l'ancien service. Coolify préfixe les noms à la création : il faut corriger le nom par `PATCH /applications/{uuid}/storages` ;
  - le fichier `/run/secrets/youtube-cookies.txt`, modifiable dans Coolify, onglet Persistent Storage. Il contient les cookies d'un compte YouTube dédié au bot : YouTube bloque l'IP du VPS sans eux.
- L'ancien service `muse` (image officielle, uuid `eugkyedm65dcjgeqczsitrok`) est arrêté et conservé comme solution de repli. Ne jamais faire tourner les deux en même temps : ils partagent le même jeton et le même volume.

## Accès Git

- Remotes : `origin` = `git@github.com:attlhjd/muse.git` (écriture via la clé de déploiement `~/.ssh/muse_push`, réglée en `core.sshCommand`), `upstream` = museofficial/muse.
- Auteur des commits : `attlhjd <attlhjd@users.noreply.github.com>`.

## Passer à une nouvelle version de Muse

```sh
git fetch upstream --tags
git checkout lupin && git merge vX.Y.Z   # conflits possibles dans player.ts et inversify.config.ts
```

Lancer ensuite les tests, puis pousser et déployer. YouTube casse souvent yt-dlp, mais `YT_DLP_AUTO_UPDATE` le met à jour à chaque démarrage : une nouvelle version de Muse n'est donc nécessaire que pour les correctifs de Muse lui-même.

## Tests en local

Node n'est pas installé sur l'hôte. Télécharger Node 22 (nodejs.org, vérifier `SHASUMS256.txt`) dans un dossier temporaire et le mettre dans le `PATH`, puis :

```sh
npx yarn@1.22.22 install --frozen-lockfile && npx yarn@1.22.22 prisma generate
npx tsc --noEmit && npx eslint "src/**/*.ts" && npx vitest run
```

Le hook de pré-commit de Muse a besoin de `yarn` dans le `PATH`. Sans lui, il est ignoré : lancer alors les commandes ci-dessus à la main.
