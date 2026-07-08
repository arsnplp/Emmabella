#!/usr/bin/env bash
# À installer et exécuter sur le VPS (pas dans GitHub Actions). Synchronise le
# répertoire servi par nginx avec la branche main du dépôt, sans avoir besoin
# de donner de clé SSH à GitHub.
#
# Installation (une seule fois, sur le VPS) :
#   1. Si le dossier servi par nginx (le `root` du server{} de emmabella.fr,
#      cf. nginx.seo.conf) n'est pas déjà un clone git, sauvegarder son contenu
#      puis cloner le dépôt à sa place :
#        git clone <url-du-depot> /chemin/vers/SiteRDV1
#   2. Copier ce script sur le VPS, par ex. /usr/local/bin/emmabella-deploy.sh,
#      et le rendre exécutable : chmod +x /usr/local/bin/emmabella-deploy.sh
#   3. Adapter la variable SITE_DIR ci-dessous au chemin réel (le même que le
#      `root` dans la config nginx).
#   4. Ajouter une tâche cron (crontab -e) qui s'exécute après le job GitHub
#      Actions (lundi 06:00 UTC) pour laisser le temps à l'article d'être
#      généré et poussé, par exemple 1h plus tard :
#        0 7 * * 1 /usr/local/bin/emmabella-deploy.sh >> /var/log/emmabella-deploy.log 2>&1
#
# Ce script ne fait que suivre `main` : tout changement fait localement sur le
# VPS en dehors de git serait écrasé au prochain déploiement.

set -euo pipefail

SITE_DIR="/chemin/vers/SiteRDV1"   # <-- à adapter : doit correspondre au `root` nginx
BRANCH="main"

cd "$SITE_DIR"

git fetch origin "$BRANCH"

BEFORE=$(git rev-parse HEAD)
AFTER=$(git rev-parse "origin/$BRANCH")

if [ "$BEFORE" = "$AFTER" ]; then
  echo "$(date -Iseconds) — rien de nouveau (déjà à jour sur $AFTER)."
  exit 0
fi

git reset --hard "origin/$BRANCH"

echo "$(date -Iseconds) — déployé $BEFORE -> $AFTER"

if command -v nginx >/dev/null 2>&1; then
  nginx -t && systemctl reload nginx
  echo "$(date -Iseconds) — nginx rechargé."
fi
