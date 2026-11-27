---
title: Run a Barking relay
description: "One static binary, one SQLite file, UDP port 4433: run a Barking relay with systemd, Docker or Compose, and see what it stores and what it never writes."
date: 2026-11-27
translationKey: run-a-relay
tags: [barking, self-hosting, tutorial]
barking: true
draft: false
cta: Run a relay, then tell the other operators where to find it.
---
A Barking relay is one static binary, one SQLite file and one UDP port. Run `barking-node init`, then `barking-node run`, and your machine keeps encrypted packets it cannot read, for at most 7 days, without ever writing a client's IP address.

This is a short tutorial with three paths: systemd, `docker run` and Docker Compose. Every command and output below comes from Barking [v0.7.0](https://github.com/NaKoCorp/Barking/tree/v0.7.0) (commit `2c142eb`, protocol 5).

## One binary, one port, one database

A relay keeps packets for temporary mailboxes and hands them to whoever fetches those mailboxes, over QUIC. A packet leaves when its receipt arrives, as [Delivered once, deleted everywhere](/en/blog/delivered-once-deleted-everywhere/) explains, or when it expires. The relay cannot read any of them: [Trust no node. Not even ours.](/en/blog/trust-no-node/) covers what a relay can and cannot do.

<figure>
{% diagram "relay-in-the-network" %}
<figcaption>Your relay between the clients that deposit and fetch, and the peers it replicates to. What it keeps, and what it never writes.</figcaption>
</figure>

What you need:

- Linux, on a VPS or a Raspberry Pi (macOS works for a test);
- one open UDP port, 4433 by default;
- a few hundred MB of disk: storage is capped at 1 GiB by default, and 256 MiB is a sensible value on a small device.

Before you start, the honest part: Barking is a prototype and has not been audited. As its README says, "there is no public relay network yet". The first operators are the ones who build it.

## Get the binary

Two options. Build it yourself; the toolchain is pinned by `rust-toolchain.toml`:

```sh
cargo build --release -p barking-node
# target/release/barking-node
```

Or take a release. The Linux binaries are static (musl), for `x86_64` and `aarch64`. Clone the repository, download the release into `dist/` and check it:

```sh
git clone https://github.com/NaKoCorp/Barking.git && cd Barking
git fetch --tags
gh release download v0.7.0 -R NaKoCorp/Barking -D dist
scripts/verify-release.sh 0.7.0 --from-dir dist
```

It checks the files against `SHA256SUMS`, then the GitHub attestations bound to the release workflow and the tag, and ends with `Version 0.7.0 verified ✓`. If it prints "FAILURE", do not use the binary. [`docs/VERIFYING.md`](https://github.com/NaKoCorp/Barking/blob/v0.7.0/docs/VERIFYING.md) has the details, including a full rebuild.

## Configure

Start from [`docs/deploy/barking-node.toml`](https://github.com/NaKoCorp/Barking/blob/v0.7.0/docs/deploy/barking-node.toml). Every missing key takes its default, and an [unknown key](https://github.com/NaKoCorp/Barking/blob/2c142ebb0c137cc88d220e7f431eb26d0059a83b/crates/barking-node/src/config.rs#L223-L225) stops the node at startup, so a typo never goes unnoticed. The keys that matter:

```toml
listen = ["[::]:4433"]           # also IPv4 on Linux when net.ipv6.bindv6only=0
data_dir = "/var/lib/barking-node"
storage_max_bytes = 268435456     # 256 MiB on a Raspberry Pi; default 1 GiB
pow_bits = 18                     # proof of work asked of depositors, 1 to 24
# max_connections = 1000          # 200 on a small device
# max_connections_per_ip = 8

[dht]
public_addr = ["203.0.113.7:4433"]  # your public IPv4 and/or IPv6, with the port
# bootstrap = ["<identifier>@<ip:port>"]
# replication_bytes_per_hour = 134217728   # 128 MiB on a Pi; default 512 MiB
```

`[dht] public_addr` is the line that turns a relay into a member of the network. It goes into the node's signed record, so it must be a literal IP address with its port, not a DNS name, and the node refuses a private address. **Without it, the node stays a plain relay outside the S/Kademlia table.** If you write a `[dht]` section without `public_addr`, the log says so: `[dht] without public_addr: table disabled, plain relay`. Publishing an IPv6 address also needs an IPv6 listen address.

Two more sections are on by default. `[wake]` keeps wake-up subscriptions for iOS devices: sealed tokens that only the push relay named by the app can open, so the node learns no device. `[info]` lets the node describe itself (version, uptime, how full it is) and look up the autonomous system and country of its own public address once a day, through Team Cymru's DNS service. That lookup carries your node's address; set `origin_lookup = false` under `[info]` if you would rather not send it.

## Path A: systemd

The unit file [`docs/deploy/barking-node.service`](https://github.com/NaKoCorp/Barking/blob/v0.7.0/docs/deploy/barking-node.service) starts with the install commands. As root:

```sh
useradd --system --home-dir /var/lib/barking-node --shell /usr/sbin/nologin barking-node
install -m 0755 barking-node /usr/local/bin/barking-node
install -d -m 0700 -o barking-node -g barking-node /var/lib/barking-node
install -m 0644 barking-node.toml /etc/barking-node.toml
sudo -u barking-node barking-node init --data-dir /var/lib/barking-node
install -m 0644 barking-node.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now barking-node
```

`init` searches for an identity that solves a 20-bit puzzle. It took between 7 and 16 seconds on a recent laptop; count on more on a Pi. It prints the identifier you will publish:

```text
Searching for an identity (20-bit puzzle, a few seconds)…
identifier  : 2RS2C4Q5FGE5ZXURHRONJ5V2DWXVTLNYNPWVRLYUDE36RU4AWNIQ
address     : [::]:4433

To publish: the identifier above and the public address (host or IP) of the server with the listen port ([::]:4433 is the configured local address).
```

The `address` line is the local listen address, not your public one. `init` refuses a directory that is already initialized, and the node refuses to start if `node.key` is readable by anyone but its owner.

The unit is hardened: `ProtectSystem=strict`, `NoNewPrivileges`, no capabilities, and only the data directory is writable. Its comments list the checks: `systemd-analyze security barking-node.service`, `journalctl -u barking-node -n 20`, and modes 700, 600 and 600 on the directory, `node.key` and `node.db`.

## Path B: Docker

The image is the static binary alone on an empty base (`scratch`), running as user 65532, with `EXPOSE 4433/udp`. The release workflow publishes it as `ghcr.io/nakocorp/barking-node`, but at the time of writing that image cannot be pulled anonymously: `docker pull` answers `unauthorized`. Until it is public, build it from the release you verified in `dist/`. The build checks the binary against `SHA256SUMS` once more:

```sh
docker build -f docker/node.Dockerfile --build-arg VERSION=0.7.0 -t barking-node dist
docker run --rm -v barking-node:/var/lib/barking-node barking-node init
docker run -d --name barking-node -v barking-node:/var/lib/barking-node \
  -p 4433:4433/udp barking-node
```

To use your configuration, mount it read-only and pass it to `run`:

```sh
docker run -d --name barking-node -v barking-node:/var/lib/barking-node \
  -v ./barking-node.toml:/etc/barking-node.toml:ro \
  -p 4433:4433/udp barking-node run --config /etc/barking-node.toml
```

Once the image is public, replace `barking-node` with `ghcr.io/nakocorp/barking-node:0.7.0` and check it with `gh attestation verify oci://ghcr.io/nakocorp/barking-node:0.7.0 -R NaKoCorp/Barking`, as [`docs/VERIFYING.md`](https://github.com/NaKoCorp/Barking/blob/v0.7.0/docs/VERIFYING.md#container-images) describes.

## Path C: Docker Compose

From the repository, with the verified release files in `dist/`:

```sh
scripts/stack-init.sh --version 0.7.0 --public-addr <public-ip>:4433
docker compose -f deploy/compose.yaml up -d
docker compose -f deploy/compose.yaml exec node /barking-node status
```

The script writes `deploy/.env` and `deploy/config/barking-node.toml`, builds the image, creates the key in the volume and prints the identifier. It refuses a private address and refuses to run twice; `--force` stops the node and deletes its volume, key and packets included. For an IPv6 server, pass `--public-addr` twice, once per family. The service runs with a read-only root, `cap_drop: [ALL]` and `no-new-privileges`, and its logs are capped at three files of 10 MB.

On a Mac, Docker Desktop hides the peers' addresses behind its proxy, so the per-address limits apply to everyone at once. A public node belongs on Linux with Docker Engine. The `relay` profile of the same file runs the iOS push relay, which needs NakoCorp's Apple key; an operator does not need it.

## Open the port and check

Open UDP 4433 in the host firewall (`ufw allow 4433/udp`) and at your provider, or forward it on a home router. Then:

```text
$ barking-node status --data-dir /var/lib/barking-node
identifier  : 2RS2C4Q5FGE5ZXURHRONJ5V2DWXVTLNYNPWVRLYUDE36RU4AWNIQ
version     : 0.7.0 (protocol 5)
packets     : 0
acks        : 0
bytes       : 0
peers       : 0
buckets     : 0 non-empty
responsible : table empty or disabled
replicated  : 0 bytes in the last hour
```

`status` and `peers` read the data directory, not the configuration, so pass `--data-dir` if yours is not the default. `peers` lists the peers of the table, without their addresses. The log prints `node <identifier> started`, then one line of aggregated counters every 60 seconds:

```text
deposits accepted: 0, fetches: 0, expired purged: 0, refusals: none, open connections: 0 (peak 0), database operations peak: 1, response bytes peak: 0
```

The real test is a message. From a laptop with the CLI set up as in [Send your first Barking message in 5 minutes](/en/blog/first-barking-message/):

```sh
barking node add 203.0.113.7:4433 2RS2C4Q5FGE5ZXURHRONJ5V2DWXVTLNYNPWVRLYUDE36RU4AWNIQ
barking sync
```

`node add` only succeeds if the node answers and proves its identity. Then `deposits accepted` grows in your log.

## What your relay sees, and what it doesn't

It sees:

- **the IP address of each client**, for as long as the connection lasts;
- the mailbox IDs that are deposited and fetched, the size tier of each packet and the time;
- enough to link the deposits and fetches made over the same connection.

It does not see the content, the sender or the recipient.

It does not write any client IP address, in the database or in the logs. The [schema](https://github.com/NaKoCorp/Barking/blob/2c142ebb0c137cc88d220e7f431eb26d0059a83b/crates/barking-node/src/store.rs#L61-L91) has no column for one; the only addresses in `node.db` are those other nodes publish themselves, in the signed records of the `peers` table.

It stores encrypted packets, until at most 7 days and one hour after they were sealed ([`MAX_EXPIRY_SECS`](https://github.com/NaKoCorp/Barking/blob/2c142ebb0c137cc88d220e7f431eb26d0059a83b/crates/barking-node/src/rules.rs#L40-L42)), receipts, and the sealed wake-up subscriptions.

These guarantees are those of the published binary. A client cannot check what code runs on your machine, which is why the protocol trusts no node, yours included. [Hiding who talks to whom](/en/blog/hiding-who-talks-to-whom/) goes through the metadata field by field.

## Join the network

The bootstrap list built into the binary is [empty](https://github.com/NaKoCorp/Barking/blob/2c142ebb0c137cc88d220e7f431eb26d0059a83b/crates/barking-dht/bootstrap.toml) as long as no public node exists. For now, nodes find each other by hand:

- publish your identifier and `ip:4433`;
- other operators add you under `[dht]` as `bootstrap = ["<identifier>@<ip:port>"]`, and you add theirs;
- clients add you with `barking node add`, or receive your node in a friend's contact card, which carries up to three.

From there the node finds its peers through S/Kademlia and copies each packet to the [five nodes responsible](https://github.com/NaKoCorp/Barking/blob/2c142ebb0c137cc88d220e7f431eb26d0059a83b/crates/barking-dht/src/lib.rs#L21-L26) for its mailbox, within `replication_bytes_per_hour`. [A messenger without a central server](/en/blog/no-central-server/) explains how those five are chosen.

Once your relay runs, open a discussion or an issue titled "relay operators" on [github.com/NaKoCorp/Barking](https://github.com/NaKoCorp/Barking) with its identifier and address, if you are willing to publish them. The first nodes can then bootstrap from each other, and the built-in list can stop being empty.
