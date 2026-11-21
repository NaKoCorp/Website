---
title: Ne faites confiance à aucun nœud. Pas même aux nôtres.
description: Barking suppose chaque relais hostile, ceux de NakoCorp compris. Ce qu’un relais voit, ce qu’il peut faire et ce qu’il ne peut pas faire, mécanisme à l’appui.
date: 2026-11-22
translationKey: trust-no-node
tags: [barking, security, threat-model]
barking: true
draft: false
---
Barking ne vous demande pas de faire confiance à ses relais. Il suppose que chacun est hostile, y compris ceux que NakoCorp ferait tourner, et il est construit pour que cela ne change rien à ce que vous écrivez. Cela change d’autres choses, et cet article les énumère. Trois questions, sans adjectif : ce qu’un relais voit, ce qu’il ne peut pas faire, et ce qu’il peut faire.

## Supposer que chaque relais est hostile

En une phrase : un relais Barking hostile ne peut ni lire, ni falsifier, ni faire passer pour livré un message ; il peut voir des métadonnées (votre adresse IP, les boîtes que vous relevez, la taille et l’heure des paquets) et perdre ou retarder des paquets, ce que la réplication, les accusés de réception et un score local compensent sans le rendre impossible.

Dans un réseau ouvert, impossible de savoir quel code tourne chez un inconnu. Le code officiel du relais [n’écrit aucune adresse IP](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-node/src/logging.rs#L1-L27) dans ses journaux ni dans sa base, et un [test](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-node/tests/cli.rs#L261-L262) le vérifie. Cela ne vous protège de rien si l’opérateur a patché son binaire. L’hypothèse retenue ici est donc la pire : l’opérateur a modifié le code, journalise tout ce qu’il reçoit, et coopère avec d’autres relais.

La coopération compte. Un relais voit une tranche du trafic : les boîtes dont il est responsable, les clients qui se connectent à lui. Plusieurs relais tenus par la même personne voient plusieurs tranches et peuvent les mettre côte à côte. La question n’est donc jamais « que sait ce relais » mais « que savent ensemble tous les relais qu’un attaquant contrôle ». Tout ce qui suit tient avec cette lecture.

Chaque chiffre ci-dessous vient du dépôt Barking au commit [`4fe359d`](https://github.com/NaKoCorp/Barking/commit/4fe359d07fe5caa05594766477e6d7e5291dc403), protocole 4. Si les relais, les boîtes aux lettres et les responsables vous sont nouveaux, [Une messagerie sans serveur central](/fr/blog/sans-serveur-central/) les présente d’abord.

## Ce qu’un relais voit

Un paquet Barking porte un en-tête en clair de [40 octets](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-packet/src/lib.rs#L17-L18), plus 2 pour la longueur du contenu. Un relais en a besoin pour ranger et acheminer le paquet, et il y [lit](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-packet/src/header.rs#L1-L4) :

- la version du format ;
- le type : message ou accusé de réception ;
- les sauts restants ;
- un identifiant de paquet de 16 octets ;
- l’expiration, fixée 7 jours après le scellement et [arrondie vers le bas à 10 minutes](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/envelope.rs#L312-L326), pour que le relais n’apprenne pas la seconde où vous l’avez scellé ;
- la boîte aux lettres, sur 16 octets ;
- le palier de taille.

Il n’existe que [trois tailles](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-packet/src/lib.rs#L47-L55) : 245, 1 024 et 16 384 octets. Le reste est du remplissage, et un relais [refuse](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-node/src/rules.rs#L89-L95) un paquet dont la longueur n’est pas exactement celle de son palier. Tout le reste est chiffré, y compris l’expéditeur.

La connexion en dit plus que le paquet. Un relais voit l’adresse IP du client pendant qu’il est connecté, les paquets qu’il dépose, les boîtes qu’il relève, et à quelle heure. Barking le dit lui-même. Voici le journal de transparence d’un vrai échange (`barking log`, compilé depuis `4fe359d`, paquets échangés en fichiers comme dans le [tutoriel du premier message](/fr/blog/premier-message-barking/)) :

```text
Encrypted packet of 16384 bytes (large tier), expires on 2026-11-28 23:20 UTC. First message of a session: the introduction mailbox is computed from the public keys (signing and key agreement) of the recipient device and the day. Relays see: the size, the type (message or acknowledgement), the hop count, a packet identifier, the mailbox, the expiry. They see neither who you are nor the content. But anyone who has the recipient's contact card can tell that this is a first message for that person.
```

Quand un paquet passe par un relais, le journal dit le reste : le nœud [voit](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/transparency.rs#L413-L420) « the mailbox, the size, the time and your IP address; not the content » (la boîte, la taille, l’heure et votre adresse IP, pas le contenu).

Notez ce que veut dire « l’heure ». Le relais officiel enregistre l’arrivée d’un paquet [arrondie à la minute](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-node/src/rules.rs#L265-L273). Un relais hostile garde la seconde exacte, tout comme n’importe quel observateur sur le chemin réseau. L’arrondi de l’expiration cache quand vous avez scellé un paquet, pas quand vous l’avez envoyé.

<figure>
{% diagram "relay-view" %}
<figcaption>Deux couches sont visibles du relais. La troisième ne s’ouvre que sur les appareils du destinataire.</figcaption>
</figure>

## Ce qu’un relais ne peut pas faire

Chaque ligne nomme l’attaque, le mécanisme qui l’arrête et le code qui l’implémente.

| Un relais ne peut pas… | Parce que | Code |
|---|---|---|
| lire un message | la session commence par PQXDH (X25519 + ML-KEM-768), puis passe à un Double Ratchet à en-têtes chiffrés ; le relais n’a aucune clé | [`pqxdh.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/handshake/pqxdh.rs#L1-L17), [`ratchet/mod.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/ratchet/mod.rs#L1-L7) |
| savoir qui envoie | l’expéditeur n’est que dans le contenu chiffré ; le message initial est lui-même scellé, donc les relais ne voient jamais la clé d’identité de l’expéditeur | [`envelope.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/envelope.rs#L1-L7) |
| modifier ou forger un message | le chiffrement est authentifié ; un paquet qui ne s’ouvre pas part en quarantaine et n’est jamais affiché | [`receive.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/receive.rs#L478-L503) |
| rejouer un vieux message | les identifiants de message déjà vus sont ignorés (et quand même accusés) ; l’horodatage authentifié doit dater de 8 jours au plus et avoir au plus 1 jour d’avance | [`core/mod.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/mod.rs#L125-L133), [`receive.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/receive.rs#L237-L247) |
| faire croire à une livraison | l’identifiant d’un paquet dérive d’un secret que seul le destinataire détient ; le relais vérifie un accusé sans apprendre qui l’émet | [`ack.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-packet/src/ack.rs#L19-L38) |
| se faire passer pour un autre relais | le client épingle TLS sur l’identifiant du relais, dérivé de sa clé Ed25519 avec un puzzle de 20 bits, sans autorité de certification | [`node_id.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-proto/src/node_id.rs#L1-L28), [`tls.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-proto/src/tls.rs#L1-L15) |
| glisser un faux appareil dans un contact | la liste d’appareils est signée par la clé racine et versionnée, compte 8 appareils au plus, et voyage de bout en bout dans les cartes de contact, pas par les relais | [`device_list.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/identity/device_list.rs#L1-L27), [`remove.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/remove.rs#L1-L15) |

Trois lignes méritent qu’on s’y arrête.

**Le rejeu est borné par une horloge authentifiée.** L’horodatage sur lequel un relais voudrait mentir est dans le contenu scellé : le modifier casse le paquet. Une copie gardée puis redéposée plus tard est soit déjà dans la liste des identifiants vus du destinataire, soit vieille de plus de 8 jours et refusée. Cette liste est gardée [plus longtemps](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/mod.rs#L130-L133) que la fenêtre elle-même, donc la purger ne rouvre pas la porte.

**Forger coûte au faussaire, pas à vous.** Un paquet poubelle déposé dans votre boîte coûte à votre appareil quelques tentatives de déchiffrement d’en-tête. Il échoue, part en quarantaine avec une [raison fixe](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/receive.rs#L28-L39), et ne change aucun état de session.

**Un accusé prouve la livraison sans nommer personne.** L’identifiant du paquet est dérivé par BLAKE3 d’un secret, sous le contexte `barking/v0/ack`, et tronqué à 16 octets. Le secret est scellé dans le contenu : seul le destinataire peut le lire. Pour accuser réception, le destinataire révèle le secret ; n’importe quel relais peut alors dériver l’identifiant et le comparer, en temps constant, à celui qu’il garde. Un relais [refuse](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-node/src/rules.rs#L324-L338) un accusé pour un paquet qu’il ne détient pas. Il ne peut pas fabriquer l’accusé d’un paquet qu’on lui a confié, parce qu’il n’a jamais eu le secret.

Un vieux relais ne peut pas non plus ramener un client vers un vieux protocole : le client [ne parle](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-proto/src/client.rs#L54-L55) aucune version antérieure à la 2. La version actuelle est la [4](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-proto/src/lib.rs#L20-L43), celle qui a apporté la durée de vie de 7 jours. Un relais resté en version 3 n’accepte aucun paquet qui expire plus de 25 heures plus tard, donc un paquet de 7 jours ne va pas chez lui.

## Ce qu’un relais peut faire

Cette liste est aussi longue que nécessaire. Chaque point dit ce qui le limite aujourd’hui.

- **Perdre ou retarder un paquet.** Chaque boîte a [5 responsables](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-dht/src/lib.rs#L21-L24) ; le client dépose jusqu’à 3 copies, les relais [se répliquent toutes les heures](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-node/src/dht/replicate.rs#L57-L58), le client renvoie après [6 heures](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-net/src/plan.rs#L18-L21) sans accusé, et un [score de fiabilité](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-net/src/score.rs#L1-L26) local écarte les relais qui perdent des messages. Limite : un relais n’est repéré qu’après une perte.
- **Répondre « rien ici ».** Une boîte lue en entier chez un responsable est relue chez un autre, au plus [toutes les 6 heures](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-net/src/sync.rs#L216-L223). Limite : la même, après coup.
- **Relier vos connexions.** Un responsable voit l’IP qui dépose dans une boîte et l’IP qui la relève, et peut relier les deux. Un accusé réutilise la boîte et l’identifiant de son message, donc un relais relie un message à son accusé ; le journal de transparence le dit en toutes lettres. Aucune identité réelle n’en sort, mais le motif, si.
- **Relier votre identité à votre IP.** Votre boîte d’introduction est [calculée](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-packet/src/lib.rs#L88-L102) à partir des clés publiques de votre appareil et du jour. Qui a votre carte de contact peut la calculer, et un responsable qui vous voit la relever sait que cette IP, c’est vous.
- **Reconnaître un premier message.** Pour la même raison, quiconque a la carte du destinataire sait qu’un premier message arrive pour cette personne. Le journal cité plus haut le dit exactement.
- **Inonder une boîte d’introduction.** N’importe qui peut la remplir en payant la [preuve de travail](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-proto/src/pow.rs#L26-L61) du dépôt (18 bits par défaut, davantage pour les grands paliers et les boîtes pleines). Cela retarde les premiers contacts. Les jetons de contact qui l’empêcheraient sont prévus, pas faits.
- **Se placer près d’une boîte d’introduction.** Sur un petit réseau, quelques minutes de calcul (le puzzle de 20 bits, plus une clé proche de la boîte) suffisent pour devenir l’un de ses responsables et retarder des premiers contacts.
- **Mentir dans la table de hachage.** Les recherches passent par [3 chemins disjoints](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-dht/src/lib.rs#L15-L34), gardent au plus 2 nœuds par bloc /24 ou /48, et n’acceptent que des [fiches signées](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-proto/src/record.rs#L1-L15). Limite : un attaquant qui dispose de nombreux blocs d’adresses distincts n’est borné que par le puzzle. Encercler une cible ainsi, c’est une attaque par éclipse (eclipse).

<figure>
{% diagram "sees-can-cannot" %}
<figcaption>La troisième colonne tient grâce à la cryptographie. La deuxième ne rétrécit qu’avec plus de travail.</figcaption>
</figure>

## Pourquoi « pas même aux nôtres »

Les relais lancés par NakoCorp n’ont aucun pouvoir de plus. Même binaire, même protocole, et rien dans le client ne leur fait davantage confiance. Il n’existe aucune liste privilégiée : la [liste d’amorçage](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-dht/bootstrap.toml#L1-L10) intégrée au binaire est vide, et elle ne servirait qu’à trouver un premier nœud, jamais à le classer.

Deux choses reposent bien sur NakoCorp aujourd’hui. Le relais push iOS, dont l’identité et la clé de scellement sont [intégrées à l’app](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/deploy/README.md#L6) : un prochain article dit ce qu’il apprend. Et les binaires eux-mêmes : vous faites confiance à qui a compilé le code que vous lancez, et c’est pourquoi les versions vérifiables auront aussi leur article.

## Ce qui l’améliorerait, et quand

Prévu, sans date :

- **Cacher votre IP aux relais**, par Tor ou un mixnet. C’est le plus gros manque : la plupart de la colonne « peut » vient des adresses IP. Cela ne cacherait pas tout. Un responsable verrait encore que quelqu’un dépose dans une boîte et que quelqu’un la relève, et quand ; il ne saurait simplement plus où se trouve l’un ou l’autre.
- **Des jetons de contact**, pour que seules les personnes que vous avez invitées puissent remplir votre boîte d’introduction.
- **Un audit externe.** Rien dans cet article n’a été audité. Le modèle de menace est écrit par ceux qui ont écrit le code.

Envisagé puis écarté : les **boîtes leurres**, relever des boîtes vides pour cacher les vraies. Elles resteraient vides, donc un responsable les distinguerait, et elles ne protégeraient ni le lien entre dépôt et relève, ni la boîte d’introduction. Le code n’en contient aucune.

## Cassez-le

Ce modèle de menace est un document vivant. Chaque attaque qu’il oublie est une attaque contre laquelle le code ne se défend pas encore. Si vous en trouvez une, signalez-la en privé comme l’explique [`SECURITY.md`](https://github.com/NaKoCorp/Barking/blob/main/SECURITY.md), ou [ouvrez une issue](https://github.com/NaKoCorp/Barking/issues) pour une question de conception.

Un audit externe est un objectif, pas un fait. Si vous voulez qu’il arrive plus tôt, vous pouvez [sponsoriser NakoCorp](https://github.com/sponsors/NaKoCorp).
