---
title: Hiding who talks to whom
description: "A Barking relay sees neither sender nor recipient, only a mailbox ID that changes daily. It still sees your IP address. A field-by-field inventory."
date: 2026-11-25
translationKey: hiding-metadata
tags: [barking, privacy, metadata]
barking: true
draft: false
---
End-to-end encryption hides what you say. It says nothing about who you say it to, when, or how much. Those three facts are metadata, and they are often enough: two people who write to each other every night at 2 a.m. tell a story without a single word of content.

Barking starts from the threat model of [Trust no node. Not even ours.](/en/blog/trust-no-node/): every relay may be hostile, so the protocol tries to hand relays nothing they can use. This article is the inventory. Field by field, what a relay sees on a packet; how the mailbox and the sender are hidden; what is rounded; and then the part that matters most, what still leaks. The first item on that list is your IP address.

Every value below comes from the Barking repository at release [v0.4.0](https://github.com/NaKoCorp/Barking/tree/v0.4.0) (commit `f6f3a0a`).

## Encryption hides what you say, not who you say it to

In one sentence: a Barking relay sees neither the sender nor the recipient of a packet, only a mailbox ID that changes every day, a payload size and a time rounded to the minute. It does see the IP address of whoever deposits and whoever fetches, and Barking does not hide it yet.

The rest of this article follows that sentence: the clear header, the rotating mailbox, the hidden sender, the rounding, then the leaks.

## What a relay actually sees

A Barking packet has one fixed layout, [written at the top of `header.rs`](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-packet/src/header.rs#L1-L4). The first 40 bytes are in clear, because relays need them to store and route the packet:

- **version** (1 byte), always 0 today;
- **kind** (1 byte): a message or an acknowledgement;
- **hops** (1 byte): how many more times the packet may be forwarded;
- **tier** (1 byte): S, M or L, the size class;
- **packet ID** (16 bytes): for a message, the first 16 bytes of a BLAKE3 hash of a random secret that only the recipient learns. It looks random and links to nothing. The acknowledgement later reveals the secret, which lets relays check that the receipt is genuine;
- **expires** (4 bytes): the expiry time;
- **mailbox ID** (16 bytes): where the packet waits.

Then come 2 bytes of payload length, the encrypted payload, and zeros up to the tier size: [245, 1,024 or 16,384 bytes](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-packet/src/lib.rs#L49-L55). Everything that identifies a person sits inside the encrypted payload, the sender included.

<figure>
{% diagram "packet-header" %}
<figcaption>The 40 bytes a relay can read. No field names a sender, a recipient or a phone number.</figcaption>
</figure>

## A mailbox that changes every day

There is no address in the header, only a mailbox ID. For a conversation that is already open, it is [computed](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-core/src/mailbox.rs#L26-L33) like this:

```rust
pub fn session_mailbox(secret: &[u8; 32], recipient: &DeviceId, day: u32) -> MailboxId {
    let mut h = blake3::Hasher::new_keyed(secret);
    h.update(labels::MAILBOX);
    h.update(&recipient.0);
    h.update(&day.to_be_bytes());
    truncate(h.finalize().as_bytes())
}
```

The key is the mailbox secret, which the handshake derives next to the session key (see [Post-quantum from day one](/en/blog/post-quantum-from-day-one/)). Only the two devices of the session hold it. The input is a label, the identifier of the receiving device and the day number, `now / 86400` in UTC. The output is cut to 16 bytes.

Three consequences follow, and the tests in the same file check them:

- **A new mailbox every day.** Monday's mailbox and Tuesday's are two unrelated 16-byte values. A relay cannot link them without the secret.
- **One mailbox per direction.** The receiving device is part of the input, so Alice → Bob and Bob → Alice use two different mailboxes. A relay cannot pair the two halves of a conversation.
- **One mailbox per pair of devices.** A contact with a phone and a laptop gets two mailboxes from you every day.

The relays that store a mailbox are chosen from the mailbox ID itself: the five nodes whose identifiers are closest to it, as described in [A messenger without a central server](/en/blog/no-central-server/). When the mailbox changes, so do those five nodes. A relay that holds your Monday mailbox has no particular reason to hold Tuesday's.

<figure>
{% diagram "daily-mailbox" %}
<figcaption>The same direction of the same conversation, on three days: three IDs, three groups of nodes. Hex values are illustrative.</figcaption>
</figure>

To receive, a device fetches a window of days: [from 8 days back to tomorrow](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-core/src/core/mod.rs#L90-L95), ten days in all. A packet stays in the mailbox of the day it was sealed, and it may be deposited late, so the window covers its whole lifetime: 7 days, plus a day of clock skew. That window decides where to look, not what to accept. A message is accepted only if its authenticated timestamp is at most [8 days old and at most one day ahead](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-core/src/core/mod.rs#L125-L129) of the receiver's clock.

## Hiding the sender

On an open session, the packet carries no sender identity at all. The encrypted envelope holds a timestamp, a receipt secret, a message ID and the body. [The module](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-core/src/envelope.rs#L1-L7) is called "Envelope with hidden sender". The recipient knows who wrote because only one of its sessions decrypts the packet.

The first message of a session is harder. It must carry the sender's identity key, otherwise the recipient could not open the session. Barking seals that initial message for the recipient's key with a fresh ephemeral X25519 key, so a relay sees 32 random bytes followed by an encrypted block. The idea is close to Signal's *sealed sender*, without a server issuing sender certificates. One limit, already listed in the article on post-quantum: this sealing is classical. A future quantum attacker who kept the packet could learn who opened the conversation, not what was said.

That first message cannot use a session mailbox, since there is no session yet. It goes to the recipient's **introduction mailbox**, computed from the device's public keys and the day. It reappears in the list of leaks below.

The acknowledgement of a message is deposited [in the mailbox of the message it acknowledges](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-core/src/core/receive.rs#L1231-L1261), never in a mailbox of the other direction. The comment in the code gives both reasons: answering elsewhere would link the two directions of the conversation, and the nodes that keep the message would not see the receipt that lets them delete it.

## Rounding the rest

What cannot be hidden is made coarser:

- **The packet size** on the wire is one of three tiers, padded with zeros.
- **The expiry** is the sealing time plus 7 days, [rounded down to 10 minutes](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-core/src/envelope.rs#L313-L326). Acknowledgements use the same rounding. A relay cannot read the second the message was written.
- **The arrival time** a node stores is [rounded to the minute](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-node/src/rules.rs#L265-L279).
- **No IP address on disk.** The node's [database schema](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-node/src/store.rs#L62-L91) has no column for one. The only addresses it keeps are those other nodes publish about themselves.
- **No IP address in the logs.** The [log filter](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-node/src/logging.rs#L1-L27) turns off every target by default and turns `quinn_udp` off explicitly, because that crate writes addresses when a send fails. A test checks it.

All of this describes the binary Barking publishes. An operator can run a modified node that logs everything it receives; the threat model already assumes so. Rounding protects you from a careless relay, not from a hostile one.

## What still leaks

This is the list to read if you only read one section. It starts with the warning at the top of the [README](https://github.com/NaKoCorp/Barking/blob/v0.4.0/README.md): "relays can observe client IP addresses".

<div class="status-list is-limit">

- **Your IP address.** The node you deposit on and the node you fetch from see your IP address during the connection. Barking has no protection against this today.
- **Who deposits and who fetches, for one mailbox.** A node that keeps a mailbox sees the IP address that fetches it, and the IP addresses that deposit into it when the deposit reaches that node first. It can link the two: one mailbox on one node is enough to pair two IP addresses for that day. It also sees which mailboxes a client fetches together, and the deposits made over the same connection.
- **Your introduction mailbox.** It is computed from your device's public keys, and those are in your contact card. Anyone who has your card can compute it, so fetching it links your identity to your IP address. Anyone who has your card can also fill it: the node only asks for a proof of work, which gets harder as the mailbox fills.
- **The exact size of the payload.** The tier pads the packet, but the 2-byte length field in clear gives the size of the encrypted payload to the byte, and the envelope adds no padding of its own. A short "ok" and a long paragraph do not look the same to a relay.
- **Volume and timing**, to the minute and to the tier: how many packets a mailbox receives, and when.
- **Message or acknowledgement.** The kind byte is in clear. An acknowledgement in a mailbox tells the nodes that the message in it was received.
- **iOS wake-ups.** If you turn on instant notifications, a node keeps a sealed wake-up token next to your mailbox. A node and the push relay that cooperate can link that mailbox to an iPhone. Turning instant notifications off avoids it.
- **Nodes in your contact card.** Your card lists at most three nodes you use, to help contacts find the network. Barking never picks the nodes responsible for your own mailboxes.

</div>

{% diagram "what-a-relay-sees" %}

## Why no decoy fetches

An earlier version of the design planned *decoy fetches*: fetching mailboxes that do not exist, so that real fetches hide among fake ones. Barking dropped the idea before implementing it, and there is no decoy anywhere in the code.

The reason is in the list above. A decoy multiplies requests on a weak network, and it protects against none of those leaks: a decoy mailbox stays empty, the IP address is the same, and a node that sees a real mailbox fill up can tell it from a decoy. The cost is real; the gain is not.

The real fix is to hide the IP address from relays: route client connections through Tor or a mixnet. It is on the [roadmap](https://github.com/NaKoCorp/Barking/blob/v0.4.0/README.md#-roadmap), not started, with no date. Until then, Barking is not an anonymity tool, and it does not claim to be one.

## Check it yourself

Barking tells you what each node saw. Every deposit and every fetch writes an event to the transparency log, shown by `barking log` in the command-line client. The text comes from [`transparency.rs`](https://github.com/NaKoCorp/Barking/blob/f6f3a0ad1a4def5c1cc4c96deee8d1a064a2f92a/crates/barking-core/src/transparency.rs#L413-L430), word for word:

```text
{count} packets deposited on node {node} ({refused} refused). The node sees
the mailbox, the size, the time and your IP address; not the content.

Mailboxes fetched from node {node}: {mailboxes} mailboxes, {received} items
received. The node sees which mailboxes you fetch and your IP address during
the connection, and can link together the deposits and the fetch of a single
connection. Your introduction mailbox is computed from your public key:
fetching it links your identity to this IP address.
```

You can also run your own node and open its SQLite database: each row of the `packets` table holds the packet ID, the mailbox, the kind, the tier, the expiry, the arrival minute, a hash, the proof-of-work nonce and the packet bytes. No column for an IP address.

Barking is a prototype and has not been audited. This list is what its authors know. If you find a leak that is not on it, read [`SECURITY.md`](https://github.com/NaKoCorp/Barking/blob/v0.4.0/SECURITY.md) and the threat model in [Trust no node. Not even ours.](/en/blog/trust-no-node/), then report it: in a [GitHub issue](https://github.com/NaKoCorp/Barking/issues), or privately as `SECURITY.md` describes if it is sensitive. If Tor or mixnets are your field, open an issue about the planned integration: that is the work that would close the first item on the list.
