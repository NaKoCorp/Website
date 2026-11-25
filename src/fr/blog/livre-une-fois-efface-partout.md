---
title: Livré une fois, effacé partout
description: "Un accusé Barking est un secret de 16 octets révélé : chaque relais vérifie son hash et efface sa copie, sans savoir qui a accusé réception."
date: 2026-11-26
translationKey: delivered-once
tags: [barking, protocol, privacy]
barking: true
draft: false
---
Dans la plupart des messageries, un accusé de réception est une coche. Le serveur qui a relayé le message sait déjà qui l’a envoyé et qui l’a reçu : il peut dire « distribué » à l’expéditeur et garder tout le reste pour lui, copies comprises.

Barking n’a pas de tel serveur. Un message attend sur des relais qui peuvent être hostiles, comme l’explique [Ne faites confiance à aucun nœud. Pas même aux nôtres.](/fr/blog/aucun-noeud-de-confiance/), et aucun d’eux ne sait qui l’a écrit ni à qui il est destiné. L’accusé a donc deux rôles : dire à l’expéditeur que le message est arrivé, et dire à chaque relais qui en garde une copie de l’effacer. Chaque relais doit pouvoir le vérifier seul, et aucun ne doit apprendre qui l’a envoyé.

Le mécanisme tient en trois lignes : un secret, un hash, une publication. Chaque valeur ci-dessous vient du dépôt Barking à la version [v0.6.0](https://github.com/NaKoCorp/Barking/tree/v0.6.0) (commit `cc8f623`).

## Un accusé qui efface

En une phrase : l’identifiant d’un paquet Barking est le hash d’un secret caché dans son contenu chiffré ; pour accuser réception, le destinataire publie ce secret, et chaque relais qui garde une copie vérifie le hash et efface le paquet, sans apprendre qui a accusé.

<figure>
{% diagram "receipt-erases" %}
<figcaption>Un accusé, cinq détenteurs. Le nœud où il arrive efface sa copie aussitôt ; les autres l’apprennent de ce nœud.</figcaption>
</figure>

Sans accusé, le paquet disparaît quand même de lui-même : il expire 7 jours après avoir été scellé.

## L’astuce : l’identifiant est le hash d’un secret

Quand Barking envoie un message, il scelle un paquet par appareil destinataire. Pour chacun, il tire un [secret aléatoire de 16 octets](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-packet/src/ack.rs#L11-L17) et le place dans l’enveloppe chiffrée, à côté de l’horodatage, de l’identifiant du message et du corps. L’identifiant du paquet, en clair dans l’en-tête, est [dérivé de ce secret](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-packet/src/ack.rs#L19-L25) :

```rust
pub fn packet_id_for(secret: &[u8; 16]) -> PacketId {
    let full = blake3::derive_key(labels::ACK_CONTEXT, secret);
    let mut id = [0u8; 16];
    id.copy_from_slice(&full[..16]);
    PacketId(id)
}
```

`ACK_CONTEXT` vaut la chaîne `"barking/v0/ack"` : le hash est donc BLAKE3 en mode dérivation de clé, coupé à 16 octets. Un relais voit l’identifiant ; seul quelqu’un qui a déchiffré le paquet connaît le secret.

Le destinataire vérifie le lien dès qu’il déchiffre. Si l’identifiant de l’en-tête ne correspond pas au secret de l’enveloppe, le paquet est [rejeté](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-core/src/core/receive.rs#L1264-L1272) pour « identifiant de paquet incohérent ». Un expéditeur ne peut pas fournir un identifiant que son propre accusé n’ouvrirait pas.

## Publier le secret

L’accusé est un paquet à part entière, du plus petit palier (S, 245 octets sur le réseau). Sa charge fait [32 octets](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-packet/src/ack.rs#L40-L62) : l’identifiant du paquet accusé, puis le secret. Il est déposé dans la boîte aux lettres du message qu’il accuse. Les nœuds qui gardent le message relèvent et servent déjà cette boîte, et l’expéditeur la relève tant qu’il attend. Répondre dans une autre boîte relierait les deux sens de la conversation, comme le décrit [Cacher qui parle à qui](/fr/blog/cacher-qui-parle-a-qui/). Un accusé ne demande pas de preuve de travail ; un message, si.

Pourquoi pas une signature ? Une signature dit qui a signé. Pour la vérifier, un relais aurait besoin d’une clé publique, et cette clé rattacherait l’accusé à un appareil. Le secret révélé ne prouve qu’une chose : quelqu’un a déchiffré ce paquet. C’est tout ce qu’un relais doit savoir pour l’effacer.

Cela suffit aussi à arrêter un relais menteur. Pour annoncer une livraison qui n’a pas eu lieu, un relais devrait produire un secret dont le hash vaut l’identifiant du paquet, c’est-à-dire inverser BLAKE3. Il peut jeter un accusé, ou garder une copie qu’on lui a dit d’effacer. Il ne peut pas en forger un.

L’accusé dit « un appareil a reçu et déchiffré ce paquet ». Barking n’a pas d’état « lu ».

## Ce qu’en fait un relais

Un relais qui reçoit un accusé exécute [`deposit_ack`](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-node/src/rules.rs#L286-L347). En voici le cœur :

```rust
if n == 0 || !boxes.iter().any(|m| m[..] == p.mailbox.0) || !ack::verify(&target, &sec) {
    return Ok(Err(ErrorReason::UnknownAckTarget));
}
let delta = i(bytes.len() as u64) * i(boxes.len() as u64) - old_len;
if delta > 0 && stored_bytes(&tx)?.saturating_add(delta as u64) > policy.storage_max_bytes {
    return Ok(Err(ErrorReason::NodeFull));
}
tx.execute("DELETE FROM packets WHERE id=?1", params![&target.0[..]])?;
let keep = i64::from(p.expires_at).max(max_exp);
for m in &boxes {
    tx.execute(
        "INSERT INTO acks(packet_id,mailbox,expires_at,bytes) VALUES(?1,?2,?3,?4)",
        params![&target.0[..], m, keep, bytes],
    )?;
}
```

Dans l’ordre :

1. **Vérifier.** Le nœud doit garder un paquet de cet identifiant, l’accusé doit se trouver dans l’une des boîtes de ce paquet, et le hash du secret doit valoir l’identifiant. La comparaison se fait [en temps constant](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-packet/src/ack.rs#L27-L38), pour que l’identifiant ne serve pas d’oracle. Si un contrôle échoue, la réponse est `UnknownAckTarget`. L’appareil qui reçoit cette réponse réessaie une heure plus tard : l’accusé est peut-être arrivé avant son paquet.
2. **Effacer.** Toutes les lignes de cet identifiant partent, dans une seule transaction.
3. **Garder l’accusé.** Il est rangé dans chaque boîte qui contenait le paquet, jusqu’à la plus tardive de sa propre expiration et de celle du paquet effacé.

Garder l’accusé sert à deux choses. Un autre appareil de l’expéditeur, ou un autre nœud, peut encore l’apprendre. Et un message redéposé après son accusé est [accepté sans effet](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-node/src/rules.rs#L236-L244) : le nœud voit l’accusé et ne stocke rien, donc une copie en retard ne peut pas ressusciter le message. Un accusé que le nœud connaît déjà est lui aussi accepté sans effet.

## Effacé partout

Un seul relais ne suffit pas. Un message vit sur les cinq nœuds les plus proches de son identifiant de boîte, comme le décrit [Une messagerie sans serveur central](/fr/blog/sans-serveur-central/) : l’appareil de l’expéditeur en dépose [jusqu’à trois copies](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-net/src/plan.rs#L18-L21), et les nœuds le recopient chez les autres responsables. L’accusé, lui, est déposé sur un seul nœud.

Ce nœud efface sa copie aussitôt. Les autres l’apprennent par la recopie : toutes les heures, chaque nœud envoie ses boîtes aux autres nœuds responsables, et le [module qui s’en charge](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-node/src/dht/replicate.rs#L1-L12) envoie ce qui manque **en commençant par les accusés**. Un accusé qui arrive ainsi passe par le même `deposit_ack` et efface la copie là aussi. Quand un nouveau nœud entre parmi les cinq plus proches d’une boîte, cette boîte est recopiée une minute plus tard au lieu d’attendre l’heure suivante.

Un test réseau, [`ack_on_one_clears_all_five`](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-node/tests/dht.rs#L651-L677), démarre huit nœuds, dépose un message sur trois d’entre eux, attend que les cinq responsables le gardent, dépose l’accusé sur le cinquième seulement, puis attend qu’aucun des cinq ne serve plus le message.

Donc, honnêtement : effacé tout de suite là où l’accusé arrive, et en temps normal à la passe horaire suivante partout ailleurs. La recopie a des limites par passe et par heure, donc un nœud chargé peut prendre plus de temps. Un nœud qui gardait la copie mais ne fait plus partie des cinq plus proches ne reçoit pas l’accusé par la recopie ; sa copie reste jusqu’à son expiration.

## Et quand personne ne répond

Un destinataire dont le téléphone reste éteint n’accuse rien. Le paquet vit alors toute sa durée :

- Barking scelle chaque paquet pour qu’il expire **7 jours** après l’envoi, [arrondi vers le bas à 10 minutes](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-core/src/envelope.rs#L360-L372). Les accusés suivent le même arrondi.
- Un nœud refuse tout paquet qui expire [plus de 7 jours et une heure](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-node/src/rules.rs#L40-L42) après sa propre horloge (`TooFarInFuture`). L’heure en plus absorbe le décalage des horloges.
- Toutes les [60 secondes](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-node/src/server.rs#L96), le nœud purge les paquets expirés, 2 000 à la fois. Un accusé reste [24 heures de plus](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-packet/src/lib.rs#L25-L29) après l’expiration pour laquelle il était gardé, pour qu’un téléphone d’expéditeur qui synchronise un jour trop tard le trouve encore.

<figure>
{% diagram "receipt-lifetimes" %}
<figcaption>Deux vies du même message. Avec un accusé, les copies partent en quelques heures ; sans accusé, elles restent jusqu’au jour 7.</figcaption>
</figure>

Côté expéditeur, un message sans accusé au bout de [6 heures](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-net/src/plan.rs#L21) est redéposé chez des responsables qui ne l’ont pas encore. Quand le paquet expire, l’app ne passe pas tout de suite à « non distribué ». Elle attend deux heures après l’expiration, puis interroge chaque nœud qui a accepté le paquet et chaque responsable actuel de sa boîte. Seulement si tous répondent en entier, sans le paquet ni son accusé, le message devient [non distribué](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-core/src/core/delivery.rs#L254-L287). Si l’un d’eux est injoignable, le message reste « sur le réseau ». Sur iOS, l’arrivée d’un accusé et l’expiration d’un paquet réveillent toutes deux l’iPhone de l’expéditeur par un push silencieux, si les notifications instantanées sont activées.

La durée de vie a bougé deux fois. Le premier protocole gardait les paquets 7 jours ; le protocole 2 l’a ramenée à 24 heures ([PR #33](https://github.com/NaKoCorp/Barking/pull/33)) ; le protocole 4 l’a remise à 7 jours ([PR #70](https://github.com/NaKoCorp/Barking/pull/70)), pour qu’un paquet scellé hors ligne et déposé des jours plus tard soit encore lu. La constante client `DEFAULT_TTL_SECS` sert d’interrupteur, et ce qu’accepte un nœud de protocole 4 est fixé indépendamment d’elle. Sept jours, c’est long pour une copie sans accusé posée sur un relais. C’est l’accusé qui la raccourcit dans le cas courant.

## Aujourd’hui et demain

Ce qui est livré aujourd’hui : l’accusé efface les copies sur les relais internet, et dit aux appareils de l’expéditeur que le message est arrivé.

Ce qui est prévu : Barking transportera aussi les messages de téléphone en téléphone, par Bluetooth et Wi-Fi, sans internet. Là, l’accusé voyagera de la même façon et effacera les copies encore en transit, et un message déjà livré par ce mesh ne partira pas sur internet. Rien de tout cela n’est encore construit.

Une limite vaut dans les deux cas. L’effacement est une hygiène des relais honnêtes, pas une garantie contre un relais hostile. Un nœud modifié peut ignorer l’accusé et garder sa copie. Il ne peut toujours pas la lire, et la copie expire ; mais « effacé partout » veut dire chez chaque relais qui fait tourner le code de Barking, pas sur chaque machine qui a vu passer le paquet. Le modèle de menace de [Ne faites confiance à aucun nœud. Pas même aux nôtres.](/fr/blog/aucun-noeud-de-confiance/) part exactement de là.

## Essayez de le casser

Tout le mécanisme tient en deux courts morceaux de code : [`ack.rs`](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-packet/src/ack.rs) et [`deposit_ack`](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-node/src/rules.rs#L286-L347). Lisez-les, puis essayez de faire effacer un paquet par un nœud sans connaître son secret, ou de faire croire à un expéditeur qu’un message est arrivé alors qu’il ne l’est pas. Barking est un prototype et n’a pas été audité. Si vous trouvez un moyen, signalez-le comme l’explique [`SECURITY.md`](https://github.com/NaKoCorp/Barking/blob/v0.6.0/SECURITY.md).
