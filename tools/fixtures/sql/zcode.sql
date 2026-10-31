CREATE TABLE session (id TEXT PRIMARY KEY, directory TEXT);
CREATE TABLE model_usage (id INTEGER PRIMARY KEY, session_id TEXT, turn_id TEXT, model_id TEXT, input_tokens INTEGER, output_tokens INTEGER, reasoning_tokens INTEGER, cache_creation_input_tokens INTEGER, cache_read_input_tokens INTEGER, started_at INTEGER, completed_at INTEGER);
CREATE TABLE tool_usage (id INTEGER PRIMARY KEY, session_id TEXT, turn_id TEXT, tool_name TEXT, started_at INTEGER);
INSERT INTO model_usage VALUES (1,'s','t1','GLM-5.2',5000,300,50,200,4000,__TSN__,__TSN__);
INSERT INTO model_usage VALUES (2,'s','t2','GLM-5.2',800,100,0,0,0,__TSN__,__TSN__);
INSERT INTO tool_usage VALUES (1,'s','t1','Bash',__TSN__);
INSERT INTO tool_usage VALUES (2,'s','t2','Edit',__TSN__);
