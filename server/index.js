const { Server } = require("socket.io");
const PORT = process.env.PORT || 3001;
const io = new Server(PORT, {
  cors: {
    origin: "*",
  },
});

const rooms = {};
const roomSettings = {};
const kickedPlayers = {}; // حفظ المطرودين من كل روم

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, name }) => {
    if (!rooms[roomId]) rooms[roomId] = [];
    if (!kickedPlayers[roomId]) kickedPlayers[roomId] = [];

    const isKicked = kickedPlayers[roomId].includes(name);
    if (isKicked) return;

    if (!rooms[roomId].some((p) => p.name === name)) {
      rooms[roomId].push({ name });
    }

    socket.join(roomId);
    io.to(roomId).emit("room-players", rooms[roomId]);
  });

  socket.on("check-room", (roomId, callback) => {
    const exists = !!rooms[roomId];
    callback(exists);
  });

  socket.on("kick-player", ({ roomId, name }) => {
    if (!rooms[roomId]) return;

    // إزالة اللاعب من الغرفة
    rooms[roomId] = rooms[roomId].filter((p) => p.name !== name);
    kickedPlayers[roomId].push(name);

    io.to(roomId).emit("room-players", rooms[roomId]);
  });

  socket.on("start-game", (roomId, settings) => {
    const players = rooms[roomId] || [];
    const playerNames = players.map((p) => p.name);
    roomSettings[roomId] = settings;

    const roles = assignRoles(playerNames, settings);
    const playerData = players.map((player) => {
      const found = roles.find((r) => r.name === player.name);
      return { name: player.name, role: found?.role || "citizen" };
    });

    rooms[roomId] = playerData;

    io.to(roomId).emit("room-players", playerData);
    playerData.forEach(({ name, role }) => {
      io.to(roomId).emit("assign-role", { name, role });
    });
  });
});

console.log(`🚀 Socket.IO server running at http://localhost:${PORT}`);

function assignRoles(players, settings) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const roles = [];

  const mafiaCount = settings.mafiaCount;
  let current = 0;

  // إذا الهوست مفعل "أنا حكم" لا نوزع له دور، نخزنه ونكمل
  const judge = settings.judgeHost ? shuffled.shift() : null;

  if (mafiaCount >= 1 && shuffled.length >= current + 1)
    roles.push({ name: shuffled[current++], role: "mafia-leader" });
  if (mafiaCount >= 2 && shuffled.length >= current + 1)
    roles.push({ name: shuffled[current++], role: "mafia-police" });
  for (let i = 2; i < mafiaCount && current < shuffled.length; i++) {
    roles.push({ name: shuffled[current++], role: "mafia" });
  }

  const specialRoles = ["police", "sniper", "doctor"];
  for (let role of specialRoles) {
    if (current < shuffled.length) {
      roles.push({ name: shuffled[current++], role });
    }
  }

  for (let i = current; i < shuffled.length; i++) {
    roles.push({ name: shuffled[i], role: "citizen" });
  }

  if (judge) {
    roles.push({ name: judge, role: "observer" });
  }

  return roles;
}
