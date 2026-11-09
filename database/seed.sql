-- ============================================================================
-- Branching Story PWA - Seed Data (Phase 1)
--
-- Creates four placeholder stories, each a complete, playable branching graph:
--
--   start scene ──> decision scene ──(correct)──> ending scene
--                        │  ▲
--                        │  └── (retry choice) ── failure scene
--                        └─────(wrong)───────────┘
--
-- Real content will replace these later through the admin story editor.
-- Run AFTER database/schema.sql.
--
-- Safe to re-run: it does nothing if any stories already exist.
-- ============================================================================

do $$
declare
  v_stories jsonb := '[
    {
      "title": "The Whispering Forest",
      "description": "A lost traveller must choose the safest path out of an enchanted forest before nightfall.",
      "cover": "/images/story-placeholder-1.jpg",
      "start_title": "Edge of the Woods",
      "start_narration": "You wake at the edge of the Whispering Forest with no memory of how you arrived. The trees lean toward you as if listening. Somewhere inside, a lantern flickers between the trunks.",
      "decision_title": "Three Ways In",
      "decision_narration": "The forest splits into three paths. The left path glows with lantern light. The middle path drops into a dark ravine. The right path climbs past an enormous old oak.",
      "choices": [
        {"text": "Follow the lantern light", "correct": true,
         "feedback": "The lantern light marks the ranger trail. You are safe."},
        {"text": "Take the dark ravine", "correct": false,
         "failure": "The ravine floor is slick with moss and you slide into a shallow creek. Soaked and shivering, you climb back to the fork."},
        {"text": "Climb the old oak", "correct": false,
         "failure": "The branches creak and bend. You scramble back down before the whole tree gives way."}
      ],
      "ending_narration": "The ranger trail opens onto a warm clearing. A keeper with a lantern waves you toward a cabin. You made it out before dark."
    },
    {
      "title": "The Clockwork Classroom",
      "description": "A strange substitute teacher leaves a puzzle on the board that unlocks the way home.",
      "cover": "/images/story-placeholder-2.jpg",
      "start_title": "A Substitution",
      "start_narration": "The substitute teacher clicks once, and every clock in the classroom begins ticking backwards. On the board, a single riddle appears in chalk.",
      "decision_title": "The Riddle",
      "decision_narration": "The riddle reads: I have hands but cannot clap, a face but cannot smile. What am I? Two answers are written below it.",
      "choices": [
        {"text": "A clock", "correct": true,
         "feedback": "Correct. The chalk riddle fades and the classroom door clicks open."},
        {"text": "A mirror", "correct": false,
         "failure": "The chalk glows red and the clocks tick louder. The riddle stays on the board."}
      ],
      "ending_narration": "The door opens onto the ordinary hallway. The substitute tips an imaginary hat and vanishes with the last chime."
    },
    {
      "title": "The Lantern Lighthouse",
      "description": "A young keeper must relight the lighthouse beacon before a storm swallows the harbor.",
      "cover": "/images/story-placeholder-3.jpg",
      "start_title": "Storm Rising",
      "start_narration": "The wind tears at the lighthouse shutters. Below, the harbor lights blink out one by one. The beacon above you is dark, and the storm is minutes away.",
      "decision_title": "Relight the Beacon",
      "decision_narration": "The lamp room holds four things. Only one of them will bring the beacon back to life.",
      "choices": [
        {"text": "The spare wick and the flint", "correct": true,
         "feedback": "The wick catches. Light floods the harbor."},
        {"text": "The brass compass", "correct": false,
         "failure": "The compass spins uselessly. The beacon stays dark."},
        {"text": "The captain''s logbook", "correct": false,
         "failure": "Paper will not light a beacon. The storm rolls closer."},
        {"text": "A handful of sea glass", "correct": false,
         "failure": "The sea glass only glitters. The beacon stays dark."}
      ],
      "ending_narration": "The beacon sweeps across the water and every ship finds its way in. The storm breaks harmlessly against the cliffs."
    },
    {
      "title": "The Garden of Seasons",
      "description": "A gardener must decide which season to release from a set of sealed glass globes.",
      "cover": "/images/story-placeholder-4.jpg",
      "start_title": "The Sealed Garden",
      "start_narration": "The garden is frozen mid-bloom. Three glass globes float above the fountain, each holding a different season. A note reads: Release only what the garden needs.",
      "decision_title": "Choose a Season",
      "decision_narration": "The garden is trapped in an endless winter. Which season should be released first?",
      "choices": [
        {"text": "Spring", "correct": true,
         "feedback": "Warmth returns. Buds open across the garden."},
        {"text": "A second winter", "correct": false,
         "failure": "The frost thickens. The garden groans under new ice."},
        {"text": "Autumn", "correct": false,
         "failure": "Leaves scatter, but the cold remains. The garden still sleeps."}
      ],
      "ending_narration": "The garden breathes again, green and bright. The remaining globes settle gently back onto their pedestals for another day."
    }
  ]'::jsonb;

  v_story           jsonb;
  v_story_id        uuid;
  v_start_id        uuid;
  v_decision_id     uuid;
  v_ending_id       uuid;
  v_fail_id         uuid;
  v_choice          jsonb;
  v_idx             integer;
  v_order           integer;
  v_story_sequence  integer := 0;
