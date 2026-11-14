# Design r/place with Multiple Canvases

Design a collaborative pixel canvas in the style of Reddit's r/place. Visitors see a large shared image and can colour one pixel at a time; after placing a pixel, they must wait before placing another. Everyone watching sees changes appear in near real time.

Your version has two twists:

- **Multiple canvases.** Communities can create their own canvases. Each has its own size, palette and cooldown, and they run side by side with one huge flagship canvas.
- **Anonymous access.** Viewing and placing pixels doesn't require an account.

You have about **45 minutes**. Drive the conversation:

1. **Clarify requirements.** Ask about scale, canvas sizes, cooldowns, latency, history, and abuse. The interviewer has the numbers.
2. **Estimate** the load: placements per second, viewers, canvas sizes in bytes, and update bandwidth.
3. **Design the system**: APIs, data model, and how a pixel gets from one user's click to everyone else's screen, and how a new viewer gets the current canvas.
4. **Go deep** on the hardest parts, such as real-time fan-out, cooldowns and bots without accounts, and very different canvas sizes and popularity.

Use the **Whiteboard** tab to draw, and the **Notes** tab (markdown) for requirements, estimates, and tradeoffs. The interviewer sees both when you send a message.
