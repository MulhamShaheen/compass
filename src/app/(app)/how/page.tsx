import { CHARACTER_LEVEL_STEP, ATTRIBUTE_LEVEL_STEP, MILESTONE_BONUS, NOTE_ONLY_POINTS } from "@/lib/game";

export default function HowPage() {
  return (
    <main className="codex">
      <section className="panel">
        <h2>The idea</h2>
        <p>
          Your life is one long storyline. Compass is the window onto it: the threads you are following, how far each has come, how you
          feel, and where your time actually goes.
        </p>
        <p>
          A quest is a thread, not a task. It can run for months. You move it forward by logging checkpoints: what happened, when, how long
          it took and what you think about it. Read back, a quest becomes the story of that part of your life.
        </p>
      </section>
      <section className="panel">
        <h2>Building blocks</h2>
        <dl>
          <dt>True North</dt>
          <dd>One sentence of purpose. Main quests should point at it.</dd>
          <dt>Quests</dt>
          <dd>Long-running threads, main or side. Each links to one or two attributes and can be active, paused or completed.</dd>
          <dt>Checkpoints</dt>
          <dd>Dated entries inside a quest: a title, your commentary, time spent, and an optional milestone flag.</dd>
          <dt>Attributes</dt>
          <dd>Body, Mind, Bonds, Craft, Spirit. Checkpoints feed them, so you can see which parts of life get your time.</dd>
          <dt>Habits</dt>
          <dd>Good ones to keep, bad ones to starve, with a 7-day strip.</dd>
          <dt>Inner weather and logbook</dt>
          <dd>How you feel today, and a short diary with one reflective question.</dd>
        </dl>
      </section>
      <section className="panel">
        <h2>How points work</h2>
        <ul>
          <li>Each checkpoint earns 1 point per 6 minutes spent (10 per hour).</li>
          <li>A milestone adds a {MILESTONE_BONUS}-point bonus.</li>
          <li>A checkpoint with no time logged still earns {NOTE_ONLY_POINTS} points, because noticing counts.</li>
          <li>Quests with two attributes split points 70/30 between primary and secondary.</li>
          <li>
            Each attribute levels up every {ATTRIBUTE_LEVEL_STEP} points. Character level rises every {CHARACTER_LEVEL_STEP} points in total.
          </li>
        </ul>
      </section>
      <section className="panel">
        <h2>Slots and unlocks</h2>
        <ul>
          <li>You hold 1 main quest and 3 side quests at a time. You gain a side slot at levels 3, 5 and 8. Pausing frees a slot.</li>
          <li>Habits start with 2 slots, one to keep and one to starve. Each weekly review adds one, up to 6.</li>
          <li>The map opens as you play: habits, side quests, the character panel, where life goes, and the weekly review.</li>
        </ul>
      </section>
      <section className="panel">
        <h2>The daily loop</h2>
        <ol>
          <li>
            <b>Morning check-in.</b> Set your inner weather.
          </li>
          <li>
            <b>Move a thread.</b> Log at least one checkpoint on any quest.
          </li>
          <li>
            <b>Evening logbook.</b> Answer one question.
          </li>
          <li>
            <b>Weekly look.</b> Check where life went this week and whether it matches your True North.
          </li>
        </ol>
      </section>
    </main>
  );
}
