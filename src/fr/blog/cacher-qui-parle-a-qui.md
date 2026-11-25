---
title: Cacher qui parle à qui
description: "Un relais Barking ne voit ni l’expéditeur ni le destinataire, seulement une boîte qui change chaque jour. Il voit encore votre adresse IP. Inventaire complet."
date: 2026-11-25
translationKey: hiding-metadata
tags: [barking, privacy, metadata]
barking: true
draft: false
---
Le chiffrement de bout en bout cache ce que vous dites. Il ne dit rien de la personne à qui vous le dites, ni de quand, ni de combien. Ces trois faits sont des métadonnées, et ils suffisent souvent : deux personnes qui s’écrivent chaque nuit à 2 h du matin racontent une histoire sans un seul mot de contenu.

Barking part du modèle de menace de [Ne faites confiance à aucun nœud. Pas même aux nôtres.](/fr/blog/aucun-noeud-de-confiance/) : chaque relais peut être hostile, donc le protocole essaie de ne rien lui donner d’utile. Cet article en fait l’inventaire. Champ par champ, ce qu’un relais voit d’un paquet ; comment la boîte et l’expéditeur sont cachés ; ce qui est arrondi ; puis la partie qui compte le plus, ce qui fuit encore. Le premier point de cette liste est votre adresse IP.

