const round1 = (value) => Math.round(value * 10) / 10;

function sceneEntries(content) {
  return Object.values(content?.scenes ?? {}).map((scene, index) => ({
    ...scene,
    display_order: Number.isFinite(Number(scene.display_order)) ? Number(scene.display_order) : index,
  }));
}

function sceneInsight(scene) {
  if (!scene.reachedStudents) return 'No students have reached this scene yet.';
  if (!scene.passedStudents) {
    return `${scene.reachedStudents} ${scene.reachedStudents === 1 ? 'student has' : 'students have'} reached this scene, but no correct answer is recorded yet.`;
  }

  if (scene.passedStudents === scene.reachedStudents && scene.attempts.first === scene.passedStudents) {
    return 'Everyone who reached this scene passed on the first try.';
  }

  const slower = [
    [scene.attempts.second, '2 tries'],
    [scene.attempts.third, '3 tries'],
    [scene.attempts.fourPlus, '4 or more tries'],
  ].filter(([count]) => count > 0);
  const parts = [];
  if (scene.attempts.first) parts.push(`${scene.attempts.first} passed on the first try`);
  for (const [count, label] of slower) {
    parts.push(`${count} ${count === 1 ? 'student needed' : 'students needed'} ${label}`);
  }
  if (scene.droppedOff) parts.push(`${scene.droppedOff} ${scene.droppedOff === 1 ? 'has' : 'have'} not passed yet`);
  return `${parts.join('; ')}.`;
}

function summarizeStory(story, storySessions, storyLogs, versionsById) {
  const sessionById = new Map(storySessions.map((session) => [session.id, session]));
  const definitions = new Map();
  const versionScenes = new Map();

  const addVersion = (versionId) => {
    if (!versionId || versionScenes.has(versionId)) return;
    const version = versionsById.get(versionId);
    if (!version) return;
    const scenes = sceneEntries(version.content);
    versionScenes.set(versionId, new Map(scenes.map((scene) => [scene.id, scene])));
    for (const scene of scenes) {
      const hasCorrectChoice = (scene.choices ?? []).some((choice) => choice.is_correct);
      if (scene.scene_type === 'decision' || hasCorrectChoice) {
        if (!definitions.has(scene.id) || versionId === story.published_version_id) {
          definitions.set(scene.id, scene);
        }
      }
    }
  };

  // Prefer the current published version, then include older scenes used by
  // existing sessions so reports remain useful after a story is republished.
  addVersion(story.published_version_id);
  for (const session of storySessions) addVersion(session.story_version_id);

  const runsByScene = new Map();
  const logGroups = new Map();
  for (const log of storyLogs) {
    if (!log.scene_id) continue;
    const session = sessionById.get(log.game_session_id);
    if (!session) continue;
    const key = `${session.id}:${log.scene_id}`;
    if (!logGroups.has(key)) logGroups.set(key, { session, sceneId: log.scene_id, logs: [] });
    logGroups.get(key).logs.push(log);
  }

  for (const group of logGroups.values()) {
    group.logs.sort((a, b) => new Date(a.selected_at) - new Date(b.selected_at));
    const firstCorrect = group.logs.findIndex((log) => log.is_correct);
    const loggedAttempt = Number(group.logs[firstCorrect >= 0 ? firstCorrect : group.logs.length - 1]?.attempt_number) || 1;
    const run = {
      sessionId: group.session.id,
      studentId: group.session.student_id,
      startedAt: group.session.started_at,
      attempts: firstCorrect >= 0 ? Math.max(firstCorrect + 1, loggedAttempt) : Math.max(group.logs.length, loggedAttempt),
      passed: firstCorrect >= 0,
    };
    if (!runsByScene.has(group.sceneId)) runsByScene.set(group.sceneId, []);
    runsByScene.get(group.sceneId).push(run);
    if (!definitions.has(group.sceneId)) {
      const versionScene = versionScenes.get(group.session.story_version_id)?.get(group.sceneId);
      definitions.set(group.sceneId, versionScene || {
        id: group.sceneId,
        title: group.logs.find((log) => log.scene_title_snapshot)?.scene_title_snapshot || 'Untitled scene',
        scene_type: 'decision',
        display_order: 9999,
      });
    }
  }

  const studentRunsByScene = new Map();
  for (const [sceneId, runs] of runsByScene) {
    const byStudent = new Map();
    for (const run of runs) {
      if (!byStudent.has(run.studentId)) byStudent.set(run.studentId, []);
      byStudent.get(run.studentId).push(run);
    }
    studentRunsByScene.set(sceneId, byStudent);
  }

  const sceneStats = [...definitions.values()]
    .sort((a, b) => a.display_order - b.display_order || String(a.title).localeCompare(String(b.title)))
    .map((definition) => {
      const reached = new Set();
      const passed = new Set();
      for (const group of logGroups.values()) {
        if (group.sceneId === definition.id) {
          reached.add(group.session.student_id);
          if (group.logs.some((log) => log.is_correct)) passed.add(group.session.student_id);
        }
      }
      for (const session of storySessions) {
        if (session.current_scene_id === definition.id) reached.add(session.student_id);
      }

      const attempts = { first: 0, second: 0, third: 0, fourPlus: 0 };
      const byStudent = studentRunsByScene.get(definition.id) ?? new Map();
      const learnerAttempts = [];
      for (const runs of byStudent.values()) {
        runs.sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
        const passingRun = runs.find((run) => run.passed);
        const selectedRun = passingRun || runs[runs.length - 1];
        if (selectedRun?.passed) {
          learnerAttempts.push(selectedRun.attempts);
          if (selectedRun.attempts === 1) attempts.first += 1;
          else if (selectedRun.attempts === 2) attempts.second += 1;
          else if (selectedRun.attempts === 3) attempts.third += 1;
          else attempts.fourPlus += 1;
        }
      }

      const reachedStudents = reached.size;
      const passedStudents = passed.size;
      const droppedOff = Math.max(0, reachedStudents - passedStudents);
      const avgAttempts = learnerAttempts.length
        ? round1(learnerAttempts.reduce((sum, value) => sum + value, 0) / learnerAttempts.length)
        : null;
      const scene = {
        id: definition.id,
        title: definition.title || 'Untitled scene',
        reachedStudents,
        passedStudents,
        droppedOff,
        avgAttempts,
        attempts,
      };
      scene.insight = sceneInsight(scene);
      return scene;
    });

  const startedStudents = new Set(storySessions.map((session) => session.student_id));
  const finishedStudents = new Set(storySessions.filter((session) => session.status === 'completed').map((session) => session.student_id));
  const successRate = startedStudents.size ? Math.round((finishedStudents.size / startedStudents.size) * 100) : 0;
  const passedScenes = sceneStats.filter((scene) => scene.avgAttempts !== null);
  const successfulScenePasses = passedScenes.reduce((sum, scene) => sum + scene.passedStudents, 0);
  const averageAttemptsPerScene = successfulScenePasses
    ? round1(passedScenes.reduce((sum, scene) => sum + scene.avgAttempts * scene.passedStudents, 0) / successfulScenePasses)
    : null;
  const hardestScene = [...passedScenes].sort((a, b) => b.avgAttempts - a.avgAttempts)[0] ?? null;
  const dropoffScene = [...sceneStats].filter((scene) => scene.droppedOff > 0)
    .sort((a, b) => b.droppedOff - a.droppedOff || (b.reachedStudents - a.reachedStudents))[0] ?? null;

  const wrongAnswers = new Map();
  for (const log of storyLogs) {
    if (log.is_correct || !log.scene_id || !log.choice_text_snapshot) continue;
    const session = sessionById.get(log.game_session_id);
    if (!session) continue;
    const scene = versionScenes.get(session.story_version_id)?.get(log.scene_id);
    const resultScene = log.resulting_scene_id
      ? versionScenes.get(session.story_version_id)?.get(log.resulting_scene_id)
      : null;
    const key = `${log.scene_id}:${log.choice_text_snapshot}:${log.resulting_scene_id || ''}`;
    if (!wrongAnswers.has(key)) {
      wrongAnswers.set(key, {
        sceneTitle: log.scene_title_snapshot || scene?.title || 'Untitled scene',
        choiceText: log.choice_text_snapshot,
        branchTitle: resultScene?.title || '',
        selections: 0,
        students: new Set(),
      });
    }
    const answer = wrongAnswers.get(key);
    answer.selections += 1;
    answer.students.add(log.student_id);
  }

  const mostWrongAnswers = [...wrongAnswers.values()]
    .map(({ students, ...answer }) => ({ ...answer, students: students.size }))
    .sort((a, b) => b.selections - a.selections)
    .slice(0, 5);

  return {
    id: story.id,
    title: story.title,
    coverImage: story.cover_image_path,
    hasData: storySessions.length > 0,
    startedStudents: startedStudents.size,
    finishedStudents: finishedStudents.size,
    successRate,
    averageAttemptsPerScene,
    successfulScenePasses,
    hardestScene,
    dropoffScene,
    scenes: sceneStats,
    mostWrongAnswers,
  };
}

