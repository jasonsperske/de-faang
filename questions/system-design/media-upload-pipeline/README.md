# Design a Media Upload and Transcoding Pipeline

**Type:** System design · **Difficulty:** Medium · **Time:** 45 min · **Tags:** `system-design` `storage` `queues` `workflows` `cdn`

A platform lets brands and creators upload videos from iOS, Android and the web. Each video is processed into formats that play smoothly on phones over any connection, with thumbnails, and is then published to the brand's audience in the mobile apps.

Full prompt: [prompt.md](prompt.md).

## How it's graded

Rubric: [`system-design`](../../../rubrics/README.md#system-design) (System design interview rubric). Each dimension is scored 1–4 with quoted evidence; see the [rubric guide](../../../rubrics/README.md) for the level descriptors and how the hire signal is computed.

| Dimension | Weight | Learn more |
|---|---|---|
| Requirements & scoping | 20% | [The System Design Primer](https://github.com/donnemartin/system-design-primer)<br>[Latency numbers every programmer should know](https://gist.github.com/jboner/2841832)<br>[Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction) |
| High-level design | 25% | [The System Design Primer](https://github.com/donnemartin/system-design-primer)<br>[ByteByteGo — System design](https://bytebytego.com/) |
| Deep dive & technical depth | 25% | [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)<br>[The System Design Primer](https://github.com/donnemartin/system-design-primer)<br>[Wikipedia — Consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing) |
| Scalability, reliability & tradeoffs | 20% | [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)<br>[Google SRE Book](https://sre.google/sre-book/table-of-contents/)<br>[ByteByteGo — System design](https://bytebytego.com/) |
| Communication & leadership | 10% | [Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction) |

## Approach

> **Spoiler.** This is what the interviewer is privately told to look for. Try the round first.

<details>
<summary>Show the approach</summary>

Strong answers keep large bytes off the application servers, model processing as an idempotent multi-step workflow, and use adaptive streaming behind a CDN for delivery. Requirements: uploads up to 2 GB / 20 minutes, resumable; validate format, duration and content policy; output HLS (or DASH) ladder (e.g. 240p-1080p) plus thumbnails and a preview; uploader sees progress and gets notified when ready or failed; publish only when all required renditions exist; playback starts fast on mobile. Estimates: 500k uploads/day ~6/s average, ~20/s peak; average 150 MB is 75 TB/day of uploads (~7 Gbps average); a 3-minute video at ~5 renditions takes ~1-2 CPU-minutes per rendition with a fast preset, so ~500k x 5 x 1.5 = ~3.75M CPU-minutes/day (~2,600 vCPUs continuous, more at peak); outputs roughly equal to input size (~75 TB/day), originals kept at a cheaper storage tier. Upload: client asks the API to create a video record (idempotency key), receives an upload id and presigned URLs for multipart/chunked upload directly to object storage (S3 multipart or a tus-style resumable protocol); on drop it asks which parts exist and resumes; on completion the client (or a storage event) marks the upload complete. Processing: storage event -> workflow orchestrator (Step Functions, Temporal, or a job table plus queues) that runs validate/probe, content checks, split into segments (GOP-aligned chunks) for parallel transcoding of each rendition, stitch/package into HLS, generate thumbnails, then publish; each task is idempotent (deterministic output paths keyed by video id + rendition + chunk, so a retried task overwrites rather than duplicates), with visibility timeouts/heartbeats so a crashed worker's task is retried, bounded retries and a dead-letter queue. Video state machine: CREATED -> UPLOADING -> UPLOADED -> PROCESSING -> READY/FAILED with per-rendition status; publish is an atomic state flip after all required renditions exist. Workers: autoscaled on queue depth, spot/preemptible instances (chunks make preemption cheap), GPU or hardware encoders where cost-effective; prioritise short videos and paying customers. Delivery: HLS manifests and segments served from a CDN with long cache TTLs (segments immutable), origin shield in front of object storage, signed URLs or tokens for private videos; mobile clients choose bitrate adaptively. Notifications: status changes published to an event bus -> push notifications and a status endpoint/WebSocket for the uploader. Cost: content hash of the original to deduplicate identical uploads (with care for privacy and takedowns), skip renditions above the source resolution, per-title encoding, lifecycle policies to move originals to cold storage, delete abandoned multipart uploads.

**Common pitfalls**

- Streaming uploads through the application servers, which ties up connections and bandwidth.
- Single-request uploads with no resume, so mobile users restart large uploads from zero.
- One worker transcoding a whole video into every rendition sequentially, so a crash loses all the work and long videos are slow.
- Non-idempotent tasks (random output names, append-only writes), so retries create duplicate or partial outputs.
- Publishing a video before all required renditions are complete, or with no state machine to say what is ready.
- Serving progressive MP4 files from origin storage instead of adaptive streaming through a CDN.
- No plan for compute and storage costs: keeping every original in hot storage, transcoding renditions above the source resolution, never cleaning up abandoned uploads.

**Likely deep dives**

- Resumable uploads directly to object storage with presigned multipart URLs
- The processing workflow: state machine, chunked parallel transcoding, idempotent tasks and crash recovery
- Adaptive streaming delivery through a CDN, and private videos
- Scaling and cost: autoscaling on queue depth, spot instances, prioritisation, deduplication and storage tiers
- Progress tracking and notifications to the uploader

</details>

## Follow-up questions

Asked in writing after you submit.

- A creator uploads a 1.5 GB video from a phone on a train. The connection drops three times. Walk through the API calls the app makes and what the server stores after each drop.
- A transcoding worker crashes 80% of the way through the 1080p rendition. What happens next, how does the system notice, and how do you avoid publishing a half-finished video or doing all the work twice?
- A popular brand posts a video and 2 million viewers open it within 10 minutes. Trace a viewer's playback request and explain why your origin storage doesn't melt.
- Processing compute is now the largest line on the cloud bill. Where would you look to cut it, and what does each option cost in quality or latency?
- The same 300 MB promo video is uploaded 5,000 times by different franchise accounts of one brand. How would you notice and avoid storing and transcoding it 5,000 times, and what are the risks?

## Study resources

- [AWS docs — Uploading objects with presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [AWS docs — Uploading and copying objects using multipart upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)
- [Wikipedia — Adaptive bitrate streaming](https://en.wikipedia.org/wiki/Adaptive_bitrate_streaming)
- [Temporal docs — Workflow execution](https://docs.temporal.io/workflow-execution)
- [Latency numbers every programmer should know](https://gist.github.com/jboner/2841832)
- [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)
- [The System Design Primer](https://github.com/donnemartin/system-design-primer)
- [ByteByteGo — System design](https://bytebytego.com/)
- [Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction)