Chaque valeur ci-dessous vient du dépôt Barking à la version [v0.4.0](https://github.com/NaKoCorp/Barking/tree/v0.4.0) (commit `f6f3a0a`).

## Le chiffrement cache ce que vous dites, pas à qui

En une phrase : un relais Barking ne voit ni l’expéditeur ni le destinataire d’un paquet, seulement un identifiant de boîte aux lettres qui change chaque jour, une taille de charge et une heure arrondie à la minute. Il voit en revanche l’adresse IP de qui dépose et de qui relève, et Barking ne la cache pas encore.

La suite de l’article reprend cette phrase dans l’ordre : l’en-tête en clair, la boîte tournante, l’expéditeur caché, les arrondis, puis les fuites.

## Ce qu’un relais voit vraiment

Un paquet Barking a une seule disposition, [écrite en tête de `header.rs`](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-packet/src/header.rs#L1-L4). Les 40 premiers octets sont en clair, parce que les relais en ont besoin pour stocker et acheminer le paquet :

- **version** (1 octet), toujours 0 aujourd’hui ;
- **type** (1 octet) : un message ou un accusé de réception ;
- **sauts** (1 octet) : combien de fois le paquet peut encore être retransmis ;
- **palier** (1 octet) : S, M ou L, la classe de taille ;
- **identifiant de paquet** (16 octets) : pour un message, les 16 premiers octets d’un hachage BLAKE3 d’un secret tiré au hasard, que seul le destinataire apprend. Il a l’air aléatoire et ne relie rien. L’accusé de réception révèle ensuite ce secret, ce qui permet aux relais de vérifier qu’il est authentique ;
- **expiration** (4 octets) : l’heure d’expiration ;
- **identifiant de boîte** (16 octets) : la boîte où le paquet attend.

Viennent ensuite 2 octets de longueur, la charge chiffrée, et des zéros jusqu’à la taille du palier : [245, 1 024 ou 16 384 octets](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-packet/src/lib.rs#L49-L55). Tout ce qui identifie une personne est dans la charge chiffrée, l’expéditeur compris.

<figure>
{% diagram "packet-header" %}
<figcaption>Les 40 octets qu’un relais peut lire. Aucun champ ne nomme un expéditeur, un destinataire ou un numéro de téléphone.</figcaption>
</figure>

## Une boîte qui change chaque jour

L’en-tête ne porte aucune adresse, seulement un identifiant de boîte. Pour une conversation déjà ouverte, il est [calculé](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-core/src/mailbox.rs#L26-L33) ainsi :

```rust
pub fn session_mailbox(secret: &[u8; 32], recipient: &DeviceId, day: u32) -> MailboxId {
    let mut h = blake3::Hasher::new_keyed(secret);
    h.update(labels::MAILBOX);
    h.update(&recipient.0);
    h.update(&day.to_be_bytes());
    truncate(h.finalize().as_bytes())
}
```

La clé est le secret des boîtes, que la poignée de main dérive à côté de la clé de session (voir [Post-quantique dès le premier jour](/fr/blog/post-quantique-des-le-premier-jour/)). Seuls les deux appareils de la session le détiennent. L’entrée est une étiquette, l’identifiant de l’appareil destinataire et le numéro du jour, `now / 86400` en UTC. Le résultat est tronqué à 16 octets.

Trois conséquences en découlent, et les tests du même fichier les vérifient :

- **Une nouvelle boîte chaque jour.** La boîte du lundi et celle du mardi sont deux valeurs de 16 octets sans rapport. Sans le secret, un relais ne peut pas les relier.
- **Une boîte par sens.** L’appareil destinataire entre dans le calcul, donc Alice → Bob et Bob → Alice utilisent deux boîtes différentes. Un relais ne peut pas réunir les deux moitiés d’une conversation.
- **Une boîte par paire d’appareils.** Un contact qui a un téléphone et un ordinateur reçoit de vous deux boîtes par jour.

Les relais qui gardent une boîte sont choisis à partir de l’identifiant de boîte lui-même : les cinq nœuds dont l’identifiant en est le plus proche, comme l’explique [Une messagerie sans serveur central](/fr/blog/sans-serveur-central/). Quand la boîte change, ces cinq nœuds changent aussi. Un relais qui garde votre boîte du lundi n’a aucune raison particulière de garder celle du mardi.

<figure>
{% diagram "daily-mailbox" %}
<figcaption>Le même sens de la même conversation, sur trois jours : trois identifiants, trois groupes de nœuds. Les valeurs hexadécimales sont des exemples.</figcaption>
</figure>

Pour recevoir, un appareil relève une fenêtre de jours : [de 8 jours en arrière jusqu’au lendemain](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-core/src/core/mod.rs#L90-L95), dix jours en tout. Un paquet reste dans la boîte du jour où il a été scellé, et il peut être déposé en retard : la fenêtre couvre donc toute sa durée de vie, 7 jours, plus un jour de décalage d’horloge. Cette fenêtre dit où chercher, pas quoi accepter. Un message n’est accepté que si son horodatage authentifié a [au plus 8 jours et au plus un jour d’avance](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-core/src/core/mod.rs#L125-L129) sur l’horloge du destinataire.

## Cacher l’expéditeur

Sur une session ouverte, le paquet ne porte aucune identité d’expéditeur. L’enveloppe chiffrée contient un horodatage, un secret d’accusé, un identifiant de message et le contenu. [Le module](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-core/src/envelope.rs#L1-L7) s’intitule « Envelope with hidden sender ». Le destinataire sait qui écrit parce qu’une seule de ses sessions déchiffre le paquet.

Le premier message d’une session est plus délicat. Il doit porter la clé d’identité de l’expéditeur, sinon le destinataire ne pourrait pas ouvrir la session. Barking scelle ce message initial pour la clé du destinataire avec une clé X25519 éphémère tirée pour l’occasion : un relais voit 32 octets aléatoires suivis d’un bloc chiffré. L’idée est proche du *sealed sender* de Signal (l’expéditeur scellé), sans serveur qui délivre des certificats d’expéditeur. Une limite, déjà dans la liste de l’article sur le post-quantique : ce scellement est classique. Un futur attaquant quantique qui aurait gardé le paquet pourrait apprendre qui a ouvert la conversation, pas ce qui s’est dit.

Ce premier message ne peut pas utiliser une boîte de session, puisqu’il n’y a pas encore de session. Il va dans la **boîte d’introduction** du destinataire, calculée à partir des clés publiques de l’appareil et du jour. Elle revient plus bas, dans la liste des fuites.

L’accusé de réception d’un message est déposé [dans la boîte du message qu’il accuse](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-core/src/core/receive.rs#L1231-L1261), jamais dans une boîte de l’autre sens. Le commentaire du code donne les deux raisons : répondre ailleurs relierait les deux sens de la conversation, et les nœuds qui gardent le message ne verraient pas l’accusé qui leur permet de l’effacer.

## Arrondir le reste

Ce qui ne peut pas être caché est rendu plus grossier :

- **La taille du paquet** sur le réseau est l’un des trois paliers, complétée par des zéros.
- **L’expiration** vaut l’heure du scellement plus 7 jours, [arrondie vers le bas à 10 minutes](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-core/src/envelope.rs#L313-L326). Les accusés suivent le même arrondi. Un relais ne peut pas lire la seconde où le message a été écrit.
- **L’heure d’arrivée** qu’un nœud enregistre est [arrondie à la minute](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-node/src/rules.rs#L265-L279).
- **Aucune adresse IP sur le disque.** Le [schéma de la base](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-node/src/store.rs#L62-L91) du nœud n’a pas de colonne pour elle. Les seules adresses qu’il garde sont celles que les autres nœuds publient sur eux-mêmes.
- **Aucune adresse IP dans les journaux.** Le [filtre des journaux](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-node/src/logging.rs#L1-L27) coupe toutes les cibles par défaut et coupe explicitement `quinn_udp`, parce que cette bibliothèque écrit les adresses quand un envoi échoue. Un test le vérifie.

Tout ceci décrit le binaire que Barking publie. Un opérateur peut faire tourner un nœud modifié qui enregistre tout ce qu’il reçoit ; le modèle de menace le suppose déjà. Les arrondis vous protègent d’un relais négligent, pas d’un relais hostile.

## Ce qui fuit encore

C’est la liste à lire si vous ne lisez qu’une section. Elle commence par l’avertissement en tête du [README](https://github.com/NaKoCorp/Barking/blob/v0.4.0/README.md) : « relays can observe client IP addresses » (les relais peuvent voir l’adresse IP des clients).

<div class="status-list is-limit">

- **Votre adresse IP.** Le nœud où vous déposez et celui où vous relevez voient votre adresse IP pendant la connexion. Barking n’a aucune protection contre cela aujourd’hui.
- **Qui dépose et qui relève, pour une boîte.** Un nœud qui garde une boîte voit l’adresse IP qui la relève, et les adresses IP qui y déposent quand le dépôt arrive d’abord chez lui. Il peut relier les deux : une seule boîte sur un seul nœud suffit à associer deux adresses IP pour ce jour-là. Il voit aussi quelles boîtes un client relève ensemble, et les dépôts faits sur la même connexion.
- **Votre boîte d’introduction.** Elle se calcule à partir des clés publiques de votre appareil, et celles-ci sont dans votre carte de contact. Quiconque a votre carte peut la calculer : la relever lie donc votre identité à votre adresse IP. Quiconque a votre carte peut aussi la remplir : le nœud ne demande qu’une preuve de travail, plus difficile à mesure que la boîte se remplit.
- **La taille exacte de la charge.** Le palier complète le paquet, mais le champ de longueur de 2 octets, en clair, donne la taille de la charge chiffrée à l’octet près, tout comme les préfixes de longueur à l’intérieur de la charge, qui ne sont pas chiffrés non plus. L’enveloppe n’ajoute aucun remplissage. Un « ok » et un long paragraphe ne se ressemblent pas pour un relais. [#85](https://github.com/NaKoCorp/Barking/pull/85) corrige ce point pour la prochaine version : le message est complété par des zéros avant le chiffrement, la charge remplit toujours son palier, et un relais n’apprend plus que le palier.
- **Le volume et l’heure**, à la minute et au palier près : combien de paquets une boîte reçoit, et quand.
- **Message ou accusé.** L’octet de type est en clair. Un accusé dans une boîte apprend aux nœuds que le message qui s’y trouve a été reçu.
- **Les réveils iOS.** Si vous activez les notifications instantanées, un nœud garde un jeton de réveil scellé à côté de votre boîte. Un nœud et le relais de push qui coopèrent peuvent relier cette boîte à un iPhone. Couper les notifications instantanées l’évite.
- **Les nœuds de votre carte de contact.** Votre carte cite au plus trois nœuds que vous utilisez, pour aider vos contacts à trouver le réseau. Barking n’y met jamais les nœuds responsables de vos propres boîtes.

</div>

{% diagram "what-a-relay-sees" %}

## Pourquoi pas de relèves leurres

Une version antérieure de la conception prévoyait des *relèves leurres* : relever des boîtes qui n’existent pas, pour que les vraies relèves se perdent parmi les fausses. Barking a abandonné l’idée avant de l’écrire, et le code ne contient aucun leurre.

La raison est dans la liste ci-dessus. Un leurre multiplie les requêtes sur un réseau faible, et il ne protège d’aucune de ces fuites : une boîte leurre reste vide, l’adresse IP est la même, et un nœud qui voit une vraie boîte se remplir la distingue d’un leurre. Le coût est réel ; le gain ne l’est pas.

La vraie parade est de cacher l’adresse IP aux relais : faire passer les connexions des clients par Tor ou par un mixnet. C’est dans la [feuille de route](https://github.com/NaKoCorp/Barking/blob/v0.4.0/README.md#-roadmap), pas commencé, sans date. D’ici là, Barking n’est pas un outil d’anonymat, et il ne prétend pas en être un.

## Vérifiez par vous-même

Barking vous dit ce que chaque nœud a vu. Chaque dépôt et chaque relève écrit un événement dans le journal de transparence, affiché par `barking log` dans le client en ligne de commande. Le texte vient de [`transparency.rs`](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-core/src/transparency.rs#L413-L430), mot pour mot, en anglais comme dans le code :

```text
{count} packets deposited on node {node} ({refused} refused). The node sees
the mailbox, the size, the time and your IP address; not the content.

Mailboxes fetched from node {node}: {mailboxes} mailboxes, {received} items
received. The node sees which mailboxes you fetch and your IP address during
the connection, and can link together the deposits and the fetch of a single
connection. Your introduction mailbox is computed from your public key:
fetching it links your identity to this IP address.
```

Vous pouvez aussi faire tourner votre propre nœud et ouvrir sa base SQLite : chaque ligne de la table `packets` contient l’identifiant de paquet, la boîte, le type, le palier, l’expiration, la minute d’arrivée, un hachage, le nonce de la preuve de travail et les octets du paquet. Aucune colonne pour une adresse IP.

Barking est un prototype et n’a pas été audité. Cette liste est ce que ses auteurs savent. Si vous trouvez une fuite qui n’y est pas, lisez [`SECURITY.md`](https://github.com/NaKoCorp/Barking/blob/v0.4.0/SECURITY.md) et le modèle de menace de [Ne faites confiance à aucun nœud. Pas même aux nôtres.](/fr/blog/aucun-noeud-de-confiance/), puis signalez-la : dans une [issue GitHub](https://github.com/NaKoCorp/Barking/issues), ou en privé comme le décrit `SECURITY.md` si elle est sensible. Si Tor ou les mixnets sont votre domaine, ouvrez une issue sur l’intégration prévue : c’est le travail qui fermerait le premier point de la liste.
