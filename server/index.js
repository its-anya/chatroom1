const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketIO = require('socket.io');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

const __dirname1=path.resolve();
if (process.env.NODE_ENV==="production"){

  app.use(express.static(path.join(__dirname1,"/client/build")));

  app.get("*",(req,res)=>{
    res.sendFile(path.resolve(__dirname1,"client","build","index.html"));
  });
}
else{
  app.get("/",(req,res)=>{
    res.send("API is running successfully");
  });
}
// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB error:', err));

// Socket.IO
const io = socketIO(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('🔌 New user connected');

  // Handle text messages
  socket.on('chatMessage', (msg) => {
    io.emit('chatMessage', msg);
  });

  // ✅ Handle file messages
  socket.on('chatFile', (msg) => {
    io.emit('chatFile', msg);
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected');
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
