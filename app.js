<<<<<<< HEAD
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const path = require('path');

require('./config/passport');

const app = express();

mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URL }),
    cookie: { maxAge: 24 * 60 * 60 * 1000, secure: true, sameSite: 'lax' }
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/index.html?error=login_failed' }), (req, res) => {
    res.redirect('/home');
});

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));
app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/index.html?error=login_failed' }), (req, res) => {
    res.redirect('/home');
});

app.get('/auth/logout', (req, res) => {
    req.logout((err) => {
        res.redirect('/');
    });
});

app.get('/api/current_user', (req, res) => {
    if (!req.user) return res.json(null);
    res.json({
        id: req.user._id.toString(),
        name: req.user.name,
        email: req.user.email || null
    });
});
app.get('/home', (req, res) => res.redirect('/'));

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
=======
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const path = require('path');

require('./config/passport');

const app = express();

mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URL }),
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/index.html?error=login_failed' }), (req, res) => {
    res.redirect('/home');
});

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));
app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/index.html?error=login_failed' }), (req, res) => {
    res.redirect('/home');
});

app.get('/auth/logout', (req, res) => {
    req.logout((err) => {
        res.redirect('/');
    });
});

app.get('/api/current_user', (req, res) => {
    if (!req.user) return res.json(null);
    res.json({
        id: req.user._id.toString(),
        name: req.user.name,
        email: req.user.email || null
    });
});
app.get('/home', (req, res) => res.redirect('/'));

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
>>>>>>> 0d2c8ec (first commit)
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));