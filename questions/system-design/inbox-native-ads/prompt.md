# Design Native Ads in an Email Inbox

A large webmail service shows a few **native ads** at the top of the inbox, styled like email rows. Tapping one opens an ad "message" that can include an interactive lead-generation form. The inbox is used on the web and in iOS and Android apps.

Design the system that decides which ads to show, renders them on every client, and records impressions, clicks and form submissions for advertiser reporting and billing.

- **In scope:** the ad request from each client, ad selection (targeting, pacing, frequency caps), consistent behaviour across a user's devices, event tracking, and the reporting and billing pipeline.
- **Out of scope:** the advertiser-facing campaign management UI and the machine-learning models themselves (assume a click-prediction service exists that you can call).

You have about **45 minutes**. Drive the conversation:

1. **Clarify requirements.** Ask about scale, latency, privacy, targeting, and how advertisers pay. The interviewer has the numbers.
2. **Estimate** ad requests, event volume, and storage.
3. **Design the system**: the serving path from inbox load to rendered ad, and the event path from tap to advertiser report and invoice.
4. **Go deep** on the hardest parts, such as staying out of the inbox's latency budget, frequency caps and dismissals across devices, and counting events accurately enough to bill.

Use the **Whiteboard** tab to draw, and the **Notes** tab (markdown) for requirements, estimates, and tradeoffs. The interviewer sees both when you send a message.
