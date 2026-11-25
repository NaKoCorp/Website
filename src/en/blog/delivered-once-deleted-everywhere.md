---
title: Delivered once, deleted everywhere
description: "A Barking receipt is a revealed 16-byte secret: any relay can check its hash and delete its copy, without learning who acknowledged it."
date: 2026-11-26
translationKey: delivered-once
tags: [barking, protocol, privacy]
barking: true
draft: false
---
In most messengers, a delivery receipt is a checkmark. The server that relayed the message already knows who sent it and who received it, so it can tell the sender "delivered" and keep everything else to itself, copies included.

Barking has no such server. A message waits on relays that may be hostile, as [Trust no node. Not even ours.](/en/blog/trust-no-node/) explains, and none of them knows who wrote it or who it is for. So the receipt has two jobs: tell the sender the message arrived, and tell every relay that holds a copy to delete it. Any relay must be able to check it alone, and none should learn who sent it.

The mechanism fits in three lines: a secret, a hash, a publication. Every value below comes from the Barking repository at release [v0.6.0](https://github.com/NaKoCorp/Barking/tree/v0.6.0) (commit `cc8f623`).

## A receipt that deletes

In one sentence: the ID of a Barking packet is the hash of a secret hidden inside its encrypted content; to acknowledge it, the recipient publishes that secret, and each relay that holds a copy checks the hash and deletes the packet, without learning who acknowledged it.

<figure>
{% diagram "receipt-erases" %}
<figcaption>One receipt, five holders. The node it lands on deletes its copy at once; the others learn it from that node.</figcaption>
</figure>

Without a receipt, the packet still goes away on its own: it expires 7 days after it was sealed.

## The trick: the ID is a hash of a secret

When Barking sends a message, it seals one packet per recipient device. For each one it draws a [random 16-byte secret](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-packet/src/ack.rs#L11-L17) and puts it inside the encrypted envelope, next to the timestamp, the message ID and the body. The packet ID, which sits in clear in the header, is [derived from that secret](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-packet/src/ack.rs#L19-L25):

```rust
pub fn packet_id_for(secret: &[u8; 16]) -> PacketId {
    let full = blake3::derive_key(labels::ACK_CONTEXT, secret);
    let mut id = [0u8; 16];
    id.copy_from_slice(&full[..16]);
    PacketId(id)
}
```

`ACK_CONTEXT` is the string `"barking/v0/ack"`, so the hash is BLAKE3 in key-derivation mode, cut to 16 bytes. A relay sees the ID; only someone who decrypted the packet knows the secret.

The recipient checks the link as soon as it decrypts. If the ID in the header does not match the secret in the envelope, the packet is [rejected](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-core/src/core/receive.rs#L1264-L1272) as an "inconsistent packet identifier". A sender cannot hand out an ID that its own receipt would not open.

## Publishing the secret

The receipt is a packet of its own, of the smallest size tier (S, 245 bytes on the wire). Its payload is [32 bytes](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-packet/src/ack.rs#L40-L62): the ID of the packet it acknowledges, then the secret. It goes into the mailbox of the message it acknowledges. The nodes that keep the message already fetch and serve that mailbox, and the sender fetches it while it waits. Answering in another mailbox would link the two directions of the conversation, as [Hiding who talks to whom](/en/blog/hiding-who-talks-to-whom/) describes. A receipt needs no proof of work; a message does.

Why not a signature? A signature says who signed. To check it, a relay would need a public key, and that key would tie the receipt to a device. The revealed secret proves one thing only: someone decrypted this packet. That is all a relay needs to know to delete it.

It is also enough to stop a lying relay. To claim a delivery that did not happen, a relay would have to produce a secret whose hash is the packet ID, which means inverting BLAKE3. It can drop a receipt, or keep a copy it was told to delete. It cannot forge one.

The receipt says "a device received and decrypted this packet". Barking has no "read" state.

## What a relay does with it

A relay that receives a receipt runs [`deposit_ack`](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-node/src/rules.rs#L286-L347). The heart of it:

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

In order:

1. **Check.** The node must hold a packet with that ID, the receipt must sit in one of that packet's mailboxes, and the hash of the secret must equal the ID. The comparison runs in [constant time](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-packet/src/ack.rs#L27-L38), so the ID cannot serve as an oracle. If any check fails, the answer is `UnknownAckTarget`. A sender's device that gets that answer tries again an hour later: the receipt may have arrived before its packet.
2. **Delete.** Every row with that ID goes, in one transaction.
3. **Keep the receipt.** It is stored in each mailbox that held the packet, until the later of its own expiry and the deleted packet's.

Keeping the receipt has two uses. Another device of the sender, or another node, can still learn from it. And a message deposited again after its receipt is [accepted with no effect](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-node/src/rules.rs#L236-L244): the node sees the receipt and stores nothing, so a late copy cannot bring the message back. A receipt the node already knows is accepted with no effect too.

## Deleted everywhere

One relay is not enough. A message lives on the five nodes closest to its mailbox ID, as described in [A messenger without a central server](/en/blog/no-central-server/): the sender's device deposits [up to three copies](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-net/src/plan.rs#L18-L21), and the nodes copy it to the other responsibles. The receipt, though, is deposited on one node.

That node deletes its copy at once. The others learn about it from replication: every hour, each node sends its mailboxes to the other responsible nodes, and the [module that does it](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-node/src/dht/replicate.rs#L1-L12) sends what is missing **receipts first**. A receipt arriving that way goes through the same `deposit_ack` and deletes the copy there too. When a new node joins the five closest to a mailbox, that mailbox is replicated a minute later rather than at the next hour.

A network test, [`ack_on_one_clears_all_five`](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-node/tests/dht.rs#L651-L677), starts eight nodes, deposits a message on three of them, waits until all five responsibles hold it, deposits the receipt on the fifth one only, then waits until none of the five serves the message any more.

So, honestly: deleted at once where the receipt lands, and normally at the next hourly pass everywhere else. Replication has limits per pass and per hour, so a busy node can take longer. A node that held the copy but is no longer among the five closest gets no receipt through replication; its copy stays until it expires.

## And when no one answers

A recipient whose phone stays off does not acknowledge anything. The packet then lives out its lifetime:

- Barking seals every packet to expire **7 days** after sending, [rounded down to 10 minutes](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-core/src/envelope.rs#L360-L372). Receipts use the same rounding.
- A node refuses any packet that expires [more than 7 days and one hour](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-node/src/rules.rs#L40-L42) after its own clock (`TooFarInFuture`). The extra hour absorbs clock skew.
- Every [60 seconds](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-node/src/server.rs#L96), the node purges expired packets, 2,000 at a time. A receipt stays [24 hours more](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-packet/src/lib.rs#L25-L29) past the expiry it was kept for, so a sender's phone that syncs a day late still finds it.

<figure>
{% diagram "receipt-lifetimes" %}
<figcaption>Two lives of the same message. With a receipt, copies go within hours; without one, they stay until day 7.</figcaption>
</figure>

On the sender's side, a message with no receipt after [6 hours](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-net/src/plan.rs#L21) is deposited again on responsibles that do not have it yet. When the packet expires, the app does not jump to "not delivered". It waits two hours past the expiry, then asks every node that accepted the packet and every current responsible of its mailbox. Only if all of them answer in full, with neither the packet nor its receipt, does the message become [not delivered](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-core/src/core/delivery.rs#L254-L287). If one of them cannot be reached, the message stays "on the network". On iOS, the arrival of a receipt and the expiry of a packet both wake the sender's iPhone with a silent push, if instant notifications are on.

The lifetime has moved twice. The first protocol kept packets 7 days; protocol 2 cut that to 24 hours ([PR #33](https://github.com/NaKoCorp/Barking/pull/33)); protocol 4 brought it back to 7 days ([PR #70](https://github.com/NaKoCorp/Barking/pull/70)), so a packet sealed offline and deposited days later is still read. The client constant `DEFAULT_TTL_SECS` is the switch, and what a protocol 4 node accepts is fixed apart from it. Seven days is a long time for an unacknowledged copy to sit on a relay. The receipt is what keeps it short in the common case.

## Today and tomorrow

What ships today: the receipt deletes copies on the internet relays, and tells the sender's own devices that the message arrived.

What is planned: Barking will also carry messages from phone to phone over Bluetooth and Wi-Fi, without the internet. There, the receipt will travel the same way and delete the copies still in transit, and a message already delivered over that mesh will not leave over the internet. None of that is built yet.

One limit holds in both cases. Deletion is hygiene for honest relays, not a guarantee against a hostile one. A modified node can ignore the receipt and keep its copy. It still cannot read it, and the copy expires; but "deleted everywhere" means every relay running Barking's code, not every machine that ever saw the packet. The threat model in [Trust no node. Not even ours.](/en/blog/trust-no-node/) assumes exactly that.

## Try to break it

The whole mechanism is two short pieces of code: [`ack.rs`](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-packet/src/ack.rs) and [`deposit_ack`](https://github.com/NaKoCorp/Barking/blob/cc8f62324081e216a32feeb07a35035514a92c8f/crates/barking-node/src/rules.rs#L286-L347). Read them, then try to make a node delete a packet without knowing its secret, or to make a sender believe a message arrived when it did not. Barking is a prototype and has not been audited. If you find a way, report it as [`SECURITY.md`](https://github.com/NaKoCorp/Barking/blob/v0.6.0/SECURITY.md) describes.
