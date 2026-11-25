# Compass Events

Events are scheduled activities that can stand alone, belong to a quest, or reference a checkpoint from that quest. The Events screen lets you create, edit, complete, reopen, and remove them. Completed events earn points using the existing duration rule. An event linked to a checkpoint uses the checkpoint's points, so recording the same activity twice does not increase the total. Standalone events use a selected attribute. Scheduling alone earns zero.

Export a calendar file for use with any calendar app. Google Calendar publishing is optional and connects through Compass. The connection asks for event-write access through Google consent. Compass publishes to a separate calendar it creates for Compass events. The user chooses which events to publish. Publishing again updates the existing Google event, and a separate action removes it from Google while keeping the Compass record. Existing calendar imports remain read-only.

Verify create, edit, points on completion, linked-checkpoint scoring, and calendar-file import without a Google connection. Test Google publishing, updating, and removing with provider fixtures, then verify consent and write operations with a live Google account.

## Iteration 9 — Events and publishing

Open **Events** to schedule an activity. To start with a quest selected, choose **Add event to this quest** from its thread. You can complete an event once it starts. Its points go to the quest's attributes or to the attribute you picked for a standalone event. Reopening or removing the event recalculates those points. If you link a checkpoint, its minutes and points are the record for that activity.

Use **Download .ics** for a single event or **Download calendar file** for all events. The files include dates, times, titles, and notes. They import into calendar apps such as Google Calendar, Apple Calendar, and Outlook.

## Google Calendar setup

1. Run `npm run db:migrate` with the target Supabase database configured in `.env`.
2. Enable the Google Calendar API for the OAuth client. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` on the server. Register `https://<your-app-host>/api/events/google/callback` as an authorized redirect URI for each host. Add yourself as a test user if your consent screen is in testing.
3. In Compass, open **Events** and choose **Connect Google Calendar**. Approve access to calendars Compass creates. This opens a separate **Compass Events** calendar.
4. Select **Publish to Google** on an event. Use **Update on Google** after changing its title, time, or notes. **Remove from Google** removes that copy and keeps the Compass event. Disconnecting keeps any copies already in Google.

**Hosted check:** Connect with a Google account, then publish, edit, update, and remove one event. Verify the same Google event updates on retry and that the original Compass record is still present after removal.
