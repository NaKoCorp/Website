---
title: Faire tourner un relais Barking
description: "Un binaire statique, une base SQLite, le port UDP 4433 : lancez un relais Barking avec systemd, Docker ou Compose, et voyez ce qu’il garde."
date: 2026-11-27
translationKey: run-a-relay
tags: [barking, self-hosting, tutorial]
barking: true
draft: false
cta: Lancez un relais, puis dites aux autres opérateurs où le trouver.
---
Un relais Barking, c’est un binaire statique, une base SQLite et un port UDP. Lancez `barking-node init`, puis `barking-node run`, et votre machine garde des paquets chiffrés qu’elle ne peut pas lire, au plus 7 jours, sans jamais écrire l’adresse IP d’un client.

Voici un tutoriel court, avec trois chemins : systemd, `docker run` et Docker Compose. Chaque commande et chaque sortie ci-dessous viennent de Barking [v0.7.0](https://github.com/NaKoCorp/Barking/tree/v0.7.0) (commit `2c142eb`, protocole 5).

## Un binaire, un port, une base

Un relais garde des paquets pour des boîtes aux lettres temporaires, et les rend à qui relève ces boîtes, sur QUIC. Un paquet s’en va quand son accusé arrive, comme l’explique [Livré une fois, effacé partout](/fr/blog/livre-une-fois-efface-partout/), ou quand il expire. Le relais ne peut en lire aucun : [Ne faites confiance à aucun nœud. Pas même aux nôtres.](/fr/blog/aucun-noeud-de-confiance/) détaille ce qu’un relais peut faire et ce qu’il ne peut pas faire. Dans cet article, « relais » et « nœud » désignent la même machine : le binaire s’appelle `barking-node`.

<figure>
{% diagram "relay-in-the-network" %}
<figcaption>Votre relais entre les clients qui déposent et relèvent, et les pairs vers lesquels il recopie. Ce qu’il garde, et ce qu’il n’écrit jamais.</figcaption>
</figure>

Ce qu’il vous faut :

- Linux, sur un VPS ou un Raspberry Pi (macOS suffit pour un essai) ;
- un port UDP ouvert, 4433 par défaut ;
- quelques centaines de Mo de disque : le stockage est plafonné à 1 Gio par défaut, et 256 Mio est une valeur raisonnable sur un petit appareil.

Avant de commencer, la partie honnête : Barking est un prototype et n’a pas été audité. Comme le dit son README, « there is no public relay network yet » : il n’existe pas encore de réseau public de relais. Ce sont les premiers opérateurs qui le construisent.

## Obtenir le binaire

Deux options. Le compiler vous-même ; la toolchain est épinglée par `rust-toolchain.toml` :

```sh
cargo build --release -p barking-node
# target/release/barking-node
```

Ou prendre une release. Les binaires Linux sont statiques (musl), pour `x86_64` et `aarch64`. Clonez le dépôt, téléchargez la release dans `dist/` et vérifiez-la :

```sh
git clone https://github.com/NaKoCorp/Barking.git && cd Barking
git fetch --tags
gh release download v0.7.0 -R NaKoCorp/Barking -D dist
scripts/verify-release.sh 0.7.0 --from-dir dist
```

Le script vérifie les fichiers contre `SHA256SUMS`, puis les attestations GitHub liées au workflow de release et au tag, et finit par `Version 0.7.0 verified ✓`. S’il affiche « FAILURE », n’utilisez pas le binaire. [`docs/VERIFYING.md`](https://github.com/NaKoCorp/Barking/blob/v0.7.0/docs/VERIFYING.md) donne le détail, recompilation complète comprise.

## Configurer

Partez de [`docs/deploy/barking-node.toml`](https://github.com/NaKoCorp/Barking/blob/v0.7.0/docs/deploy/barking-node.toml). Une clé absente prend sa valeur par défaut, et une [clé inconnue](https://github.com/NaKoCorp/Barking/blob/2c142ebb0c137cc88d220e7f431eb26d0059a83b/crates/barking-node/src/config.rs#L223-L225) arrête le nœud au démarrage : une faute de frappe ne passe jamais inaperçue. Les clés qui comptent :

```toml
listen = ["[::]:4433"]           # also IPv4 on Linux when net.ipv6.bindv6only=0
data_dir = "/var/lib/barking-node"
storage_max_bytes = 268435456     # 256 MiB on a Raspberry Pi; default 1 GiB
pow_bits = 18                     # proof of work asked of depositors, 1 to 24
# max_connections = 1000          # 200 on a small device
# max_connections_per_ip = 8

[dht]
public_addr = ["203.0.113.7:4433"]  # your public IPv4 and/or IPv6, with the port
# bootstrap = ["<identifier>@<ip:port>"]
# replication_bytes_per_hour = 134217728   # 128 MiB on a Pi; default 512 MiB
```

`[dht] public_addr` est la ligne qui fait d’un relais un membre du réseau. Elle entre dans la fiche signée du nœud : ce doit donc être une adresse IP littérale avec son port, pas un nom DNS, et le nœud refuse une adresse privée. **Sans elle, le nœud reste un simple relais, hors de la table S/Kademlia.** Si vous écrivez une section `[dht]` sans `public_addr`, le journal le dit : `[dht] without public_addr: table disabled, plain relay`. Publier une adresse IPv6 demande aussi une adresse d’écoute IPv6.

Deux autres sections sont actives par défaut. `[wake]` garde les abonnements de réveil des appareils iOS : des jetons scellés que seul le relais de push désigné par l’app peut ouvrir, si bien que le nœud n’apprend aucun appareil. `[info]` permet au nœud de se décrire (version, durée de fonctionnement, taux de remplissage) et de chercher une fois par jour le système autonome et le pays de sa propre adresse publique, par le service DNS de Team Cymru. Cette requête contient l’adresse de votre nœud ; mettez `origin_lookup = false` sous `[info]` si vous préférez ne pas l’envoyer.

## Chemin A : systemd

Le fichier d’unité [`docs/deploy/barking-node.service`](https://github.com/NaKoCorp/Barking/blob/v0.7.0/docs/deploy/barking-node.service) commence par les commandes d’installation. En root :

```sh
useradd --system --home-dir /var/lib/barking-node --shell /usr/sbin/nologin barking-node
install -m 0755 barking-node /usr/local/bin/barking-node
install -d -m 0700 -o barking-node -g barking-node /var/lib/barking-node
install -m 0644 barking-node.toml /etc/barking-node.toml
sudo -u barking-node barking-node init --data-dir /var/lib/barking-node
install -m 0644 barking-node.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now barking-node
```

`init` cherche une identité qui résout un puzzle de 20 bits. Il a pris entre 7 et 16 secondes sur un portable récent ; comptez davantage sur un Pi. Il affiche l’identifiant que vous publierez :

```text
Searching for an identity (20-bit puzzle, a few seconds)…
identifier  : 2RS2C4Q5FGE5ZXURHRONJ5V2DWXVTLNYNPWVRLYUDE36RU4AWNIQ
address     : [::]:4433

To publish: the identifier above and the public address (host or IP) of the server with the listen port ([::]:4433 is the configured local address).
```

La ligne `address` est l’adresse d’écoute locale, pas votre adresse publique. `init` refuse un dossier déjà initialisé, et le nœud refuse de démarrer si `node.key` est lisible par un autre que son propriétaire.

L’unité est durcie : `ProtectSystem=strict`, `NoNewPrivileges`, aucune capacité, et seul le dossier de données est accessible en écriture. Ses commentaires listent les vérifications : `systemd-analyze security barking-node.service`, `journalctl -u barking-node -n 20`, et les droits 700, 600 et 600 sur le dossier, `node.key` et `node.db`.

## Chemin B : Docker

L’image contient le binaire statique seul, sur une base vide (`scratch`), avec l’utilisateur 65532 et `EXPOSE 4433/udp`. Le workflow de release la publie sous le nom `ghcr.io/nakocorp/barking-node`, mais au moment d’écrire, cette image ne se télécharge pas sans compte : `docker pull` répond `unauthorized`. En attendant qu’elle soit publique, construisez-la à partir de la release vérifiée dans `dist/`. La construction vérifie encore le binaire contre `SHA256SUMS` :

```sh
docker build -f docker/node.Dockerfile --build-arg VERSION=0.7.0 -t barking-node dist
docker run --rm -v barking-node:/var/lib/barking-node barking-node init
docker run -d --name barking-node -v barking-node:/var/lib/barking-node \
  -p 4433:4433/udp barking-node
```

Pour utiliser votre configuration, montez-la en lecture seule et passez-la à `run` :

```sh
docker run -d --name barking-node -v barking-node:/var/lib/barking-node \
  -v ./barking-node.toml:/etc/barking-node.toml:ro \
  -p 4433:4433/udp barking-node run --config /etc/barking-node.toml
```

Quand l’image sera publique, remplacez `barking-node` par `ghcr.io/nakocorp/barking-node:0.7.0` et vérifiez-la avec `gh attestation verify oci://ghcr.io/nakocorp/barking-node:0.7.0 -R NaKoCorp/Barking`, comme le décrit [`docs/VERIFYING.md`](https://github.com/NaKoCorp/Barking/blob/v0.7.0/docs/VERIFYING.md#container-images).

## Chemin C : Docker Compose

Depuis le dépôt, avec la release vérifiée dans `dist/` :

```sh
scripts/stack-init.sh --version 0.7.0 --public-addr <public-ip>:4433
docker compose -f deploy/compose.yaml up -d
docker compose -f deploy/compose.yaml exec node /barking-node status
```

Le script écrit `deploy/.env` et `deploy/config/barking-node.toml`, construit l’image, crée la clé dans le volume et affiche l’identifiant. Il refuse une adresse privée et refuse de tourner deux fois ; `--force` arrête le nœud et efface son volume, clé et paquets compris. Pour un serveur IPv6, passez `--public-addr` deux fois, une par famille. Le service tourne avec une racine en lecture seule, `cap_drop: [ALL]` et `no-new-privileges`, et ses journaux sont plafonnés à trois fichiers de 10 Mo.

Sur un Mac, Docker Desktop masque les adresses des pairs derrière son proxy : les plafonds par adresse s’appliquent alors à tout le monde à la fois. Un nœud public va sur Linux, avec Docker Engine. Le profil `relay` du même fichier lance le relais de push iOS, qui demande la clé Apple de NakoCorp ; un opérateur n’en a pas besoin.

## Ouvrir le port et vérifier

Ouvrez le port UDP 4433 dans le pare-feu de la machine (`ufw allow 4433/udp`) et chez votre hébergeur, ou redirigez-le sur une box. Puis :

```text
$ barking-node status --data-dir /var/lib/barking-node
identifier  : 2RS2C4Q5FGE5ZXURHRONJ5V2DWXVTLNYNPWVRLYUDE36RU4AWNIQ
version     : 0.7.0 (protocol 5)
packets     : 0
acks        : 0
bytes       : 0
peers       : 0
buckets     : 0 non-empty
responsible : table empty or disabled
replicated  : 0 bytes in the last hour
```

`status` et `peers` lisent le dossier de données, pas la configuration : passez `--data-dir` si le vôtre n’est pas celui par défaut. `peers` liste les pairs de la table, sans leurs adresses. Le journal affiche `node <identifiant> started`, puis une ligne de compteurs agrégés toutes les 60 secondes :

```text
deposits accepted: 0, fetches: 0, expired purged: 0, refusals: none, open connections: 0 (peak 0), database operations peak: 1, response bytes peak: 0
```

Le vrai test, c’est un message. Depuis un portable où le CLI est installé comme dans [Envoyez votre premier message Barking en 5 minutes](/fr/blog/premier-message-barking/) :

```sh
barking node add 203.0.113.7:4433 2RS2C4Q5FGE5ZXURHRONJ5V2DWXVTLNYNPWVRLYUDE36RU4AWNIQ
barking sync
```

`node add` ne réussit que si le nœud répond et prouve son identité. Ensuite, `deposits accepted` augmente dans votre journal.

## Ce que votre relais voit, et ce qu’il ne voit pas

Il voit :

- **l’adresse IP de chaque client**, le temps de la connexion ;
- les identifiants de boîtes déposées et relevées, le palier de taille de chaque paquet et l’heure ;
- de quoi relier les dépôts et la relève faits sur une même connexion.

Il ne voit ni le contenu, ni l’expéditeur, ni le destinataire.

Il n’écrit aucune adresse IP de client, ni dans la base ni dans les journaux. Le [schéma](https://github.com/NaKoCorp/Barking/blob/2c142ebb0c137cc88d220e7f431eb26d0059a83b/crates/barking-node/src/store.rs#L61-L91) n’a pas de colonne pour cela ; les seules adresses de `node.db` sont celles que les autres nœuds publient eux-mêmes, dans les fiches signées de la table `peers`.

Il garde des paquets chiffrés, jusqu’à 7 jours et une heure au plus après leur scellement ([`MAX_EXPIRY_SECS`](https://github.com/NaKoCorp/Barking/blob/2c142ebb0c137cc88d220e7f431eb26d0059a83b/crates/barking-node/src/rules.rs#L40-L42)), des accusés, et les abonnements de réveil scellés.

Ces garanties sont celles du binaire publié. Un client ne peut pas vérifier le code qui tourne sur votre machine : c’est pour cela que le protocole ne fait confiance à aucun nœud, le vôtre compris. [Cacher qui parle à qui](/fr/blog/cacher-qui-parle-a-qui/) passe les métadonnées en revue, champ par champ.

## Rejoindre le réseau

La liste d’amorçage intégrée au binaire est [vide](https://github.com/NaKoCorp/Barking/blob/2c142ebb0c137cc88d220e7f431eb26d0059a83b/crates/barking-dht/bootstrap.toml) tant qu’aucun nœud public n’existe. Pour l’instant, les nœuds se trouvent à la main :

- publiez votre identifiant et `ip:4433` ;
- les autres opérateurs vous ajoutent sous `[dht]`, avec `bootstrap = ["<identifier>@<ip:port>"]`, et vous ajoutez les leurs ;
- les clients vous ajoutent avec `barking node add`, ou reçoivent votre nœud dans la carte de contact d’un ami, qui en porte jusqu’à trois.

Ensuite, le nœud trouve ses pairs par S/Kademlia et recopie chaque paquet vers les [cinq nœuds responsables](https://github.com/NaKoCorp/Barking/blob/2c142ebb0c137cc88d220e7f431eb26d0059a83b/crates/barking-dht/src/lib.rs#L21-L26) de sa boîte, dans la limite de `replication_bytes_per_hour`. [Une messagerie sans serveur central](/fr/blog/sans-serveur-central/) explique comment ces cinq sont choisis.

Une fois votre relais lancé, ouvrez une discussion ou une issue intitulée « relay operators » sur [github.com/NaKoCorp/Barking](https://github.com/NaKoCorp/Barking), avec son identifiant et son adresse, si vous acceptez de les publier. Les premiers nœuds pourront alors s’amorcer entre eux, et la liste intégrée cessera d’être vide.
