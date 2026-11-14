# Multipart coding question template

Copy this folder to `questions/coding/<your-id>/`, then:

1. In `question.json`, set `id` (must match the folder name), the title, tags and timing, and fill in
   each entry of `parts`: its `id` (matches the folder under `parts/`), title, suggested minutes,
   typed `signature`, and private `interviewer` notes (approach, hint ladder, pitfalls).
2. Write the shared introduction in `prompt.md` and each part's prompt in `parts/<part-id>/prompt.md`.
3. Put every part's function (or class) in `reference.py`, using the Python entry names.
4. Add tests to `parts/<part-id>/tests.json` (`public` are shown as samples, `hidden` run on hand-in).
5. Run `npm run validate`. It runs the reference against every part's tests.

Add more parts by adding entries to `parts` (and folders under `parts/`). The placeholder content
here is a working two-part question (sum, then maximum), so it validates as-is once copied.
See "Multipart questions" in the project README for how rounds with parts work.
