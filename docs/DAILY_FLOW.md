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

The Today plan landed in [PR #4](https://github.com/MulhamShaheen/compass/pull/4). Run `npm run db:migrate` against the target Supabase database before deploying if it still needs the Today plan migration. The local file store supports the same flow without account setup.

The phone tests cover returning to a saved plan, editing the actual result, all three later-day choices and an older tab trying to log a replaced plan. An isolated PostgreSQL check exercised owner-only reads, rollback after a failed checkpoint save and retrying a successful save.

## Iteration 7 — Reflect on one checkpoint

The evening logbook can start with something that happened today. Choose **Reflect on a checkpoint**, pick a moment from a main or side quest, and write why it mattered. If you set a True North, the logbook shows it beside the question. You can switch back to the daily question and keep the words you’ve already written.

For example, “Walked a lap with my sister” might sit under “Run a 10K,” but the thing worth remembering was the conversation on the way home. Saving that reflection puts the quest name, checkpoint title and question in the journal entry. They remain readable in the logbook and JSON export even if the checkpoint changes later.

The choices follow the date the checkpoint happened in your profile timezone. The entry uses the existing journal format, counts toward the daily writing ritual and adds no points. This iteration needs no database migration.

**Question for the next review:** On an evening when a quest moved forward, did starting with a particular moment help you write something the regular question would have missed?
