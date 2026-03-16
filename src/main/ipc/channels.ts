export const IPC_CHANNELS = {
  // Settings
  GET_SETTINGS: 'settings:get',
  UPDATE_SETTINGS: 'settings:update',

  // Coaching session
  START_SESSION: 'session:start',
  STOP_SESSION: 'session:stop',
  GET_SESSION_STATS: 'session:stats',

  // Coaching tips (main -> renderer)
  COACHING_TIP: 'coaching:tip',
  COACHING_STATUS: 'coaching:status',

  // Overlay control
  UPDATE_OVERLAY: 'overlay:update',
  TOGGLE_OVERLAY: 'overlay:toggle',

  // Death detection
  DEATH_DETECTED: 'death:detected',
  CALIBRATE_START: 'calibrate:start',
  CALIBRATE_DONE: 'calibrate:done',

  // Cost tracking
  COST_UPDATE: 'cost:update',

  // Test connection
  TEST_API_KEY: 'api:test',

  // Debug
  TEST_CAPTURE: 'debug:test-capture',
} as const;