begin
  if (select count(*) from public.stories) > 0 then
    raise notice 'Stories already exist - skipping seed.';
    return;
  end if;

  for v_story in select * from jsonb_array_elements(v_stories) loop

    insert into public.stories (title, description, cover_image_path, status, sequence_order, unlock_after_previous)
    values (
      v_story->>'title',
      v_story->>'description',
      v_story->>'cover',
      'draft',
      v_story_sequence,
      true
    )
    returning id into v_story_id;
    v_story_sequence := v_story_sequence + 1;

    -- Start scene
    insert into public.scenes (story_id, title, scene_type, narration, display_order)
    values (v_story_id, v_story->>'start_title', 'start', v_story->>'start_narration', 0)
    returning id into v_start_id;

    -- Decision scene
    insert into public.scenes (story_id, title, scene_type, narration, display_order)
    values (v_story_id, v_story->>'decision_title', 'decision', v_story->>'decision_narration', 1)
    returning id into v_decision_id;

    -- Ending scene
    insert into public.scenes (story_id, title, scene_type, narration, display_order)
    values (v_story_id, 'Ending', 'ending', v_story->>'ending_narration', 2)
    returning id into v_ending_id;

    -- Start scene's single "continue" choice leads into the decision.
    insert into public.choices (scene_id, story_id, text, destination_scene_id, is_correct, display_order)
    values (v_start_id, v_story_id, 'Continue', v_decision_id, false, 0);

    -- One choice per option; wrong options get their own failure scene.
    v_order := 0;
    for v_choice in select * from jsonb_array_elements(v_story->'choices') loop
      v_fail_id := null;

      if (v_choice->>'correct')::boolean then
        insert into public.choices (
          scene_id, story_id, text, destination_scene_id,
          is_correct, feedback, display_order
        ) values (
          v_decision_id, v_story_id, v_choice->>'text', v_ending_id,
          true, v_choice->>'feedback', v_order
        );
      else
        insert into public.scenes (story_id, title, scene_type, narration, display_order)
        values (
          v_story_id,
          'Setback',
          'failure',
          v_choice->>'failure',
          10 + v_order
        )
        returning id into v_fail_id;

        insert into public.choices (
          scene_id, story_id, text, destination_scene_id,
          failure_scene_id, is_correct, display_order
        ) values (
          v_decision_id, v_story_id, v_choice->>'text', v_fail_id,
          v_fail_id, false, v_order
        );

        -- Failure scene loops back to the original decision.
        insert into public.choices (scene_id, story_id, text, destination_scene_id, is_correct, display_order)
        values (v_fail_id, v_story_id, 'Try again', v_decision_id, false, 0);
      end if;

      v_order := v_order + 1;
    end loop;

    -- Point the story at its start scene and publish an immutable version.
    update public.stories
       set starting_scene_id = v_start_id
     where id = v_story_id;

    perform public.publish_story_version(v_story_id, null);

  end loop;

  raise notice 'Seeded % stories.', (select count(*) from public.stories);
end $$;

-- ============================================================================
-- Admin bootstrap is NOT done here on purpose. Create the first administrator
-- with the secure script (never through public signup):
--
--   cd server
--   npm run bootstrap-admin
--
-- after setting ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_USERNAME in .env.
-- ============================================================================
