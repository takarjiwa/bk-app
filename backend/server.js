// server.js

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const serverless = require('serverless-http'); // <-- Import serverless-http

require('dotenv').config();

const app = express();
// NOTE: We don't need the port constant anymore
// const port = process.env.PORT || 3000;

// --- Database Connection ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// We can remove the testConnection() and setupDatabase() functions
// as they are not ideal for a serverless environment that can start up frequently.
// It's better to assume the DB is ready. You already set up the schema in Supabase.

app.use(cors());
app.use(express.json());

// --- API Endpoints (No changes needed here) ---

// This is a good practice for serverless: define a base router
const router = express.Router();

// Endpoint to create a new session
router.post('/sessions', async (req, res) => {
  try {
    const { userName, ethnicGroup, educationLevel } = req.body;
    const result = await pool.query(
      'INSERT INTO sessions (user_name, ethnic_group, education_level) VALUES ($1, $2, $3) RETURNING id',
      [userName, ethnicGroup, educationLevel]
    );
    res.status(201).json({ sessionId: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to save an AI interaction
router.post('/interactions', async (req, res) => {
    try {
        const { sessionId, featureTitle, userInput, aiOutput } = req.body;
        await pool.query(
            'INSERT INTO interactions (session_id, feature_title, user_input, ai_output) VALUES ($1, $2, $3, $4)',
            [sessionId, featureTitle, userInput, aiOutput]
        );
        res.status(201).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint to handle Gemini API calls securely
router.post('/gemini', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    // Use the native fetch included in recent Node.js versions
    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
    });

    if (!geminiResponse.ok) {
      console.error('Gemini API Error:', await geminiResponse.text());
      throw new Error(`Gemini API failed`);
    }
    const data = await geminiResponse.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// All API routes will be prefixed with '/api'
app.use('/api', router);

// --- EXPORT THE HANDLER FOR NETLIFY ---
// This is the crucial part that wraps the Express app
module.exports.handler = serverless(app);
