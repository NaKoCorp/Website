---
title: Envoyez votre premier message Barking en 5 minutes
description: Compilez le CLI de Barking, créez deux identités, vérifiez un code de sécurité, puis échangez un message chiffré et son accusé dans de simples fichiers.
date: 2026-11-20
updated: 2026-11-27
translationKey: first-message
tags: [barking, tutorial, rust]
barking: true
draft: false
---
En cinq minutes et avec deux dossiers, vous créez deux identités, vérifiez un code de sécurité, échangez un message chiffré de bout en bout dans un fichier `.pkt` et recevez son accusé de réception. Ni serveur, ni réseau, ni compte. Ensuite, si vous avez un relais sous la main, `barking sync` fait le même trajet par internet.

## Ce que vous allez faire

Alice et Bob vivent tous les deux sur votre machine, chacun dans son propre dossier de données. Alice écrit un message dans un fichier, Bob l’ouvre et écrit un accusé dans un autre fichier, Alice lit l’accusé et son message passe à `delivered`. La partie fichiers a été exécutée pour de vrai avec la version [v0.2.0](https://github.com/NaKoCorp/Barking/releases/tag/v0.2.0) sur macOS, et chaque sortie ci-dessous est copiée de cette exécution.

Barking est un prototype que personne n’a encore audité. [Pourquoi nous construisons Barking](/fr/blog/pourquoi-barking/) explique à quoi il sert et où il en est. Jouez avec, mais ne lui confiez rien de sensible.

## Compiler le client

Il vous faut Rust, installé avec [rustup](https://rustup.rs). Le dépôt épingle sa toolchain dans `rust-toolchain.toml` : rustup télécharge tout seul la bonne version.

<div class="term">
<div class="term-bar"><i></i><i></i><i></i><span>build</span></div>

```sh
git clone --branch v0.2.0 https://github.com/NaKoCorp/Barking.git
cd Barking
cargo build --release -p barking-cli
alias barking="$PWD/target/release/barking"
```

</div>

Sur un Apple M4, avec un dossier `target` neuf, cette compilation a pris 1 min 09 s (149 crates, le registre crates.io et la toolchain étant déjà téléchargés). Votre premier build sera plus long si Cargo doit les récupérer. Les cinq minutes du tutoriel commencent après.

Placez-vous maintenant dans un dossier vide : toute la suite s’y passe.

```sh
mkdir -p ~/barking-demo && cd ~/barking-demo
```

## Créer deux identités

L’option `--home` choisit le dossier de données (par défaut `~/.barking`). Un dossier par personne :

```sh
# pour ce tutoriel seulement : la phrase de passe finit dans l'historique du shell
export BARKING_PASSPHRASE='demo-only-passphrase'
barking --home alice init --name laptop
barking --home bob init --name phone
```

La phrase de passe chiffre la base SQLCipher locale. Elle passe par [Argon2id](https://github.com/NaKoCorp/Barking/blob/v0.2.0/crates/barking-cli/src/passphrase.rs) (64 Mio de mémoire, 3 passes) avant de devenir une clé. Sans `BARKING_PASSPHRASE`, `init` la demande deux fois et chaque autre commande une fois. La variable est une commodité pour les scripts et les tutoriels, pas une bonne habitude. Chaque `init` affiche :

```text
Identity created.
Fingerprint: qkwr-rurz-yt2y-dfnk-laa7-kn66-kfh4-glil-pwgu-clug-5ww6-gdwu-lfhq

Recovery phrase (24 words):
# 24 mots, masqués dans cet article

Write it down offline: it alone lets you recover your identity.
```

L’empreinte (*fingerprint*) vous identifie ; la vôtre sera différente. Les 24 mots sont votre identité. Gardez-les hors ligne. Une récupération restaure l’identité, mais ni vos contacts ni votre historique.

## Échanger les cartes de contact

La carte de contact est la façon de rencontrer quelqu’un sur Barking. Rangez chaque carte dans une variable de shell plutôt que de recopier 2 364 caractères à la main :

```sh
ALICE_CARD=$(barking --home alice card --display-name Alice)
BOB_CARD=$(barking --home bob card --display-name Bob)
barking --home bob add "$ALICE_CARD" --alias alice
barking --home alice add "$BOB_CARD" --alias bob
```

Chaque `add` répond `Contact added:` suivi de l’empreinte de l’autre. Une carte commence par `barking1:`. Elle contient une liste d’appareils signée par la clé racine de l’identité, et les clés publiques dont un contact a besoin pour ouvrir une session. Elle ne contient ni numéro de téléphone ni e-mail. Le format prévoit jusqu’à trois indications de relais, signées avec le reste, mais le CLI les laisse vides. Comment identités et appareils s’articulent fera l’objet d’un prochain article.

## Comparer le code de sécurité

N’importe qui peut vous tendre une carte. Le code de sécurité vous dit que c’est la bonne :

```sh
barking --home alice safety bob
barking --home bob safety alice
```

```text
46702 95821 15050 31417 99645 54460 51939 22903 40051 42212 85143 59254
46702 95821 15050 31417 99645 54460 51939 22903 40051 42212 85143 59254
```

Douze groupes de cinq chiffres, identiques des deux côtés. Avec un vrai contact, comparez-les en personne ou par un canal auquel vous faites déjà confiance. S’ils concordent, marquez le contact :

```sh
barking --home alice safety bob --verified
barking --home alice contacts
```

```text
46702 95821 15050 31417 99645 54460 51939 22903 40051 42212 85143 59254
Contact marked as verified.
bob  bz4c-vjp6-7mit-je4x-usq2-ph7v-27oa-rh7b-dnzy-24dh-ufsk-s2cs-pl3a  verified
```

## Envoyer un message dans un fichier

`send` chiffre le texte, écrit un fichier `.pkt` par paquet dans le dossier `--out` et met le message en file d’envoi. Bob traite ensuite le fichier, puis Alice traite l’accusé :

```sh
barking --home alice send bob 'Hello!' --out a2b
barking --home bob receive a2b/*.pkt --out b2a
barking --home alice receive b2a/*.pkt
```

```text
a2b/54461a58c157cab1093e29a6b4595ed8.pkt
[alice] Hello!
  receipt: b2a/0dad12d5081b8731204c62c8529ae047.pkt
b2a/0dad12d5081b8731204c62c8529ae047.pkt: delivered ✓
```

Bob déchiffre le paquet, apprend qui l’envoie et écrit l’accusé. Alice ouvre l’accusé, et son message est remis. Vérifiez des deux côtés :

```sh
barking --home alice messages bob
barking --home bob messages alice
```

```text
2026-11-19 23:13:00  →  delivered  Hello!
2026-11-19 23:13:00  ←  received  Hello!
```

<figure>
{% diagram "file-trip" %}
<figcaption>Le message et son accusé dans deux fichiers. N’importe quel canal peut les porter.</figcaption>
</figure>

Ce fichier peut voyager sur une clé USB, par e-mail, par n’importe quoi. Il est chiffré et ne dit pas qui l’envoie : Bob ne l’apprend qu’en le déchiffrant. Un texte peut faire jusqu’à [4 000 octets](https://github.com/NaKoCorp/Barking/blob/v0.2.0/crates/barking-core/src/envelope.rs#L29).

## Ce qu’un relais verrait

Barking tient un journal de transparence de ce qu’il a fait et de ce qu’il a exposé :

```sh
barking --home alice log
```

L’entrée du premier paquet, coupée pour la lecture :

```text
Encrypted packet of 16384 bytes (large tier), expires on 2026-11-20 23:10 UTC.
First message of a session: the introduction mailbox is computed from the public
keys (signing and key agreement) of the recipient device and the day. Relays see:
the size, the type (message or acknowledgement), the hop count, a packet
identifier, the mailbox, the expiry. They see neither who you are nor the content.
But anyone who has the recipient's contact card can tell that this is a first
message for that person.
```

Les paquets ont trois [tailles fixes](https://github.com/NaKoCorp/Barking/blob/v0.2.0/crates/barking-packet/src/lib.rs#L49-L51) : 245, 1 024 et 16 384 octets. Le premier message d’une session prend la plus grande, parce qu’il transporte l’accord de clés ; l’accusé tient dans 245 octets. Chaque paquet [expire 24 heures après avoir été scellé](https://github.com/NaKoCorp/Barking/blob/v0.2.0/crates/barking-core/src/envelope.rs#L282-L296), arrondi à 10 minutes près vers le bas pour que les relais n’apprennent pas la seconde où il a été écrit : c’est pourquoi le message scellé à 23 h 13 expire le lendemain à 23 h 10. C’est la v0.2.0 : depuis le protocole 4, arrivé après elle, un paquet [vit 7 jours](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-packet/src/lib.rs#L21-L22), et une compilation de la branche principale affiche une expiration une semaine plus tard. La dernière phrase de l’entrée est une vraie limite : quiconque a la carte de Bob peut reconnaître un premier message qui lui est adressé. Le modèle de menace complet est dans [Ne faites confiance à aucun nœud. Pas même aux nôtres.](/fr/blog/aucun-noeud-de-confiance/)

## Maintenant, par des relais

Cette partie est facultative, et elle demande ce que le client en ligne de commande ne vous donne pas encore : un relais joignable depuis internet. Des relais publics tournent en bêta depuis le 27 novembre 2026 (voir la [carte du réseau](/fr/reseau/)), mais la [liste d’amorçage](https://github.com/NaKoCorp/Barking/blob/v0.2.0/crates/barking-dht/bootstrap.toml) intégrée au binaire est encore vide : le client n’en connaît aucun. Sans relais, `sync` s’arrête là :

```sh
barking --home alice sync
```

```text
introductions: partial poll, the rest at the next sync
Poll not recorded: some mailboxes were not fetched in full
polled 0 mailboxes, received 0 items, deposited 0 (first copies 0, extra 0), avoided 0 nodes, view 0 nodes
no known node: add a contact or a node
```

Le relais doit participer à la table du réseau : son opérateur renseigne `public_addr` dans la section `[dht]` de sa [configuration](https://github.com/NaKoCorp/Barking/blob/v0.2.0/docs/deploy/barking-node.toml), et vous donne son adresse (`IP:port`) et son identifiant de 52 caractères. Ajoutez-le des deux côtés, puis synchronisez à la main, dans cet ordre :

```sh
barking --home alice node add <IP:port> <node-id>
barking --home bob node add <IP:port> <node-id>
barking --home alice send bob 'Through a relay' --out a2b
# Alice dépose le message
barking --home alice sync
# Bob le reçoit et dépose l'accusé
barking --home bob sync
# Alice reçoit l'accusé
barking --home alice sync
```

`node add` vérifie que le relais répond et prouve son identité, et refuse un relais sans adresse publique. Un build release refuse aussi `127.0.0.1` et les autres adresses privées. Si le relais est injoignable, `sync` affiche `network unreachable, nothing is lost`, et les paquets attendent dans la file la tentative suivante. La synchronisation est manuelle pour l’instant. Gardez en tête qu’un relais voit votre adresse IP pendant que vous y êtes connecté.

## Et ensuite ?

- `barking --home alice outbox --out resend` réécrit les paquets qui attendent encore un accusé, pour les renvoyer par n’importe quel canal.
- `barking link` ajoute un second appareil à une identité, par le même genre d’échange de fichiers.
- Lancez votre propre relais, pour que la section précédente marche pour vous et vos contacts : la section [Run a relay](https://github.com/NaKoCorp/Barking/blob/v0.2.0/README.md#-run-a-relay) du README demande un seul binaire, avec Docker ou systemd.

Quand vous avez fini, `rm -rf ~/barking-demo` et `unset BARKING_PASSPHRASE`. Si une commande de ce tutoriel ne se comporte pas comme écrit, [ouvrez une issue](https://github.com/NaKoCorp/Barking/issues) : c’est un bogue de l’article ou de Barking, et les deux méritent d’être corrigés.
