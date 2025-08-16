// server.js

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// --- Database Connection ---
// This now connects to your Supabase database using the connection string from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test the connection to Supabase
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Supabase database connection successful!');
    console.log('Current time from database:', result.rows[0].now);
  } catch (err) {
    console.error('❌ Supabase database connection failed:', err.message);
    process.exit(1);
  }
}

testConnection();

// REMOVED: The setupDatabase() function is no longer needed.
// You have already created the tables in the Supabase dashboard.

app.use(cors());
app.use(express.json());

// --- API Endpoints (No changes needed here) ---

// Endpoint to create a new session
app.post('/api/sessions', async (req, res) => {
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
app.post('/api/interactions', async (req, res) => {
    try {
        const { sessionId, featureTitle, userInput, aiOutput } = req.body;
        // NOTE: The table name in the query is 'interactions', which matches our SQL schema.
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

// NEW: Endpoint to handle Gemini API calls securely
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    // Securely get the API key from the .env file
    const apiKey = process.env.GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };

    // Call the real Gemini API from your server
    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
      // Log the detailed error on the server but don't send it to the client
      console.error('Gemini API Error:', await geminiResponse.text());
      throw new Error(`Gemini API failed with status: ${geminiResponse.status}`);
    }

    const data = await geminiResponse.json();

    // Send the successful response back to the frontend
    return res.status(200).json(data);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

app.get('/', (req, res) => {
  res.send('Server is up and running, connected to Supabase!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});