---
title: Vous êtes une clé, pas un numéro de téléphone
description: "Dans Barking, votre identité est une clé racine sauvegardée en 24 mots. Elle signe la liste de vos 8 appareils au plus : ni numéro, ni serveur de comptes."
date: 2026-11-23
translationKey: key-not-phone-number
tags: [barking, identity, security, multi-device]
barking: true
draft: false
---
La plupart des messageries vous connaissent par votre numéro de téléphone. Ce numéro appartient à un opérateur, qui peut le réattribuer quand vous partez, ou le confier à quiconque obtient une nouvelle carte SIM en boutique à votre place. Il fait aussi de votre carnet d’adresses une carte : téléversez-le, et le service apprend qui connaît qui.

Barking n’a ni numéro de téléphone, ni adresse e-mail, ni serveur d’inscription. `barking init` crée votre identité sur votre propre appareil, et rien n’en sort. Cet article suit cette identité au long de sa vie, dans l’ordre où vous la vivriez : vous la créez, vous la montrez à quelqu’un, vous ajoutez un ordinateur, vous passez le rôle principal à un autre appareil, vous perdez un téléphone, vous perdez tout. À chaque étape : ce qui est signé, par quelle clé, et ce que vous perdez.

Chaque chiffre ci-dessous vient du dépôt Barking au commit [`4fe359d`](https://github.com/NaKoCorp/Barking/commit/4fe359d07fe5caa05594766477e6d7e5291dc403).

## Ni numéro, ni serveur de comptes

En une phrase : votre identité est une clé racine Ed25519 créée sur votre appareil et sauvegardée en 24 mots ; elle signe la liste de vos appareils (8 au plus, chacun avec sa propre clé), et c’est cette liste signée, pas un serveur de comptes, qui dit à vos contacts pour quels appareils chiffrer.

Il n’y a pas d’annuaire où l’on vous cherche. On vous ajoute parce que vous avez donné votre carte de contact, et on sait que c’est vous parce qu’on a comparé un code avec vous. La suite de l’article, c’est le détail.

## Une clé racine, 24 mots

À la création, Barking tire [32 octets d’entropie](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/identity/root.rs#L49-L68), les écrit sous forme d’une phrase BIP39 de 24 mots anglais, et en dérive la clé racine Ed25519 avec HKDF. Les mots sont la clé sous une autre forme : qui les a, a votre identité.

Ce que vous partagez, c’est l’empreinte, un hachage BLAKE3 de la clé publique racine, [affiché en base32](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/identity/root.rs#L130-L152) en 13 groupes de 4 caractères.

La clé racine elle-même vit dans la base chiffrée (SQLCipher) de votre premier appareil. Dans le client en ligne de commande, la clé de cette base vient de votre phrase de passe via [Argon2id](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-cli/src/passphrase.rs#L7-L9) (64 Mio, 3 passes). Dans l’app iOS, encore en développement, une clé gardée dans le Secure Enclave [enveloppe la clé de la base](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/apple/BarkingKit/EnclaveKey.swift#L5). Pour être exact : la racine Ed25519 n’est pas dans le Secure Enclave. Elle est dans la base que l’enclave aide à verrouiller.

Le [tutoriel du premier message](/fr/blog/premier-message-barking/) montre `barking init` et sa sortie.

## Une clé par appareil, une liste signée

La clé racine ne sert pas à discuter. Chaque appareil génère sa propre paire, Ed25519 pour signer et X25519 pour l’accord de clés, qui ne le quitte jamais. La racine signe pour lui un certificat (clé publique, un nom de [64 octets au plus](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/identity/device.rs#L13), une date), une fois que l’appareil a prouvé qu’il détient la moitié privée.

Les certificats forment une liste, signée par la racine et versionnée. Le code pose la règle en [deux lignes](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/identity/device_list.rs#L1-L2) : une liste plus récente sans un appareil révoque cet appareil. `init` signe la première liste avec l’heure courante comme version ; chaque liaison ou retrait ajoute un.

La liste contient [8 appareils au plus](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/identity/device_list.rs#L12-L18). La raison tient à la taille, pas à une politique : avec 8 appareils et les noms les plus longs, le message le plus lourd qui transporte votre carte tient encore dans un seul paquet de 16 Kio, et un test le mesure.

<figure>
{% diagram "key-tree" %}
<figcaption>La liste part dans les cartes que gardent vos contacts. Elle ne va jamais vers les relais.</figcaption>
</figure>

Quand quelqu’un vous écrit, son client chiffre le message une fois pour chaque appareil de votre liste. Quand vous envoyez depuis votre téléphone, Barking copie aussi le message vers vos autres appareils, et votre ordinateur affiche toute la conversation.

Comme l’explique [Ne faites confiance à aucun nœud](/fr/blog/aucun-noeud-de-confiance/), les relais ne voient jamais cette liste. Elle circule de bout en bout, dans les cartes et les messages de synchronisation.

## Montrer sa clé à quelqu’un

Votre carte de contact est une ligne de texte qui commence par [`barking1:`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/contact.rs#L14-L30). Elle contient votre nom affiché, votre liste d’appareils signée, les clés publiques dont chaque appareil a besoin pour ouvrir une session, et jusqu’à 3 fiches de relais. La racine signe la carte entière, qui reste sous 16 Kio. Elle ne contient ni numéro, ni adresse.

Une carte prouve que ses clés vont ensemble. Elle ne prouve pas qu’elle vient de vous. Pour cela, `barking safety alice` affiche un code de sécurité : 12 groupes de 5 chiffres, [calculés à partir des deux empreintes](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/identity/safety.rs#L1-L26) et identiques des deux côtés. Comparez-le en personne ou lors d’un appel de confiance, puis marquez le contact avec `--verified`.

Si un alias que vous connaissez revient plus tard avec une autre clé, Barking ne bascule pas en silence. Il écrit un [avertissement dans le journal](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/transparency.rs#L365) (« the key of alice has changed »), avec l’ancienne et la nouvelle empreinte, et vous demande de vérifier le code à nouveau.

## Ajouter un ordinateur

La liaison se fait en quatre temps, et le client en ligne de commande a une commande pour chacun. Voici une exécution réelle avec deux dossiers `--home`, l’un pour le téléphone (qui porte la racine), l’autre pour le nouvel ordinateur. Elle a tourné sur la release v0.2.0 ; le code de liaison est le même au commit `4fe359d`.

```text
$ barking --home phone link offer --out offer.txt
Link offer written: offer.txt
It is valid for 10 minutes and can be used only once.
Hand this file to the new device over a channel you control.

$ barking --home laptop link request --offer offer.txt --name laptop --out request.txt
Link request written: request.txt
Hand it to the admin device (`barking link accept`).
Delete the offer file now: offer.txt

$ barking --home phone link accept --request request.txt --out bundle.barkinglink --history history.bin --packets out
Device linked: laptop
Link bundle written: bundle.barkinglink
History written: history.bin
out/bac633eb….pkt

$ barking --home laptop link finish --bundle bundle.barkinglink --history history.bin
Link completed.
Fingerprint: <same fingerprint as the phone>
Delete the link files now: the offer, the link bundle and the history. They are no longer needed, and the bundle and the history contain your contacts and your messages.
```

Ce qui se passe dessous :

1. **Offre.** L’appareil administrateur tire un secret aléatoire, valable [10 minutes](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/link.rs#L74) et à usage unique. Un second `accept` avec la même offre échoue avec « offer missing or already used ».
2. **Demande.** Le nouvel appareil crée ses propres clés et envoie sa clé publique, protégée par un MAC HMAC-SHA256 dérivé de ce secret.
3. **Paquet de liaison.** L’appareil administrateur signe une nouvelle liste à la version + 1 et écrit un paquet de liaison chiffré avec XChaCha20-Poly1305 et signé par la racine. Il emporte un instantané de vos contacts. Avec `--history`, votre historique suit en [morceaux chiffrés de 64 Kio](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/history.rs#L59), signés eux aussi.
4. **Fin.** L’ordinateur vérifie les signatures et rejoint l’identité. Il affiche la même empreinte que le téléphone.

<figure>
{% diagram "device-linking" %}
<figcaption>Quatre messages, tous portés à la main. C’est le secret de l’offre qui rattache la demande à vous.</figcaption>
</figure>

Rien de tout cela ne passe par un relais. Dans le client en ligne de commande, les étapes sont des fichiers. Dans l’app iOS, l’offre et la demande sont des [QR codes ou des fichiers](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-ffi/src/link.rs#L1-L2), et le paquet de liaison est un seul fichier `.barkinglink`.

Le fichier `.pkt` qu’écrit `accept` est le moment où le réseau revient. Il contient des messages `CardUpdate` pour vos contacts, afin que leurs clients chiffrent aussi pour l’ordinateur. Dans l’exécution ci-dessus, le journal de Bob disait ensuite « alice updated their device list (+1, −0) ». Vos autres appareils reçoivent la nouvelle liste sous forme de `SyncDevices`.

L’ordinateur ne reçoit pas la racine. Demandez-lui une carte et il répond « This device does not hold the root key ». Il peut lire et envoyer, mais il ne peut ni lier un autre appareil, ni signer une nouvelle liste.

## Passer le rôle d’administrateur

L’appareil qui porte la racine est l’appareil administrateur. Vous pouvez déplacer ce rôle, par exemple vers le nouveau téléphone qui remplace l’ancien. Dans l’app iOS, le bouton s’appelle « Rendre administrateur ».

Le transfert envoie la racine, chiffrée par la session existante, à un seul de vos appareils. L’ancien administrateur [garde sa copie](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/admin.rs#L1-L13) jusqu’à ce que la cible accuse réception du paquet, puis l’efface. D’ici là, ni liaison, ni second transfert. Si aucun accusé ne revient avant l’expiration du paquet, 7 jours après le scellement, le transfert est annulé et l’ancien administrateur garde la racine. Si le paquet est arrivé et que seul son accusé s’est perdu, les deux appareils détiennent la racine.

Il n’y a volontairement pas de second administrateur qui garderait une copie de secours. Chaque copie de la racine est un appareil de plus dont le vol livre toute l’identité.

Le transfert existe dans le cœur Rust et dans l’app iOS, qui n’est pas publiée. Le client en ligne de commande n’a pas de commande pour cela.

## Perdre un téléphone

Pour retirer un appareil, l’administrateur signe une nouvelle liste à la version + 1 [sans lui](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/remove.rs#L1-L15). Vos autres appareils la reçoivent sous forme de `SyncDevices`, et vos contacts sous forme de `CardUpdate` : ils cessent de chiffrer pour cet appareil et suppriment leurs sessions avec lui.

L’appareil retiré est prévenu aussi, s’il est encore en ligne. Il [efface alors sa racine](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/removed.rs#L1-L11) s’il en avait une, et ne peut plus envoyer. Il peut encore lire, y compris l’historique déjà stocké chez lui : le retrait protège l’avenir, pas le passé.

Un appareil lié peut aussi partir de lui-même, en demandant à l’administrateur de le retirer.

Comme le transfert, le retrait se trouve dans le cœur et dans l’app iOS non publiée, pas dans le client en ligne de commande.

Le cas difficile, c’est la perte de l’appareil administrateur lui-même. La racine est dessus, protégée seulement par la clé de sa base. Personne d’autre ne peut signer une liste pour le retirer. La réponse, ce sont les 24 mots.

## Tout perdre : les 24 mots

`barking recover --name <appareil>` lit la phrase sur l’entrée standard et reconstruit la racine. Barking signe alors une nouvelle liste qui ne contient que le nouvel appareil. Sa version est l’heure courante : elle est donc plus récente que toute liste issue d’une liaison, et elle remplace l’ancienne partout où elle arrive.

Les anciens appareils l’apprennent de deux façons : un contact qui accepte votre nouvelle carte la leur relaie, ou un ancien appareil qui l’apprend la transmet aux autres. Chacun note alors son retrait et efface sa racine. Les 24 mots reprennent l’identité.

La récupération rend l’identité, pas le reste. La commande le dit clairement :

```text
Identity recovered.
Contacts are not restored: add them again.
```

Vos contacts et votre historique ne sont pas restaurés. Vous ajoutez à nouveau vos contacts, et ils voient votre nouvelle carte. Gardez la phrase hors ligne : elle vaut toute l’identité, et c’est la seule copie qui ne se trouve sur aucun appareil.

## Ce qui manque encore

Barking est un prototype et n’a pas été audité. Sur l’identité en particulier :

- **Pas de sauvegarde par passkey.** Elle est prévue. Les 24 mots sont aujourd’hui le seul retour possible.
- **Pas de sauvegarde chiffrée des contacts.** Une récupération repart d’un carnet vide.
- **L’appareil administrateur porte toute l’identité.** Volez-le, cassez la clé de sa base, et vous avez la racine.
- **Un trou pendant la liaison.** Un contact qui écrit avant d’avoir reçu votre nouvelle carte chiffre pour l’ancienne liste : ce message n’atteint pas le nouvel appareil.
- **Le retrait et le transfert ne sont pas dans le client en ligne de commande.** Ils existent dans le cœur et dans une app iOS qui n’est pas publiée.

Pour voir la liaison de vos yeux, préparez deux dossiers comme dans le [tutoriel du premier message](/fr/blog/premier-message-barking/), puis lancez `barking link offer`, `request`, `accept` et `finish` entre eux. Si quelque chose vous surprend, [ouvrez une issue](https://github.com/NaKoCorp/Barking/issues).

Le code du rôle d’administrateur et du retrait est court et commenté : [`admin.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/admin.rs) et [`remove.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/remove.rs).
