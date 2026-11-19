---
title: Pourquoi nous construisons Barking
description: Une messagerie chiffrée de bout en bout, des relais que chacun peut lancer, sans serveur central ni numéro. Ce qui marche aujourd’hui, ce qui manque encore.
date: 2026-11-19
translationKey: why-barking
tags: [barking, manifesto]
barking: true
draft: false
---
Barking est une messagerie libre, chiffrée de bout en bout, dont les relais peuvent être lancés par n’importe qui. Pas de serveur central, pas de numéro de téléphone. C’est aussi un prototype que personne n’a encore audité. Cet article dit à quoi il sert, comment il est construit, et exactement ce qui marche aujourd’hui. Chaque fait ci-dessous a été vérifié dans le code de la release [v0.2.0](https://github.com/NaKoCorp/Barking/releases/tag/v0.2.0), la dernière au moment d’écrire.

## Une messagerie qui ne dépend de l’infrastructure de personne

Les messageries que la plupart des gens utilisent s’arrêtent quand une antenne tombe, quand un gouvernement coupe internet, ou quand l’entreprise qui les fait tourner ferme un serveur. Vos conversations vivent sur les machines de quelqu’un d’autre, et ce quelqu’un peut être débranché.

Barking vise deux situations avec le même logiciel : les jours ordinaires, quand vous voulez simplement parler à vos proches, et le jour où l’une de ces choses arrive. L’objectif de conception : aucun opérateur, NakoCorp compris, ne doit pouvoir bloquer vos messages ni les lire.

<p class="pull">Aucun opérateur, NakoCorp compris, ne doit pouvoir bloquer vos messages ni les lire.</p>

Le code n’y est pas encore : la suite trace la frontière entre les deux.

## À qui elle s’adresse

Le premier public, c’est quiconque veut une vraie alternative à Signal ou Telegram : pas de numéro de téléphone, pas de compte sur le serveur d’une entreprise, et un code source lisible.

Le second public, ce sont les personnes en situation de crise : coupure d’internet, catastrophe naturelle, manifestation surveillée. Pour elles, rester joignable et rester anonyme passent avant tout. Barking est conçu en pensant à elles, et c’est justement pour cela qu’elles ne doivent **pas** compter dessus aujourd’hui. Un logiciel destiné à ces situations doit d’abord passer un audit externe, et Barking ne l’a pas passé.

## Ce que Barking fait autrement

**Pas de serveur central.** Les messages passent par des relais. Un relais est un seul binaire, `barking-node`, que n’importe qui peut lancer sur un petit serveur. Les relais se trouvent entre eux grâce à une table de routage S/Kademlia et recopient chaque paquet sur les différents nœuds responsables de sa boîte aux lettres : un relais qui disparaît ne fait pas perdre vos messages.

**Aucun relais n’est digne de confiance, pas même ceux de NakoCorp.** Les messages sont chiffrés de bout en bout. L’identité de l’expéditeur n’est pas écrite sur le paquet : elle se trouve seulement dans le contenu chiffré, et le destinataire la découvre en déchiffrant. La boîte aux lettres à laquelle un paquet est adressé est un identifiant de 16 octets que seuls les deux correspondants savent calculer, et il [change chaque jour](https://github.com/NaKoCorp/Barking/blob/v0.2.0/crates/barking-core/src/mailbox.rs#L1-L2). Un relais garde des paquets scellés pour des boîtes aux lettres qu’il ne peut relier à aucun nom.

<figure>
{% diagram "message-path" %}
<figcaption>Scellé sur un appareil, recopié sur les relais responsables d’une boîte qui change chaque jour, ouvert sur l’autre.</figcaption>
</figure>

**Une identité est une clé, pas un numéro.** Votre identité est une clé racine Ed25519, dérivée d’une phrase de récupération de 24 mots. Elle peut certifier jusqu’à [huit appareils](https://github.com/NaKoCorp/Barking/blob/v0.2.0/crates/barking-core/src/identity/device_list.rs#L18).

**Un protocole maison, aucune cryptographie maison.** Barking ne s’appuie ni sur Nostr, ni sur libp2p, ni sur MLS : aucun des trois n’apparaît dans ses dépendances. Il utilise en revanche des bibliothèques reconnues pour chaque primitive (des crates RustCrypto comme `ml-kem` et `chacha20poly1305`, et les crates dalek pour X25519 et Ed25519). Une conversation commence par PQXDH, un accord de clés qui combine X25519 et ML-KEM-768, résistant aux ordinateurs quantiques, puis continue avec un Double Ratchet dont les en-têtes sont eux aussi chiffrés.

## Ce qui marche aujourd’hui

Le prototype actuel livre un client en ligne de commande, `barking`, et les relais. Concrètement, en v0.2.0 :

<div class="status-list is-done">

- messagerie chiffrée un à un depuis le CLI, avec cartes de contact, codes de sécurité et accusés de réception ;
- messages texte jusqu’à [4 000 octets UTF-8](https://github.com/NaKoCorp/Barking/blob/v0.2.0/crates/barking-core/src/envelope.rs#L29) ;
- une file d’envoi persistante ;
- une base locale SQLCipher, dont la clé est dérivée de votre phrase de passe par Argon2id ;
- jusqu’à huit appareils sur une même identité, liés par un échange de fichiers, avec transfert facultatif de l’historique chiffré ;
- deux transports : des fichiers `.pkt` que vous déplacez à la main (clé USB, e-mail, n’importe quoi), ou `barking sync`, qui envoie et reçoit par les relais ;
- des relais auto-hébergés qui gardent les paquets chiffrés, en QUIC, jusqu’à ce que le destinataire vienne les chercher ;
- un routage distribué : découverte S/Kademlia et réplication entre les nœuds responsables d’une boîte aux lettres ;
- une synchronisation pensée pour les mauvaises connexions, avec reprise des téléchargements et progression sauvegardée ;
- le côté serveur des réveils iOS : les relais préviennent `barking-push`, un relais sans état qui transmet des jetons scellés au service de notifications d’Apple.

</div>

Une première conversation, avec les commandes du Quick start du README en v0.2.0 (la synchronisation est manuelle pour l’instant) :

<div class="term">
<div class="term-bar"><i></i><i></i><i></i><span>barking · v0.2.0</span></div>

```sh
# créer une identité et exporter sa carte de contact
barking init --name laptop
barking card --display-name Alice

# ajouter un contact et un relais, puis écrire
barking add '<contact-card>' --alias bob
barking node add <IP:port> <node-id>
barking send bob 'Hello!' --out ./packets
barking sync
barking messages bob
```

</div>

Une app iOS est en cours dans le même dépôt, sous `apple/`. Elle n’est pas publiée, et ses versions de test ne sont pas publiques.

## Ce qui n’existe pas encore

Ces éléments sont prévus, pas construits :

<div class="status-list is-planned">

- des apps Android et iOS publiées ;
- des transports mesh : Bluetooth LE, Wi-Fi et LoRa (le format de paquet sait déjà se fragmenter pour les petites trames radio, mais aucun transport radio n’existe) ;
- les groupes et les pièces jointes ;
- Tor ou un mixnet, pour cacher votre adresse IP aux relais ;
- un audit de sécurité externe.

</div>

Des releases existent bien : v0.0.1 et v0.1.0 sont sorties le 13 novembre 2026, et [v0.2.0](https://github.com/NaKoCorp/Barking/releases/tag/v0.2.0) le 16 novembre. Une release veut seulement dire que les binaires ont été construits par la CI de GitHub et attestés par elle. Elle ne veut pas dire que le logiciel est prêt.

Il n’y a pas non plus de réseau public de relais. La [liste d’amorçage](https://github.com/NaKoCorp/Barking/blob/v0.2.0/crates/barking-dht/bootstrap.toml) intégrée au binaire est vide : pour envoyer quoi que ce soit, vous ajoutez d’abord un relais à la main, le vôtre ou celui d’un ami.

## Des limites honnêtes

L’avertissement du README tient en trois points :

<div class="status-list is-limit">

- **Pas d’audit.** Aucun cabinet externe n’a relu la cryptographie ni le code.
- **Les relais voient votre adresse IP.** Un relais sait quelle adresse dépose ou relève un paquet. La cacher demande Tor ou un mixnet, prévus mais pas faits.
- **Pas de réseau public de relais.** Il faut lancer un relais ou connaître quelqu’un qui en lance un.

</div>

N’utilisez pas encore Barking pour des communications sensibles. Utilisez-le pour essayer la conception, la mettre à l’épreuve et signaler ce que vous trouvez.

## Qui le construit

Barking est construit par une seule personne, Paul ([HoaMi sur GitHub](https://github.com/HoaMi)), tech lead SRE et DevSecOps, sous le nom NakoCorp. Avec un seul auteur, chaque relecteur compte : le code est public sous licence AGPL-3.0-only, lisez-le plutôt que de croire cet article sur parole.

Il reste une dépendance à NakoCorp pour l’instant. Apple n’accepte que les réveils signés avec la clé de l’éditeur de l’app : NakoCorp est donc le seul opérateur du relais de notifications pour son app iOS.

## Où il va

<figure>
{% diagram "roadmap" %}
<figcaption>Déjà construit, ensuite, plus tard. Aucune date.</figcaption>
</figure>

L’ordre est fixé, les dates ne le sont pas. D’abord les apps mobiles : iOS, puis Android. Ensuite le mesh, pour que les téléphones se passent les messages sans internet : Bluetooth LE avec des passerelles, Wi-Fi Aware, et LoRa par de petites stations sur Raspberry Pi. Enfin les groupes, les médias, et l’audit externe, qui doit venir avant que quiconque en situation de crise compte sur Barking.

## Comment vous pouvez aider

- **Essayer le CLI.** Compilez-le et envoyez vos premiers messages avec le [Quick start](https://github.com/NaKoCorp/Barking/blob/v0.2.0/README.md#-quick-start) du README (en anglais).
- **Lancer un relais.** Un seul binaire, avec Docker ou systemd : voir [Run a relay](https://github.com/NaKoCorp/Barking/blob/v0.2.0/README.md#-run-a-relay).
- **Relire la cryptographie.** Si vous trouvez une faille, signalez-la en privé comme l’explique [SECURITY.md](https://github.com/NaKoCorp/Barking/blob/v0.2.0/SECURITY.md).
- **Sponsoriser NakoCorp** sur [GitHub Sponsors](https://github.com/sponsors/NaKoCorp).

Commencez par mettre une étoile au [dépôt](https://github.com/NaKoCorp/Barking) et par le suivre : c’est là qu’apparaîtra chaque release.
