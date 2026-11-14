# Design a Media Upload and Transcoding Pipeline

A platform lets brands and creators upload videos from iOS, Android and the web. Each video is processed into formats that play smoothly on phones over any connection, with thumbnails, and is then published to the brand's audience in the mobile apps.

Design the system from the moment a user picks a file to the moment viewers can play it.

- **In scope:** uploading (including large files over unreliable mobile networks), processing (transcoding, thumbnails, validation), tracking progress and notifying the uploader, storage, and delivery to viewers.
- **Out of scope:** the social features around videos (comments, feeds, recommendations) and the internals of video codecs.

You have about **45 minutes**. Drive the conversation:

1. **Clarify requirements.** Ask about file sizes, upload volume, processing time targets, output formats, and cost. The interviewer has the numbers.
2. **Estimate** upload bandwidth, processing compute, storage growth, and delivery bandwidth.
3. **Design the system**: the upload API, the processing pipeline, the data model for a video and its renditions, and delivery.
4. **Go deep** on the hardest parts, such as resumable uploads, a processing pipeline that survives crashes and retries without duplicate work, and keeping processing and storage costs under control.

Use the **Whiteboard** tab to draw, and the **Notes** tab (markdown) for requirements, estimates, and tradeoffs. The interviewer sees both when you send a message.
