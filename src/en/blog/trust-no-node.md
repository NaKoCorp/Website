---
title: Trust no node. Not even ours.
description: Barking assumes every relay is hostile, ours included. What a relay sees, what it can do and what it cannot do, each with its mechanism.
date: 2026-11-22
translationKey: trust-no-node
tags: [barking, security, threat-model]
barking: true
draft: false
---
Barking does not ask you to trust its relays. It assumes each one is hostile, including the ones NakoCorp would run, and is built so that this does not matter for what you write. It does matter for other things, and this article lists them. Three questions, no adjectives: what a relay sees, what it cannot do, and what it can.

## Assume every relay is hostile

In one sentence: a hostile Barking relay cannot read, forge or fake the delivery of a message; it can see metadata (your IP address, the mailboxes you fetch, the size and time of packets) and it can lose or delay packets, which replication, receipts and a local score make up for without making it impossible.

In an open network, you cannot know what code a stranger runs. The relay's official code [writes no IP address](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-node/src/logging.rs#L1-L27) to its logs or its database, and a [test](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-node/tests/cli.rs#L261-L262) checks it. That protects you from nothing if the operator patched the binary. So the hypothesis here is the worst one: the operator modified the code, logs everything it receives, and works with other relays.

Cooperation matters. One relay sees a slice of the traffic: the mailboxes it is responsible for, the clients that connect to it. Several relays run by the same person see several slices and can put them side by side. The question is therefore never "what does this relay know" but "what do all the relays an attacker controls know together". Everything that follows holds under that reading.

