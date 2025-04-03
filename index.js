import express from 'express';
import { Server } from 'socket.io';
import Room from './Room.js';

const ADMIN = 'Admin';
const MIN_USERS = 2;
const PORT = process.env.PORT || 5000;
const app = express();

const expressServer = app.listen(PORT, () => {
  console.log('Server Listening on Port ' + PORT);
});

const Users = {
  users: [],
  setUsers: function (newUsersArray) {
    this.users = newUsersArray;
  },
};

let rooms = [];

const io = new Server(expressServer, {
  cors: {
    origin:
      process.env.NODE_ENV === 'production'
        ? '*'
        : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  },
});

io.on('connection', (socket) => {
  console.log(`User ${socket.id} connected`);

  if (rooms.length > 0) {
    console.log('sending open rooms to new client!');
    socket.emit('roomsList', getOpenRooms());
  }

  socket.on('createRoom', ({ name, roomName }) => {
    if (getRoom(roomName)) {
      socket.emit(
        'error',
        'A room with that name already exists, please try again!'
      );
    } else {
      const newUser = activateUser(socket.id, name, roomName);
      const newRoom = createRoom(roomName, newUser);

      socket.join(newRoom.name);

      socket.emit('joinedRoom', newRoom);

      console.log('resending rooms to all clients after new one is made!');
      io.emit('roomsList', getOpenRooms());
    }
  });

  socket.on('joinRoom', ({ name, roomName }) => {
    const newUser = activateUser(socket.id, name, roomName);
    const room = getRoom(roomName);
    room.addUser(newUser);
    socket.join(roomName);
    socket.emit('joinedRoom', room);

    io.to(newUser.room).emit('updateRoom', room);

    if (room.users.length >= MIN_USERS) {
      io.to(room.adminId).emit('ready');
    }
  });

  socket.on('startRoom', (roomName) => {
    getRoom(roomName)?.startRoom();
    socket.broadcast.to(roomName).emit('chatStarted');
    io.emit('roomsList', getOpenRooms());
  });

  socket.on('leaveRoom', () => {
    const user = getUser(socket.id);

    if (user) {
      removeUser(user);
      io.to(user.room).emit(
        'message',
        buildMessage(ADMIN, `${user.name} has left the room.`)
      );
      io.to(user.room).emit('updateRoom', getRoom(user.room));

      io.emit('roomsList', getOpenRooms());
    }
    console.log(`User ${socket.id} disconnected`);
  });

  //when user disconnects - send message to all others
  socket.on('disconnect', () => {
    const user = getUser(socket.id);

    if (user) {
      removeUser(user);
      io.to(user.room).emit(
        'message',
        buildMessage(ADMIN, `${user.name} has left the room.`)
      );
      io.to(user.room).emit('updateRoom', getRoom(user.room));

      io.emit('roomsList', getOpenRooms());
    }
    console.log(`User ${socket.id} disconnected`);
  });

  socket.on('message', ({ text }) => {
    const user = getUser(socket.id);
    if (user) {
      const room = getRoom(user.room);
      if (room) {
        const msg = buildMessage(user.name, text);
        io.to(room.name).emit('message', msg);
      }
    }
  });
});

function buildMessage(name, text) {
  return {
    name,
    text,
    time: new Intl.DateTimeFormat('default', {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).format(new Date()),
  };
}

function getUser(id) {
  return Users.users.find((user) => user.id === id);
}

function getRoom(roomName) {
  return rooms.find((room) => room.name === roomName);
}

function getOpenRooms() {
  return rooms.filter((room) => !room.started);
}

function activateUser(id, name, room) {
  const user = { id, name, room };
  Users.setUsers([...Users.users.filter((user) => user.id !== id), user]);
  return user;
}

function removeUser(leaver) {
  Users.setUsers(Users.users.filter((user) => user.id !== leaver.id));
  getRoom(leaver.room)?.removeUser(leaver);
  deleteEmptyRooms();
}

function createRoom(name, admin) {
  const room = new Room(name, admin);
  rooms.push(room);
  return room;
}

function deleteEmptyRooms() {
  rooms = rooms.filter((r) => {
    return r.users.length > 0;
  });
}
