CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  title TEXT NOT NULL DEFAULT '',
  images_json TEXT NOT NULL DEFAULT '{}',
  social_json TEXT NOT NULL DEFAULT '{}'
);
INSERT OR IGNORE INTO settings(id,title,images_json,social_json) VALUES(1,'','{}','{}');

CREATE TABLE IF NOT EXISTS students (
  regno TEXT PRIMARY KEY,
  dob TEXT NOT NULL,
  name TEXT DEFAULT '',
  father TEXT DEFAULT '',
  mother TEXT DEFAULT '',
  course TEXT DEFAULT '',
  courseCode TEXT DEFAULT '',
  period TEXT DEFAULT '',
  duration TEXT DEFAULT '',
  marks TEXT DEFAULT '',
  grade TEXT DEFAULT '',
  center TEXT DEFAULT '',
  photo TEXT DEFAULT ''
);
