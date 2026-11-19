---
title: Privacy policy
description: What the Barking app keeps, what leaves your iPhone, and who can see what. The short version is that NakoCorp has nothing to read.
lang: en
altUrl: /fr/confidentialite/
eyebrow: privacy
layout: layouts/page.njk
permalink: /en/privacy/
updated: 2026-11-19
---

This policy covers the Barking app for iPhone and the network services NakoCorp runs for it (relay nodes and the notification relay). Barking is free software under AGPL-3.0: every statement below can be checked in [the source code](https://github.com/nakocorp/barking).

Barking is a prototype. It has not been externally audited. Do not rely on it for sensitive communications yet.

## In short

- No account, no phone number, no e-mail address. Your identity is a key pair created on your iPhone.
- Messages are end-to-end encrypted. Nodes only carry sealed packets and never see who sent them or what they say.
- No advertising, no tracking, no analytics, no crash reporting, no third-party SDK.
- NakoCorp keeps no record of your contacts, your messages or your device.

## What stays on your iPhone

Your contacts, your messages, your keys and the app's journal are stored in one database on your iPhone, encrypted with SQLCipher. Its key is protected by the iPhone's Secure Enclave when the device has one, otherwise by the keychain, and is bound to this device.

- The database is excluded from iCloud and computer backups.
- The journal shown in the Transparency screen (what the app did and which paths messages took) is kept 30 days on the iPhone and never sent.
- Your recovery phrase (24 words) is shown once and not kept by the app. If you export it as a PDF, the file is encrypted with the password you choose.
- **Erase Barking** (Settings › Security) deletes the database, the keys and the app's files from the iPhone. Your contacts are not told.

## What leaves your iPhone

**Your contact card.** When you share your code or link, the other person receives your display name, your devices' public keys and their key packets. You choose who gets it. No phone number or e-mail address is in it.

**Messages.** Each message is encrypted for each of the recipient's devices (PQXDH key exchange, then the Double Ratchet) before it leaves your iPhone. It travels as a fixed-size sealed packet, left in a mailbox whose identifier changes every day. A packet holds no sender identity.

**Delivery receipts.** When a message arrives, the recipient's app publishes a receipt that proves delivery without revealing who received it. Your contact then sees "Received". There are no read receipts and no typing indicators.

**Notification tokens.** If instant notifications are on, your iPhone seals its Apple notification token so that only the notification relay can open it, and leaves that sealed token with a node. You can turn instant notifications off in Settings › Notifications. Messages then arrive when you open the app or during an iOS refresh.

## Who can see what

**Nodes** (relays) store sealed packets for at most 24 hours, plus the receipt that a packet arrived. Like any internet server, a node sees the IP address your iPhone connects from. Nodes use addresses only in memory, to limit abuse, for the duration of the connection: they do not write them to disk or to their logs. Their logs contain no address, no mailbox and no message.

**The notification relay** (`barking-push`) opens a sealed token only to ask Apple to wake an iPhone. It stores nothing: no token, no address, no mailbox. To limit abuse it keeps, in memory and for at most an hour, a hash of the token.

**Apple** delivers the notification. It sees that an iPhone receives a Barking notification, never the content: the notification only says "New message". The app then decrypts the message on the iPhone to show the sender's name or the text, depending on your preview setting. With the app lock on, notifications always say "New message".

**None of them sees the sender or the content.** One limit remains: a node that cooperates with the notification relay or with Apple could link a mailbox to an iPhone. Turning instant notifications off prevents it.

## What NakoCorp collects

Nothing about your use of Barking. NakoCorp has no account database, no copy of your contacts or messages, and no analytics. The privacy label of the App Store says "Data Not Collected".

If you write to [support@nakocorp.com](mailto:support@nakocorp.com), we use your e-mail address and your message only to answer you, and delete them once your request is settled.

## This website

www.nakocorp.com uses no cookies, no analytics and no advertising. It remembers your language and theme in your browser's local storage. The site is hosted by GitHub Pages, which receives your IP address to serve the pages. The homepage loads its fonts from Google Fonts, which also receives your IP address; the blog pages host their fonts themselves.

## Your rights

Under the GDPR you may ask to access, correct or delete personal data about you, or object to its processing. Because NakoCorp holds no data about your use of the app, there is usually nothing to hand over: your data is on your iPhone, and **Erase Barking** deletes it. For any question, write to [support@nakocorp.com](mailto:support@nakocorp.com). You can also complain to the CNIL (cnil.fr) or to your own data protection authority.

## Children

Barking is not directed at children.

## Changes

We will update this page when the app or the services change what they handle. The date at the top shows the last change. The history of this page is public in [the website's repository](https://github.com/nakocorp/website).

## Contact

NakoCorp, France. [support@nakocorp.com](mailto:support@nakocorp.com)
