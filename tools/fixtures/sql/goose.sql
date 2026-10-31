CREATE TABLE sessions (id TEXT PRIMARY KEY, created_at TEXT, accumulated_input_tokens INTEGER, accumulated_output_tokens INTEGER, accumulated_total_tokens INTEGER);
INSERT INTO sessions VALUES ('g1','2026-10-31',1000,200,1200);
