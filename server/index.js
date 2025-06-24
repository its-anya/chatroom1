const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketIO = require('socket.io');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const Message = require('./models/messages');

const app = express();
const server = http.createServer(app);

// Allow both local and deployed frontend
const allowedOrigins = [
  'http://localhost:3000',
  'https://chatroom1-6.onrender.com'// <-- add your deployed frontend domain here if different
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// Health check for Render
app.get('/', (req, res) => res.send('Server is running!'));

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

const io = socketIO(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const users = new Map();

io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  socket.on('register-user', (username) => {
    users.set(username, socket.id);
    socket.username = username; // Save for disconnect and signaling
    console.log(`✅ Registered user ${username} with socket ID ${socket.id}`);
  });

  // Send all messages to the newly connected user
  Message.find().sort({ timestamp: 1 }).then(messages => {
    socket.emit('loadMessages', messages);
  });

  // Handle text message
  socket.on('chatMessage', async (msg) => {
    try {
      const message = new Message({
        sender: msg.sender,
        content: msg.content,
        type: 'text',
        timestamp: new Date()
      });
      await message.save();
      io.emit('chatMessage', message);
    } catch (error) {
      console.error('❌ Error saving message:', error);
    }
  });

  // Handle file message
  socket.on('chatFile', async (msg) => {
    try {
      const message = new Message({
        sender: msg.sender,
        content: msg.content,
        type: 'file',
        timestamp: new Date()
      });
      await message.save();
      io.emit('chatFile', message);
    } catch (error) {
      console.error('❌ Error saving file message:', error);
    }
  });

  // Handle message deletion
  socket.on('deleteMessage', async (messageId) => {
    try {
      await Message.findByIdAndDelete(messageId);
      io.emit('deleteMessage', messageId);
    } catch (error) {
      console.error('❌ Error deleting message:', error);
    }
  });

  // --- Audio Call Signaling Events ---
  socket.on('call-user', ({ targetId, offer, caller }) => {
    const targetSocket = users.get(targetId);
    if (targetSocket) {
      io.to(targetSocket).emit('incoming-call', { from: socket.username, offer, caller: socket.username });
    }
  });

  socket.on('answer-call', ({ targetId, answer }) => {
    const targetSocket = users.get(targetId);
    if (targetSocket) {
      io.to(targetSocket).emit('call-answered', { answer });
    }
  });

  socket.on('ice-candidate', ({ targetId, candidate }) => {
    const targetSocket = users.get(targetId);
    if (targetSocket) {
      io.to(targetSocket).emit('ice-candidate', { candidate });
    }
  });

  // Handle call rejection
  socket.on('reject-call', ({ targetId }) => {
    const targetSocket = users.get(targetId);
    if (targetSocket) {
      io.to(targetSocket).emit('call-rejected');
    }
  });

  // End call for the other peer only
  socket.on('end-call', ({ targetId }) => {
    const targetSocket = users.get(targetId);
    if (targetSocket) {
      io.to(targetSocket).emit('end-call');
    }
  });

  socket.on('disconnect', () => {
    for (const [user, id] of users.entries()) {
      if (id === socket.id) {
        users.delete(user);
        console.log(`❌ ${user} disconnected`);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
