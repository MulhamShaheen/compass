# Daily flow

## Iteration 6 — A next step for the main quest

Today brings the latest checkpoint on your active main quest into view. If it gives you an idea for a next step, you can leave yourself a short note. There is room for one idea at a time, so returning to Compass takes you straight back to the same thread.

For example, after a first walk around the park, you might write “Jog one lap.” On your next visit, **Log what happened** opens the checkpoint form for that quest. You can change the title to “Walked a lap with my sister” and enter the time you actually spent. Saving that checkpoint clears the note and awards the usual points. You can also log a checkpoint directly.

An open note carries across days. On a later day in your profile timezone, choose **Keep it**, **Change it** or **Let it go**. Each choice leaves the quest history and points alone.

Pausing or finishing the quest clears its open note. A form left open in another tab checks that the note is still current before logging anything.

### Questions for the next iteration

- After a few return visits, did seeing the latest checkpoint help you pick up the thread?
- When the day went differently, was it clear you could rewrite the planned action before saving the checkpoint?
- On days you only opened Compass once, could you record progress as quickly as before?

### Deployment

With the PR checked out and the target Supabase database configured in `.env`, run `npm run db:migrate` before deploying the app. The local file store supports the same flow without account setup.

The phone tests cover returning to a saved plan, editing the actual result, all three later-day choices and an older tab trying to log a replaced plan. An isolated PostgreSQL check exercised owner-only reads, rollback after a failed checkpoint save and retrying a successful save.
