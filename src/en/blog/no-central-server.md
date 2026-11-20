---
title: A messenger without a central server
description: How Barking places each mailbox on the five closest relays, replicates packets between them and drops the relays that lose messages, with no directory.
date: 2026-11-21
translationKey: no-central-server
tags: [barking, networking, rust, p2p]
barking: true
draft: false
---
A central server is one place to seize, one place to censor and one switch to turn off. Barking has none. This article follows one encrypted packet from the moment Alice deposits it to the moment Bob fetches it, and at each step asks the same question: who decides? The answer is never a directory or a privileged node. The client computes where a mailbox lives, the relays copy packets to each other, and each client keeps its own score of the relays that lose messages.

## No server to seize, censor or switch off

In one sentence: in Barking, a mailbox lives on the [5 relays](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/src/lib.rs#L22) whose identifier is closest to its key (S/Kademlia); the client deposits one copy, the relays complete the others themselves, and each client stops using the relays that lose its messages.

Status first, because it matters: the code works and is tested, but no public network exists yet. Every number below comes from the Barking repository at commit [`7aa3a41`](https://github.com/NaKoCorp/Barking/commit/7aa3a4100f32e4380b030d6240be9115368abe5e), not from intentions. If you have not read it, [Why Barking](/en/blog/why-barking/) gives the context.

## What a relay is

A relay, `barking-node`, is one binary. It speaks QUIC over UDP, with TLS 1.3 and the ALPN [`barking/0`](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-proto/src/lib.rs#L45), and keeps its data in an [embedded SQLite database](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-node/Cargo.toml#L37). No external service, no account, no registration: an operator publishes the identifier and address of their node, and that is all.

What it keeps is narrow. Sealed packets of [three fixed sizes](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-packet/src/lib.rs#L51-L53) (245, 1,024 and 16,384 bytes), filed under 16-byte mailbox identifiers, until a receipt arrives or the packet expires. A message lives [7 days by default](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-packet/src/lib.rs#L22), and a relay refuses any packet that would expire [more than 7 days and 1 hour](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-proto/src/lib.rs#L27-L30) after its own clock. Release v0.2.0, used in the [first-message tutorial](/en/blog/first-barking-message/), still sealed packets for 24 hours; the 7-day lifetime came with protocol 4, after it. The relay decrypts nothing: it reads only the clear header that tells it the size, the mailbox and the expiry.

## Node identities that cost something

A node's identifier is the [BLAKE3 hash of its Ed25519 public key](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-proto/src/node_id.rs#L21-L23). Not any key will do: the hash of the identifier must start with [20 zero bits](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-proto/src/node_id.rs#L15). Finding such a key takes about a million tries, a few seconds once, when the operator runs `init`.

Two things follow. Making thousands of identities to surround a mailbox (a Sybil attack) now costs real CPU time for each one. And a client [pins the TLS connection](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-proto/src/tls.rs#L104-L105) on the identifier it expects, with no certificate authority: a relay cannot pretend to be another relay without its private key.

## Where a mailbox lives

The key of a mailbox is `BLAKE3("barking/v0/mailbox-key", mailbox)`, with that exact [context string](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/src/lib.rs#L42). The distance between a key and a node is the XOR of the two, as in Kademlia. The mailbox's responsibles are the 5 nodes with the smallest distance. Anyone who knows the mailbox and enough of the network computes the same five, so no one needs to be asked.

Conversation mailboxes are derived from a secret the two correspondents share, and they change every day. So their key moves every day, and so do their five responsibles.

<figure>
{% diagram "mailbox-placement" %}
<figcaption>The same network on two days. A new mailbox each day, so five new responsibles.</figcaption>
</figure>

Nodes describe themselves with a signed record: identifier, routable addresses only, and a date rounded to the hour, accepted up to [one hour ahead](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-proto/src/record.rs#L15) of the reader's clock. A newer record replaces an older one.

## Finding nodes without a directory

Each relay keeps a routing table of [256 buckets](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/src/table.rs#L55), one per bit of distance, with [20 nodes each](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/src/lib.rs#L16) and 10 more in reserve. A node enters only after a direct contact with a valid record, and old nodes are kept first: an attacker cannot push out a node that keeps answering. The table also limits address diversity: at most [2 nodes per /24 or /48](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/src/lib.rs#L30-L32), and no block above 10 % of the table. A lookup runs on [3 disjoint paths](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/src/lib.rs#L18-L20), with 3 requests in parallel on each, so one lying node cannot steer all of them.

The client does not run a table. It keeps a local view of up to [2,048 node records](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/lib.rs#L32), filled by [2 lookups of random identifiers](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/sync.rs#L200) per sync. A random identifier reveals nothing: it is not the key of any of your mailboxes. To start, the view is seeded in this order: its own cache, the node records carried by contact cards ([at most 3 per card](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-core/src/contact.rs#L28), and [never the responsibles of your own mailboxes](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/discover.rs#L468)), the nodes you added by hand, then the list built into the binary. It stops once [3 nodes](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/discover.rs#L33) answer.

From that view, the client picks the responsibles of a mailbox itself. It falls back to a lookup on the mailbox key only when the view holds fewer than [20 nodes](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/lib.rs#L47), or when [2 responsibles](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/sync.rs#L245) answer `NotResponsible`.

## One deposit, five copies

Alice's client deposits a packet first on 1 responsible, the one it scores best, with a proof of work: [18 bits](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-proto/src/pow.rs#L28-L29) by default, [more](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-node/src/rules.rs#L184-L192) for larger packets, fuller mailboxes and a fuller node, up to 24. Once one relay accepts it, the packet is safe: relays copy it to each other. If the sync has time left, the client adds copies on other responsibles, up to [3 in all](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/plan.rs#L19).

<figure>
{% diagram "deposit-replication" %}
<figcaption>Alice deposits on one responsible, the relays fill in the other four, Bob fetches from the one he scores best.</figcaption>
</figure>

Then the relays take over. [Every hour](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-node/src/dht/replicate.rs#L58), and [one minute](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-node/src/dht/replicate.rs#L60) after a new node enters among a mailbox's 5 closest, each responsible relay asks every other responsible what it already holds (`FindValue`), then sends what is missing (`Store`), receipts before packets. Calls between nodes are authenticated by their certificate, and a relay accepts a `Store` only if [both the caller and itself](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-node/src/dht/mod.rs#L443-L457) are among the 10 nodes closest to the mailbox. Replication is capped at [512 MiB per hour](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-node/src/config.rs#L29) by default, so a small device can take part. A node that is no longer responsible stops copying, but deletes nothing by force.

The repository checks this with a deterministic simulation of 500 nodes. [`churn_restores_five_copies_in_two_passes`](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/tests/sim.rs#L577) removes 30 % of the nodes, then requires every one of 100 mailboxes to have its 5 copies back after one table maintenance cycle and two replication passes. [`twenty_percent_liars_still_find_three`](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/tests/sim.rs#L520) requires more than 95 % of lookups to find 3 of the 5 responsibles when a fifth of the nodes answer only with each other, and [`sybil_slash24_is_capped`](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/tests/sim.rs#L544) adds 200 identities from one /24 and checks that no table holds more than its share of them.

## Clients keep score

Replication handles relays that go away. It does not handle a relay that accepts a packet and then drops it. For that, each client keeps a [reliability score](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/score.rs#L14-L26) per relay, on the device, never shared:

| Event | Change |
| --- | --- |
| starting value | 0.5 |
| a message it had accepted is missing (no receipt, not expired) | −0.3 |
| connection failure while another relay answered | −0.1 |
| a message it had accepted is still there | +0.05 |
| a request succeeded | +0.02 |

Below 0.2, the relay is avoided for [7 days](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/lib.rs#L34), and its score climbs back by 0.05 a day. When no relay answers at all, no score drops: the problem is your connection, not theirs.

Checking for losses costs nothing extra. While Alice waits for a receipt, her client already reads the mailbox of her messages, so it sees whether a relay that accepted a packet still has it. After a loss, the packet goes at once to another responsible; after [6 hours](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/plan.rs#L21) without a receipt, it gets more copies. And a relay that answers "nothing here" while keeping nothing would never be caught that way, so a mailbox read in full from one responsible is also read from another one, at most [every 6 hours](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-net/src/sync.rs#L223).

When a relay is set aside, `barking sync` prints [`Node … avoided: it lost messages or kept failing`](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-cli/src/main.rs#L483), and the transparency log keeps the reason.

## What this design does not solve yet

- **There is no public network.** The [bootstrap list](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht/bootstrap.toml) built into the binary is empty. Today you add a relay by hand.
- **A relay behind NAT stays a plain relay.** Without a `public_addr` in the [`[dht]` section](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/docs/deploy/barking-node.toml#L56-L62) of its configuration, it stores packets but takes no part in the table.
- **A responsible sees IP addresses.** It sees the address that deposits and the address that fetches, and can link the two. What a relay can learn, and what it cannot, gets its own article.
- **Introduction mailboxes can be targeted.** The mailbox for a first contact is computed from a public key. A patient attacker can place identities near it and delay first contacts, at the cost of the puzzle for each identity.
- **Large networks.** Beyond a few thousand nodes, the client's view becomes partial and fallback lookups become more frequent.
- **Losses are seen after the fact.** A relay that loses messages is caught only after it has lost one.

Barking is a prototype and has not been audited.

## Be one of the nodes

The first public network will be made of its first operators. Run a relay with the table enabled (`public_addr` in the `[dht]` section), then publish its identifier and address: the README's [Run a relay](https://github.com/NaKoCorp/Barking/blob/7aa3a4100f32e4380b030d6240be9115368abe5e/README.md#-run-a-relay) takes one binary, with Docker or systemd.

And if you would rather break it than run it, read the table's code in [`crates/barking-dht`](https://github.com/NaKoCorp/Barking/tree/7aa3a4100f32e4380b030d6240be9115368abe5e/crates/barking-dht) and [open an issue](https://github.com/NaKoCorp/Barking/issues) where it is wrong.
