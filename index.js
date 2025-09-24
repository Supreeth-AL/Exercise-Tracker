require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');

app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));


// ----- Schema & Models -----
const userSchema = new mongoose.Schema({
  username: { type: String, required: true }
});

const exerciseSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, required: true }
});

const User = mongoose.model('User', userSchema);
const Exercise = mongoose.model('Exercise', exerciseSchema);

// ----- API Endpoints -----

// 1. Create new user
app.post('/api/users', async (req, res) => {
  const username = req.body.username;
  if (!username) return res.json({ error: 'Username is required' });

  try {
    const newUser = new User({ username });
    const savedUser = await newUser.save();
    res.json({ username: savedUser.username, _id: savedUser._id });
  } catch (err) {
    res.json({ error: 'Could not create user' });
  }
});

// 2. Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({});
    const userList = users.map(u => ({ username: u.username, _id: u._id }));
    res.json(userList);
  } catch (err) {
    res.json({ error: 'Could not fetch users' });
  }
});

// 3. Add exercise for a user
app.post('/api/users/:_id/exercises', async (req, res) => {
  const { description, duration, date } = req.body;
  const userId = req.params._id;

  if (!description || !duration) {
    return res.json({ error: 'Description and duration are required' });
  }

  const exerciseDate = date ? new Date(date) : new Date();
  if (exerciseDate.toString() === 'Invalid Date') {
    return res.json({ error: 'Invalid date' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.json({ error: 'User not found' });

    const newExercise = new Exercise({
      userId,
      description,
      duration: parseInt(duration),
      date: exerciseDate
    });

    const savedExercise = await newExercise.save();

    res.json({
      _id: user._id,
      username: user.username,
      date: savedExercise.date.toDateString(),
      duration: savedExercise.duration,
      description: savedExercise.description
    });
  } catch (err) {
    res.json({ error: 'Could not add exercise' });
  }
});

// 4. Get user's exercise log
app.get('/api/users/:_id/logs', async (req, res) => {
  const userId = req.params._id;
  const { from, to, limit } = req.query;

  try {
    const user = await User.findById(userId);
    if (!user) return res.json({ error: 'User not found' });

    let filter = { userId };

    if (from || to) filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);

    let query = Exercise.find(filter).select('description duration date -_id').sort({ date: 1 });
    if (limit) query = query.limit(parseInt(limit));

    const exercises = await query.exec();

    const log = exercises.map(e => ({
      description: e.description,
      duration: e.duration,
      date: e.date.toDateString()
    }));

    res.json({
      _id: user._id,
      username: user.username,
      count: log.length,
      log
    });
  } catch (err) {
    res.json({ error: 'Could not fetch logs' });
  }
});

// ----- Start Server -----
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
