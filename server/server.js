const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5000;

// Supabase client initialization
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the React app (in production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

// API routes
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Digital Calendar API!' });
});

// Test Supabase connection
app.get('/api/test-supabase', async (req, res) => {
  try {
    // Try to fetch one row from a table (adjust table name as needed)
    const { data, error } = await supabase
      .from('calendar_events') // Assuming you have a calendar_events table
      .select('*')
      .limit(1);
    
    if (error) {
      // If table doesn't exist yet, we can still check if connection works
      // by trying a simple query or checking the client
      res.json({ 
        connected: true, 
        message: 'Supabase client initialized successfully',
        note: 'Table query failed - ensure table exists or adjust table name',
        error: error.message 
      });
    } else {
      res.json({ 
        connected: true, 
        message: 'Supabase connection successful',
        data: data 
      });
    }
  } catch (err) {
    res.status(500).json({ 
      connected: false, 
      message: 'Failed to connect to Supabase',
      error: err.message 
    });
  }
});

// Handle React routing, return all requests to React app
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
