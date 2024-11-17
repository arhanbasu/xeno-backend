const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const cors = require('cors');
app.use(cors());

const JWT_SECRET = 'your_jwt_secret'; // Replace with a strong secret key

const port = process.env.PORT || 5000;

// Database Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'xeno', // Replace with your DB user
    password: 'xeno12345', // Replace with your DB password
    database: 'crm' // Replace with your database name
});

db.connect(err => {
    if (err) throw err;
    console.log('Connected to database');
});

// Register Admin
app.post('/admin/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `INSERT INTO admins (name, email, password) VALUES (?, ?, ?)`;
    db.query(query, [name, email, hashedPassword], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error registering admin' });
        res.status(201).json({ message: 'Admin registered successfully' });
    });
});

// Admin Login
app.post('/admin/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const query = `SELECT * FROM admins WHERE email = ?`;
    db.query(query, [email], async (err, results) => {
        if (err || results.length === 0) return res.status(401).json({ message: 'Invalid email or password' });

        const admin = results[0];
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

        const token = jwt.sign({ id: admin.id }, JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: 'Login successful', token, name: admin.name});
    });
});

// Middleware to Verify Admin
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ message: 'Token is required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
}

// Filter Customers
app.post('/customers/filter', authenticateToken, (req, res) => {
    const { totalSpent, visits, lastVisit } = req.body;

    let query = `SELECT COUNT(*) AS audience FROM customers WHERE 1=1`;
    const params = [];

    if (totalSpent) {
        query += ` AND total_spent >= ?`;
        params.push(totalSpent);
    }
    if (visits) {
        query += ` AND visits >= ?`;
        params.push(visits);
    }
    if (lastVisit) {
        query += ` AND last_visit <= ?`;
        params.push(lastVisit);
    }

    db.query(query, params, (err, results) => {
        if (err) return res.status(500).json({ message: 'Error fetching customers' });
        res.status(200).json({ audience: results[0].audience });
    });
});


// Get Communication Log
app.get('/admin/communication-log', authenticateToken, (req, res) => {
    const query = `SELECT name, message, created_at FROM communication_log ORDER BY created_at DESC`;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ message: 'Error fetching communication log' });
        res.status(200).json(results);
    });
});

// Add a Message to Communication Log
app.post('/admin/communication-log', authenticateToken, (req, res) => {
    const { name, message } = req.body;

    if (!name || !message) {
        return res.status(400).json({ message: 'Name and message are required' });
    }

    const query = `INSERT INTO communication_log (name, message) VALUES (?, ?)`;
    db.query(query, [name, message], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error saving message' });
        res.status(201).json({ message: 'Message logged successfully!' });
    });
});



// Start Server
app.listen(port, () => {
    console.log('Server is running on port 5000');
});