export function buildStoryAnalytics({ stories, sessions, choiceLogs, versions, totalStudents }) {
  const versionsById = new Map(versions.map((version) => [version.id, version]));
  const storiesWithStats = stories.map((story) => {
    const storySessions = sessions.filter((session) => session.story_id === story.id);
    const storyLogs = choiceLogs.filter((log) => log.story_id === story.id);
    return summarizeStory(story, storySessions, storyLogs, versionsById);
  });

  const startedPairs = new Set();
  const finishedPairs = new Set();
  for (const session of sessions) {
    const key = `${session.story_id}:${session.student_id}`;
    startedPairs.add(key);
    if (session.status === 'completed') finishedPairs.add(key);
  }

  const storiesWithAttempts = storiesWithStats.filter((story) => story.averageAttemptsPerScene !== null);
  const successfulScenePasses = storiesWithAttempts.reduce((sum, story) => sum + story.successfulScenePasses, 0);
  const averageAttemptsPerScene = successfulScenePasses
    ? round1(storiesWithAttempts.reduce((sum, story) => sum + story.averageAttemptsPerScene * story.successfulScenePasses, 0) / successfulScenePasses)
    : null;
  const easiestStory = [...storiesWithAttempts].sort((a, b) => a.averageAttemptsPerScene - b.averageAttemptsPerScene)[0] ?? null;
  const hardestStory = [...storiesWithAttempts].sort((a, b) => b.averageAttemptsPerScene - a.averageAttemptsPerScene)[0] ?? null;

  return {
    summary: {
      totalStudents,
      completionRate: startedPairs.size ? Math.round((finishedPairs.size / startedPairs.size) * 100) : 0,
      averageAttemptsPerScene,
      easiestStory: easiestStory ? { id: easiestStory.id, title: easiestStory.title, averageAttemptsPerScene: easiestStory.averageAttemptsPerScene } : null,
      hardestStory: hardestStory ? { id: hardestStory.id, title: hardestStory.title, averageAttemptsPerScene: hardestStory.averageAttemptsPerScene } : null,
    },
    stories: storiesWithStats,
  };
}
