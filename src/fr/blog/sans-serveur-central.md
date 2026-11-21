---
title: Une messagerie sans serveur central
description: Comment Barking place chaque boîte aux lettres sur les cinq relais les plus proches, recopie les paquets et écarte les relais qui en perdent, sans annuaire.
date: 2026-11-21
translationKey: no-central-server
tags: [barking, networking, rust, p2p]
barking: true
draft: false
---
Un serveur central, c’est un endroit à saisir, un endroit à censurer et un interrupteur à couper. Barking n’en a pas. Cet article suit un paquet chiffré depuis le moment où Alice le dépose jusqu’à celui où Bob le relève, et pose à chaque étape la même question : qui décide ? La réponse n’est jamais un annuaire ni un nœud privilégié. Le client calcule où vit une boîte aux lettres, les relais se recopient les paquets, et chaque client tient son propre compte des relais qui perdent des messages.

## Aucun serveur à saisir, censurer ou éteindre

En une phrase : dans Barking, une boîte aux lettres vit sur les [5 relais](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/src/lib.rs#L22) dont l’identifiant est le plus proche de sa clé (S/Kademlia) ; le client y dépose une copie, les relais complètent eux-mêmes les autres, et chaque client cesse d’utiliser les relais qui perdent ses messages.

Le statut d’abord, parce qu’il compte : le code fonctionne et il est testé, mais aucun réseau public n’existe encore. Chaque chiffre ci-dessous vient du dépôt Barking au commit [`7aa3a41`](https://github.com/NaKoCorp/Barking/commit/7aa3a4100f32e4380b030d6240be9115368abe5e), pas d’intentions. Si vous ne l’avez pas lu, [Pourquoi Barking](/fr/blog/pourquoi-barking/) donne le contexte. Ici, « relais » et « nœud » désignent la même chose.

## Ce qu’est un relais

Un relais, `barking-node`, est un seul binaire. Il parle QUIC sur UDP, avec TLS 1.3 et l’ALPN [`barking/0`](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-proto/src/lib.rs#L45), et garde ses données dans une [base SQLite intégrée](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-node/Cargo.toml#L37). Aucun service externe, aucun compte, aucune inscription : un opérateur publie l’identifiant et l’adresse de son nœud, et c’est tout.

Ce qu’il garde est étroit. Des paquets scellés de [trois tailles fixes](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-packet/src/lib.rs#L51-L53) (245, 1 024 et 16 384 octets), rangés sous des identifiants de boîte de 16 octets, jusqu’à l’arrivée d’un accusé ou jusqu’à leur expiration. Un message vit [7 jours par défaut](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-packet/src/lib.rs#L22), et un relais refuse tout paquet qui expirerait [plus de 7 jours et 1 heure](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-proto/src/lib.rs#L27-L30) après sa propre horloge. La release v0.2.0, celle du [tutoriel du premier message](/fr/blog/premier-message-barking/), scellait encore les paquets pour 24 heures ; la durée de 7 jours est arrivée avec le protocole 4, après elle. Le relais ne déchiffre rien : il ne lit que l’en-tête en clair, qui lui donne la taille, la boîte et l’expiration.

## Des identités de nœud qui ont un coût

L’identifiant d’un nœud est l’[empreinte BLAKE3 de sa clé publique Ed25519](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-proto/src/node_id.rs#L21-L23). Pas n’importe quelle clé : l’empreinte de l’identifiant doit commencer par [20 bits à zéro](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-proto/src/node_id.rs#L15). Trouver une telle clé demande environ un million d’essais, quelques secondes une seule fois, quand l’opérateur lance `init`.

Deux conséquences. Fabriquer des milliers d’identités pour encercler une boîte (une attaque Sybil) coûte désormais du vrai temps de calcul pour chacune. Et le client [épingle la connexion TLS](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-proto/src/tls.rs#L104-L105) sur l’identifiant qu’il attend, sans autorité de certification : un relais ne peut pas se faire passer pour un autre sans sa clé privée.

## Où vit une boîte aux lettres

La clé d’une boîte est `BLAKE3("barking/v0/mailbox-key", boîte)`, avec exactement cette [chaîne de contexte](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/src/lib.rs#L42). La distance entre une clé et un nœud est le XOR des deux, comme dans Kademlia. Les nœuds responsables de la boîte sont les 5 nœuds à la plus petite distance. Quiconque connaît la boîte et assez du réseau calcule les cinq mêmes : personne n’a besoin d’être consulté.

Les boîtes de conversation sont dérivées d’un secret que les deux correspondants partagent, et elles changent chaque jour. Leur clé se déplace donc chaque jour, et leurs cinq responsables aussi.

<figure>
{% diagram "mailbox-placement" %}
<figcaption>Le même réseau deux jours de suite. Une nouvelle boîte chaque jour, donc cinq nouveaux responsables.</figcaption>
</figure>

Les nœuds se décrivent par une fiche signée : identifiant, adresses routables seulement, et une date arrondie à l’heure, acceptée jusqu’à [une heure d’avance](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-proto/src/record.rs#L15) sur l’horloge de celui qui la lit. Une fiche plus récente remplace l’ancienne.

## Trouver des nœuds sans annuaire

Chaque relais tient une table de routage de [256 compartiments](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/src/table.rs#L55), un par bit de distance, de [20 nœuds chacun](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/src/lib.rs#L16), plus 10 en réserve. Un nœud n’y entre qu’après un contact direct avec une fiche valide, et les anciens passent d’abord : un attaquant ne peut pas évincer un nœud qui continue de répondre. La table limite aussi la diversité des adresses : au plus [2 nœuds par /24 ou /48](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/src/lib.rs#L30-L32), et aucun bloc au-delà de 10 % de la table. Une recherche passe par [3 chemins disjoints](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/src/lib.rs#L18-L20), avec 3 requêtes en parallèle sur chacun : un nœud menteur ne peut pas tous les détourner.

Le client, lui, ne tient pas de table. Il garde une vue locale de [2 048 fiches](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/lib.rs#L32) au plus, remplie par [2 recherches d’identifiants tirés au hasard](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/sync.rs#L200) à chaque synchronisation. Un identifiant tiré au hasard ne révèle rien : ce n’est la clé d’aucune de vos boîtes. Au départ, la vue est amorcée dans cet ordre : son propre cache, les fiches portées par les cartes de contact ([3 au plus par carte](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-core/src/contact.rs#L28), et [jamais les responsables de vos propres boîtes](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/discover.rs#L468)), les nœuds ajoutés à la main, puis la liste intégrée au binaire. Elle s’arrête dès que [3 nœuds](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/discover.rs#L33) répondent.

À partir de cette vue, le client choisit lui-même les responsables d’une boîte. Il ne se rabat sur une recherche de la clé de la boîte que si la vue compte moins de [20 nœuds](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/lib.rs#L47), ou si [2 responsables](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/sync.rs#L245) répondent `NotResponsible`.

## Un dépôt, cinq copies

Le client d’Alice dépose d’abord le paquet chez 1 responsable, celui qu’il note le mieux, avec une preuve de travail : [18 bits](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-proto/src/pow.rs#L28-L29) par défaut, [davantage](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-node/src/rules.rs#L184-L192) pour les gros paquets, les boîtes pleines et un nœud rempli, jusqu’à 24. Dès qu’un relais l’accepte, le paquet est en sécurité : les relais se le recopient. S’il reste du temps à la synchronisation, le client ajoute des copies chez d’autres responsables, [3 en tout](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/plan.rs#L19) au plus.

<figure>
{% diagram "deposit-replication" %}
<figcaption>Alice dépose chez un responsable, les relais complètent les quatre autres, Bob relève chez celui qu’il note le mieux.</figcaption>
</figure>

Ensuite, les relais prennent le relais. [Toutes les heures](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-node/src/dht/replicate.rs#L58), et [une minute](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-node/src/dht/replicate.rs#L60) après l’arrivée d’un nouveau nœud parmi les 5 plus proches d’une boîte, chaque relais responsable demande à chaque autre responsable ce qu’il détient déjà (`FindValue`), puis envoie ce qui manque (`Store`), les accusés avant les paquets. Les appels entre nœuds sont authentifiés par leur certificat, et un relais n’accepte un `Store` que si [l’appelant et lui-même](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-node/src/dht/mod.rs#L443-L457) sont parmi les 10 nœuds les plus proches de la boîte. La recopie est plafonnée à [512 Mio par heure](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-node/src/config.rs#L29) par défaut, pour qu’un petit appareil puisse participer. Un nœud qui n’est plus responsable arrête de recopier, mais n’efface rien de force.

Le dépôt le vérifie par une simulation déterministe de 500 nœuds. [`churn_restores_five_copies_in_two_passes`](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/tests/sim.rs#L577) retire 30 % des nœuds, puis exige que chacune de 100 boîtes ait retrouvé ses 5 copies après un cycle d’entretien des tables et deux passes de réplication. [`twenty_percent_liars_still_find_three`](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/tests/sim.rs#L520) exige que plus de 95 % des recherches trouvent 3 des 5 responsables quand un cinquième des nœuds ne répondent qu’en se citant entre eux, et [`sybil_slash24_is_capped`](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/tests/sim.rs#L544) ajoute 200 identités venues d’un même /24 et vérifie qu’aucune table n’en garde plus que sa part.

## Les clients tiennent les comptes

La réplication gère les relais qui disparaissent. Elle ne gère pas un relais qui accepte un paquet puis le jette. Pour cela, chaque client tient un [score de fiabilité](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/score.rs#L14-L26) par relais, sur l’appareil, jamais partagé :

| Évènement | Effet |
| --- | --- |
| valeur de départ | 0,5 |
| un message qu’il avait accepté a disparu (sans accusé, non expiré) | −0,3 |
| échec de connexion alors qu’un autre relais a répondu | −0,1 |
| un message qu’il avait accepté est toujours là | +0,05 |
| une requête a réussi | +0,02 |

Sous 0,2, le relais est mis à l’écart pendant [7 jours](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/lib.rs#L34), et son score remonte de 0,05 par jour. Quand aucun relais ne répond, aucun score ne baisse : le problème vient de votre connexion, pas d’eux.

Le contrôle des pertes ne coûte rien de plus. Tant qu’Alice attend un accusé, son client relève déjà la boîte de ses messages : il voit donc si un relais qui a accepté un paquet l’a toujours. Après une perte, le paquet part aussitôt chez un autre responsable ; après [6 heures](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/plan.rs#L21) sans accusé, il reçoit de nouvelles copies. Et comme un relais qui répond « rien ici » sans rien garder ne serait jamais pris de cette façon, une boîte relevée en entier chez un responsable est aussi relevée chez un autre, au plus [toutes les 6 heures](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/sync.rs#L223).

Quand un relais est mis à l’écart, `barking sync` affiche [`Node … avoided: it lost messages or kept failing`](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-cli/src/main.rs#L483), et le journal de transparence en garde la raison.

## Ce que cette conception ne résout pas encore

- **Il n’y a pas de réseau public.** La [liste d’amorçage](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/bootstrap.toml) intégrée au binaire est vide. Aujourd’hui, on ajoute un relais à la main.
- **Un relais derrière un NAT reste un simple relais.** Sans `public_addr` dans la [section `[dht]`](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/docs/deploy/barking-node.toml#L56-L62) de sa configuration, il stocke des paquets mais ne participe pas à la table.
- **Un responsable voit des adresses IP.** Il voit l’adresse qui dépose et celle qui relève, et peut relier les deux. Ce qu’un relais peut apprendre, et ce qu’il ne peut pas, fera l’objet d’un article à part.
- **Les boîtes d’introduction peuvent être ciblées.** La boîte d’un premier contact se calcule à partir d’une clé publique. Un attaquant patient peut placer des identités près d’elle et retarder des premiers contacts, au prix du puzzle pour chaque identité.
- **Les grands réseaux.** Au-delà de quelques milliers de nœuds, la vue du client devient partielle et les recherches de secours plus fréquentes.
- **Les pertes se voient après coup.** Un relais qui perd des messages n’est repéré qu’après en avoir perdu un.

Barking est un prototype et n’a pas été audité.

## Devenez l’un des nœuds

Le premier réseau public sera fait de ses premiers opérateurs. Lancez un relais avec la table activée (`public_addr` dans la section `[dht]`), puis publiez son identifiant et son adresse : la section [Run a relay](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/README.md#-run-a-relay) du README tient en un binaire, avec Docker ou systemd.

Et si vous préférez le casser plutôt que le faire tourner, lisez le code de la table dans [`crates/barking-dht`](https://github.com/NaKoCorp/Barking/tree/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht) et [ouvrez une issue](https://github.com/NaKoCorp/Barking/issues) là où il se trompe.
