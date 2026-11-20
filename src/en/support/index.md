---
title: Support
description: How to add a contact, verify them, link a device and keep your identity, what message statuses mean, and how to reach us.
lang: en
altUrl: /fr/support/
eyebrow: support
layout: layouts/page.njk
permalink: /en/support/
updated: 2026-11-19
---

Barking is an end-to-end encrypted messenger with no phone number and no central server. It needs an iPhone with iOS 26 or later. It is a prototype: it has not been externally audited, so do not rely on it for sensitive communications yet.

**Need help?** Write to [support@nakocorp.com](mailto:support@nakocorp.com). Never send us your recovery phrase: we will never ask for it.

## Getting started

Open Barking and tap **Create my identity**, then choose the name your contacts will see. Barking then shows your recovery phrase: 24 words, shown only once. Write them down on paper and keep them offline, never in a screenshot or a notes app. They are the only way to get your identity back on a new iPhone.

## Adding a contact

Barking has no directory: you add people you know, in person or through a link you trust.

- **In person:** tap **Add a contact**. One of you opens **My code**, the other one **Scan**.
- **At a distance:** open **My code** and tap **Share my link**, then send it through a channel you trust. Opening the link in Barking adds the card.

Only someone whose card you added can write to you.

## Verifying a contact

Open the conversation, tap the contact's name, and compare the safety code with them, aloud, in person or on a call you trust. If the numbers match, tap **The numbers match**: nobody sits between you. The same code shows on all your linked devices, so verifying once is enough. If they don't match, don't send anything sensitive and compare again.

## Message statuses

- **Pending**: the message is sealed and saved on your iPhone, waiting for a network.
- **On the network**: a relay holds it for your contact.
- **Received**: your contact's device confirmed it (two checkmarks).
- **Not delivered**: no confirmation came back before the message expired, after about 7 days. Tap **Retry** to send it again.

## Notifications

Settings › Notifications. With **Instant notifications** on, a new message wakes your iPhone. The preview can show the name and the text, the name only, or just "New message". The text is decrypted on your iPhone, never by a server. With instant notifications off, messages arrive when you open the app or when iOS refreshes it.

## Linking another device

Settings › Linked devices › **Link a new device** (up to 8 devices). On the new device, tap **Link to an existing device** and scan the code shown, then tap **Scan the new device's code** on the first one. The code is valid for 10 minutes and works once. You can also transfer the encrypted history.

## Lost or new iPhone

On the new iPhone, tap **Recover with 24 words** and enter your phrase. Your identity comes back, but not your contacts or your message history: they live only on your devices. If you have another linked device, link the new iPhone from it instead.

## Blocking a contact

Tap the contact's name in the conversation, then **Block this contact**. Their messages stop reaching you and the conversation disappears, on all your devices. They are not told, but their messages stay marked as not delivered on their side. To undo it: Settings › Blocked contacts › **Unblock**.

## Locking and erasing

Settings › Security. **Lock Barking** asks for Face ID, Touch ID or the iPhone's passcode to open the app; while it is locked, notifications only say "New message". **Erase Barking** deletes everything on this iPhone. Your contacts are not told, and you will need your 24 words to get your identity back.

## Privacy

See the [privacy policy](/en/privacy/). The Transparency screen in Settings shows what the app did and who could see what.

## Reporting a problem

- **A bug or a question:** [support@nakocorp.com](mailto:support@nakocorp.com), or an issue on [GitHub](https://github.com/nakocorp/barking/issues). Say which iPhone and iOS version you use, and never include your recovery phrase.
- **A security vulnerability:** report it privately as described in the project's [security policy](https://github.com/nakocorp/barking/security/policy).