Every number below comes from the Barking repository at commit [`4fe359d`](https://github.com/NaKoCorp/Barking/commit/4fe359d07fe5caa05594766477e6d7e5291dc403), protocol 4. If relays, mailboxes and responsibles are new to you, [A messenger without a central server](/en/blog/no-central-server/) explains them first.

## What a relay sees

A Barking packet has a clear header of [40 bytes](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-packet/src/lib.rs#L17-L18), plus 2 for the payload length. A relay needs it to store and route the packet, so it [reads](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-packet/src/header.rs#L1-L4):

- the format version;
- the type: message or acknowledgement;
- the hops left;
- a 16-byte packet identifier;
- the expiry, set 7 days after sealing and [rounded down to 10 minutes](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/envelope.rs#L312-L326), so the relay does not learn the second you sealed it;
- the 16-byte mailbox;
- the size tier.

There are only [three sizes](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-packet/src/lib.rs#L47-L55): 245, 1,024 and 16,384 bytes. The rest is padding, and a relay [refuses](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-node/src/rules.rs#L89-L95) a packet whose length is not exactly its tier. Everything else is encrypted, including who sent it.

The connection reveals more than the packet. A relay sees the client's IP address while it is connected, the packets it deposits, the mailboxes it fetches, and when. Barking says so itself. Here is the transparency log of a real exchange (`barking log`, built from `4fe359d`, packets exchanged as files as in the [first-message tutorial](/en/blog/first-barking-message/)):

```text
Encrypted packet of 16384 bytes (large tier), expires on 2026-11-28 23:20 UTC. First message of a session: the introduction mailbox is computed from the public keys (signing and key agreement) of the recipient device and the day. Relays see: the size, the type (message or acknowledgement), the hop count, a packet identifier, the mailbox, the expiry. They see neither who you are nor the content. But anyone who has the recipient's contact card can tell that this is a first message for that person.
```

When a packet goes through a relay, the log says the rest: the node [sees](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/transparency.rs#L413-L420) "the mailbox, the size, the time and your IP address; not the content."

Note what "the time" means here. The official relay stores the arrival of a packet [rounded to the minute](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-node/src/rules.rs#L265-L273). A hostile one keeps the exact second, and so does any observer on the network path. The rounding of the expiry hides when you sealed a packet, not when you sent it.

<figure>
{% diagram "relay-view" %}
<figcaption>Two layers are visible to the relay. The third opens only on the recipient's devices.</figcaption>
</figure>

## What a relay cannot do

Each line names the attack, the mechanism that stops it and the code that implements it.

| A relay cannot… | Because | Code |
|---|---|---|
| read a message | the session starts with PQXDH (X25519 + ML-KEM-768), then runs a Double Ratchet with encrypted headers; the relay holds no key | [`pqxdh.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/handshake/pqxdh.rs#L1-L17), [`ratchet/mod.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/ratchet/mod.rs#L1-L7) |
| learn who sends | the sender is only inside the encrypted content; the initial message is itself sealed, so relays never see the sender's identity key | [`envelope.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/envelope.rs#L1-L7) |
| modify or forge a message | encryption is authenticated; a packet that does not open is quarantined and never shown | [`receive.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/receive.rs#L478-L503) |
| replay an old message | message identifiers already seen are ignored (and still acknowledged); the authenticated timestamp must be at most 8 days old and 1 day ahead | [`core/mod.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/mod.rs#L125-L133), [`receive.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/receive.rs#L237-L247) |
| fake a delivery | a packet's identifier is derived from a secret only the recipient holds; the relay checks a receipt against it without learning who sends it | [`ack.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-packet/src/ack.rs#L19-L38) |
| impersonate another relay | the client pins TLS on the relay's identifier, derived from its Ed25519 key with a 20-bit puzzle, with no certificate authority | [`node_id.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-proto/src/node_id.rs#L1-L28), [`tls.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-proto/src/tls.rs#L1-L15) |
| slip a fake device into a contact | the device list is signed by the root key and versioned, holds 8 devices at most, and travels end to end in contact cards, not through relays | [`device_list.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/identity/device_list.rs#L1-L27), [`remove.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/remove.rs#L1-L15) |

Three lines deserve a closer look.

**Replay is bounded by an authenticated clock.** The timestamp a relay could want to lie about is inside the sealed content, so changing it breaks the packet. A copy kept and redeposited later is either already in the recipient's list of seen identifiers, or older than 8 days and refused. That list is kept [longer](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/mod.rs#L130-L133) than the window itself, so purging it does not reopen the door.

**Forgery costs the forger, not you.** A garbage packet deposited in your mailbox costs your device a few header decryption attempts. It fails, goes to quarantine with a [fixed reason](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/receive.rs#L28-L39), and changes no session state.

**A receipt proves delivery without naming anyone.** The packet identifier is derived with BLAKE3 from a secret, under the context `barking/v0/ack`, and cut to 16 bytes. The secret is sealed inside the content, so only the recipient can read it. To acknowledge, the recipient reveals the secret; any relay can derive the identifier again and compare it, in constant time, with the one it stores. A relay [refuses](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-node/src/rules.rs#L324-L338) a receipt for a packet it does not hold. It cannot mint a receipt for a packet it was asked to deliver, because it never had the secret.

An old relay cannot drag a client back to an old protocol either: the client [does not speak](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-proto/src/client.rs#L54-L55) anything older than version 2. The current version is [4](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-proto/src/lib.rs#L20-L43), the one that brought the 7-day lifetime. A relay still on version 3 accepts no packet expiring more than 25 hours ahead, so a 7-day packet does not go to it.

## What a relay can do

This list is as long as it needs to be. Each point says what limits it today.

- **Lose or delay a packet.** Each mailbox has [5 responsibles](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-dht/src/lib.rs#L21-L24); the client deposits up to 3 copies, relays [replicate every hour](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-node/src/dht/replicate.rs#L57-L58), the client resends after [6 hours](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-net/src/plan.rs#L18-L21) without a receipt, and a local [reliability score](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-net/src/score.rs#L1-L26) sets aside relays that lose messages. Limit: a relay is caught only after a loss.
- **Answer "nothing here".** A mailbox read in full from one responsible is read again from another one, at most [every 6 hours](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-net/src/sync.rs#L216-L223). Limit: the same, after the fact.
- **Link your connections.** A responsible sees the IP that deposits into a mailbox and the IP that fetches from it, and can link the two. A receipt reuses its message's mailbox and identifier, so a relay links a message to its receipt; the transparency log says it in plain words. No real identity comes out of it, but the pattern does.
- **Link your identity to your IP.** Your introduction mailbox is [computed](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-packet/src/lib.rs#L88-L102) from your device's public keys and the day. Whoever has your contact card can compute it, and a responsible that sees you fetch it knows that this IP is you.
- **Recognise a first message.** For the same reason, anyone with the recipient's card knows that a first message is arriving for that person. The log quoted above says exactly that.
- **Flood an introduction mailbox.** Anyone can fill it by paying the deposit's [proof of work](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-proto/src/pow.rs#L26-L61) (18 bits by default, more for larger tiers and fuller mailboxes). That delays first contacts. Contact tokens that would stop it are planned, not built.
- **Sit near an introduction mailbox.** On a small network, a few minutes of computing (the 20-bit puzzle, plus a key close to the mailbox) are enough to become one of its responsibles and delay first contacts.
- **Lie in the hash table.** Lookups run on [3 disjoint paths](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-dht/src/lib.rs#L15-L34), keep at most 2 nodes per /24 or /48 block, and accept only [signed records](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-proto/src/record.rs#L1-L15). Limit: an attacker with many distinct address blocks is bounded only by the puzzle. Surrounding a target this way is an eclipse attack.

<figure>
{% diagram "sees-can-cannot" %}
<figcaption>The third column holds because of cryptography. The second shrinks only with more work.</figcaption>
</figure>

## Why "not even ours"

Relays launched by NakoCorp have no extra power. Same binary, same protocol, and nothing in the client trusts them more. There is no privileged list: the [bootstrap list](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-dht/bootstrap.toml#L1-L10) built into the binary is empty, and it would only ever serve to find a first node, not to rank it.

Two things do rest on NakoCorp today. The iOS push relay, whose identity and seal key are [built into the app](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/deploy/README.md#L6): a later article covers what it learns. And the binaries themselves: you trust whoever built the code you run, which is why verifiable releases get their own article too.

## What would make it better, and when

Planned, with no date:

- **Hiding your IP from relays**, through Tor or a mixnet. This is the largest gap: most of the "can" column comes from IP addresses. It would not hide everything. A responsible would still see that someone deposits into a mailbox and someone fetches from it, and when; it would just no longer know where either of them is.
- **Contact tokens**, so that only people you invited can fill your introduction mailbox.
- **An external audit.** Nothing in this article has been audited. The threat model is written by the people who wrote the code.

Considered and set aside: **decoy mailboxes**, fetching empty mailboxes to hide the real ones. They would stay empty, so a responsible could tell them apart, and they would protect neither the link between deposit and fetch nor the introduction mailbox. There are none in the code.

## Break it

This threat model is a living document. Each attack it forgets is one the code does not defend against yet. If you find one, report it privately as described in [`SECURITY.md`](https://github.com/NaKoCorp/Barking/blob/main/SECURITY.md), or [open an issue](https://github.com/NaKoCorp/Barking/issues) for a design question.

An external audit is a goal, not a fact. If you want it to happen sooner, you can [sponsor NakoCorp](https://github.com/sponsors/NaKoCorp).
