-- schema.sql

-- Table to store user/session information
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY, -- Automatically generates a unique ID
    user_name VARCHAR(255) NOT NULL,
    ethnic_group VARCHAR(100),
    education_level VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table to store the AI-generated summaries and interactions
CREATE TABLE interactions (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES sessions(id), -- Links to a session
    feature_title VARCHAR(255),
    user_input TEXT,
    ai_output TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);