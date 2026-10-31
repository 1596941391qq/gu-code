CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, time_updated INTEGER, data TEXT);
INSERT INTO message VALUES ('msg_1','ses_1',__TSN__,__TSN__,'{"role":"user","time":{"created":__TSN__}}');
INSERT INTO message VALUES ('msg_2','ses_1',__TSN__,__TSN__,'{"role":"assistant","modelID":"glm-4.6","providerID":"zai","tokens":{"input":400,"output":60,"reasoning":10,"cache":{"read":3000,"write":100}},"cost":0}');
