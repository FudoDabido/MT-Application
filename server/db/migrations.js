const db = require('./database');

function addCol(table, col, def) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch(e) {}
}

function runMigrations() {
  // ─── Core tables (existing) ────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      birth_date TEXT,
      initial_weight REAL,
      initial_height REAL,
      photo_path TEXT,
      is_anonymous INTEGER DEFAULT 0,
      is_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exercise_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('strength','cardio','custom')),
      is_system INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workout_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      exercise_type_id INTEGER NOT NULL REFERENCES exercise_types(id),
      logged_at TEXT DEFAULT (datetime('now')),
      sets INTEGER,
      reps INTEGER,
      distance_km REAL,
      duration_secs INTEGER,
      video_path TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS personal_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      exercise_type_id INTEGER NOT NULL REFERENCES exercise_types(id),
      best_reps INTEGER,
      best_sets INTEGER,
      best_distance_km REAL,
      best_duration_secs INTEGER,
      log_id INTEGER REFERENCES workout_logs(id),
      achieved_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, exercise_type_id)
    );

    CREATE TABLE IF NOT EXISTS monthly_checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      weight_kg REAL,
      height_cm REAL,
      checked_in_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, year, month)
    );
  `);

  // ─── Extend users ──────────────────────────────────────────────────────────
  addCol('users', 'username', 'TEXT');
  addCol('users', 'is_admin', 'INTEGER DEFAULT 0');
  addCol('users', 'meditation_mode', "TEXT DEFAULT '1h_morning'");

  // ─── Extend exercise_types ─────────────────────────────────────────────────
  addCol('exercise_types', 'muscle_group', 'TEXT');
  addCol('exercise_types', 'secondary_muscles', 'TEXT');
  addCol('exercise_types', 'difficulty', "TEXT DEFAULT 'beginner'");
  addCol('exercise_types', 'movement_type', 'TEXT');
  addCol('exercise_types', 'required_equipment', 'TEXT'); // JSON array e.g. '["dumbbells"]' or null for bodyweight
  addCol('exercise_types', 'is_compound', 'INTEGER DEFAULT 0');
  addCol('exercise_types', 'met_value', 'REAL DEFAULT 4.0'); // metabolic equivalent for load calc

  // ─── New tables ────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      icon TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS user_equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      equipment_item_id INTEGER NOT NULL REFERENCES equipment_items(id),
      extra_data TEXT,
      UNIQUE(user_id, equipment_item_id)
    );

    CREATE TABLE IF NOT EXISTS user_onboarding (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
      completed INTEGER DEFAULT 0,
      training_location TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS program_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      try_number INTEGER NOT NULL DEFAULT 1,
      started_at TEXT DEFAULT (datetime('now')),
      ended_at TEXT,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      wake_time TEXT,
      notes TEXT,
      UNIQUE(user_id, date)
    );

    CREATE TABLE IF NOT EXISTS program_setup (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER UNIQUE NOT NULL REFERENCES program_attempts(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      start_weight REAL,
      start_height REAL,
      phases_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ─── Seed equipment items ──────────────────────────────────────────────────
  db.exec(`
    INSERT OR IGNORE INTO equipment_items (id,name,category,icon,description) VALUES
      (1,'No Equipment / Bodyweight','bodyweight','🤸','No equipment needed'),
      (2,'Pull-up Bar','bodyweight','🔧','Doorframe or freestanding pull-up bar'),
      (3,'Dip Bars','bodyweight','🔩','Parallel dip bars or dip station'),
      (4,'Jump Rope','bodyweight','🪢','Standard jump rope'),
      (5,'Exercise Mat','bodyweight','🟩','Yoga or exercise mat'),
      (6,'Gymnastics Rings','bodyweight','⭕','Olympic rings for advanced calisthenics'),
      (7,'Dumbbells','free_weights','🏋️','Fixed or adjustable dumbbells'),
      (8,'Barbell','free_weights','🏋️','Olympic or standard barbell with weight plates'),
      (9,'EZ Bar','free_weights','〰️','Curved barbell for curls and skull crushers'),
      (10,'Kettlebells','free_weights','🔔','Kettlebell set'),
      (11,'Flat Bench','bench','🛏️','Flat weight bench'),
      (12,'Adjustable Bench','bench','🛏️','Bench with adjustable angles (incline/decline)'),
      (13,'Light Resistance Bands','bands','🔴','Resistance bands: light tension'),
      (14,'Medium Resistance Bands','bands','🟡','Resistance bands: medium tension'),
      (15,'Heavy Resistance Bands','bands','🟢','Resistance bands: heavy tension'),
      (16,'Loop Bands','bands','🔵','Small loop resistance bands (glute bands)'),
      (17,'Cable Machine','machines','🏭','Full cable stack machine'),
      (18,'Smith Machine','machines','🏗️','Smith machine rack'),
      (19,'Leg Press Machine','machines','🦵','Plate-loaded or selectorized leg press'),
      (20,'Lat Pulldown Machine','machines','⬇️','Lat pulldown / seated row station'),
      (21,'Chest Press Machine','machines','💪','Selectorized chest press'),
      (22,'Shoulder Press Machine','machines','⬆️','Selectorized shoulder press'),
      (23,'Pec Deck Machine','machines','🦅','Pec deck / butterfly machine'),
      (24,'Leg Curl Machine','machines','🦵','Lying or seated leg curl'),
      (25,'Leg Extension Machine','machines','🦵','Seated leg extension'),
      (26,'Hip Thrust Machine','machines','🍑','Dedicated hip thrust / glute machine'),
      (27,'Hack Squat Machine','machines','🏋️','Hack squat plate-loaded machine'),
      (28,'Calf Raise Machine','machines','🦶','Standing or seated calf raise machine'),
      (29,'Ab Crunch Machine','machines','💪','Weighted ab crunch machine'),
      (30,'Back Extension Machine','machines','🔙','45° or Roman chair back extension'),
      (31,'Assisted Pull-up Machine','machines','🤖','Counterweighted pull-up/dip machine'),
      (32,'Treadmill','cardio','🏃','Motorized treadmill'),
      (33,'Stationary Bike','cardio','🚴','Upright or recumbent stationary bike'),
      (34,'Rowing Machine','cardio','🚣','Rowing ergometer'),
      (35,'Elliptical','cardio','🔄','Elliptical cross-trainer'),
      (36,'TRX / Suspension Trainer','other','🔱','TRX or similar suspension training system'),
      (37,'Medicine Ball','other','⚽','Weighted medicine ball'),
      (38,'Foam Roller','other','🫙','Foam roller for recovery');
  `);

  // ─── Seed comprehensive exercise types ────────────────────────────────────
  db.exec(`
    INSERT OR IGNORE INTO exercise_types (id,name,category,is_system,muscle_group,secondary_muscles,difficulty,movement_type,required_equipment,is_compound,met_value) VALUES
    -- BODYWEIGHT (no equipment)
    (1,'Push-ups','strength',1,'chest','triceps,shoulders','beginner','push','null',1,8.0),
    (2,'Pull-ups','strength',1,'back','biceps','intermediate','pull','["pull_up_bar"]',1,8.0),
    (3,'Sit-ups','strength',1,'abs','hip_flexors','beginner','core','null',0,5.0),
    (4,'Running','cardio',1,'full_body','legs,core','beginner','cardio','null',0,9.8),
    (5,'Diamond Push-ups','strength',1,'triceps','chest,shoulders','intermediate','push','null',0,8.0),
    (6,'Wide Push-ups','strength',1,'chest','shoulders','beginner','push','null',0,8.0),
    (7,'Pike Push-ups','strength',1,'shoulders','triceps','intermediate','push','null',0,7.0),
    (8,'Decline Push-ups','strength',1,'upper_chest','shoulders,triceps','intermediate','push','null',0,8.0),
    (9,'Chin-ups','strength',1,'biceps','back','intermediate','pull','["pull_up_bar"]',1,8.0),
    (10,'Dips','strength',1,'triceps','chest,shoulders','intermediate','push','["dip_bars"]',1,8.0),
    (11,'Bodyweight Squat','strength',1,'quads','glutes,hamstrings','beginner','legs','null',1,6.0),
    (12,'Jump Squat','cardio',1,'quads','glutes,calves','intermediate','legs','null',1,10.0),
    (13,'Lunge','strength',1,'quads','glutes,hamstrings','beginner','legs','null',1,6.0),
    (14,'Bulgarian Split Squat','strength',1,'quads','glutes','intermediate','legs','null',1,7.0),
    (15,'Glute Bridge','strength',1,'glutes','hamstrings,core','beginner','legs','null',0,5.0),
    (16,'Hip Thrust (Bodyweight)','strength',1,'glutes','hamstrings','beginner','legs','null',0,5.5),
    (17,'Calf Raise (Bodyweight)','strength',1,'calves','','beginner','legs','null',0,4.0),
    (18,'Plank','strength',1,'core','shoulders,glutes','beginner','core','null',0,4.0),
    (19,'Side Plank','strength',1,'obliques','core','beginner','core','null',0,4.0),
    (20,'Leg Raise','strength',1,'abs','hip_flexors','beginner','core','null',0,5.0),
    (21,'Mountain Climbers','cardio',1,'core','shoulders,legs','beginner','core','null',0,9.0),
    (22,'Burpee','cardio',1,'full_body','','intermediate','cardio','null',1,10.0),
    (23,'Jumping Jacks','cardio',1,'full_body','','beginner','cardio','null',0,8.0),
    (24,'High Knees','cardio',1,'core','legs','beginner','cardio','null',0,9.0),
    (25,'Superman','strength',1,'lower_back','glutes','beginner','core','null',0,4.0),
    (26,'Flutter Kicks','strength',1,'abs','hip_flexors','beginner','core','null',0,5.0),
    (27,'Russian Twist','strength',1,'obliques','abs','beginner','core','null',0,5.0),
    (28,'Crunch','strength',1,'abs','','beginner','core','null',0,5.0),
    -- DUMBBELL EXERCISES
    (29,'Dumbbell Bench Press','strength',1,'chest','triceps,shoulders','beginner','push','["dumbbells","bench"]',1,6.0),
    (30,'Dumbbell Fly','strength',1,'chest','shoulders','beginner','push','["dumbbells","bench"]',0,5.0),
    (31,'Dumbbell Overhead Press','strength',1,'shoulders','triceps','beginner','push','["dumbbells"]',1,6.0),
    (32,'Dumbbell Lateral Raise','strength',1,'shoulders','traps','beginner','push','["dumbbells"]',0,4.0),
    (33,'Dumbbell Front Raise','strength',1,'shoulders','','beginner','push','["dumbbells"]',0,4.0),
    (34,'Dumbbell Bent-Over Row','strength',1,'back','biceps,rear_delts','beginner','pull','["dumbbells"]',1,6.0),
    (35,'Dumbbell Romanian Deadlift','strength',1,'hamstrings','glutes,lower_back','beginner','legs','["dumbbells"]',1,7.0),
    (36,'Dumbbell Curl','strength',1,'biceps','forearms','beginner','pull','["dumbbells"]',0,4.0),
    (37,'Hammer Curl','strength',1,'biceps','forearms','beginner','pull','["dumbbells"]',0,4.0),
    (38,'Dumbbell Tricep Extension','strength',1,'triceps','','beginner','push','["dumbbells"]',0,4.0),
    (39,'Dumbbell Skull Crusher','strength',1,'triceps','','intermediate','push','["dumbbells","bench"]',0,5.0),
    (40,'Dumbbell Goblet Squat','strength',1,'quads','glutes,core','beginner','legs','["dumbbells"]',1,7.0),
    (41,'Dumbbell Lunge','strength',1,'quads','glutes,hamstrings','beginner','legs','["dumbbells"]',1,7.0),
    (42,'Dumbbell Calf Raise','strength',1,'calves','','beginner','legs','["dumbbells"]',0,4.0),
    (43,'Dumbbell Shrug','strength',1,'traps','','beginner','pull','["dumbbells"]',0,4.0),
    (44,'Dumbbell Deadlift','strength',1,'back','legs,glutes','beginner','pull','["dumbbells"]',1,7.0),
    -- BARBELL EXERCISES
    (45,'Barbell Bench Press','strength',1,'chest','triceps,shoulders','intermediate','push','["barbell","bench"]',1,7.0),
    (46,'Barbell Squat','strength',1,'quads','glutes,hamstrings,core','intermediate','legs','["barbell"]',1,8.0),
    (47,'Barbell Deadlift','strength',1,'back','legs,glutes,traps','intermediate','pull','["barbell"]',1,9.0),
    (48,'Barbell Overhead Press','strength',1,'shoulders','triceps,core','intermediate','push','["barbell"]',1,7.0),
    (49,'Barbell Bent-Over Row','strength',1,'back','biceps,rear_delts','intermediate','pull','["barbell"]',1,7.0),
    (50,'Barbell Curl','strength',1,'biceps','forearms','beginner','pull','["barbell"]',0,4.0),
    (51,'Barbell Skull Crusher','strength',1,'triceps','','intermediate','push','["barbell","bench"]',0,5.0),
    (52,'Barbell Romanian Deadlift','strength',1,'hamstrings','glutes,lower_back','intermediate','legs','["barbell"]',1,8.0),
    (53,'Barbell Hip Thrust','strength',1,'glutes','hamstrings','intermediate','legs','["barbell","bench"]',1,7.0),
    (54,'Barbell Shrug','strength',1,'traps','','beginner','pull','["barbell"]',0,4.0),
    (55,'EZ Bar Curl','strength',1,'biceps','forearms','beginner','pull','["ez_bar"]',0,4.0),
    (56,'EZ Bar Skull Crusher','strength',1,'triceps','','beginner','push','["ez_bar","bench"]',0,4.0),
    -- RESISTANCE BAND EXERCISES
    (57,'Band Pull-Apart','strength',1,'upper_back','rear_delts','beginner','pull','["resistance_bands"]',0,3.0),
    (58,'Band Bicep Curl','strength',1,'biceps','','beginner','pull','["resistance_bands"]',0,3.0),
    (59,'Band Tricep Pushdown','strength',1,'triceps','','beginner','push','["resistance_bands"]',0,3.0),
    (60,'Band Lateral Walk','strength',1,'glutes','abductors','beginner','legs','["loop_bands"]',0,4.0),
    (61,'Band Squat','strength',1,'quads','glutes','beginner','legs','["resistance_bands"]',1,5.0),
    (62,'Band Row','strength',1,'back','biceps','beginner','pull','["resistance_bands"]',1,4.0),
    (63,'Band Face Pull','strength',1,'rear_delts','upper_back','beginner','pull','["resistance_bands"]',0,3.0),
    (64,'Band Hip Thrust','strength',1,'glutes','hamstrings','beginner','legs','["loop_bands"]',0,4.0),
    (65,'Band Chest Press','strength',1,'chest','triceps,shoulders','beginner','push','["resistance_bands"]',1,4.0),
    -- KETTLEBELL EXERCISES
    (66,'Kettlebell Swing','strength',1,'glutes','back,core,hamstrings','intermediate','legs','["kettlebells"]',1,9.0),
    (67,'Kettlebell Goblet Squat','strength',1,'quads','glutes,core','beginner','legs','["kettlebells"]',1,7.0),
    (68,'Kettlebell Turkish Get-Up','strength',1,'full_body','core,shoulders','advanced','core','["kettlebells"]',1,8.0),
    (69,'Kettlebell Row','strength',1,'back','biceps','beginner','pull','["kettlebells"]',1,6.0),
    -- GYM MACHINES
    (70,'Leg Press','strength',1,'quads','glutes,hamstrings','beginner','legs','["leg_press_machine"]',1,7.0),
    (71,'Leg Extension','strength',1,'quads','','beginner','legs','["leg_extension_machine"]',0,5.0),
    (72,'Leg Curl','strength',1,'hamstrings','','beginner','legs','["leg_curl_machine"]',0,5.0),
    (73,'Lat Pulldown','strength',1,'back','biceps','beginner','pull','["lat_pulldown_machine"]',1,6.0),
    (74,'Seated Cable Row','strength',1,'back','biceps,rear_delts','beginner','pull','["cable_machine"]',1,6.0),
    (75,'Chest Press Machine','strength',1,'chest','triceps,shoulders','beginner','push','["chest_press_machine"]',1,6.0),
    (76,'Shoulder Press Machine','strength',1,'shoulders','triceps','beginner','push','["shoulder_press_machine"]',1,6.0),
    (77,'Pec Deck / Butterfly','strength',1,'chest','','beginner','push','["pec_deck_machine"]',0,5.0),
    (78,'Cable Fly','strength',1,'chest','shoulders','intermediate','push','["cable_machine"]',0,5.0),
    (79,'Cable Bicep Curl','strength',1,'biceps','','beginner','pull','["cable_machine"]',0,4.0),
    (80,'Cable Tricep Pushdown','strength',1,'triceps','','beginner','push','["cable_machine"]',0,4.0),
    (81,'Cable Lateral Raise','strength',1,'shoulders','','beginner','push','["cable_machine"]',0,4.0),
    (82,'Cable Face Pull','strength',1,'rear_delts','upper_back','beginner','pull','["cable_machine"]',0,4.0),
    (83,'Smith Machine Squat','strength',1,'quads','glutes','beginner','legs','["smith_machine"]',1,7.0),
    (84,'Hack Squat','strength',1,'quads','glutes','intermediate','legs','["hack_squat_machine"]',1,8.0),
    (85,'Hip Thrust Machine','strength',1,'glutes','hamstrings','beginner','legs','["hip_thrust_machine"]',0,6.0),
    (86,'Seated Calf Raise','strength',1,'calves','','beginner','legs','["calf_raise_machine"]',0,4.0),
    (87,'Ab Crunch Machine','strength',1,'abs','','beginner','core','["ab_crunch_machine"]',0,4.0),
    (88,'Back Extension Machine','strength',1,'lower_back','glutes','beginner','core','["back_extension_machine"]',0,5.0),
    (89,'Assisted Pull-up','strength',1,'back','biceps','beginner','pull','["assisted_pullup_machine"]',1,6.0),
    -- CARDIO EQUIPMENT
    (90,'Treadmill Run','cardio',1,'full_body','legs,core','beginner','cardio','["treadmill"]',0,9.8),
    (91,'Treadmill Walk','cardio',1,'full_body','legs','beginner','cardio','["treadmill"]',0,4.0),
    (92,'Stationary Bike','cardio',1,'legs','core','beginner','cardio','["stationary_bike"]',0,7.0),
    (93,'Rowing Machine','cardio',1,'full_body','back,legs,arms','intermediate','cardio','["rowing_machine"]',1,8.5),
    (94,'Elliptical','cardio',1,'full_body','legs','beginner','cardio','["elliptical"]',0,6.0),
    (95,'Jump Rope','cardio',1,'calves','core,shoulders','beginner','cardio','["jump_rope"]',0,10.0),
    -- TRX / SUSPENSION
    (96,'TRX Row','strength',1,'back','biceps,rear_delts','intermediate','pull','["trx"]',1,6.0),
    (97,'TRX Push-up','strength',1,'chest','triceps,core','intermediate','push','["trx"]',1,7.0),
    (98,'TRX Squat','strength',1,'quads','glutes','beginner','legs','["trx"]',1,6.0),
    -- OTHER
    (99,'Medicine Ball Slam','strength',1,'core','shoulders,back','intermediate','core','["medicine_ball"]',1,9.0),
    (100,'Box Jump','cardio',1,'quads','glutes,calves','intermediate','legs','null',1,10.0);
  `);

  // ─── program_setup: add schedule columns ───────────────────────────────────
  addCol('program_setup', 'work_leave_time', 'TEXT');
  addCol('program_setup', 'wake_time', 'TEXT');
  addCol('program_setup', 'train_time', 'TEXT');
  addCol('program_setup', 'shower_time', 'TEXT');
  addCol('program_setup', 'meditate_time', 'TEXT');
  addCol('program_setup', 'bedtime', 'TEXT');

  // ─── Stretching category support ──────────────────────────────────────────
  addCol('exercise_types', 'is_stretching', 'INTEGER DEFAULT 0');

  // ─── Exercise descriptions (how-to instructions) ───────────────────────────
  addCol('exercise_types', 'description', 'TEXT');

  // ─── program_setup: add return_time, evening schedule ─────────────────────
  addCol('program_setup', 'return_time', 'TEXT');
  addCol('program_setup', 'stretch_time', 'TEXT');
  addCol('program_setup', 'meditate_eve_time', 'TEXT');

  // ─── Meditation sessions ────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS meditation_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      started_at TEXT DEFAULT (datetime('now')),
      ended_at TEXT,
      duration_mins INTEGER DEFAULT 60,
      presence_confirmed INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_presence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      train_start TEXT,
      train_end TEXT,
      reps_completed INTEGER,
      target_reps INTEGER,
      meditation_session_id INTEGER REFERENCES meditation_sessions(id),
      stretch_start TEXT,
      stretch_end TEXT,
      stretch_duration_mins INTEGER,
      UNIQUE(user_id, date)
    );
  `);

  // ─── Seed stretching exercises ─────────────────────────────────────────────
  db.exec(`
    INSERT OR IGNORE INTO exercise_types (id, name, category, is_system, muscle_group, is_stretching, required_equipment, is_compound, met_value) VALUES
      (201, 'Hip Flexor Stretch', 'custom', 1, 'hip_flexors', 1, '[]', 0, 2.5),
      (202, 'Hamstring Stretch', 'custom', 1, 'hamstrings', 1, '[]', 0, 2.5),
      (203, 'Quad Stretch', 'custom', 1, 'quads', 1, '[]', 0, 2.5),
      (204, 'Calf Stretch', 'custom', 1, 'calves', 1, '[]', 0, 2.5),
      (205, 'Shoulder Cross-Body Stretch', 'custom', 1, 'shoulders', 1, '[]', 0, 2.5),
      (206, 'Tricep Overhead Stretch', 'custom', 1, 'triceps', 1, '[]', 0, 2.5),
      (207, 'Child''s Pose', 'custom', 1, 'back', 1, '[]', 0, 2.5),
      (208, 'Cat-Cow Stretch', 'custom', 1, 'back', 1, '[]', 0, 2.5),
      (209, 'Spinal Twist', 'custom', 1, 'back', 1, '[]', 0, 2.5),
      (210, 'Pigeon Pose', 'custom', 1, 'glutes', 1, '[]', 0, 2.5),
      (211, 'Downward Dog', 'custom', 1, 'full_body', 1, '[]', 0, 2.5),
      (212, 'Cobra Stretch', 'custom', 1, 'back', 1, '[]', 0, 2.5),
      (213, 'Butterfly Stretch', 'custom', 1, 'inner_thighs', 1, '[]', 0, 2.5),
      (214, 'IT Band Stretch', 'custom', 1, 'legs', 1, '[]', 0, 2.5),
      (215, 'Chest Opener Stretch', 'custom', 1, 'chest', 1, '[]', 0, 2.5),
      (216, 'Neck Roll Stretch', 'custom', 1, 'neck', 1, '[]', 0, 2.5),
      (217, 'Side Body Stretch', 'custom', 1, 'obliques', 1, '[]', 0, 2.5),
      (218, 'Standing Forward Fold', 'custom', 1, 'hamstrings', 1, '[]', 0, 2.5),
      (219, 'Glute Bridge Stretch', 'custom', 1, 'glutes', 1, '[]', 0, 2.5),
      (220, 'Hip Circle', 'custom', 1, 'hips', 1, '[]', 0, 2.5),
      (221, 'Wrist Flexor Stretch', 'custom', 1, 'forearms', 1, '[]', 0, 2.5),
      (222, 'Ankle Circle', 'custom', 1, 'calves', 1, '[]', 0, 2.5);
  `);

  // ─── Wake presence tracking ────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS wake_presence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      scheduled_wake TEXT NOT NULL,
      marked_at TEXT,
      status TEXT DEFAULT 'pending',
      UNIQUE(user_id, date)
    );
  `);

  // ─── Training & Stretch checkin tables ────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS training_checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      checked_in_at TEXT,
      status TEXT DEFAULT 'pending',
      completed_at TEXT,
      UNIQUE(user_id, date)
    );

    CREATE TABLE IF NOT EXISTS training_exercise_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkin_id INTEGER NOT NULL REFERENCES training_checkins(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      exercise_type_id INTEGER NOT NULL,
      exercise_name TEXT NOT NULL,
      reps_done INTEGER,
      video_path TEXT,
      logged_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stretch_checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      checked_in_at TEXT,
      status TEXT DEFAULT 'pending',
      completed_at TEXT,
      UNIQUE(user_id, date)
    );
  `);

  // ─── Meditation: slot tracking for 2x30 mode ──────────────────────────────
  addCol('meditation_sessions', 'slot', "TEXT DEFAULT 'solo'");

  // ─── Training: late checkin flag + per-set weight ──────────────────────────
  addCol('training_checkins', 'late_checkin', 'INTEGER DEFAULT 0');
  addCol('training_exercise_logs', 'weight_kg', 'REAL');

  // ─── Day workout overrides (swap exercises for a specific date) ────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS day_workout_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      slot TEXT NOT NULL,
      exercise_type_id INTEGER NOT NULL,
      exercise_name TEXT NOT NULL,
      UNIQUE(user_id, date, slot)
    );
  `);

  // ─── Schedule / day plans & todos ─────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS day_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      leave_time TEXT,
      return_time TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, date)
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      text TEXT NOT NULL,
      remind_at TEXT,
      completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ─── Diary & Lessons ──────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS diary_entries (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      date       TEXT NOT NULL,
      did_best   TEXT,
      what_did   TEXT,
      proud      TEXT,
      do_better  TEXT,
      notes      TEXT,
      locked     INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, date)
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      title      TEXT NOT NULL,
      topic      TEXT NOT NULL,
      content    TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ─── Presence tracker: clock-in/out + late flag ───────────────────────────
  addCol('wake_presence', 'clocked_in_at',  'TEXT');
  addCol('wake_presence', 'clocked_out_at', 'TEXT');
  addCol('wake_presence', 'late_wakeup',    'INTEGER DEFAULT 0');

  // ─── Calendar events ───────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id),
      title        TEXT NOT NULL,
      date         TEXT NOT NULL,
      time         TEXT,
      duration_mins INTEGER,
      notes        TEXT,
      color        TEXT DEFAULT 'emerald',
      remind_mins  INTEGER DEFAULT 0,
      repeat_type  TEXT DEFAULT 'none',
      created_at   TEXT DEFAULT (datetime('now'))
    );
  `);

  // ─── Feature expansion: energy rating, PR weight, new tables ──────────────
  addCol('training_checkins', 'energy_rating', 'INTEGER DEFAULT NULL');
  addCol('personal_records',  'best_weight_kg', 'REAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS streak_reflections (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      date        TEXT NOT NULL,
      reflection  TEXT NOT NULL,
      streak_saved INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_badges (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      badge_key  TEXT NOT NULL,
      earned_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, badge_key)
    );

    CREATE TABLE IF NOT EXISTS friend_requests (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id   INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      status      TEXT DEFAULT 'pending',
      created_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(sender_id, receiver_id)
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      challenger_id  INTEGER NOT NULL,
      challenged_id  INTEGER NOT NULL,
      start_date     TEXT NOT NULL,
      end_date       TEXT NOT NULL,
      status         TEXT DEFAULT 'active',
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL,
      endpoint     TEXT NOT NULL,
      keys_p256dh  TEXT NOT NULL,
      keys_auth    TEXT NOT NULL,
      created_at   TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, endpoint)
    );
  `);

  // ─── Xiaomi Smart Band 9 Active biometric tables ──────────────────────────
  db.exec(`
    -- Band workout/sport sessions (50 sport modes) — defined first for FK use below
    CREATE TABLE IF NOT EXISTS band_workout_sessions (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id            INTEGER NOT NULL REFERENCES users(id),
      sport_type         TEXT NOT NULL,
      started_at         TEXT NOT NULL,
      ended_at           TEXT,
      duration_secs      INTEGER,
      distance_km        REAL,
      calories_kcal      REAL,
      avg_hr             INTEGER,
      max_hr             INTEGER,
      min_hr             INTEGER,
      avg_pace_min_km    REAL,
      avg_speed_kmh      REAL,
      cadence_spm        REAL,
      steps              INTEGER,
      aerobic_effect     REAL,
      anaerobic_effect   REAL,
      training_load      REAL,
      recovery_time_mins INTEGER,
      source             TEXT NOT NULL DEFAULT 'band'
                         CHECK(source IN ('band','manual')),
      notes              TEXT,
      created_at         TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_band_sessions_user ON band_workout_sessions(user_id, started_at);

    -- Heart rate time-series (all-day monitoring + workout readings)
    CREATE TABLE IF NOT EXISTS hr_readings (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id            INTEGER NOT NULL REFERENCES users(id),
      recorded_at        TEXT NOT NULL DEFAULT (datetime('now')),
      bpm                INTEGER NOT NULL,
      context            TEXT DEFAULT 'resting'
                         CHECK(context IN ('resting','active','workout','sleep','manual')),
      workout_session_id INTEGER REFERENCES band_workout_sessions(id),
      source             TEXT NOT NULL DEFAULT 'band'
                         CHECK(source IN ('band','manual')),
      created_at         TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hr_user_at ON hr_readings(user_id, recorded_at);

    -- SpO2 / blood oxygen readings
    CREATE TABLE IF NOT EXISTS spo2_readings (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL REFERENCES users(id),
      recorded_at     TEXT NOT NULL DEFAULT (datetime('now')),
      spo2_pct        REAL NOT NULL,
      alert_triggered INTEGER DEFAULT 0,
      context         TEXT DEFAULT 'resting'
                      CHECK(context IN ('resting','sleep','workout','manual')),
      source          TEXT NOT NULL DEFAULT 'band'
                      CHECK(source IN ('band','manual')),
      created_at      TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_spo2_user_at ON spo2_readings(user_id, recorded_at);

    -- Stress readings (manual ~1 min HRV measurement via band)
    CREATE TABLE IF NOT EXISTS stress_readings (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id),
      recorded_at  TEXT NOT NULL DEFAULT (datetime('now')),
      stress_score INTEGER NOT NULL CHECK(stress_score BETWEEN 0 AND 100),
      hrv_ms       REAL,
      notes        TEXT,
      source       TEXT NOT NULL DEFAULT 'band'
                   CHECK(source IN ('band','manual')),
      created_at   TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_stress_user_at ON stress_readings(user_id, recorded_at);

    -- Skin temperature readings (24/7 continuous from band)
    CREATE TABLE IF NOT EXISTS skin_temp_readings (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id),
      recorded_at  TEXT NOT NULL DEFAULT (datetime('now')),
      temp_c       REAL NOT NULL,
      temp_delta_c REAL,
      source       TEXT NOT NULL DEFAULT 'band'
                   CHECK(source IN ('band','manual')),
      created_at   TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_skin_temp_user_at ON skin_temp_readings(user_id, recorded_at);

    -- Sleep sessions (one main sleep per night + naps tracked separately)
    CREATE TABLE IF NOT EXISTS sleep_sessions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id          INTEGER NOT NULL REFERENCES users(id),
      date             TEXT NOT NULL,
      sleep_start      TEXT,
      sleep_end        TEXT,
      total_mins       INTEGER,
      deep_mins        INTEGER,
      light_mins       INTEGER,
      rem_mins         INTEGER,
      awake_mins       INTEGER,
      quality_score    INTEGER CHECK(quality_score BETWEEN 0 AND 100),
      breathing_score  INTEGER CHECK(breathing_score BETWEEN 0 AND 100),
      apnea_events     INTEGER DEFAULT 0,
      respiratory_rate REAL,
      is_nap           INTEGER DEFAULT 0,
      sleep_animal     TEXT,
      source           TEXT NOT NULL DEFAULT 'band'
                       CHECK(source IN ('band','manual')),
      notes            TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sleep_user_date ON sleep_sessions(user_id, date);

    -- Daily activity summary (steps, calories, distance, standing)
    CREATE TABLE IF NOT EXISTS daily_activity (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL REFERENCES users(id),
      date            TEXT NOT NULL,
      steps           INTEGER DEFAULT 0,
      distance_km     REAL DEFAULT 0,
      calories_kcal   REAL DEFAULT 0,
      standing_mins   INTEGER DEFAULT 0,
      active_mins     INTEGER DEFAULT 0,
      vitality_points REAL DEFAULT 0,
      source          TEXT NOT NULL DEFAULT 'band'
                      CHECK(source IN ('band','manual')),
      created_at      TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_activity_user_date ON daily_activity(user_id, date);

    -- Training fitness metrics snapshot (VO2 max, load, recovery — one per day)
    CREATE TABLE IF NOT EXISTS training_fitness_metrics (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id            INTEGER NOT NULL REFERENCES users(id),
      date               TEXT NOT NULL,
      vo2_max            REAL,
      training_load      REAL,
      recovery_time_mins INTEGER,
      aerobic_effect     REAL,
      anaerobic_effect   REAL,
      source             TEXT NOT NULL DEFAULT 'band'
                         CHECK(source IN ('band','manual','calculated')),
      created_at         TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_fitness_user_date ON training_fitness_metrics(user_id, date);

    -- Band sync log (track each sync: what came in, device state)
    CREATE TABLE IF NOT EXISTS band_sync_log (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id          INTEGER NOT NULL REFERENCES users(id),
      synced_at        TEXT NOT NULL DEFAULT (datetime('now')),
      records_hr       INTEGER DEFAULT 0,
      records_spo2     INTEGER DEFAULT 0,
      records_stress   INTEGER DEFAULT 0,
      records_sleep    INTEGER DEFAULT 0,
      records_activity INTEGER DEFAULT 0,
      records_workouts INTEGER DEFAULT 0,
      device_id        TEXT,
      firmware_ver     TEXT,
      battery_pct      INTEGER,
      notes            TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    );
  `);

  // ─── Schedule: shower/work/home check-in timestamps on day_plans ─────────
  addCol('day_plans', 'shower_started_at',  'TEXT');
  addCol('day_plans', 'shower_completed_at','TEXT');
  addCol('day_plans', 'arrived_work_at',    'TEXT');
  addCol('day_plans', 'lunch_started_at',   'TEXT');
  addCol('day_plans', 'lunch_ended_at',     'TEXT');
  addCol('day_plans', 'left_work_at',       'TEXT');
  addCol('day_plans', 'arrived_home_at',    'TEXT');

  // ─── Calendar events: soft-cancel flag ───────────────────────────────────
  addCol('calendar_events', 'is_canceled', 'INTEGER DEFAULT 0');

  // ─── Work timer (pause/resume) + home late penalty ────────────────────────
  addCol('day_plans', 'work_paused_secs',  'INTEGER DEFAULT 0');
  addCol('day_plans', 'work_paused_since', 'TEXT');
  addCol('day_plans', 'home_late',         'INTEGER DEFAULT 0');

  // ─── Calendar: event type (appointment vs reminder) ───────────────────────
  addCol('calendar_events', 'event_type', "TEXT DEFAULT 'appointment'");

  // ─── Muscle load history (recovery-aware programming) ────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS muscle_load_history (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id),
      date         TEXT NOT NULL,
      muscle_group TEXT NOT NULL,
      load_units   REAL NOT NULL DEFAULT 0,
      UNIQUE(user_id, date, muscle_group)
    );
  `);

    // ─── Seed comprehensive exercises + descriptions ─────────────────────────

  // ── Running progress tracking ──────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS running_progress (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id             INTEGER NOT NULL REFERENCES users(id),
      attempt_id          INTEGER NOT NULL REFERENCES program_attempts(id),
      run_number          INTEGER NOT NULL,
      target_distance_km  REAL    NOT NULL,
      is_recovery_run     INTEGER NOT NULL DEFAULT 0,
      completed_at        TEXT,
      actual_distance_km  REAL,
      UNIQUE(user_id, attempt_id, run_number)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS work_sessions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id          INTEGER NOT NULL REFERENCES users(id),
      started_at       TEXT    NOT NULL,
      ended_at         TEXT    NOT NULL,
      duration_seconds INTEGER NOT NULL,
      date             TEXT    NOT NULL
    )
  `);

  const { seedExercises } = require('./exerciseSeeds');
  seedExercises(db);

  // ─── program_setup: cold plunge time ──────────────────────────────────────
  addCol('program_setup', 'cold_plunge_time', 'TEXT');
  addCol('day_plans', 'cold_plunge_done_at', 'TEXT');

  // ─── workout_logs: weight tracking for Chess Board sessions ───────────────
  addCol('workout_logs', 'weight_kg', 'REAL');


  // ─── New 60-day program v2: strikes + custom tasks ────────────────────────
  addCol('program_attempts', 'strikes', 'INTEGER DEFAULT 0');

  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_tasks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id),
      name         TEXT NOT NULL,
      icon         TEXT DEFAULT '📌',
      duration_mins INTEGER NOT NULL DEFAULT 15,
      time_of_day  TEXT NOT NULL,
      sort_order   INTEGER DEFAULT 0,
      created_at   TEXT DEFAULT (datetime('now'))
    )
  `);

  console.log('Migrations complete.');
}

module.exports = { runMigrations };
